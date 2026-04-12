"use client";

import React, { useState, useEffect } from "react";
import TopNav from "@/components/layout/TopNav";
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  BookOpen, 
  GraduationCap, 
  MapPin, 
  AlertCircle,
  X,
  ArrowLeft
} from "lucide-react";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO
} from "date-fns";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { getAuthUser } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api/v1";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: string;
  course_name: string;
  course_id: string;
}

interface Course {
  id: string;
  title: string;
  teacher_id?: string;
}

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

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [courseId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const user = getAuthUser();
      if (!user) return;
      const userId = user.id;
      const role = (user.role || "").toLowerCase();

      // Broad Permission check: are they a teacher or admin?
      if (role === 'teacher' || role === 'admin' || role === 'user') {
        setCanEdit(true);
      }

      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [eventsRes, courseRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/calendar/?user_id=${userId}&course_id=${courseId}`, config),
        axios.get(`${API_BASE_URL}/courses/${courseId}`, config)
      ]);
      
      setEvents(eventsRes.data);
      const courseData = courseRes.data;
      setCourse(courseData);
      
      // Strict check: if they are a student, they definitely shouldn't edit
      if (role === 'student') {
        setCanEdit(false);
      }
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
    const userId = user.id;

    setIsSubmitting(true);
    try {
      // Set to noon to avoid timezone shifts pushing it to the wrong day
      const creationDate = new Date(selectedDate);
      creationDate.setHours(12, 0, 0, 0);

      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/calendar/?creator_id=${userId}`,
        {
          title: newTitle,
          description: newDesc,
          date: creationDate.toISOString(),
          event_type: newType,
          course_id: courseId
        },
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

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-8">
        <div>
          <button 
            onClick={() => router.push(`/dashboard/courses/${courseId}`)}
            className="flex items-center text-sm font-black text-blue-600 mb-2 hover:gap-2 transition-all uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Classroom
          </button>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">
            {course?.title || "Class"} Calendar
          </h2>
          <p className="text-gray-500 font-medium">
            Manage local exams, deadlines, and milestones
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <button 
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-600"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="px-4 font-bold text-gray-800 min-w-[140px] text-center">
              {format(currentDate, "MMMM yyyy")}
            </div>
            <button 
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-600"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day) => (
          <div key={day} className="text-center text-xs font-black uppercase text-gray-400 tracking-widest pb-3">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarInterval = eachDayOfInterval({
      start: startDate,
      end: endDate
    });

    return (
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        {calendarInterval.map((day, idx) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const dayEvents = events.filter(e => e.date.startsWith(dayStr));
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={idx}
              onClick={() => {
                setSelectedDate(day);
                // If they are a teacher/admin, allow adding events to ANY day they click
                if (canEdit) {
                  setIsModalOpen(true);
                }
              }}
              className={`min-h-[120px] bg-white p-3 cursor-pointer transition-all hover:bg-cyan-50/30 group relative ${
                !isCurrentMonth ? "bg-gray-50/50 text-gray-400" : "text-gray-800"
              } ${isSelected ? "ring-2 ring-cyan-500 ring-inset z-10" : ""}`}
            >
              <span className={`text-sm font-bold inline-flex items-center justify-center w-7 h-7 rounded-lg mb-2 ${
                isToday ? "bg-cyan-600 text-white" : isSelected ? "text-cyan-600" : isCurrentMonth ? "text-gray-800" : "text-gray-300"
              }`}>
                {format(day, "d")}
              </span>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event, eIdx) => (
                  <div 
                    key={eIdx}
                    className={`text-[10px] p-1 px-2 rounded-md truncate font-bold border-l-2 shadow-sm ${
                      event.type === 'exam' ? 'bg-red-50 text-red-700 border-red-500' :
                      event.type === 'assignment_deadline' ? 'bg-orange-50 text-orange-700 border-orange-500' :
                      event.type === 'holiday' ? 'bg-green-50 text-green-700 border-green-500' :
                      'bg-cyan-50 text-cyan-700 border-cyan-500'
                    }`}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-gray-400 font-bold pl-1">
                    + {dayEvents.length - 3} more
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>
    );
  };

  const renderTodayEvents = () => {
    const dayStr = format(selectedDate, "yyyy-MM-dd");
    const selectedEvents = events.filter(e => e.date.startsWith(dayStr));
    
    return (
      <div className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-gray-900 flex items-center">
            <Clock className="w-6 h-6 mr-3 text-cyan-600" />
            Class Schedule - {format(selectedDate, "MMMM do")}
          </h3>
        </div>

        {selectedEvents.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl">
            <p className="text-gray-400 font-medium">No class events for this day.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {selectedEvents.map((event) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 flex items-start space-x-4 group hover:border-cyan-200 transition-all hover:shadow-md"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  event.type === 'exam' ? 'bg-red-100 text-red-600' :
                  event.type === 'assignment_deadline' ? 'bg-orange-100 text-orange-600' :
                  event.type === 'holiday' ? 'bg-green-100 text-green-600' :
                  'bg-cyan-100 text-cyan-600'
                }`}>
                  {event.type === 'exam' ? <GraduationCap /> : 
                   event.type === 'assignment_deadline' ? <BookOpen /> : 
                   event.type === 'holiday' ? <MapPin /> : <CalendarDays />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                      {event.type.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 group-hover:text-cyan-600 transition-colors uppercase tracking-tight">
                    {event.title}
                  </h4>
                  {event.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
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
               <p className="font-bold text-gray-400 font-mono tracking-tighter">Initializing local workspace...</p>
             </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {renderHeader()}
              <div className="bg-white p-6 md:p-10 rounded-[40px] shadow-sm border border-gray-100">
                {renderDays()}
                {renderCells()}
              </div>
              {renderTodayEvents()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Add Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-10 overflow-hidden"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Create Class Event</h3>
              <p className="text-gray-500 font-medium mb-8">
                For {course?.title} on {format(selectedDate, "MMMM do, yyyy")}
              </p>

              <form onSubmit={handleAddEvent} className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Event Title</label>
                  <input 
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. End Semester Examination"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-gray-400 uppercase tracking-tight"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Event Type</label>
                    <select 
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                    >
                      <option value="general">General</option>
                      <option value="exam">Examination</option>
                      <option value="submission">Submission</option>
                      <option value="holiday">Holiday</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Description (Optional)</label>
                  <textarea 
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>

                <button 
                  disabled={isSubmitting}
                  className="w-full py-4 bg-cyan-600 text-white rounded-2xl font-black text-lg tracking-tight uppercase hover:bg-cyan-700 transition-all shadow-xl shadow-cyan-100 disabled:opacity-50"
                >
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
