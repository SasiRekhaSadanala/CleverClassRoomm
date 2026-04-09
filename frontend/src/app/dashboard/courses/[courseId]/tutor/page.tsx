"use client";

import React, { useState, useRef, useEffect } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { Bot, User, Send, BrainCircuit, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

import { getAuthUser } from "@/lib/auth";

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
    { role: "assistant", content: "Hi! I am your AI Knowledge Tutor for this course. Ask a doubt like: Can you explain linked list reversal step by step?" }
  ]);
  const [input, setInput] = useState("");
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !studentId) return;

    const userMessage = input.trim();
    setInput("");
    
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.post("/chatbot/ask", {
        student_id: studentId,
        question: userMessage,
        course_id: courseId || null,
        history,
      });
      
      const answer = res.data?.answer || "I could not generate a response based on the course materials.";
      setMessages(prev => [...prev, { role: "assistant", content: answer }]);
      setSources((res.data?.sources || []) as SourceItem[]);
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
        <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
               <h2 className="text-2xl font-black text-gray-900 tracking-tight">Semantic Learning Tutor</h2>
               <p className="text-sm font-medium text-gray-500">Ask questions based on your course's materials.</p>
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
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isAssistant ? 'bg-purple-100 text-purple-600' : 'bg-blue-600 text-white'}`}>
                                    {isAssistant ? <Bot className="w-5 h-5"/> : <User className="w-5 h-5"/>}
                                </div>
                                <div className={`px-5 py-3.5 max-w-[80%] rounded-2xl text-[15px] leading-relaxed shadow-sm ${isAssistant ? 'bg-gray-100/80 text-gray-800 rounded-tl-sm border border-gray-200/60' : 'bg-blue-600 text-white rounded-tr-sm'}`}>
                                    {msg.content}
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
                          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-purple-100 text-purple-600">
                              <Bot className="w-5 h-5"/>
                          </div>
                          <div className="px-5 py-4 max-w-[80%] rounded-2xl bg-gray-100/80 text-gray-500 rounded-tl-sm border border-gray-200/60 flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> Thinking...
                          </div>
                    </motion.div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
                <form onSubmit={handleSend} className="relative flex items-center">
                    <input 
                       type="text" 
                       value={input}
                       onChange={(e) => setInput(e.target.value)}
                       placeholder="Message your Knowledge Tutor..."
                       className="w-full pl-6 pr-14 py-4 rounded-2xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all font-medium text-gray-800"
                    />
                    <button 
                       type="submit"
                       disabled={!input.trim() || loading}
                       className="absolute right-2 p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
        
        <AnimatePresence>
            {sources.length > 0 && (
                <motion.div 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 10 }}
                   className="mt-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200"
                >
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <BookOpen className="w-4 h-4" /> Class Sources Used by AI
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {sources.slice(0, 6).map((s, idx) => (
                            <a
                                key={`${s.url}-${idx}`}
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
                            >
                                {s.topic}: {s.title}
                            </a>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

      </main>
    </div>
  );
}
