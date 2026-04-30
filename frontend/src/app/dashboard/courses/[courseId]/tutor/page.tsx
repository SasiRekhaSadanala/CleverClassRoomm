"use client";

import React, { useState, useRef, useEffect } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { Bot, User, Send, BrainCircuit, Loader2, Paperclip, X, FileText } from "lucide-react";
import { api } from "@/lib/api";

import { getAuthUser } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type SourceItem = {
  topic: string;
  title: string;
  url: string;
  type: string;
};

export default function CourseTutor() {
  const params = useParams();
  const courseId = params.courseId as string;

  const [studentId, setStudentId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I am your AI Knowledge Tutor for this course. You can ask me questions, and even attach code files, PDFs, or PPTs so I can review them!" }
  ]);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const auth = getAuthUser();
    if (auth) setStudentId(auth.id);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || loading || !studentId) return;

    const userMessage = input.trim() || "Please review the attached file.";
    const fileToSend = selectedFile;
    
    setInput("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: fileToSend ? `📎 **Attached file:** ${fileToSend.name}\n\n${userMessage}` : userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let answer = "";
      let newSources = sources;

      if (fileToSend) {
        // Use multipart/form-data for file uploads
        const formData = new FormData();
        formData.append("student_id", studentId);
        formData.append("question", userMessage);
        if (courseId) formData.append("course_id", courseId);
        formData.append("history", JSON.stringify(history));
        formData.append("file", fileToSend);

        const res = await api.post("/chatbot/ask-with-file", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        answer = res.data?.answer;
        newSources = res.data?.sources || [];
      } else {
        // Use standard JSON for text-only
        const res = await api.post("/chatbot/ask", {
          student_id: studentId,
          question: userMessage,
          course_id: courseId || null,
          history,
        });
        answer = res.data?.answer;
        newSources = res.data?.sources || [];
      }
      
      answer = answer || "I could not generate a response based on the course materials.";
      setMessages(prev => [...prev, { role: "assistant", content: answer }]);
      setSources(newSources as SourceItem[]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "assistant", content: "I encountered an error trying to process your request. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50 border-t border-gray-100">
      <TopNav title="Knowledge Tutor" />
      <main className="flex-1 p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col h-[calc(100vh-80px)]">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 shrink-0">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shadow-sm border border-purple-200">
                <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
               <h2 className="text-2xl font-black text-gray-900 tracking-tight">Class Tutor</h2>
               <p className="text-sm font-medium text-gray-500">I am here to patiently explain concepts and review your documents.</p>
            </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
                <AnimatePresence>
                    {messages.map((msg, i) => {
                        const isAssistant = msg.role === "assistant";
                        return (
                            <motion.div 
                               key={i} 
                               initial={{ opacity: 0, y: 10 }}
                               animate={{ opacity: 1, y: 0 }}
                               className={`flex gap-4 ${isAssistant ? "" : "flex-row-reverse"}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isAssistant ? 'bg-purple-100 text-purple-600 border border-purple-200' : 'bg-blue-600 text-white'}`}>
                                    {isAssistant ? <Bot className="w-5 h-5"/> : <User className="w-5 h-5"/>}
                                </div>
                                <div className={`px-5 py-3.5 max-w-[85%] lg:max-w-[75%] rounded-2xl text-[15px] leading-relaxed shadow-sm ${isAssistant ? 'bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-200/60' : 'bg-blue-600 text-white rounded-tr-sm'}`}>
                                    {isAssistant ? (
                                        <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-black prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-0 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:text-purple-600">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="prose prose-sm max-w-none text-white prose-p:text-white prose-headings:text-white prose-strong:text-blue-100">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
                
                {loading && (
                    <motion.div 
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         className="flex gap-4"
                      >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-purple-100 text-purple-600 border border-purple-200">
                              <Bot className="w-5 h-5"/>
                          </div>
                          <div className="px-5 py-4 max-w-[80%] rounded-2xl bg-gray-50 text-gray-500 rounded-tl-sm border border-gray-200/60 flex items-center gap-2 font-medium">
                              <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> Thinking patiently...
                          </div>
                    </motion.div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-2 shrink-0">
                {/* File Attachment Pill */}
                <AnimatePresence>
                  {selectedFile && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, height: 0 }} 
                      animate={{ opacity: 1, y: 0, height: 'auto' }} 
                      exit={{ opacity: 0, y: 10, height: 0 }}
                      className="flex items-center gap-2 bg-purple-50 text-purple-700 px-3 py-2 rounded-xl text-sm font-bold border border-purple-100 w-max"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                      <button onClick={() => setSelectedFile(null)} className="ml-1 p-1 hover:bg-purple-200 rounded-md transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSend} className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
                        title="Attach document or code file"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".pdf,.ppt,.pptx,.txt,.py,.js,.tsx,.ts,.cpp,.java,.c,.md" 
                      />
                      <input 
                         type="text" 
                         value={input}
                         onChange={(e) => setInput(e.target.value)}
                         placeholder="Message your Knowledge Tutor..."
                         className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all font-medium text-gray-800"
                      />
                    </div>
                    <button 
                       type="submit"
                       disabled={(!input.trim() && !selectedFile) || loading}
                       className="p-4 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors shadow-sm"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
        
      </main>
    </div>
  );
}
