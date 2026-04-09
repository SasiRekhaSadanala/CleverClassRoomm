"use client";

import React, { useEffect, useState, useCallback } from "react";
import TopNav from "@/components/layout/TopNav";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  KeyRound,
  Copy,
  Check,
  BookOpen,
  Users,
  X,
  Loader2,
} from "lucide-react";

interface Course {
  _id: string;
  title: string;
  description: string;
  join_code?: string;
}

export default function UnifiedDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [createdCourses, setCreatedCourses] = useState<Course[]>([]);
  const [joinedCourses, setJoinedCourses] = useState<Course[]>([]);

  // Create classroom modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Join classroom
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");
  const [joinError, setJoinError] = useState("");

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState("");

  // Listen to query params for opening modals (from Sidebar)
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowCreateModal(true);
      router.replace("/dashboard");
    }
    if (searchParams.get("join") === "true") {
      setShowJoinModal(true);
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  const loadData = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const [createdRes, joinedRes] = await Promise.all([
        api.get(`/courses/created-by/${uid}`).catch(() => ({ data: [] })),
        api.get(`/courses/student/${uid}`).catch(() => ({ data: [] })),
      ]);
      setCreatedCourses(createdRes.data || []);
      setJoinedCourses(joinedRes.data || []);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getAuthUser();
    const uid = auth?.id || "";
    setUserId(uid);
    if (uid) loadData(uid);
    else setLoading(false);
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      await api.post("/courses", {
        title: newTitle.trim(),
        description: newDesc.trim() || "No description",
        teacher_id: userId,
      });
      setNewTitle("");
      setNewDesc("");
      setShowCreateModal(false);
      await loadData(userId);
    } catch (err: any) {
      setCreateError(
        err?.response?.data?.detail || "Failed to create classroom."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinMsg("");
    setJoinError("");
    try {
      const res = await api.post("/courses/join-by-code", {
        user_id: userId,
        join_code: joinCode.trim().toUpperCase(),
      });
      setJoinMsg(res.data?.message || "Joined successfully!");
      setJoinCode("");
      await loadData(userId);
      setTimeout(() => setShowJoinModal(false), 2000); // Close after showing success
    } catch (err: any) {
      setJoinError(
        err?.response?.data?.detail || "Failed to join. Check the code."
      );
    } finally {
      setJoining(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  const colorClasses = [
    "from-blue-600 to-blue-400",
    "from-indigo-600 to-indigo-400",
    "from-emerald-600 to-emerald-400",
    "from-amber-600 to-amber-400",
    "from-rose-600 to-rose-400",
    "from-purple-600 to-purple-400",
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full">
      <TopNav title="" />

      <main className="flex-1 p-8">
        {loading && (
          <div className="text-sm text-gray-500 mb-8 flex items-center gap-2 bg-gray-50 p-4 rounded-xl w-fit">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            Syncing classrooms...
          </div>
        )}

        {/* My Created Classrooms */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              My Classrooms
            </h2>
            <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {createdCourses.length}
            </span>
          </div>

          {createdCourses.length === 0 ? (
            <div className="p-10 rounded-2xl border-2 border-dashed border-gray-200 text-center text-gray-500 bg-gray-50/50">
              <p className="font-semibold text-lg text-gray-600">No classrooms created yet</p>
              <p className="text-sm mt-2 max-w-sm mx-auto">
                Use the "Create Classroom" button in the sidebar to create your first class and invite students.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {createdCourses.map((course, idx) => (
                <motion.div
                  key={course._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                  className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full"
                >
                  <div
                    className={`h-28 bg-gradient-to-tr ${colorClasses[idx % colorClasses.length]} p-5 relative`}
                  >
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Link
                      href={`/dashboard/courses/${course._id}`}
                      className="text-xl font-bold text-white hover:underline drop-shadow-md z-10 relative line-clamp-2"
                    >
                      {course.title}
                    </Link>
                  </div>
                    <div className="p-6 flex-1 flex flex-col">
                    <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1 font-medium leading-relaxed">
                      {course.description}
                    </p>

                    <Link
                      href={`/dashboard/courses/${course._id}`}
                      className="mb-4 block w-full text-center py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-sm font-bold rounded-xl transition-colors"
                    >
                      Open Classroom
                    </Link>

                    {course.join_code && (
                      <div className="mt-auto border-t border-gray-100 pt-4 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest block mb-1">
                            Class Code
                          </span>
                          <p className="text-base font-bold text-slate-800 tracking-widest font-mono bg-slate-50 px-2 py-1 rounded">
                            {course.join_code}
                          </p>
                        </div>
                        <button
                          onClick={() => copyCode(course.join_code!)}
                          className="p-2.5 rounded-xl hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-all active:scale-95"
                          title="Copy class code"
                        >
                          {copiedCode === course.join_code ? (
                            <Check className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Joined Classrooms */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              Enrolled Classrooms
            </h2>
            <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {joinedCourses.length}
            </span>
          </div>

          {joinedCourses.length === 0 ? (
            <div className="p-10 rounded-2xl border-2 border-dashed border-gray-200 text-center text-gray-500 bg-gray-50/50">
              <p className="font-semibold text-lg text-gray-600">
                You haven&apos;t joined any classes yet
              </p>
              <p className="text-sm mt-2 max-w-sm mx-auto">
                Use the "Join Classroom" button in the sidebar and enter your teacher's code to enroll.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {joinedCourses.map((course, idx) => (
                <motion.div
                  key={course._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                  className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all group flex flex-col h-full"
                >
                  <div
                    className={`h-28 bg-gradient-to-tr ${colorClasses[(idx + 3) % colorClasses.length]} p-5 relative`}
                  >
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Link
                      href={`/dashboard/courses/${course._id}`}
                      className="text-xl font-bold text-white hover:underline drop-shadow-md z-10 relative line-clamp-2"
                    >
                      {course.title}
                    </Link>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1 font-medium leading-relaxed">
                      {course.description}
                    </p>
                    <Link
                      href={`/dashboard/courses/${course._id}`}
                      className="mt-auto block w-full text-center py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-sm font-bold rounded-xl transition-colors"
                    >
                      Open Classroom
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Join Classroom Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowJoinModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                  Join a Classroom
                </h3>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleJoin} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Class Code
                  </label>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Ask your teacher for the class code, then enter it here. It's usually 6 letters and numbers.
                  </p>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. A B C 1 2 3"
                      value={joinCode}
                      onChange={(e) => {
                        setJoinCode(e.target.value.toUpperCase());
                        setJoinError("");
                        setJoinMsg("");
                      }}
                      className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl text-lg font-bold focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none tracking-[0.2em] uppercase transition-all"
                      maxLength={6}
                    />
                  </div>
                </div>

                {joinMsg && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-xl flex items-center gap-2">
                    <Check className="w-4 h-4" /> {joinMsg}
                  </motion.div>
                )}
                {joinError && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl flex items-center gap-2">
                    <X className="w-4 h-4" /> {joinError}
                  </motion.div>
                )}

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={joining || joinCode.length < 4}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-md shadow-blue-600/20"
                  >
                    {joining ? "Joining..." : "Join Class"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Classroom Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                  Create Class
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Class name (required)
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base font-medium focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all"
                  />
                </div>

                {createError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-medium">
                    {createError}
                  </p>
                )}

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newTitle.trim()}
                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:bg-slate-300 transition-colors shadow-md"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
