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
  X
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
}

export default function GlobalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("general");
  const [newCourseId, setNewCourseId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUserRole(user.role);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) return;
      const user = JSON.parse(storedUser);
      const userId = user.id || user._id;

      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [eventsRes, coursesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/calendar/?user_id=${userId}`, config),
        axios.get(`${API_BASE_URL}/courses/teacher/${userId}`, config).catch(() => 
          axios.get(`${API_BASE_URL}/courses/student/${userId}`, config)
        )
      ]);
      
      setEvents(eventsRes.data);
      // For teachers, we only want courses they can add events to
      if (user.role === 'teacher') {
        const createdRes = await axios.get(`${API_BASE_URL}/courses/created-by/${userId}`, config);
        setCourses(createdRes.data);
      } else {
        setCourses(coursesRes.data);
      }
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newCourseId) return;

    const storedUser = localStorage.getItem("user");
    if (!storedUser) return;
    const user = JSON.parse(storedUser);
    const userId = user.id || user._id;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/calendar/?creator_id=${userId}`,
        {
          title: newTitle,
          description: newDesc,
          date: selectedDate.toISOString(),
          event_type: newType,
          course_id: newCourseId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setIsModalOpen(false);
      setNewTitle("");
      setNewDesc("");
      fetchData();
    } catch (error) {
      console.error("Error creating event:", error);
      alert("Failed to create event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">
            Classroom Calendar
          </h2>
          <p className="text-gray-500 font-medium">
            Global view across all your enrolled courses
          </p>
        </div>
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
          const dayEvents = events.filter(e => isSameDay(parseISO(e.date), day));
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={idx}
              onClick={() => setSelectedDate(day)}
              className={`min-h-[120px] bg-white p-3 cursor-pointer transition-all hover:bg-blue-50/30 group relative ${
                !isCurrentMonth ? "bg-gray-50/50" : ""
              } ${isSelected ? "ring-2 ring-blue-500 ring-inset z-10" : ""}`}
            >
              <span className={`text-sm font-bold inline-flex items-center justify-center w-7 h-7 rounded-lg mb-2 ${
                isToday ? "bg-blue-600 text-white" : isSelected ? "text-blue-600" : isCurrentMonth ? "text-gray-800" : "text-gray-300"
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
                      'bg-blue-50 text-blue-700 border-blue-500'
                    }`}
                  >
                    {event.course_name}: {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-gray-400 font-bold pl-1">
                    + {dayEvents.length - 3} more
                  </div>
                )}
              </div>

              {/* Action for Teacher on hover */}
              {userRole === "teacher" && isCurrentMonth && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDate(day);
                    setIsModalOpen(true);
                  }}
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-blue-100 text-blue-600 rounded-lg transition-all hover:bg-blue-600 hover:text-white"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTodayEvents = () => {
    const selectedEvents = events.filter(e => isSameDay(parseISO(e.date), selectedDate));
    
    return (
      <div className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-gray-900 flex items-center">
            <Clock className="w-6 h-6 mr-3 text-blue-600" />
            Events for {format(selectedDate, "MMMM do")}
          </h3>
          {userRole === "teacher" && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center hover:bg-blue-700 transition-all text-sm shadow-md shadow-blue-100"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </button>
          )}
        </div>

        {selectedEvents.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-400 font-medium">No events scheduled for this day.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {selectedEvents.map((event) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 flex items-start space-x-4 group hover:border-blue-200 transition-all hover:shadow-md"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  event.type === 'exam' ? 'bg-red-100 text-red-600' :
                  event.type === 'assignment_deadline' ? 'bg-orange-100 text-orange-600' :
                  event.type === 'holiday' ? 'bg-green-100 text-green-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {event.type === 'exam' ? <GraduationCap /> : 
                   event.type === 'assignment_deadline' ? <BookOpen /> : 
                   event.type === 'holiday' ? <MapPin /> : <CalendarDays />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                      {event.course_name}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      event.type === 'exam' ? 'bg-red-100 text-red-700' :
                      event.type === 'assignment_deadline' ? 'bg-orange-100 text-orange-700' :
                      event.type === 'holiday' ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {event.type.replace('_', ' ')}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">
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
    <div className="flex flex-col h-full bg-gray-50 w-full pb-10">
      <TopNav title="" />
      <main className="flex-1 px-8 lg:px-12 py-10 max-w-7xl mx-auto w-full">
        <AnimatePresence>
          {loading ? (
            <motion.div 
               exit={{ opacity: 0 }}
               className="flex flex-col items-center justify-center py-40"
            >
              <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="font-bold text-gray-400">Loading academic schedule...</p>
            </motion.div>
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
              
              <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Create Calendar Event</h3>
              <p className="text-gray-500 font-medium mb-8">
                Adding event for {format(selectedDate, "MMMM do, yyyy")}
              </p>

              <form onSubmit={handleAddEvent} className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Select Course</label>
                  <select 
                    value={newCourseId}
                    onChange={(e) => setNewCourseId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
                    required
                  >
                    <option value="">Choose Course...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Event Title</label>
                  <input 
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. End Semester Examination"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 uppercase tracking-tight"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Event Type</label>
                    <select 
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>

                <button 
                  disabled={isSubmitting}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg tracking-tight uppercase hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Confirm Event"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
