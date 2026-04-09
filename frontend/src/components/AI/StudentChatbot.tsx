"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, Loader2, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Course = {
  _id: string;
  title: string;
};

type SourceItem = {
  topic: string;
  title: string;
  url: string;
  type: string;
};

export default function StudentChatbot() {
  const [studentId, setStudentId] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const auth = getAuthUser();
    if (!auth || auth.role !== "student") return;
    setStudentId(auth.id);

    const loadCourses = async () => {
      try {
        const res = await api.get(`/courses/student/${auth.id}`);
        const list = (res.data || []) as Course[];
        setCourses(list);
        if (list.length > 0) setSelectedCourseId(list[0]._id);
      } catch (e) {
        console.error("Failed to load student courses", e);
      }
    };

    loadCourses();
  }, []);

  const canAsk = useMemo(
    () => !!studentId && query.trim().length > 0,
    [studentId, query],
  );

  const askQuestion = async () => {
    if (!canAsk || loading) return;

    const userMessage: ChatMessage = { role: "user", content: query.trim() };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setQuery("");
    setLoading(true);

    try {
      const history = updated.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.post("/chatbot/ask", {
        student_id: studentId,
        question: userMessage.content,
        course_id: selectedCourseId || null,
        history,
      });

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: res.data?.answer || "I could not generate a response.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setSources((res.data?.sources || []) as SourceItem[]);
    } catch (e) {
      console.error("Chatbot request failed", e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I could not process your request right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Personalized Doubt Chatbot
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Answers are prioritized using your class topics/materials first.
          </p>
        </div>

        <div className="min-w-[230px]">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
            Course Context
          </label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
          >
            {courses.length === 0 ? (
              <option value="">No enrolled course</option>
            ) : (
              courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.title}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="border border-gray-100 rounded-xl bg-gray-50 p-4 h-[320px] overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="text-sm text-gray-500">
            Ask a doubt like: "Can you explain linked list reversal step by
            step?"
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white ml-8"
                  : "bg-white border border-gray-200 text-gray-800 mr-8"
              }`}
            >
              {msg.content}
            </div>
          ))
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              askQuestion();
            }
          }}
          placeholder="Type your doubt here..."
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-900"
        />
        <button
          onClick={askQuestion}
          disabled={!canAsk || loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-sm flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Ask
        </button>
      </div>

      {sources.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Class Sources Used
          </p>
          <div className="flex flex-wrap gap-2">
            {sources.slice(0, 6).map((s, idx) => (
              <a
                key={`${s.url}-${idx}`}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md hover:bg-blue-100"
              >
                {s.topic}: {s.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
