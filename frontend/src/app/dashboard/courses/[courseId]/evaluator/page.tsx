"use client";

import React, { useEffect, useState } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { 
  ClipboardCheck, 
  Users, 
  CheckCircle2, 
  Clock, 
  BrainCircuit,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Code,
  FileText,
  Loader2,
  ExternalLink
} from "lucide-react";

interface Submission {
  _id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  status: string;
  score?: number;
  feedback?: string;
  submitted_at: string;
  code?: string;
  theory_answer?: string;
}

interface Assignment {
  _id: string;
  title: string;
  type: string;
  submissions?: Submission[];
}

export default function Evaluator() {
  const params = useParams();
  const courseId = params.courseId as string;
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Modal for Viewing Submission
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);

  useEffect(() => {
    const auth = getAuthUser();
    if (!auth) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [courseRes, assignmentsRes] = await Promise.all([
          api.get(`/courses/${courseId}`).catch(() => null),
          api.get(`/assignments/${courseId}`).catch(() => ({ data: [] }))
        ]);
        
        const courseData = courseRes?.data;
        if (courseData) {
          if (courseData.teacher_id === auth.id || auth.role === "teacher") {
            setIsTeacher(true);
          }
        } else if (auth.role === "teacher") {
          setIsTeacher(true);
        }

        const rawAssignments = assignmentsRes.data || [];
        // Fetch submissions for each assignment
        const assignmentsWithSubmissions = await Promise.all(
          rawAssignments.map(async (a: any) => {
             const subRes = await api.get(`/assignments/${a._id}/submissions`);
             return { ...a, submissions: subRes.data || [] };
          })
        );
        
        setAssignments(assignmentsWithSubmissions);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [courseId]);

  if (loading) {
     return (
        <div className="flex flex-col h-full items-center justify-center bg-gray-50">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-gray-500 font-bold">Synchronizing classroom submissions...</p>
        </div>
     );
  }

  const totalSubmissions = assignments.reduce((acc, a) => acc + (a.submissions?.length || 0), 0);
  const pendingSubmissions = assignments.reduce((acc, a) => acc + (a.submissions?.filter(s => s.status === 'pending').length || 0), 0);
  const evaluatedSubmissions = assignments.reduce((acc, a) => acc + (a.submissions?.filter(s => s.status === 'evaluated').length || 0), 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 border-t border-gray-100">
      <TopNav title="AI Evaluator" />
      <main className="flex-1 p-6 lg:p-8 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
               <h2 className="text-2xl font-black text-gray-900 tracking-tight">Assignment Evaluator</h2>
               <p className="text-sm font-medium text-gray-500">
                   {isTeacher ? "Review student submissions and manage automated grading metrics." : "View the feedback given by your instructors."}
               </p>
            </div>
        </div>

        {isTeacher ? (
           <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                 <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Submissions</p>
                    <p className="text-3xl font-black text-gray-900">{totalSubmissions}</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                    <Users className="w-5 h-5"/>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                 <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Pending Evaluation</p>
                    <p className="text-3xl font-black text-amber-600">{pendingSubmissions}</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
                    <Clock className="w-5 h-5"/>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                 <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Evaluated</p>
                    <p className="text-3xl font-black text-emerald-600">{evaluatedSubmissions}</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5"/>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
                {assignments.map((assignment) => (
                    <div key={assignment._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <button 
                            onClick={() => setExpandedId(expandedId === assignment._id ? null : assignment._id)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${assignment.type === 'coding' ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                                    {assignment.type === 'coding' ? <Code className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-gray-900">{assignment.title}</h3>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{assignment.type} Assignment</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="hidden sm:flex items-center gap-2">
                                    <Users className="w-4 h-4 text-gray-300" />
                                    <span className="text-sm font-bold text-gray-600">{assignment.submissions?.length || 0} Submissions</span>
                                </div>
                                {expandedId === assignment._id ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                            </div>
                        </button>

                        <AnimatePresence>
                            {expandedId === assignment._id && (
                                <motion.div 
                                    initial={{ height: 0 }} 
                                    animate={{ height: "auto" }} 
                                    exit={{ height: 0 }}
                                    className="overflow-hidden bg-gray-50/50"
                                >
                                    <div className="px-6 py-4 border-t border-gray-100">
                                        {assignment.submissions?.length === 0 ? (
                                            <div className="py-8 text-center">
                                                <p className="text-sm font-medium text-gray-400 italic">No submissions yet for this assignment.</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="text-left border-b border-gray-100">
                                                            <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Student Name</th>
                                                            <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Score</th>
                                                            <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                                            <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Review</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {assignment.submissions?.map((sub) => (
                                                            <tr key={sub._id} className="border-b border-gray-50 last:border-0">
                                                                <td className="py-4 font-bold text-gray-900 text-sm whitespace-nowrap">{sub.student_name}</td>
                                                                <td className="py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-sm font-black ${sub.score && sub.score > 70 ? 'text-emerald-600' : 'text-gray-900'}`}>{sub.score ?? '--'}/100</span>
                                                                        {sub.score && sub.score > 80 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                                                    </div>
                                                                </td>
                                                                <td className="py-4">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                                        sub.status === 'evaluated' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                                    }`}>
                                                                        {sub.status}
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 text-right">
                                                                    <button 
                                                                        onClick={() => {
                                                                            setSelectedSub(sub);
                                                                            setShowSubModal(true);
                                                                        }}
                                                                        className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-indigo-600"
                                                                    >
                                                                        <ExternalLink className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            {/* Submission Detail Modal */}
            <AnimatePresence>
                {showSubModal && selectedSub && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl p-0 max-w-4xl w-full max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900">{selectedSub.student_name}</h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Submission Details</p>
                                </div>
                                <button onClick={() => setShowSubModal(false)} className="p-2 hover:bg-white rounded-xl transition-colors shadow-sm">
                                    <ChevronRight className="w-6 h-6 text-gray-400 rotate-90" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                                    <div className="md:col-span-2">
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            {selectedSub.code ? <Code className="w-4 h-4"/> : <FileText className="w-4 h-4"/>}
                                            Student Content
                                        </h4>
                                        <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl font-mono text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-800">
                                            {selectedSub.code || selectedSub.theory_answer || "No content provided."}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <BrainCircuit className="w-4 h-4 text-indigo-500"/>
                                            AI Evaluation
                                        </h4>
                                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                                            <div className="mb-6">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Score</p>
                                                <p className="text-4xl font-black text-indigo-600">{selectedSub.score ?? "--"}<span className="text-lg opacity-50">/100</span></p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Feedback</p>
                                                <p className="text-sm font-medium text-indigo-900 leading-relaxed italic">
                                                    "{selectedSub.feedback || "The AI is still processing this submission..."}"
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-8 py-6 border-t border-gray-100 flex justify-end">
                                <button onClick={() => setShowSubModal(false)} className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-colors">
                                    Done Reviewing
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
           </>
        ) : (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-3xl flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-base font-bold text-amber-900">Instructor Access Required</p>
                  <p className="text-sm font-medium opacity-80">This module is primarily for instructors to evaluate class submissions. You can view your personal feedback in the Progress tab.</p>
                </div>
            </div>
        )}

        {isTeacher && assignments.length === 0 && (
           <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-sm text-center">
              <BrainCircuit className="w-16 h-16 text-indigo-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No active assignments found.</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                  Create an assignment in the Assignments tab to start evaluating student progress with AI insights.
              </p>
           </div>
        )}

      </main>
    </div>
  );
}
