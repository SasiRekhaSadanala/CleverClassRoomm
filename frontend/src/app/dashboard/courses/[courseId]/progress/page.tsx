"use client";

import React, { useEffect, useState } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, 
  Medal, 
  Crown, 
  Users, 
  BrainCircuit,
  Loader2,
  TrendingUp,
  Target
} from "lucide-react";
import { api } from "@/lib/api";
import { useParams } from "next/navigation";

interface AssignmentInfo {
  id: string;
  title: string;
}

interface StudentRank {
  name: string;
  assignments: Record<string, number>;
  total: number;
}

interface LeaderboardData {
  assignments: AssignmentInfo[];
  leaderboard: StudentRank[];
}

export default function CourseDashboard() {
  const params = useParams();
  const courseId = params.courseId as string;
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseName, setCourseName] = useState("Classroom");

  useEffect(() => {
    if (courseId) {
      loadDashboard();
      loadCourseInfo();
    }
  }, [courseId]);

  const loadCourseInfo = async () => {
    try {
      const res = await api.get(`/courses/${courseId}`);
      if (res.data?.title) setCourseName(res.data.title);
    } catch (e) {
      console.error(e);
    }
  }

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/evaluator/dashboard/course/${courseId}`);
      setData(res.data);
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gray-50 border-t border-gray-100 items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Assembling Leaderboard...</p>
      </div>
    );
  }

  const leaderboard = data?.leaderboard || [];
  const assignments = data?.assignments || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#F8FAFC]">
      <TopNav title="Class Dashboard" />
      
      <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
        {/* Tutor Heading Section */}
        <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                <BrainCircuit className="w-3.5 h-3.5" /> Class Tutor
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-2">
                {courseName}
            </h1>
            <p className="text-slate-400 font-medium">Real-time performance rankings based on AI evaluation.</p>
        </div>

        {/* Top 3 Podium (Optional Visualization) */}
        {leaderboard.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-12 items-end max-w-2xl mx-auto">
                {/* 2nd Place */}
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-slate-200 rounded-2xl flex items-center justify-center mb-2 shadow-sm border-2 border-white relative">
                        <Medal className="w-8 h-8 text-slate-400"/>
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-500 text-white rounded-full flex items-center justify-center text-[10px] font-black">2</div>
                    </div>
                    <p className="text-xs font-black text-slate-600 truncate w-full text-center">{leaderboard[1].name}</p>
                    <p className="text-sm font-black text-slate-400">{leaderboard[1].total}</p>
                    <div className="w-full h-16 bg-white rounded-t-xl border border-slate-200 mt-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"/>
                </div>
                {/* 1st Place */}
                <div className="flex flex-col items-center">
                    <motion.div 
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                        className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mb-2 shadow-md border-2 border-white relative"
                    >
                        <Crown className="w-10 h-10 text-amber-500"/>
                        <div className="absolute -top-3 -right-3 w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-black ring-4 ring-amber-100">1</div>
                    </motion.div>
                    <p className="text-sm font-black text-slate-900 truncate w-full text-center">{leaderboard[0].name}</p>
                    <p className="text-lg font-black text-indigo-600">{leaderboard[0].total}</p>
                    <div className="w-full h-24 bg-white rounded-t-xl border border-slate-200 mt-2 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.1)]"/>
                </div>
                {/* 3rd Place */}
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-2 shadow-sm border-2 border-white relative">
                         <Medal className="w-8 h-8 text-orange-400"/>
                         <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px] font-black">3</div>
                    </div>
                    <p className="text-xs font-black text-slate-600 truncate w-full text-center">{leaderboard[2].name}</p>
                    <p className="text-sm font-black text-slate-400">{leaderboard[2].total}</p>
                    <div className="w-full h-12 bg-white rounded-t-xl border border-slate-200 mt-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"/>
                </div>
            </div>
        )}

        {/* Global Leaderboards Table */}
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-indigo-500" />
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Student Standings</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sum of all assignment evaluation scores</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-black text-slate-700">{leaderboard.length} Students</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 w-16 text-center">Rank</th>
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 min-w-[200px]">Student Name</th>
                            {assignments.map(a => (
                                <th key={a.id} className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center min-w-[120px]">
                                    {a.title}
                                </th>
                            ))}
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-indigo-500 text-right w-32 bg-indigo-50/30">Grand Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaderboard.map((student, idx) => (
                            <tr key={idx} className="group hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                                <td className="p-6 text-center">
                                    {idx === 0 ? (
                                        <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mx-auto shadow-sm ring-2 ring-white">
                                            <Crown className="w-4 h-4" />
                                        </div>
                                    ) : (
                                        <span className="text-sm font-black text-slate-400">#{idx + 1}</span>
                                    )}
                                </td>
                                <td className="p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-500 text-xs">
                                            {student.name.substring(0,2).toUpperCase()}
                                        </div>
                                        <span className="font-bold text-slate-900">{student.name}</span>
                                    </div>
                                </td>
                                {assignments.map(a => {
                                    const score = student.assignments[a.id] || 0;
                                    return (
                                        <td key={a.id} className="p-6 text-center">
                                            <span className={`text-sm font-black ${score > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                                                {score > 0 ? score : '--'}
                                            </span>
                                        </td>
                                    );
                                })}
                                <td className="p-6 text-right bg-indigo-50/20 group-hover:bg-indigo-50/40 transition-colors">
                                    <span className="text-lg font-black text-indigo-600">{student.total}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {leaderboard.length === 0 && (
                <div className="p-20 text-center">
                    <Target className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">No evaluation data available yet.</p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
