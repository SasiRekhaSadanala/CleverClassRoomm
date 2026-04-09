"use client";

import React, { useEffect, useState } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  PenTool,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

const STORAGE_KEY = "asc_student_id";

interface Assignment {
  _id: string;
  title: string;
  description: string;
  type: string;
  due_date: string;
  course_id: string;
}

type TabType = "pending" | "submitted";

export default function GlobalTodo() {
  const [studentId, setStudentId] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [submissionResults, setSubmissionResults] = useState<
    Record<string, { status: string; score?: number; feedback?: string }>
  >({});

  useEffect(() => {
    const sid = window.localStorage.getItem(STORAGE_KEY) || "";
    setStudentId(sid);
    if (sid) {
      loadGlobalTodo(sid);
    } else {
      setLoading(false);
      setStatus("Student session missing. Please log in.");
    }
  }, []);

  const loadGlobalTodo = async (sid: string) => {
    setLoading(true);
    try {
      // First, get the student's courses to fetch all assignments
      const courseRes = await api.get(`/courses/student/${sid}`);
      const courses = courseRes.data || [];
      
      let allAssgs: Assignment[] = [];
      for (const c of courses) {
        try {
          const assgRes = await api.get(`/assignments/${c._id}`);
          const assgs = assgRes.data || [];
          // tag with course_id just in case
          assgs.forEach((a: any) => { a.course_id = c._id; });
          allAssgs = [...allAssgs, ...assgs];
        } catch (e) {
             console.error("Failed to load assignments for course", c._id);
        }
      }

      let subs: any[] = [];
      try {
        const subRes = await api.get(`/assignments/student/${sid}`);
        subs = subRes.data || [];
      } catch (subError) {
        console.error("Load submissions error", subError);
      }

      const subResults: Record<string, any> = {};
      subs.forEach((s: any) => {
        const assignmentIdRaw =
          s.assignment_id ??
          s.assignment?.id ??
          s.assignment?._id ??
          s.assignment;
        const assignmentId =
          assignmentIdRaw && typeof assignmentIdRaw === "object"
            ? assignmentIdRaw.$id || assignmentIdRaw.id || assignmentIdRaw._id
            : assignmentIdRaw;

        if (!assignmentId) return;

        subResults[String(assignmentId)] = {
          status: s.status,
          score: s.score,
          feedback: s.feedback,
        };
      });

      setSubmissionResults(subResults);
      
      // Sort assignments by internal due date
      allAssgs.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      
      setAssignments(allAssgs);
    } catch (e) {
      console.error("Load global todo error", e);
    } finally {
      setLoading(false);
    }
  };


  const pendingAssignments = assignments.filter(
    (a) => !submissionResults[a._id],
  );
  const submittedAssignments = assignments.filter(
    (a) => !!submissionResults[a._id],
  );

  const displayedAssignments =
    activeTab === "pending" ? pendingAssignments : submittedAssignments;

  const getDueStatus = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return { label: "Overdue", color: "text-red-600 bg-red-50" };
    if (days <= 2)
      return { label: `${days}d left`, color: "text-amber-600 bg-amber-50" };
    return {
      label: due.toLocaleDateString(),
      color: "text-gray-600 bg-gray-100",
    };
  };

  const getStatusBadge = (status: string, score?: number) => {
    switch (status) {
      case "pending":
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" /> Evaluating
          </span>
        );
      case "evaluated":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Score: {score}
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 border-t border-gray-100 w-full">
      <TopNav title="" />
      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
               <Calendar className="text-blue-600 w-8 h-8"/> To-do list
            </h2>
            <p className="text-gray-500 font-medium mt-2">
              All your assignments from enrolled classes in one place.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-gray-200/60 rounded-2xl mb-8 w-fit">
          {(["pending", "submitted"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-md scale-100"
                  : "text-gray-500 hover:text-gray-700 scale-95 hover:scale-100"
              }`}
            >
              {tab === "pending"
                ? `Pending (${pendingAssignments.length})`
                : `Done (${submittedAssignments.length})`}
            </button>
          ))}
        </div>

        {status ? (
          <p className="mb-4 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {status}
          </p>
        ) : null}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
            <p className="font-semibold">Loading your tasks...</p>
          </div>
        ) : displayedAssignments.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
            <p className="text-gray-600 font-bold text-xl">
              {activeTab === "pending"
                ? "Woohoo! No pending work."
                : "No submissions yet."}
            </p>
            <p className="text-sm font-medium text-gray-400 mt-2 max-w-sm mx-auto">
              {activeTab === "pending"
                ? "You've completely caught up on all assignments. Take a break!"
                : "Once you submit assignments, your evaluated results will show up here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {displayedAssignments.map((assg, idx) => {
                const result = submissionResults[assg._id];
                const dueStatus = getDueStatus(assg.due_date);

                return (
                  <motion.div
                    key={assg._id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group flex flex-col"
                  >
                    <div
                      className="flex flex-col p-6 "
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-1 ${
                              assg.type === "coding"
                                ? "bg-indigo-50 text-indigo-600"
                                : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            {assg.type === "coding" ? (
                              <Code2 className="w-6 h-6" />
                            ) : (
                              <PenTool className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {assg.title}
                            </h3>
                            <p className="text-sm font-medium text-gray-500 line-clamp-2 mt-1 max-w-xl">
                              {assg.description}
                            </p>
                            
                             <Link href={`/dashboard/courses/${assg.course_id}/assignments`}>
                               <span className="inline-block mt-3 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-md transition-colors cursor-pointer">
                                  Go to Class →
                               </span>
                             </Link>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 shrink-0">
                          {result ? (
                            getStatusBadge(result.status, result.score)
                          ) : (
                            <span
                              className={`text-xs font-bold px-3 py-1.5 rounded-full ${dueStatus.color}`}
                            >
                              <Clock className="w-3.5 h-3.5 inline mr-1" />
                              {dueStatus.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
