"use client";

import React, { useState, useEffect } from "react";
import TopNav from "@/components/layout/TopNav";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Clock, BookOpen,
  GraduationCap, MapPin, X, ArrowLeft, Trash2, Eye
} from "lucide-react";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek,
  endOfWeek, isSameMonth, isSameDay, eachDayOfInterval, parseISO
} from "date-fns";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { getAuthUser } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api/v1";

interface CalendarEvent {
  id: string; title: string; description?: string; date: string;
  type: string; course_name: string; course_id: string;
}
interface Course { id: string; title: string; teacher_id?: string; }

const getEventColor = (type: string) => {
  switch (type) {
    case 'exam': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-500', icon: 'bg-red-100 text-red-600', dot: 'bg-red-500' };
    case 'assignment_deadline': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-500', icon: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500' };
    case 'holiday': return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-500', icon: 'bg-green-100 text-green-600', dot: 'bg-green-500' };
    default: return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-500', icon: 'bg-cyan-100 text-cyan-600', dot: 'bg-cyan-500' };
  }
};
const getEventIcon = (type: string) => {
  switch (type) {
    case 'exam': return <GraduationCap className="w-4 h-4" />;
    case 'assignment_deadline': return <BookOpen className="w-4 h-4" />;
    case 'holiday': return <MapPin className="w-4 h-4" />;
    default: return <CalendarDays className="w-4 h-4" />;
  }
};
const compactDate = (dateStr: string) => { try { return format(parseISO(dateStr), "dd.MM.yy"); } catch { return dateStr; } };

export default function LocalClassroomCalendar() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchData(); }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const user = getAuthUser();
      if (!user) return;
      const userId = user.id;
      const role = (user.role || "").toLowerCase();
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [eventsRes, courseRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/calendar/?user_id=${userId}&course_id=${courseId}`, config),
        axios.get(`${API_BASE_URL}/courses/${courseId}`, config)
      ]);
      setEvents(eventsRes.data);
      const courseData = courseRes.data;
      setCourse(courseData);

      // Grant edit access if user is the course teacher OR has a teacher/admin role
      const isCourseOwner = courseData.teacher_id === userId || courseData.teacher_id === user.id;
      const isTeacherRole = role === 'teacher' || role === 'admin';
      setCanEdit(isCourseOwner || isTeacherRole);
    } catch (error) {
      console.error("Error fetching class calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    const user = getAuthUser();
    if (!user) return;
    setIsSubmitting(true);
    try {
      const creationDate = new Date(selectedDate);
      creationDate.setHours(12, 0, 0, 0);
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/calendar/?creator_id=${user.id}`,
        { title: newTitle, description: newDesc, date: creationDate.toISOString(), event_type: newType, course_id: courseId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsModalOpen(false);
      setNewTitle("");
      setNewDesc("");
      fetchData();
    } catch (error) {
      console.error("Error creating class event:", error);
      alert("Failed to create class event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const user = getAuthUser();
    if (!user) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/calendar/${eventId}?teacher_id=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event");
    }
  };

  // ─── STUDENT WHITEBOARD VIEW ───
  const renderStudentView = () => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const upcoming = events.filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date));
    const past = events.filter(e => e.date < todayStr).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => router.push(`/dashboard/courses/${courseId}`)}
            className="flex items-center text-sm font-black text-cyan-600 mb-2 hover:gap-2 transition-all uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Classroom
          </button>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">
            {course?.title || "Class"} — Events
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Eye className="w-4 h-4 text-gray-400" />
            <p className="text-gray-500 font-medium">Read-only view of classroom events</p>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-lg font-black text-gray-900 flex items-center mb-6">
            <CalendarDays className="w-5 h-5 mr-3 text-cyan-600" /> Upcoming Events
          </h3>
          {upcoming.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-gray-100 rounded-2xl">
              <CalendarDays className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-bold text-lg">No upcoming events</p>
              <p className="text-gray-300 text-sm mt-1">Your teacher hasn't added any events yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((event) => {
                const colors = getEventColor(event.type);
                return (
                  <motion.div key={event.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border border-gray-100 ${colors.bg} hover:shadow-md transition-all`}>
                    <div className="text-center shrink-0 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100">
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{format(parseISO(event.date), "MMM")}</div>
                      <div className="text-lg font-black text-gray-900 leading-tight">{format(parseISO(event.date), "dd")}</div>
                    </div>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors.icon}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}>
                        {event.type.replace('_', ' ')}
                      </span>
                      <h4 className="font-bold text-gray-900 uppercase tracking-tight truncate">{event.title}</h4>
                      {event.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{event.description}</p>}
                    </div>
                    <div className="shrink-0 text-xs font-mono font-bold text-gray-400">{compactDate(event.date)}</div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Past Events */}
        {past.length > 0 && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 opacity-70">
            <h3 className="text-lg font-black text-gray-900 flex items-center mb-6">
              <Clock className="w-5 h-5 mr-3 text-gray-400" /> Past Events
            </h3>
            <div className="space-y-2">
              {past.map((event) => {
                const colors = getEventColor(event.type);
                return (
                  <div key={event.id} className="flex items-center gap-3 py-2 px-4 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                    <span className="text-sm font-mono font-bold text-gray-400 shrink-0 w-16">{compactDate(event.date)}</span>
                    <span className="text-sm font-bold text-gray-600 truncate">{event.title}</span>
                    <span className={`ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${colors.bg} ${colors.text}`}>
                      {event.type.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  // ─── TEACHER CALENDAR GRID VIEW ───
  const renderTeacherView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarInterval = eachDayOfInterval({ start: startDate, end: endDate });
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const dayStr = format(selectedDate, "yyyy-MM-dd");
    const selectedEvents = events.filter(e => e.date.startsWith(dayStr));

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => router.push(`/dashboard/courses/${courseId}`)}
              className="flex items-center text-sm font-black text-cyan-600 mb-2 hover:gap-2 transition-all uppercase tracking-widest">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Classroom
            </button>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{course?.title || "Class"} Calendar</h2>
            <p className="text-gray-500 font-medium">Click any day to add an event</p>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={() => { setSelectedDate(new Date()); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-2xl font-bold text-sm hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-100">
              <Plus className="w-4 h-4" /> Add Event
            </button>
            <div className="flex items-center space-x-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-600"><ChevronLeft className="w-6 h-6" /></button>
              <div className="px-4 font-bold text-gray-800 min-w-[140px] text-center">{format(currentDate, "MMMM yyyy")}</div>
              <button onClick={handleNextMonth} className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-600"><ChevronRight className="w-6 h-6" /></button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white p-6 md:p-10 rounded-[40px] shadow-sm border border-gray-100">
          <div className="grid grid-cols-7 mb-2">
            {days.map((day) => (
              <div key={day} className="text-center text-xs font-black uppercase text-gray-400 tracking-widest pb-3">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
            {calendarInterval.map((day, idx) => {
              const dStr = format(day, "yyyy-MM-dd");
              const dayEvents = events.filter(e => e.date.startsWith(dStr));
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());
              return (
                <div key={idx}
                  onClick={() => { setSelectedDate(day); setIsModalOpen(true); }}
                  className={`min-h-[120px] bg-white p-3 cursor-pointer transition-all hover:bg-cyan-50/30 group relative ${
                    !isCurrentMonth ? "bg-gray-50/50 text-gray-400" : "text-gray-800"
                  } ${isSelected ? "ring-2 ring-cyan-500 ring-inset z-10" : ""}`}>
                  <span className={`text-sm font-bold inline-flex items-center justify-center w-7 h-7 rounded-lg mb-2 ${
                    isToday ? "bg-cyan-600 text-white" : isSelected ? "text-cyan-600" : isCurrentMonth ? "text-gray-800" : "text-gray-300"
                  }`}>{format(day, "d")}</span>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event, eIdx) => {
                      const colors = getEventColor(event.type);
                      return (
                        <div key={eIdx} className={`text-[10px] p-1 px-2 rounded-md truncate font-bold border-l-2 shadow-sm ${colors.bg} ${colors.text} ${colors.border}`}>
                          {event.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && <div className="text-[9px] text-gray-400 font-bold pl-1">+ {dayEvents.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Events */}
        <div className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <h3 className="text-xl font-black text-gray-900 flex items-center mb-6">
            <Clock className="w-6 h-6 mr-3 text-cyan-600" /> Class Schedule — {format(selectedDate, "MMMM do")}
          </h3>
          {selectedEvents.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl">
              <p className="text-gray-400 font-medium">No class events for this day. Click to add one.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {selectedEvents.map((event) => {
                const colors = getEventColor(event.type);
                return (
                  <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 flex items-start space-x-4 group hover:border-cyan-200 transition-all hover:shadow-md">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${colors.icon}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{event.type.replace('_', ' ')}</span>
                      <h4 className="font-bold text-gray-900 group-hover:text-cyan-600 transition-colors uppercase tracking-tight">{event.title}</h4>
                      {event.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{event.description}</p>}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      title="Delete event">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full pb-20">
      <TopNav title="" />
      <main className="flex-1 px-4 md:px-8 lg:px-12 py-10 max-w-7xl mx-auto w-full">
        <AnimatePresence>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40">
              <div className="w-12 h-12 border-4 border-cyan-600/20 border-t-cyan-600 rounded-full animate-spin mb-4" />
              <p className="font-bold text-gray-400 font-mono tracking-tighter">Loading calendar...</p>
            </div>
          ) : canEdit ? renderTeacherView() : renderStudentView()}
        </AnimatePresence>
      </main>

      {/* Add Event Modal (Teacher only) */}
      <AnimatePresence>
        {isModalOpen && canEdit && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-10 overflow-hidden">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Create Class Event</h3>
              <p className="text-gray-500 font-medium mb-8">For {course?.title} on {format(selectedDate, "MMMM do, yyyy")}</p>
              <form onSubmit={handleAddEvent} className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Event Title</label>
                  <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. End Semester Examination" required
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-gray-400 uppercase tracking-tight" />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Event Type</label>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all">
                    <option value="general">General</option>
                    <option value="exam">Examination</option>
                    <option value="submission">Submission</option>
                    <option value="holiday">Holiday</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Description (Optional)</label>
                  <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-gray-400" />
                </div>
                <button disabled={isSubmitting}
                  className="w-full py-4 bg-cyan-600 text-white rounded-2xl font-black text-lg tracking-tight uppercase hover:bg-cyan-700 transition-all shadow-xl shadow-cyan-100 disabled:opacity-50">
                  {isSubmitting ? "Creating..." : "Confirm Class Event"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
