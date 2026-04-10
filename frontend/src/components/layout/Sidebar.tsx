"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  PlusCircle,
  KeyRound,
  BookOpen,
  FileText,
  CheckSquare,
  BarChart,
  Settings,
  LogOut,
  ArrowLeft,
  Bot,
  ClipboardCheck
} from "lucide-react";
import { clearAuthUser } from "@/lib/auth";

export default function Sidebar({
  role,
}: {
  role: "student" | "teacher" | "user";
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Detect if we are inside a course
  const courseMatch = pathname.match(/\/dashboard\/courses\/([^\/]+)/);
  const isCourseContext = !!courseMatch;
  const currCourseId = courseMatch ? courseMatch[1] : null;

  const handleLogout = () => {
    clearAuthUser();
    router.replace("/login");
  };

  // Global Context Items
  const globalNavItems = [
    { name: "Home", href: "/dashboard", icon: LayoutDashboard },
    { name: "To-do", href: "/dashboard/todo", icon: ClipboardList },
    { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
  ];

  // Course Context Items
  const courseNavItems = [
    {
      name: "Stream",
      href: `/dashboard/courses/${currCourseId}`,
      icon: LayoutDashboard,
    },
    {
      name: "Assignments",
      href: `/dashboard/courses/${currCourseId}/assignments`,
      icon: FileText,
    },
    {
      name: "Quizzes",
      href: `/dashboard/courses/${currCourseId}/quizzes`,
      icon: CheckSquare,
    },
    {
      name: "Knowledge Tutor",
      href: `/dashboard/courses/${currCourseId}/tutor`,
      icon: Bot,
    },
    {
      name: "Class Notes",
      href: `/dashboard/courses/${currCourseId}/notes`,
      icon: BookOpen,
    },
    {
      name: "Progress",
      href: `/dashboard/courses/${currCourseId}/progress`,
      icon: BarChart,
    },
    {
      name: "Evaluator",
      href: `/dashboard/courses/${currCourseId}/evaluator`,
      isTeacherOnly: true,
      icon: ClipboardCheck,
    },
  ];

  const filteredCourseNavItems = courseNavItems.filter(item => {
    if (item.isTeacherOnly) return role === 'teacher';
    return true;
  });

  const activeItems = isCourseContext ? filteredCourseNavItems : globalNavItems;

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      className="flex flex-col w-72 h-screen px-6 py-8 overflow-y-auto bg-slate-950 border-r border-slate-800"
    >
      <div className="flex items-center justify-center mb-10">
        <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 mr-3">
          <span className="text-white font-bold text-2xl">A</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            CleverClassRoom
          </h2>
          <p className="text-xs text-blue-400 font-medium">Agentic Platform</p>
        </div>
      </div>

      <div className="flex flex-col justify-between flex-1 mt-2">
        <nav className="space-y-2">
          {isCourseContext && (
            <div className="mb-6">
              <Link href="/dashboard">
                <motion.div
                  whileHover={{ x: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center px-4 py-2 text-blue-400 font-bold hover:text-blue-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Classes
                </motion.div>
              </Link>
              <div className="h-px bg-slate-800 my-4" />
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {activeItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link key={item.name} href={item.href}>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    whileHover={{
                      x: 4,
                      backgroundColor: "rgba(59, 130, 246, 0.1)",
                    }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center px-4 py-3 rounded-xl transition-colors ${
                      isActive
                        ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        isActive ? "text-blue-400" : "text-slate-500"
                      }`}
                    />
                    <span className="mx-4 font-medium">{item.name}</span>
                  </motion.div>
                </Link>
              );
            })}
          </AnimatePresence>

          {/* Action Buttons in Global View */}
          {!isCourseContext && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 space-y-3"
            >
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-4 mb-2">
                Classrooms
              </div>
              <Link href="/dashboard?join=true">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center px-4 py-2.5 rounded-xl border border-dashed border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 hover:bg-slate-800/50 transition-all cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  <span className="font-semibold text-sm">Join Classroom</span>
                </motion.div>
              </Link>
              <Link href="/dashboard?create=true">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-all cursor-pointer shadow-lg shadow-blue-900/20"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  <span className="font-semibold text-sm">
                    Create Classroom
                  </span>
                </motion.div>
              </Link>
            </motion.div>
          )}
        </nav>

        <div className="mt-8 space-y-2">
          <Link href="/settings">
            <div className="flex items-center px-4 py-3 text-slate-400 rounded-xl hover:bg-slate-900 transition-colors cursor-pointer">
              <Settings className="w-5 h-5" />
              <span className="mx-4 font-medium">Settings</span>
            </div>
          </Link>
          <button type="button" onClick={handleLogout} className="w-full">
            <div className="flex items-center px-4 py-3 text-red-500 rounded-xl hover:bg-red-500/10 transition-colors cursor-pointer">
              <LogOut className="w-5 h-5" />
              <span className="mx-4 font-medium">Log out</span>
            </div>
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
