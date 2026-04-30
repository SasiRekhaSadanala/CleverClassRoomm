"use client";

import React, { useState, useEffect } from "react";
import TopNav from "@/components/layout/TopNav";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from "recharts";
import { 
  TrendingUp, Users, BookOpen, CheckCircle, Brain, 
  AlertCircle, ArrowUpRight, ArrowDownRight, Info, Sparkles 
} from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function ClassroomAnalysis() {
  const params = useParams();
  const courseId = params.courseId as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalysis();
  }, [courseId]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/analysis/${courseId}/analysis`);
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
          <p className="text-gray-500 font-bold animate-pulse uppercase tracking-widest text-sm">Analyzing Classroom Data...</p>
        </div>
      </div>
    );
  }

  const scoreDistData = Object.entries(data?.metrics?.score_dist || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="flex flex-col min-h-full bg-gray-50/50 pb-20">
      <TopNav title="Feature Analysis" />
      
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-purple-600 font-black text-sm uppercase tracking-[0.2em] mb-2">
              <Sparkles className="w-4 h-4" /> AI Powered Insights
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Classroom Intelligence</h1>
            <p className="text-gray-500 font-medium mt-1">Deep analysis of student performance and concept mastery.</p>
          </div>
          <button 
            onClick={fetchAnalysis}
            className="px-6 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm active:scale-95"
          >
            Refresh Data
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
            title="Avg Class Score" 
            value={`${data?.metrics?.avg_score}%`} 
            icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
            color="bg-purple-100"
            trend="+2.4%"
            isUp={true}
          />
          <MetricCard 
            title="Active Students" 
            value={data?.metrics?.student_count} 
            icon={<Users className="w-6 h-6 text-blue-600" />}
            color="bg-blue-100"
            trend="Stable"
          />
          <MetricCard 
            title="Avg Completion" 
            value={`${data?.metrics?.completion_rate}%`} 
            icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
            color="bg-emerald-100"
            trend="-1.2%"
            isUp={false}
          />
          <MetricCard 
            title="Topics Analyzed" 
            value={data?.metrics?.assignment_count * 2} 
            icon={<Brain className="w-6 h-6 text-amber-600" />}
            color="bg-amber-100"
            trend="New"
            isUp={true}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Charts Column */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" /> Score Distribution
                </h3>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scoreDistData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600}} />
                            <Tooltip 
                                cursor={{fill: '#f3f4f6'}} 
                                contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                            />
                            <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-emerald-600" /> Topic Mastery (Best)
                </h3>
                <div className="space-y-4">
                    {data?.top_topics?.map(([name, score]: any) => (
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

            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-5 h-5" /> Gaps Identified (Lowest)
                </h3>
                <div className="space-y-4">
                    {data?.bottom_topics?.map(([name, score]: any) => (
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
                            <h3 className="font-black text-gray-900">AI Feature Analysis Report</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Generated Just Now</p>
                        </div>
                    </div>
                </div>
                <div className="flex-1 p-8 overflow-y-auto">
                    <div className="prose prose-purple max-w-none prose-headings:font-black prose-p:leading-relaxed prose-li:font-medium prose-strong:text-purple-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data?.ai_report}</ReactMarkdown>
                    </div>
                </div>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}

function MetricCard({ title, value, icon, color, trend, isUp }: any) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden"
    >
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-2xl ${color}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-black px-2 py-1 rounded-full ${isUp === true ? 'bg-emerald-50 text-emerald-600' : isUp === false ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
            {isUp === true && <ArrowUpRight className="w-3 h-3" />}
            {isUp === false && <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="text-3xl font-black text-gray-900 tracking-tight">{value}</div>
        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">{title}</div>
      </div>
    </motion.div>
  );
}
