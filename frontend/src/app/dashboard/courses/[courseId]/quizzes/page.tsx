"use client";

import React, { useEffect, useState, useCallback } from "react";
import TopNav from "@/components/layout/TopNav";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ClipboardList,
  ArrowRight,
  Trophy,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Trash2,
  Eye,
} from "lucide-react";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";

const STORAGE_KEY = "asc_student_id";

interface QuizItem {
  _id: string;
  title: string;
  creator_id?: string | null;
  questions: {
    text: string;
    options: string[];
    correct_option_index: number;
    explanation?: string;
  }[];
  created_at?: string;
}

interface ReviewItem {
  question: string;
  options: string[];
  your_answer: number;
  correct_answer: number;
  correct: boolean;
  explanation?: string;
}

type ViewState = "list" | "taking" | "result";

export default function StudentQuizzes() {
  const params = useParams();
  const courseId = params.courseId as string;

  const [studentId, setStudentId] = useState("");
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);

  // Completed quiz tracking
  const [completedQuizIds, setCompletedQuizIds] = useState<
    Record<string, { score: number; total: number }>
  >({});

  // Quiz-taking state
  const [view, setView] = useState<ViewState>("list");
  const [activeQuiz, setActiveQuiz] = useState<QuizItem | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Result state
  const [resultData, setResultData] = useState<{
    score: number;
    total: number;
    percentage: number;
    review: ReviewItem[];
  } | null>(null);
  const [showReview, setShowReview] = useState(false);
  
  // Teacher Actions
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateTopic, setGenerateTopic] = useState("");
  const [generateTitle, setGenerateTitle] = useState("");
  const [generateCount, setGenerateCount] = useState(5);
  const [generateDifficulty, setGenerateDifficulty] = useState("medium");
  const [generating, setGenerating] = useState(false);

  const loadQuizzes = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const authUser = getAuthUser();
      const sid = authUser?.id || window.localStorage.getItem(STORAGE_KEY) || "";
      const userRole = authUser?.role || "student";

      const [quizRes, resultRes] = await Promise.all([
        api.get(`/quizzes/course/${cid}`, {
          params: { user_id: sid, role: userRole },
        }),
        sid
          ? api.get(`/quizzes/student/${sid}/results`)
          : Promise.resolve({ data: [] }),
      ]);

      const qz = quizRes.data || [];
      const rs = resultRes.data || [];

      const completed: Record<string, any> = {};
      rs.forEach((r: any) => {
        completed[r.quiz_id] = { score: r.score, total: r.total };
      });

      setCompletedQuizIds(completed);
      setQuizzes(qz);
    } catch (e) {
      console.error("Load quizzes error", e);
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkRole = async () => {
      const auth = getAuthUser();
      if (!auth) return;
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
        console.error("Quizzes checkRole error:", e);
      }
    };
    checkRole();
    
    const authUser = getAuthUser();
    const savedSid = window.localStorage.getItem(STORAGE_KEY) || "";
    const sid = authUser?.role === "student" ? authUser.id : savedSid;
    setStudentId(sid || "");
    if (sid) {
      window.localStorage.setItem(STORAGE_KEY, sid);
    }
    if (courseId) {
      loadQuizzes(courseId);
    }
  }, [courseId, loadQuizzes]);

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generateTopic.trim()) return;
    setGenerating(true);
    setStatus("");
    try {
      const authUser = getAuthUser();
      const uid = authUser?.id || studentId;
      await api.post("/quizzes/ai-generate", {
        course_id: courseId,
        topic: generateTopic.trim(),
        title: generateTitle.trim() || undefined,
        num_questions: generateCount,
        difficulty: generateDifficulty,
        user_id: uid || undefined,
      });
      setShowGenerateModal(false);
      setGenerateTopic("");
      setGenerateTitle("");
      loadQuizzes(courseId);
    } catch (err: any) {
      console.error(err);
      setStatus(err?.response?.data?.detail || "Failed to generate quiz.");
    } finally {
      setGenerating(false);
    }
  };

  // --- Quiz-taking actions ---
  const startQuiz = (quiz: QuizItem) => {
    setActiveQuiz(quiz);
    setCurrentQ(0);
    setAnswers(new Array(quiz.questions.length).fill(null));
    setResultData(null);
    setShowReview(false);
    setView("taking");
  };

  const selectOption = (optionIndex: number) => {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[currentQ] = optionIndex;
      return copy;
    });
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    
    // If teacher, calculate local score for preview instead of submitting to DB
    if (isTeacher) {
        let correctCount = 0;
        const review: ReviewItem[] = activeQuiz.questions.map((q, idx) => {
            const isCorrect = answers[idx] === q.correct_option_index;
            if (isCorrect) correctCount++;
            return {
                question: q.text,
                options: q.options,
                your_answer: answers[idx] ?? -1,
                correct_answer: q.correct_option_index,
                explanation: q.explanation,
                correct: isCorrect
            };
        });
        
        const total = activeQuiz.questions.length;
        setResultData({
            score: correctCount,
            total: total,
            percentage: Math.round((correctCount / total) * 100),
            review: review
        });
        setView("result");
        return;
    }

    if (!studentId) {
      setStatus("Student session not found. Please log in as a student.");
      return;
    }
    setSubmittingQuiz(true);
    try {
      const res = await api.post(`/quizzes/${activeQuiz._id}/submit`, {
        student_id: studentId,
        answers: answers.map((a) => (a === null ? -1 : a)),
      });
      setResultData(res.data);
      setCompletedQuizIds((prev) => ({
        ...prev,
        [activeQuiz._id]: { score: res.data.score, total: res.data.total },
      }));
      setView("result");
    } catch (e) {
      console.error("Submit quiz error", e);
      setStatus("Quiz submission failed. Please try again.");
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const backToList = () => {
    setView("list");
    setActiveQuiz(null);
    setResultData(null);
  };

  // --- Review a completed quiz ---
  const reviewQuiz = async (quiz: QuizItem) => {
    if (!studentId) return;
    try {
      const res = await api.get(`/quizzes/${quiz._id}/review/${studentId}`);
      setActiveQuiz(quiz);
      setResultData(res.data);
      setShowReview(true);
      setView("result");
    } catch (e) {
      console.error("Review quiz error", e);
      setStatus("Could not load quiz review. Please try again.");
    }
  };

  // --- Delete a practice quiz ---
  const deleteQuiz = async (quizId: string) => {
    const authUser = getAuthUser();
    const uid = authUser?.id || studentId;
    if (!uid) return;
    try {
      await api.delete(`/quizzes/${quizId}`, {
        params: { user_id: uid },
      });
      setQuizzes((prev) => prev.filter((q) => q._id !== quizId));
      setCompletedQuizIds((prev) => {
        const copy = { ...prev };
        delete copy[quizId];
        return copy;
      });
    } catch (e: any) {
      console.error("Delete quiz error", e);
      setStatus(e?.response?.data?.detail || "Failed to delete quiz.");
    }
  };

  // --- Render ---
  if (view === "taking" && activeQuiz) {
    const question = activeQuiz.questions[currentQ];
    const total = activeQuiz.questions.length;
    const progress = ((currentQ + 1) / total) * 100;
    const allAnswered = answers.every((a) => a !== null);

    return (
      <div className="flex flex-col h-full overflow-y-auto bg-gray-50 border-t border-gray-100">
        <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <button
                onClick={backToList}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back to list
              </button>
              <span className="text-sm font-bold text-gray-600">
                Question {currentQ + 1} of {total}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
              />
            </div>
          </div>

          {/* Question card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-8"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6 leading-relaxed">
                {question.text}
              </h3>

              <div className="space-y-3">
                {question.options.map((opt, idx) => {
                  const isSelected = answers[currentQ] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => selectOption(idx)}
                      className={`w-full text-left p-4 rounded-xl border-2 font-medium transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm"
                          : "border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg mr-3 text-sm font-black ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
              disabled={currentQ === 0}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 font-semibold transition-colors"
            >
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>

            {currentQ < total - 1 ? (
              <button
                onClick={() => setCurrentQ((p) => Math.min(total - 1, p + 1))}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm transition-colors"
              >
                Next <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={submitQuiz}
                disabled={!allAnswered || submittingQuiz}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm transition-colors"
              >
                {submittingQuiz ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                {submittingQuiz ? "Submitting..." : "Submit Quiz"}
              </button>
            )}
          </div>

          {/* Answered indicator dots */}
          <div className="flex items-center justify-center gap-2 mt-8">
            {activeQuiz.questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`w-3 h-3 rounded-full transition-all ${
                  i === currentQ
                    ? "bg-blue-600 scale-125"
                    : answers[i] !== null
                      ? "bg-blue-300"
                      : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (view === "result" && resultData) {
    const isPassing = resultData.percentage >= 60;
    return (
      <div className="flex flex-col h-full overflow-y-auto bg-gray-50 border-t border-gray-100">
        <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
          {/* Score Card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`rounded-3xl p-8 text-center mb-8 shadow-lg ${
              isPassing
                ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                : "bg-gradient-to-br from-rose-500 to-pink-600"
            } text-white`}
          >
            <Trophy
              className={`w-16 h-16 mx-auto mb-4 ${
                isPassing ? "text-yellow-200" : "text-white/60"
              }`}
            />
            <h2 className="text-4xl font-black mb-2">
              {resultData.score}/{resultData.total}
            </h2>
            <p className="text-2xl font-bold opacity-90">
              {resultData.percentage}%
            </p>
            <p className="text-lg font-medium mt-2 opacity-80">
              {isPassing
                ? "Great job! Keep it up!"
                : "Keep practicing — you'll get there!"}
            </p>
          </motion.div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={backToList}
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-5 py-3 rounded-xl font-bold transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Back to Quizzes
            </button>
            <button
              onClick={() => setShowReview(!showReview)}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold shadow-sm transition-colors"
            >
              {showReview ? "Hide Review" : "Review Answers"}
            </button>
          </div>

          {/* Answer Review */}
          <AnimatePresence>
            {showReview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                {resultData.review.map((r, idx) => (
                  <div
                    key={idx}
                    className={`bg-white rounded-xl border-2 p-5 ${
                      r.correct ? "border-emerald-200" : "border-rose-200"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {r.correct ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <p className="font-semibold text-gray-900">
                        {r.question}
                      </p>
                    </div>
                    <div className="ml-8 space-y-1.5">
                      {r.options.map((opt, oi) => {
                        const isYours = oi === r.your_answer;
                        const isCorrectOpt = oi === r.correct_answer;
                        let style = "text-gray-500";
                        if (isCorrectOpt)
                          style =
                            "text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded";
                        if (isYours && !r.correct)
                          style =
                            "text-rose-600 font-bold line-through bg-rose-50 px-2 py-0.5 rounded";

                        return (
                          <p key={oi} className={`text-sm ${style}`}>
                            {String.fromCharCode(65 + oi)}. {opt}
                            {isCorrectOpt && (
                              <span className="ml-2 text-xs text-emerald-500">
                                ✓ Correct
                              </span>
                            )}
                            {isYours && !r.correct && (
                              <span className="ml-2 text-xs text-rose-400">
                                ← Your answer
                              </span>
                            )}
                          </p>
                        );
                      })}
                    </div>

                    {r.explanation && (
                      <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
                        <p className="text-sm font-bold text-blue-800 mb-1 flex items-center gap-2">
                          <ClipboardList className="w-4 h-4" /> Explanation
                        </p>
                        <p className="text-sm text-blue-700 leading-relaxed">
                          {r.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 border-t border-gray-100">
      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        {status ? (
          <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {status}
          </p>
        ) : null}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Available Quizzes
            </h2>
            <p className="text-gray-500 mt-1">
              AI-generated and instructor-created quizzes.
            </p>
          </div>
          <button 
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors whitespace-nowrap"
          >
              <PlusCircle className="w-4 h-4" /> Generate Quiz
          </button>
        </div>

        {/* Generate Modal */}
        <AnimatePresence>
          {showGenerateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">AI Quiz Generator</h3>
                  <button onClick={() => setShowGenerateModal(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <XCircle className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleGenerateQuiz} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Learning Topic</label>
                    <input
                      type="text"
                      placeholder="e.g. Recursion in Python"
                      value={generateTopic}
                      onChange={(e) => setGenerateTopic(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Quiz Title (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Weekly Challenge #1"
                      value={generateTitle}
                      onChange={(e) => setGenerateTitle(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Question Count</label>
                      <select
                        value={generateCount}
                        onChange={(e) => setGenerateCount(Number(e.target.value))}
                        className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium bg-white"
                      >
                        {[3, 5, 8, 10, 15].map(n => (
                          <option key={n} value={n}>{n} Questions</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Difficulty</label>
                      <select
                        value={generateDifficulty}
                        onChange={(e) => setGenerateDifficulty(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium bg-white"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowGenerateModal(false)}
                      className="px-5 py-2.5 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={generating || !generateTopic.trim()}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors flex items-center gap-2"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                        </>
                      ) : (
                        "Generate Questions"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading quizzes...
          </div>
        ) : quizzes.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-white/50 backdrop-blur-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
               <ClipboardList className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-900 font-bold text-xl mb-2">
              No quizzes available yet
            </p>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              Ready to test your knowledge? Use our AI generator to practice any topic right now!
            </p>
            <button 
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-all hover:scale-105 active:scale-95"
            >
                <PlusCircle className="w-5 h-5" /> Practice with AI
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {quizzes.map((quiz, idx) => {
              const completed = completedQuizIds[quiz._id];
              const isPractice = !!quiz.creator_id;
              return (
                <motion.div
                  key={quiz._id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  whileHover={{ y: -4 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      {isPractice && (
                        <span className="text-xs font-bold px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">
                          Practice
                        </span>
                      )}
                      {completed ? (
                        <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                          Score: {completed.score}/{completed.total}
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">
                          New
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 text-lg mb-1">
                    {quiz.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {quiz.questions.length} questions
                  </p>

                  <div className="mt-auto space-y-2">
                    {/* Main action button */}
                    <button
                      onClick={() => {
                        if (isTeacher) {
                          startQuiz(quiz);
                        } else if (completed) {
                          reviewQuiz(quiz);
                        } else {
                          startQuiz(quiz);
                        }
                      }}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all ${
                        isTeacher
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : completed
                            ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                            : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                      }`}
                    >
                      {isTeacher ? (
                        <>
                           Preview Quiz <ArrowRight className="w-4 h-4" />
                        </>
                      ) : completed ? (
                        <>
                          <Eye className="w-4 h-4" /> Review Answers
                        </>
                      ) : (
                        <>
                          Start Quiz <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Delete button for practice quizzes */}
                    {isPractice && (
                      <button
                        onClick={() => deleteQuiz(quiz._id)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl font-semibold text-sm text-rose-500 hover:bg-rose-50 border border-rose-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Quiz
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
