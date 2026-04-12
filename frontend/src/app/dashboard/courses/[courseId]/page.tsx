"use client";

import React, { useEffect, useState } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  FileText,
  CheckSquare,
  Bot,
  BookOpen,
  BarChart,
  ArrowRight,
  School,
  Loader2,
  AlertCircle,
  ClipboardCheck,
  CalendarDays
} from "lucide-react";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

interface Course {
  _id: string;
  title: string;
  description: string;
  join_code?: string;
}

export default function CourseStream() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    if (courseId) {
      loadCourse(courseId);
    }
  }, [courseId]);

  const loadCourse = async (cid: string) => {
    setLoading(true);
    try {
      const auth = getAuthUser();
      if (!auth) {
        setLoading(false);
        return;
      }

      const res = await api.get(`/courses/${cid}`).catch(() => null);
      if (res && res.data) {
        setCourse(res.data);
        if (res.data.teacher_id === auth.id || auth.role === "teacher") {
          setIsTeacher(true);
        }
      } else {
        // Fallback for visual continuity
        setCourse({
          _id: cid,
          title: "Classroom Dashboard",
          description: "Welcome to your smart learning environment.",
        });
        if (auth.role === "teacher") setIsTeacher(true);
      }
    } catch (e) {
      console.error("Course hub load error:", e);
      setError("Failed to verify course details");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      title: "Quizzes",
      desc: "Take AI-generated or instructor quizzes to test your knowledge.",
      path: `/dashboard/courses/${courseId}/quizzes`,
      icon: CheckSquare,
      color: "bg-emerald-100 text-emerald-600 border-emerald-200",
      hover: "hover:bg-emerald-50 hover:border-emerald-300",
      btn: "bg-emerald-600 hover:bg-emerald-700"
    },
    {
      title: "Assignments",
      desc: "Submit your code challenges and essays for automated grading.",
      path: `/dashboard/courses/${courseId}/assignments`,
      icon: FileText,
      color: "bg-blue-100 text-blue-600 border-blue-200",
      hover: "hover:bg-blue-50 hover:border-blue-300",
      btn: "bg-blue-600 hover:bg-blue-700"
    },
    {
      title: "Knowledge Tutor",
      desc: "Get personalized AI help, ask questions, and brainstorm ideas.",
      path: `/dashboard/courses/${courseId}/tutor`,
      icon: Bot,
      color: "bg-purple-100 text-purple-600 border-purple-200",
      hover: "hover:bg-purple-50 hover:border-purple-300",
      btn: "bg-purple-600 hover:bg-purple-700"
    },
    {
      title: "Class Notes",
      desc: "Upload or read transcripts, PDFs, and notes attached to the class.",
      path: `/dashboard/courses/${courseId}/notes`,
      icon: BookOpen,
      color: "bg-amber-100 text-amber-600 border-amber-200",
      hover: "hover:bg-amber-50 hover:border-amber-300",
      btn: "bg-amber-600 hover:bg-amber-700"
    },
    {
      title: "Class Calendar",
      desc: "View and manage important dates, exams, and class-specific deadlines.",
      path: `/dashboard/courses/${courseId}/calendar`,
      icon: CalendarDays,
      color: "bg-cyan-100 text-cyan-600 border-cyan-200",
      hover: "hover:bg-cyan-50 hover:border-cyan-300",
      btn: "bg-cyan-600 hover:bg-cyan-700"
    },
    {
      title: "Dashboard",
      desc: "View student rankings, total scores, and class-wide performance trends.",
      path: `/dashboard/courses/${courseId}/progress`,
      icon: BarChart,
      color: "bg-rose-100 text-rose-600 border-rose-200",
      hover: "hover:bg-rose-50 hover:border-rose-300",
      btn: "bg-rose-600 hover:bg-rose-700"
    }
  ];

  const teacherFeatures = [
    {
      title: "Evaluator Hub",
      desc: "Review all student assignments, track AI scores, and manage grading.",
      path: `/dashboard/courses/${courseId}/evaluator`,
      icon: ClipboardCheck,
      color: "bg-indigo-100 text-indigo-600 border-indigo-200",
      hover: "hover:bg-indigo-50 hover:border-indigo-300",
      btn: "bg-indigo-600 hover:bg-indigo-700"
    }
  ];

  const displayFeatures = isTeacher ? [...features, ...teacherFeatures] : features;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 border-t border-gray-100">
      <TopNav title="" />
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        {loading ? (
             <div className="flex flex-col items-center justify-center py-20 text-gray-400">
             <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
             <p className="font-semibold">Loading classroom workspace...</p>
           </div>
        ) : (
            <>
                <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="w-full bg-gradient-to-tr from-slate-900 to-indigo-950 rounded-3xl p-8 mb-10 shadow-xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                       <School className="w-64 h-64 text-white -mt-10 -mr-10 rotate-12" />
                    </div>

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 text-white/90 text-sm font-bold rounded-lg mb-4 backdrop-blur-sm">
                            <School className="w-4 h-4"/> Classroom
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
                            {course?.title || "Classroom Dashboard"}
                        </h1>
                        <p className="text-lg text-indigo-100 font-medium max-w-2xl leading-relaxed">
                            {course?.description || "Access quizzes, submit assignments, and use AI features like the personalized semantic tutor and progress tracker directly from this central hub."}
                        </p>
                        
                        {course?.join_code && (
                             <div className="mt-8 flex items-center gap-4 bg-black/20 w-fit px-5 py-3 rounded-2xl backdrop-blur-md border border-white/10">
                                 <div>
                                    <p className="text-[10px] text-indigo-300 font-black tracking-widest uppercase mb-1">Class Code</p>
                                    <p className="text-2xl font-mono font-bold text-white tracking-widest">{course.join_code}</p>
                                 </div>
                             </div>
                        )}
                    </div>
                </motion.div>

                <div className="mb-8">
                     <h2 className="text-2xl font-black text-slate-800 tracking-tight">Course Features</h2>
                     <p className="text-slate-500 font-medium">Select a tool to interact with class material.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayFeatures.map((feature, idx) => {
                         const Icon = feature.icon;
                         return (
                            <motion.div
                               key={feature.title}
                               initial={{ opacity: 0, y: 20 }}
                               animate={{ opacity: 1, y: 0 }}
                               transition={{ delay: idx * 0.05 }}
                               onClick={() => router.push(feature.path)}
                               className={`bg-white rounded-3xl border-2 hover:shadow-xl transition-all cursor-pointer group flex flex-col p-6 ${feature.hover}`}
                            >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-inner ${feature.color}`}>
                                    <Icon className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">{feature.title}</h3>
                                <p className="text-sm font-medium text-slate-500 mb-6 leading-relaxed flex-1">
                                    {feature.desc}
                                </p>
                                <button className={`w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 ${feature.btn}`}>
                                    Open {feature.title}
                                </button>
                            </motion.div>
                         );
                    })}
                </div>
            </>
        )}
      </main>
    </div>
  );
}
