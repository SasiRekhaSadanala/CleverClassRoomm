"use client";

import React, { useEffect, useState } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion } from "framer-motion";
import { BrainCircuit, Target, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

const STORAGE_KEY = "asc_student_id";

interface TopicProgressItem {
  topic: string;
  mastery_score: number;
  mastery_level: "strong" | "developing" | "weak";
  trend: "up" | "down" | "stable";
  activity_count: number;
  quiz_attempts: number;
  quiz_accuracy: number | null;
}

interface ProgressPayload {
  student_id: string;
  name: string;
  overall_mastery: number;
  topic_progress: TopicProgressItem[];
}

export default function StudentProgress() {
  const [isTeacher, setIsTeacher] = useState(false);
  const [profile, setProfile] = useState<ProgressPayload | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const auth = getAuthUser();
    if (auth?.role === "teacher") {
        setIsTeacher(true);
    }
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const sid = window.localStorage.getItem(STORAGE_KEY) || "";
      if (!sid) {
        setStatus("Join a course first to initialize your student session.");
        setProfile(null);
        return;
      }

      const res = await api.get(`/analytics/student/${sid}/progress`);
      setProfile(res.data);
      setStatus("");
    } catch (e) {
      console.error("Failed to fetch progress", e);
      setStatus("Could not load progress right now. Please try again.");
      setProfile(null);
    }
  };

  if (!profile)
    return (
      <div className="flex flex-col h-full bg-gray-50 border-t border-gray-100">
        <TopNav title="Knowledge Intelligence" />
        <main className="flex-1 p-8 flex flex-col items-center justify-center text-center">
             {isTeacher ? (
                 <div className="max-w-md">
                     <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <TrendingUp className="w-8 h-8" />
                     </div>
                     <h2 className="text-2xl font-black text-gray-900 mb-2">Classroom Analytics</h2>
                     <p className="text-gray-500 font-medium leading-relaxed">
                         As a teacher, you can view the overall class performance in the <strong className="text-blue-600">Evaluator</strong> hub. Individual student progress tracking is optimized for the learner's experience.
                     </p>
                 </div>
             ) : (
                <div className="text-sm text-gray-600">
                    {status || "Loading Profile..."}
                </div>
             )}
        </main>
      </div>
    );

  const topics = profile.topic_progress || [];
  const avgScore = profile.overall_mastery || 0;
  const strongest =
    topics.length > 0
      ? [...topics].sort((a, b) => b.mastery_score - a.mastery_score)[0]
      : null;
  const weakest =
    topics.length > 0
      ? [...topics].sort((a, b) => a.mastery_score - b.mastery_score)[0]
      : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">
      <TopNav title="Knowledge Intelligence" />
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-4">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                Global Mastery
              </p>
              <p className="text-3xl font-black text-gray-900">
                {avgScore.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mr-4">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                Strongest Concept
              </p>
              <p className="text-xl font-bold text-gray-900 truncate">
                {strongest ? strongest.topic : "N/A"}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mr-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                Needs Review
              </p>
              <p className="text-xl font-bold text-gray-900 truncate">
                {weakest ? weakest.topic : "N/A"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Topic-Level Proficiency
          </h2>
          <p className="text-gray-500 mb-8">
            Generated by Code Understanding Agent & Analytics AI.
          </p>

          <div className="space-y-6 max-w-4xl">
            {topics
              .sort((a, b) => b.mastery_score - a.mastery_score)
              .map((topic, i) => {
                // Determine color gradient based on performance
                let color = "from-emerald-400 to-emerald-600";
                let badgeColor = "bg-emerald-100 text-emerald-700";
                if (topic.mastery_score < 75) {
                  color = "from-amber-400 to-amber-500";
                  badgeColor = "bg-amber-100 text-amber-700";
                }
                if (topic.mastery_score < 50) {
                  color = "from-rose-400 to-rose-600";
                  badgeColor = "bg-rose-100 text-rose-700";
                }

                const trendText =
                  topic.trend === "up"
                    ? "Improving"
                    : topic.trend === "down"
                      ? "Dropping"
                      : "Stable";

                return (
                  <div key={topic.topic} className="relative">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-800 text-lg">
                        {topic.topic}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black ${badgeColor}`}
                      >
                        {topic.mastery_score.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {trendText} | Activity: {topic.activity_count} | Quiz
                      Attempts: {topic.quiz_attempts}
                      {topic.quiz_accuracy !== null
                        ? ` | Quiz Accuracy: ${topic.quiz_accuracy.toFixed(1)}%`
                        : ""}
                    </div>
                    <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${topic.mastery_score}%` }}
                        transition={{
                          duration: 1.5,
                          delay: i * 0.1,
                          ease: "easeOut",
                        }}
                        className={`h-full rounded-full bg-gradient-to-r ${color}`}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </main>
    </div>
  );
}
