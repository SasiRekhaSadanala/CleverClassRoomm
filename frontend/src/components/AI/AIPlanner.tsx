"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Loader2,
  Calendar,
  Target,
  ChevronRight,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

interface AIPlannerProps {
  courseId?: string;
  courseTitle?: string;
}

export default function AIPlanner({ courseId, courseTitle }: AIPlannerProps) {
  const [goal, setGoal] = useState(courseTitle ? `Master ${courseTitle}` : "");
  const [planType, setPlanType] = useState<"short_term" | "long_term">(
    "short_term",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  React.useEffect(() => {
    const sid = window.localStorage.getItem("asc_student_id") || "";
    setStudentId(sid);
  }, []);

  const generatePlan = async () => {
    if (!goal.trim()) return;
    if (!studentId) {
      setStatus(
        "Student session not found. Join a course first so planner can personalize by your performance.",
      );
      return;
    }
    setIsLoading(true);
    setGeneratedPlan(null);
    setStatus("");

    try {
      const response = await api.post(
        "/planner/generate",
        {
          subject: courseTitle || "General Study",
          goal: goal,
          style: "Balanced",
          plan_type: planType,
          student_id: studentId || undefined,
        },
        {
          timeout: 35000,
        },
      );

      if (response.data && response.data.plan) {
        setGeneratedPlan(response.data.plan);
        const band = response.data?.personalization?.readiness_band;
        const mastery = response.data?.personalization?.overall_mastery;
        if (band || mastery !== undefined) {
          setStatus(
            `Personalized using your performance profile${band ? ` (${band})` : ""}${mastery !== undefined ? ` - mastery ${mastery}%` : ""}.`,
          );
        }
      }
    } catch (error) {
      console.error("Generator failed:", error);
      setGeneratedPlan(
        "Planner request timed out. Try a shorter goal statement, then retry.",
      );
      setStatus(
        "Could not generate a live personalized plan. Showing fallback roadmap.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden flex flex-col border border-gray-100 shadow-sm mt-8">
      <div className="p-8 border-b border-gray-50 bg-gray-50/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">AI Study Planner</h2>
        </div>

        <div className="flex p-1 bg-gray-100 rounded-xl mb-6 max-w-sm">
          <button
            onClick={() => setPlanType("short_term")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
              planType === "short_term"
                ? "bg-white shadow-sm text-blue-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar className="h-4 w-4" /> 7-Day Sprint
          </button>
          <button
            onClick={() => setPlanType("long_term")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
              planType === "long_term"
                ? "bg-white shadow-sm text-indigo-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Target className="h-4 w-4" /> Strategic Roadmap
          </button>
        </div>

        <div className="space-y-4">
          {status ? (
            <p className="text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg px-3 py-2">
              {status}
            </p>
          ) : null}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
              Your Learning Goal
            </label>
            <div className="relative">
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., Understanding Neural Networks"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all pr-12"
              />
              <button
                onClick={generatePlan}
                disabled={isLoading || !goal.trim()}
                className="absolute right-2 top-1.5 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[300px] p-8 bg-white overflow-y-auto">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-64 space-y-4"
            >
              <div className="relative">
                <div className="h-12 w-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-blue-600" />
              </div>
              <p className="text-sm font-bold text-gray-400 animate-pulse">
                Architecting your{" "}
                {planType === "short_term" ? "7-day sprint" : "roadmap"}...
              </p>
            </motion.div>
          ) : generatedPlan ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="prose prose-sm max-w-none"
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {generatedPlan}
              </div>
              <div className="mt-8 pt-6 border-t border-gray-50 flex justify-end">
                <button className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <Save className="h-3 w-3" /> Note: Refreshing will clear this
                  plan
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-3 opacity-20">
              <Target className="h-12 w-12 text-gray-400" />
              <p className="text-sm font-bold uppercase tracking-widest text-gray-400">
                Generate Your Plan Above
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
