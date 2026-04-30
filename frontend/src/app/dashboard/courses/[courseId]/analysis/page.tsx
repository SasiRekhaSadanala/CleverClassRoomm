"use client";

import React, { useState, useEffect } from "react";
import TopNav from "@/components/layout/TopNav";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from "recharts";
import { 
  TrendingUp, Users, BookOpen, CheckCircle, Brain, 
  AlertCircle, Sparkles, GraduationCap, Target, Trophy 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ClassroomAnalysis() {
  const params = useParams();
  const courseId = params.courseId as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const auth = getAuthUser();
    setUser(auth);
    if (auth) fetchAnalysis(auth);
  }, [courseId]);

  const fetchAnalysis = async (authUser: any) => {
    try {
      setLoading(true);
      const res = await api.get(`/analysis/${courseId}/analysis`, {
          params: {
              user_id: authUser.id,
              role: authUser.role
          }
      });
      setData(res.data);
    } catch (error) {
      console.error("Error fetching analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <TopNav title="Feature Analysis" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          <p className="text-gray-500 font-bold animate-pulse uppercase tracking-widest text-sm">Synthesizing Your Insights...</p>
        </div>
      </div>
    );
  }

  const isTeacher = data?.role === "teacher";

  return (
    <div className="flex flex-col min-h-full bg-gray-50/50 pb-20">
      <TopNav title="Feature Analysis" />
      
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-purple-600 font-black text-sm uppercase tracking-[0.2em] mb-2">
              <Sparkles className="w-4 h-4" /> AI Powered {isTeacher ? "Class" : "Personal"} Analysis
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                {isTeacher ? "Classroom Intelligence" : "Your Learning Progress"}
            </h1>
            <p className="text-gray-500 font-medium mt-1">
                {isTeacher 
                    ? "Deep insights into classroom performance and concept mastery gaps." 
                    : "A personalized look at your marks, GPA, and topic-wise strengths."}
            </p>
          </div>
          <button onClick={() => fetchAnalysis(user)} className="px-6 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 shadow-sm transition-all active:scale-95">
            Refresh Report
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isTeacher ? (
            <>
              <MetricCard title="Class Average" value={`${data.metrics.avg_score}%`} icon={<TrendingUp className="w-6 h-6 text-purple-600" />} color="bg-purple-100" />
              <MetricCard title="Highest Score" value={`${data.metrics.max_score}%`} icon={<Trophy className="w-6 h-6 text-amber-600" />} color="bg-amber-100" />
              <MetricCard title="Lowest Score" value={`${data.metrics.min_score}%`} icon={<AlertCircle className="w-6 h-6 text-red-600" />} color="bg-red-100" />
              <MetricCard title="Completion Rate" value={`${data.metrics.completion_rate}%`} icon={<CheckCircle className="w-6 h-6 text-emerald-600" />} color="bg-emerald-100" />
            </>
          ) : (
            <>
              <MetricCard title="Your Average" value={`${data.metrics.avg_score}%`} icon={<TrendingUp className="w-6 h-6 text-blue-600" />} color="bg-blue-100" />
              <MetricCard title="Estimated GPA" value={data.metrics.gpa} icon={<GraduationCap className="w-6 h-6 text-purple-600" />} color="bg-purple-100" />
              <MetricCard title="Tasks Completed" value={`${data.metrics.completion}/${data.metrics.total}`} icon={<CheckCircle className="w-6 h-6 text-emerald-600" />} color="bg-emerald-100" />
              <MetricCard title="Topics Mastered" value={data.mastery.filter((m:any) => m[1] > 80).length} icon={<Target className="w-6 h-6 text-amber-600" />} color="bg-amber-100" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Charts Column */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2">
                    {isTeacher ? <Users className="w-5 h-5 text-purple-600" /> : <TrendingUp className="w-5 h-5 text-blue-600" />}
                    {isTeacher ? "Score Distribution" : "Your Performance Trend"}
                </h3>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        {isTeacher ? (
                            <BarChart data={Object.entries(data.metrics.score_dist).map(([name, value]) => ({ name, value }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600}} />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        ) : (
                            <AreaChart data={data.metrics.trend}>
                                <defs>
                                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600}} />
                                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-emerald-600" /> {isTeacher ? "Top Class Topics" : "Your Topic Mastery"}
                </h3>
                <div className="space-y-4">
                    {(isTeacher ? data.top_topics : data.mastery.slice(0, 5)).map(([name, score]: any) => (
                        <div key={name}>
                            <div className="flex justify-between text-sm font-bold mb-1.5">
                                <span className="text-gray-700">{name}</span>
                                <span className="text-emerald-600">{score}%</span>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${score}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {isTeacher && (
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                    <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-5 h-5" /> Gaps Identified
                    </h3>
                    <div className="space-y-4">
                        {data.bottom_topics.map(([name, score]: any) => (
                            <div key={name}>
                                <div className="flex justify-between text-sm font-bold mb-1.5">
                                    <span className="text-gray-700">{name}</span>
                                    <span className="text-red-500">{score}%</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-red-400 h-full rounded-full" style={{ width: `${score}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>

          {/* AI Report Column */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-600 rounded-xl text-white">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900">AI {isTeacher ? "Class Intelligence" : "Personal Progress"} Report</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Personalized Just For You</p>
                        </div>
                    </div>
                </div>
                <div className="flex-1 p-8 overflow-y-auto">
                    <div className="prose prose-purple max-w-none prose-headings:font-black prose-p:leading-relaxed prose-li:font-medium prose-strong:text-purple-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.ai_report}</ReactMarkdown>
                    </div>
                </div>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}

function MetricCard({ title, value, icon, color }: any) {
  return (
    <motion.div whileHover={{ y: -5 }} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
      <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center mb-4 shadow-sm`}>
        {icon}
      </div>
      <div className="text-3xl font-black text-gray-900 tracking-tight">{value}</div>
      <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">{title}</div>
    </motion.div>
  );
}
