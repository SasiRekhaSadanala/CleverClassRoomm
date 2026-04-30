"use client";

import React, { useState, useRef, useEffect } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { Bot, User, Send, BrainCircuit, Loader2, Paperclip, X, FileText, Plus, MessageSquare, History, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

import { getAuthUser } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatSession = {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
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
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I am your AI Knowledge Tutor. I can help you understand course materials and review your documents. Ask me anything!" }
  ]);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingSessions, setFetchingSessions] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const auth = getAuthUser();
    if (auth) {
        setStudentId(auth.id);
        fetchSessions(auth.id);
    }
  }, [courseId]);

  const fetchSessions = async (sId: string) => {
    try {
      setFetchingSessions(true);
      const res = await api.get(`/chatbot/sessions?student_id=${sId}&course_id=${courseId}`);
      setSessions(res.data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setFetchingSessions(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/chatbot/sessions/${sessionId}`);
      setCurrentSessionId(sessionId);
      setMessages(res.data.messages);
      // On mobile, close sidebar after picking
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    } catch (error) {
      console.error("Error loading session:", error);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([
      { role: "assistant", content: "Hi! I am your AI Knowledge Tutor. I can help you understand course materials and review your documents. Ask me anything!" }
    ]);
    setSources([]);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation?")) return;
    try {
      await api.delete(`/chatbot/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) startNewChat();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

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
      let session_id = currentSessionId;

      if (fileToSend) {
        const formData = new FormData();
        formData.append("student_id", studentId);
        formData.append("question", userMessage);
        if (courseId) formData.append("course_id", courseId);
        formData.append("history", JSON.stringify(history));
        if (session_id) formData.append("session_id", session_id);
        formData.append("file", fileToSend);

        const res = await api.post("/chatbot/ask-with-file", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        answer = res.data?.answer;
        newSources = res.data?.sources || [];
        session_id = res.data?.session_id;
      } else {
        const res = await api.post("/chatbot/ask", {
          student_id: studentId,
          question: userMessage,
          course_id: courseId || null,
          history,
          session_id: session_id
        });
        answer = res.data?.answer;
        newSources = res.data?.sources || [];
        session_id = res.data?.session_id;
      }
      
      setCurrentSessionId(session_id);
      setMessages(prev => [...prev, { role: "assistant", content: answer || "I'm sorry, I couldn't generate a response." }]);
      setSources(newSources as SourceItem[]);
      
      // Refresh session list to show updated titles/sessions
      fetchSessions(studentId);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "assistant", content: "I encountered an error. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <TopNav title="Knowledge Tutor" />
      
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Sidebar */}
        <motion.aside 
          initial={false}
          animate={{ width: isSidebarOpen ? 300 : 0, opacity: isSidebarOpen ? 1 : 0 }}
          className={`bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden z-20 absolute lg:relative h-full shadow-xl lg:shadow-none`}
        >
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
            <h3 className="font-black text-gray-900 flex items-center gap-2">
                <History className="w-4 h-4 text-purple-600" /> Previous Chats
            </h3>
            <button 
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg"
            >
                <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="p-4 shrink-0">
            <button 
              onClick={startNewChat}
              className="w-full py-3 px-4 bg-purple-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-5 h-5" /> New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {fetchingSessions ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading History</span>
                </div>
            ) : sessions.length === 0 ? (
                <div className="text-center py-10 px-4">
                    <p className="text-sm font-medium text-gray-400 italic">No previous chats yet. Start one to see it here!</p>
                </div>
            ) : (
                sessions.map(s => (
                    <div 
                        key={s.id}
                        onClick={() => loadSession(s.id)}
                        className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${currentSessionId === s.id ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm' : 'hover:bg-white hover:border-gray-300 border-transparent text-gray-600'}`}
                    >
                        <MessageSquare className={`w-4 h-4 shrink-0 ${currentSessionId === s.id ? 'text-purple-600' : 'text-gray-400'}`} />
                        <span className="flex-1 text-sm font-bold truncate leading-tight">{s.title}</span>
                        <button 
                            onClick={(e) => deleteSession(e, s.id)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 rounded-md transition-all"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))
            )}
          </div>
        </motion.aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50/30 relative">
          
          {/* Toggle Sidebar Button (Floating) */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`absolute left-0 top-1/2 -translate-y-1/2 z-30 p-1.5 bg-white border border-gray-200 rounded-r-xl shadow-md text-gray-400 hover:text-purple-600 transition-all hidden lg:flex`}
          >
            {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Header Mobile Toggle */}
          <div className="lg:hidden p-4 bg-white border-b border-gray-200 flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-gray-100 rounded-xl">
                 <History className="w-5 h-5 text-gray-600" />
             </button>
             <h2 className="font-black text-gray-900 truncate">Knowledge Tutor</h2>
          </div>

          <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 lg:p-6 overflow-hidden">
            
            <div className="flex-1 bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col overflow-hidden relative">
                
                {/* Scrollable Messages */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6" ref={scrollRef}>
                    <AnimatePresence mode="popLayout">
                        {messages.map((msg, i) => {
                            const isAssistant = msg.role === "assistant";
                            return (
                                <motion.div 
                                   key={i} 
                                   initial={{ opacity: 0, y: 10 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   className={`flex gap-3 lg:gap-4 ${isAssistant ? "" : "flex-row-reverse"}`}
                                >
                                    <div className={`w-9 h-9 lg:w-10 lg:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isAssistant ? 'bg-purple-100 text-purple-600 border border-purple-200' : 'bg-blue-600 text-white'}`}>
                                        {isAssistant ? <Bot className="w-5 h-5"/> : <User className="w-5 h-5"/>}
                                    </div>
                                    <div className={`px-4 py-3 lg:px-5 lg:py-3.5 max-w-[88%] lg:max-w-[75%] rounded-2xl text-[15px] leading-relaxed shadow-sm ${isAssistant ? 'bg-gray-50 text-gray-800 rounded-tl-sm border border-gray-200/60' : 'bg-blue-600 text-white rounded-tr-sm'}`}>
                                        <div className={`prose prose-sm max-w-none ${!isAssistant ? 'text-white prose-p:text-white prose-headings:text-white prose-strong:text-blue-100' : 'prose-p:leading-relaxed prose-headings:font-black prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-0 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:text-purple-600'}`}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                    
                    {loading && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-purple-100 text-purple-600 border border-purple-200">
                                <Bot className="w-5 h-5"/>
                            </div>
                            <div className="px-5 py-4 max-w-[80%] rounded-2xl bg-gray-50 text-gray-500 rounded-tl-sm border border-gray-200/60 flex items-center gap-2 font-medium">
                                <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> Thinking...
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-2 shrink-0">
                    <AnimatePresence>
                      {selectedFile && (
                        <motion.div initial={{ opacity: 0, y: 10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} className="flex items-center gap-2 bg-purple-50 text-purple-700 px-3 py-2 rounded-xl text-sm font-bold border border-purple-100 w-max">
                          <FileText className="w-4 h-4" />
                          <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                          <button onClick={() => setSelectedFile(null)} className="ml-1 p-1 hover:bg-purple-200 rounded-md transition-colors"><X className="w-3 h-3" /></button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <form onSubmit={handleSend} className="relative flex items-center gap-2">
                        <div className="relative flex-1">
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors" title="Attach document">
                            <Paperclip className="w-5 h-5" />
                          </button>
                          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.ppt,.pptx,.txt,.py,.js,.tsx,.ts,.cpp,.java,.c,.md" />
                          <input 
                             type="text" 
                             value={input}
                             onChange={(e) => setInput(e.target.value)}
                             placeholder="Message your Knowledge Tutor..."
                             className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all font-bold text-gray-800"
                          />
                        </div>
                        <button type="submit" disabled={(!input.trim() && !selectedFile) || loading} className="p-4 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 disabled:opacity-50 transition-all shadow-sm active:scale-95">
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
