"use client";

import React, { useEffect, useState } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import {
  Code2,
  PenTool,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  ChevronDown,
  PlusCircle,
  UploadCloud,
  FileText,
  Paperclip,
  Users,
  BrainCircuit,
  Code,
  ExternalLink,
  Play,
  ClipboardCheck,
  ChevronRight,
  Trash2
} from "lucide-react";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

const STORAGE_KEY = "asc_student_id";

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
  submission_file_url?: string;
  file_name?: string;
}

interface Assignment {
  _id: string;
  title: string;
  description: string;
  type: string;
  due_date: string;
}

type TabType = "pending" | "submitted";

export default function StudentAssignments() {
  const params = useParams();
  const courseId = params.courseId as string;
  
  const [studentId, setStudentId] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);

  // Submission state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [theoryInput, setTheoryInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionResults, setSubmissionResults] = useState<
    Record<string, { status: string; score?: number; feedback?: string; file_url?: string; file_name?: string }>
  >({});
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);

  // Teacher Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("coding");
  const [newDueDate, setNewDueDate] = useState("");
  const [testCasesInput, setTestCasesInput] = useState('[{"input": "1", "expected": "1"}]');
  const [creating, setCreating] = useState(false);

  // Teacher Evaluation States
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<Record<string, Submission[]>>({});
  const [fetchingSubmissions, setFetchingSubmissions] = useState<Record<string, boolean>>({});
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);

  useEffect(() => {
    setStatus("");
    let sid = window.localStorage.getItem(STORAGE_KEY) || "";
    const auth = getAuthUser();
    
    // Simplified recovery: Any logged-in user on this page is treated as the active student session.
    if ((!sid || sid === "undefined" || sid === "null") && auth) {
      sid = auth.id;
      window.localStorage.setItem(STORAGE_KEY, sid);
    }
    
    setStudentId(sid);
    
    if (auth) {
       const checkRole = async () => {
         try {
           const res = await api.get(`/courses/${courseId}`).catch(() => null);
           const courseData = res?.data;
           if (courseData) {
             if (courseData.teacher_id === auth.id || auth.role === "teacher") {
               setIsTeacher(true);
             }
           } else if (auth.role === "teacher") {
             setIsTeacher(true);
           }
         } catch (e) {
           console.error("Assignments checkRole error:", e);
         }
       };
       checkRole();
    }

    if (courseId) {
      loadAssignments(courseId);
    }
  }, [courseId]);

  const loadAssignments = async (cid: string) => {
    setLoading(true);
    try {
      let sid = window.localStorage.getItem(STORAGE_KEY) || "";
      if (!sid || sid === "undefined" || sid === "null") {
        const auth = getAuthUser();
        if (auth) sid = auth.id;
      }
      const assgRes = await api.get(`/assignments/${cid}`);
      const assgs = assgRes.data || [];

      let subs: any[] = [];
      if (sid) {
        try {
          const subRes = await api.get(`/assignments/student/${sid}`);
          subs = subRes.data || [];
        } catch (subError) {
          console.error("Load submissions error", subError);
        }
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
          file_url: s.submission_file_url,
          file_name: s.file_name
        };
      });

      setSubmissionResults(subResults);
      setAssignments(assgs);
    } catch (e) {
      console.error("Load assignments error", e);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSubmission = async (assignmentId: string, type: string) => {
    const isCode = type === "coding";
    
    if (!studentId) {
      setStatus("Student session missing. Join a course first.");
      return;
    }

    setSubmitting(true);
    setStatus("");
    
    try {
      const sid = studentId;
      let res;

      if (submissionFile) {
        // File Submission Flow
        const formData = new FormData();
        formData.append("student_id", sid);
        formData.append("file", submissionFile);
        if (isCode) formData.append("text_answer", codeInput);
        else formData.append("text_answer", theoryInput);

        res = await api.post(`/assignments/${assignmentId}/submit-file`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        // Text/Code Submission Flow
        const textToSubmit = isCode ? codeInput : theoryInput;
        if (!textToSubmit.trim()) {
           setStatus("Please provide either text or a file submission.");
           setSubmitting(false);
           return;
        }

        const endpoint = isCode ? "submit-code" : "submit-theory";
        res = await api.post(`/assignments/${assignmentId}/${endpoint}`, {
          student_id: sid,
          [isCode ? "code" : "text"]: textToSubmit,
        });
      }

      setSubmissionResults((prev) => ({
        ...prev,
        [assignmentId]: { status: "submitted" },
      }));

      setCodeInput("");
      setTheoryInput("");
      setSubmissionFile(null);
      setExpandedId(null);

      // Refresh list
      loadAssignments(courseId);
    } catch (e: any) {
      console.error("Submission error", e);
      setStatus(e.response?.data?.detail || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!window.confirm("Are you sure you want to delete this assignment? All student submissions for this assignment will also be removed.")) return;
    try {
      await api.delete(`/assignments/${assignmentId}`);
      loadAssignments(courseId);
    } catch (err) {
      console.error("Delete error", err);
      alert("Failed to delete assignment.");
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setStatus("");
    try {
      let testCases = undefined;
      if (newType === "coding") {
        try {
          testCases = JSON.parse(testCasesInput);
        } catch (e) {
          setStatus("Invalid JSON in Test Cases. Please check your format.");
          setCreating(false);
          return;
        }
      }
      
      await api.post("/assignments", {
        title: newTitle.trim(),
        description: newDesc.trim() || "No description",
        type: newType,
        course_id: courseId,
        due_date: newDueDate ? new Date(newDueDate).toISOString() : new Date(Date.now() + 86400000).toISOString(),
        test_cases: testCases
      });
      
      setShowCreateModal(false);
      setNewTitle("");
      setNewDesc("");
      loadAssignments(courseId);
    } catch (err: any) {
      console.error(err);
      setStatus(err?.response?.data?.detail || "Failed to create assignment. Ensure coding tasks have test cases if required.");
    } finally {
      setCreating(false);
    }
  };

  const fetchSubmissions = async (assignmentId: string) => {
    if (fetchingSubmissions[assignmentId]) return;
    setFetchingSubmissions((prev) => ({ ...prev, [assignmentId]: true }));
    try {
      const res = await api.get(`/assignments/${assignmentId}/submissions`);
      setAssignmentSubmissions((prev) => ({
        ...prev,
        [assignmentId]: res.data || [],
      }));
    } catch (e) {
      console.error("Fetch submissions error", e);
    } finally {
      setFetchingSubmissions((prev) => ({ ...prev, [assignmentId]: false }));
    }
  };

  const pendingAssignments = assignments.filter(
    (a) => !submissionResults[a._id],
  );
  const submittedAssignments = assignments.filter(
    (a) => !!submissionResults[a._id],
  );

  const displayedAssignments =
    isTeacher ? assignments : (activeTab === "pending" ? pendingAssignments : submittedAssignments);

  const getDueStatus = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const isOverdue = now > due;
    const diff = due.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (isOverdue) return { label: "Closed", color: "text-red-600 bg-red-50", overdue: true };
    if (days <= 2)
      return { label: `${days}d left`, color: "text-amber-600 bg-amber-50", overdue: false };
    return {
      label: due.toLocaleDateString(),
      color: "text-gray-600 bg-gray-100",
      overdue: false
    };
  };

  const getStatusBadge = (status: string, score?: number) => {
    const isTeacherRole = isTeacher;
    switch (status) {
      case "pending":
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" /> Evaluating
          </span>
        );
      case "evaluated":
        if (isTeacherRole) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Evaluated (Draft)
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full">
            <Loader2 className="w-3 h-3 animate-spin" /> Final Review
          </span>
        );
      case "sent":
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
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 border-t border-gray-100">
      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Coding Tasks &amp; Assessments
            </h2>
            <p className="text-gray-500 mt-1">
              Submit code solutions and view your evaluation results.
            </p>
          </div>
          {isTeacher && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors whitespace-nowrap"
              >
                 <PlusCircle className="w-4 h-4" /> Create Assignment
              </button>
          )}
        </div>

        {/* Create Assignment Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">New Assignment</h3>
                  <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <XCircle className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleCreateAssignment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Title</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      placeholder="e.g. Intro to Loops"
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      rows={3}
                      placeholder="Explain the task..."
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Type</label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium bg-white"
                      >
                        <option value="coding">Coding (Auto-eval)</option>
                        <option value="content">Content/PDF</option>
                        <option value="mixed">Mixed (Code + Content)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Due Date</label>
                      <input
                        type="datetime-local"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium bg-white"
                      />
                    </div>
                  </div>

                  {newType === "coding" && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Test Cases (JSON Format)</label>
                      <textarea
                        value={testCasesInput}
                        onChange={(e) => setTestCasesInput(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-mono text-xs bg-gray-50 h-32"
                        placeholder='[{"input": "a", "expected": "b"}]'
                      />
                      <p className="mt-1 text-[10px] text-gray-400 font-medium italic">
                        Input array of objects with "input" and "expected" keys.
                      </p>
                    </div>
                  )}
                  
                  <div className="pt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating || !newTitle.trim()}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center gap-2"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                        </>
                      ) : (
                        "Create Assignment"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Tabs - only relevant for students */}
        {!isTeacher && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
            {(["pending", "submitted"] as TabType[]).map((tab) => (
                <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === tab
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                >
                {tab === "pending"
                    ? `Pending (${pendingAssignments.length})`
                    : `Submitted (${submittedAssignments.length})`}
                </button>
            ))}
            </div>
        )}

        {isTeacher && (
             <div className="mb-8">
                 <span className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm">
                     Managed Assignments ({assignments.length})
                 </span>
             </div>
        )}

        {status ? (
          <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {status}
          </p>
        ) : null}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading assignments...
          </div>
        ) : displayedAssignments.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-500 font-medium text-lg">
              {activeTab === "pending"
                ? "No pending assignments."
                : "No submissions yet."}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === "pending"
                ? "You're all caught up!"
                : "Submit code on any pending assignment to see results here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {displayedAssignments.map((assg, idx) => {
                const isExpanded = expandedId === assg._id;
                const result = submissionResults[assg._id];
                const dueStatus = getDueStatus(assg.due_date);

                return (
                  <motion.div
                    key={assg._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* Assignment Header */}
                    <div
                      className="flex flex-col p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                      onClick={() => {
                        const { overdue } = getDueStatus(assg.due_date);
                        if (!result || result.feedback || isTeacher) {
                          if (!overdue || isTeacher) {
                             const willExpand = expandedId !== assg._id;
                             setExpandedId(willExpand ? assg._id : null);
                             if (isTeacher && willExpand) {
                               fetchSubmissions(assg._id);
                             }
                          } else {
                             setStatus("This assignment is closed.");
                             setTimeout(() => setStatus(""), 3000);
                          }
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                              assg.type === "coding"
                                ? "bg-indigo-50 text-indigo-600"
                                : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            {assg.type === "coding" ? (
                              <Code2 className="w-5 h-5" />
                            ) : (
                              <PenTool className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">
                              {assg.title}
                            </h3>
                            <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                              {assg.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {result ? (
                             getStatusBadge(result.status, result.score)
                          ) : (
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-full ${dueStatus.color}`}
                            >
                              <Clock className="w-3 h-3 inline mr-1" />
                              {dueStatus.label}
                            </span>
                          )}
                          
                          {isTeacher && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAssignment(assg._id);
                              }}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ml-1"
                              title="Delete Assignment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <ChevronDown
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content Area */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-gray-100 overflow-hidden"
                        >
                          {isTeacher ? (
                            /* TEACHER VIEW: SUBMISSION LIST */
                            <div className="p-6 bg-gray-50/50">
                              {fetchingSubmissions[assg._id] ? (
                                <div className="py-8 text-center flex items-center justify-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                  <span className="text-sm font-bold text-gray-500">Loading submissions...</span>
                                </div>
                              ) : (assignmentSubmissions[assg._id]?.length || 0) === 0 ? (
                                <div className="py-8 text-center">
                                  <p className="text-sm font-medium text-gray-400 italic">No submissions yet for this assignment.</p>
                                </div>
                              ) : (
                                <div className="space-y-6">
                                  {/* Quick Actions Header */}
                                  <div className="flex items-center justify-between pb-4 border-b border-gray-200/60">
                                    <div className="flex items-center gap-3">
                                      <Users className="w-5 h-5 text-gray-400" />
                                      <h4 className="font-black text-gray-900 uppercase tracking-tight">Class Submissions ({assignmentSubmissions[assg._id]?.length})</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={async () => {
                                          setLoading(true);
                                          try {
                                            await api.post(`/evaluator/${assg._id}/evaluate-all`);
                                            fetchSubmissions(assg._id);
                                          } catch (e) { alert("Evaluation failed"); }
                                          finally { setLoading(false); }
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black hover:bg-indigo-700 transition-all shadow-sm"
                                      >
                                        <Play className="w-3 h-3" /> Evaluate All
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          setLoading(true);
                                          try {
                                            await api.post(`/evaluator/${assg._id}/send-all`);
                                            fetchSubmissions(assg._id);
                                          } catch (e) { alert("Sending failed"); }
                                          finally { setLoading(false); }
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all shadow-sm"
                                      >
                                        <Send className="w-3 h-3" /> Send All
                                      </button>
                                    </div>
                                  </div>

                                  {/* Submissions Table */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="text-left border-b border-gray-100">
                                          <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Student</th>
                                          <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">AI Score</th>
                                          <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Status</th>
                                          <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {assignmentSubmissions[assg._id]?.map((sub) => (
                                          <tr key={sub._id} className="border-b border-gray-100/50 last:border-0 hover:bg-white/40 transition-colors">
                                            <td className="py-3 font-bold text-gray-900 text-sm whitespace-nowrap">{sub.student_name}</td>
                                            <td className="py-3 text-center">
                                              <span className={`text-sm font-black ${sub.score && sub.score > 70 ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                {sub.score ?? '--'}/100
                                              </span>
                                            </td>
                                            <td className="py-3 text-center">
                                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                sub.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 
                                                sub.status === 'evaluated' ? 'bg-indigo-100 text-indigo-700' : 
                                                'bg-gray-100 text-gray-600'
                                              }`}>
                                                {sub.status === 'sent' ? 'Published' : sub.status}
                                              </span>
                                            </td>
                                            <td className="py-3 text-right">
                                              <div className="flex items-center justify-end gap-1">
                                                <button 
                                                  title="Review Content"
                                                  onClick={() => { setSelectedSub(sub); setShowSubModal(true); }}
                                                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-indigo-600"
                                                >
                                                  <ExternalLink className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                  title="Evaluate"
                                                  onClick={async () => {
                                                    setLoading(true);
                                                    try {
                                                      await api.post(`/evaluator/${assg._id}/${sub._id}/evaluate`);
                                                      fetchSubmissions(assg._id);
                                                    } catch (e) { alert("Evaluation failed"); }
                                                    finally { setLoading(false); }
                                                  }}
                                                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-amber-600"
                                                >
                                                  <BrainCircuit className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                  title="Publish Result"
                                                  disabled={sub.status !== 'evaluated'}
                                                  onClick={async () => {
                                                    setLoading(true);
                                                    try {
                                                      await api.post(`/evaluator/${assg._id}/${sub._id}/send`);
                                                      fetchSubmissions(assg._id);
                                                    } catch (e) { alert("Send failed"); }
                                                    finally { setLoading(false); }
                                                  }}
                                                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-emerald-600 disabled:opacity-30"
                                                >
                                                  <Send className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : !result ? (
                            /* STUDENT VIEW: SUBMIT AREA */
                            <div className="p-5 bg-gray-50/50 space-y-4">
                              <div>
                                <p className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200 mb-4 whitespace-pre-line leading-relaxed">
                                  {assg.description}
                                </p>
                                <label className="text-sm font-bold text-gray-700 block mb-2">
                                  {assg.type === "coding" ? "Your Code Solution" : "Your Essay / Answer"}
                                </label>
                                {assg.type === "coding" ? (
                                  <textarea
                                    rows={10}
                                    value={codeInput}
                                    onChange={(e) => setCodeInput(e.target.value)}
                                    className="w-full font-mono text-sm px-4 py-3 bg-slate-900 text-green-300 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="# Write code here..."
                                  />
                                ) : (
                                  <textarea
                                    rows={8}
                                    value={theoryInput}
                                    onChange={(e) => setTheoryInput(e.target.value)}
                                    className="w-full text-sm px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                                    placeholder="Write answer here..."
                                  />
                                )}
                                <div className="mt-4">
                                  <label className="text-sm font-bold text-gray-700 block mb-2">Upload Document (Optional)</label>
                                  <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl bg-white hover:border-blue-400 transition-colors">
                                    <input 
                                      type="file" 
                                      id={`file-upload-${assg._id}`} 
                                      accept=".pdf,.ppt,.pptx,.py,.cpp"
                                      className="hidden" 
                                      onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                                    />
                                    <label htmlFor={`file-upload-${assg._id}`} className="flex items-center justify-center gap-3 cursor-pointer">
                                      <UploadCloud className="w-6 h-6 text-gray-400" />
                                      <div>
                                        <p className="text-sm font-bold text-gray-700">{submissionFile ? submissionFile.name : "Choose a file..."}</p>
                                        <p className="text-[10px] text-gray-400">PDF, PPT, or Code (.py, .cpp)</p>
                                      </div>
                                    </label>
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end pt-2">
                                <button
                                  onClick={() => handleSubmitSubmission(assg._id, assg.type)}
                                  disabled={submitting || (!codeInput.trim() && !theoryInput.trim() && !submissionFile)}
                                  className="px-8 py-3 bg-emerald-500 text-white font-black rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 disabled:bg-emerald-200 flex items-center gap-2"
                                >
                                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                  {submitting ? "Submitting..." : "Submit for Evaluation"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* STUDENT VIEW: FEEDBACK AREA */
                            <div className="p-5 bg-gray-50/50 space-y-4">
                              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-black text-gray-900 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-500" /> Evaluation Result
                                  </h4>
                                  {result.score !== undefined && (
                                    <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-black">
                                      Score: {result.score} / 100
                                    </div>
                                  )}
                                </div>
                                {(result.status === "sent" || isTeacher) ? (
                                  <>
                                    {result.feedback && (
                                      <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        {result.feedback}
                                      </div>
                                    )}
                                    {result.file_url && (
                                      <div className="mt-4 pt-4 border-t border-gray-100">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Submitted File</p>
                                        <a 
                                          href={result.file_url.replace(':8000/', ':8001/')} 
                                          target="_blank" 
                                          className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
                                        >
                                          <Paperclip className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                          <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 truncate">
                                            {result.file_name || "View submission file"}
                                          </span>
                                        </a>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="py-4 text-center">
                                    <p className="text-sm font-medium text-gray-400 italic">Marking in progress by instructor...</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Submission Detail Modal for Teacher */}
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
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Submission Review</p>
                </div>
                <button onClick={() => setShowSubModal(false)} className="p-2 hover:bg-white rounded-xl transition-colors shadow-sm">
                  <XCircle className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  <div className="md:col-span-2">
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Code className="w-4 h-4"/>
                      Student Content
                    </h4>
                    <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl font-mono text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-800">
                      {selectedSub.code || selectedSub.theory_answer || (selectedSub.submission_file_url ? "[Content uploaded in file below]" : "No content provided.")}
                    </div>
                    {selectedSub.submission_file_url && (
                        <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-3 text-blue-700">
                                <Paperclip className="w-5 h-5" />
                                <span className="text-sm font-bold uppercase tracking-tight">{selectedSub.file_name || "Attachment"}</span>
                            </div>
                            <a 
                                href={selectedSub.submission_file_url.replace(':8000/', ':8001/')}
                                target="_blank"
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-black hover:bg-blue-700 transition-all shadow-sm"
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> Open File
                            </a>
                        </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4 text-indigo-500"/>
                      AI Insights
                    </h4>
                    <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                      <div className="mb-6">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Current Score</p>
                        <p className="text-4xl font-black text-indigo-600">{selectedSub.score ?? "--"}<span className="text-lg opacity-50">/100</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Feedback</p>
                        <p className="text-sm font-medium text-indigo-900 leading-relaxed italic">
                          "{selectedSub.feedback || "Pending evaluation..."}"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6 border-t border-gray-100 flex justify-end">
                <button onClick={() => setShowSubModal(false)} className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-colors">
                  Close Review
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
