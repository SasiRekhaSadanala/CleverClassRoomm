"use client";

import React, { useState, useEffect } from "react";
import TopNav from "@/components/layout/TopNav";
import { getAuthUser } from "@/lib/auth";
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  BookOpen, 
  GraduationCap, 
  MapPin,
  Eye
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

export default function GlobalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const auth = getAuthUser();
      if (!auth) {
        setLoading(false);
        return;
      }
      const userId = auth.id;
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      // Fetch all events across all enrolled/taught courses (no course_id filter = global)
      const eventsRes = await axios.get(`${API_BASE_URL}/calendar/?user_id=${userId}`, config);
      setEvents(eventsRes.data);
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Format a date string to compact display format like "26.04.26"
  const compactDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return format(d, "dd.MM.yy");
    } catch {
      return dateStr;
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

  const getEventColor = (type: string) => {
    switch (type) {
      case 'exam': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-500', icon: 'bg-red-100 text-red-600', dot: 'bg-red-500' };
      case 'assignment_deadline': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-500', icon: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500' };
      case 'holiday': return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-500', icon: 'bg-green-100 text-green-600', dot: 'bg-green-500' };
      default: return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-500', icon: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' };
    }
  };

  const renderHeader = () => (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">
          Academic Schedule
        </h2>
        <div className="flex items-center gap-2 mt-1">
          <Eye className="w-4 h-4 text-gray-400" />
          <p className="text-gray-500 font-medium">
            Read-only view of all your classroom events
          </p>
        </div>
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
                {dayEvents.slice(0, 3).map((event, eIdx) => {
                  const colors = getEventColor(event.type);
                  return (
                    <div 
                      key={eIdx}
                      className={`text-[10px] p-1 px-2 rounded-md truncate font-bold border-l-2 shadow-sm ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {event.course_name}: {event.title}
                    </div>
                  );
                })}
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

  const renderSelectedDayEvents = () => {
    const dayStr = format(selectedDate, "yyyy-MM-dd");
    const selectedEvents = events.filter(e => e.date.startsWith(dayStr));
    
    return (
      <div className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-gray-900 flex items-center">
            <Clock className="w-6 h-6 mr-3 text-blue-600" />
            Events for {format(selectedDate, "MMMM do")}
          </h3>
        </div>

        {selectedEvents.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl">
            <CalendarDays className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No events scheduled for this day.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map((event) => {
              const colors = getEventColor(event.type);
              return (
                <motion.div 
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border border-gray-100 ${colors.bg} hover:shadow-md transition-all`}
                >
                  {/* Date badge */}
                  <div className="text-center shrink-0 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {format(parseISO(event.date), "MMM")}
                    </div>
                    <div className="text-lg font-black text-gray-900 leading-tight">
                      {format(parseISO(event.date), "dd")}
                    </div>
                  </div>

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${colors.icon}`}>
                    {getEventIcon(event.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}>
                        {event.course_name}
                      </span>
                      <span className="text-[10px] text-gray-300">•</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        {event.type.replace('_', ' ')}
                      </span>
                    </div>
                    <h4 className={`font-bold text-gray-900 uppercase tracking-tight truncate`}>
                      {event.title}
                    </h4>
                    {event.description && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                        {event.description}
                      </p>
                    )}
                  </div>

                  {/* Compact date label */}
                  <div className="shrink-0 text-xs font-mono font-bold text-gray-400">
                    {compactDate(event.date)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Upcoming events list (below calendar) — all future events across all classes
  const renderUpcomingList = () => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const upcoming = events
      .filter(e => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);

    if (upcoming.length === 0) return null;

    return (
      <div className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
        <h3 className="text-xl font-black text-gray-900 flex items-center mb-6">
          <CalendarDays className="w-6 h-6 mr-3 text-blue-600" />
          Upcoming Events
        </h3>
        <div className="space-y-2">
          {upcoming.map((event) => {
            const colors = getEventColor(event.type);
            return (
              <div
                key={event.id}
                className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                <span className="text-sm font-mono font-bold text-gray-400 shrink-0 w-16">
                  {compactDate(event.date)}
                </span>
                <span className="text-sm font-bold text-blue-600 shrink-0">
                  {event.course_name}
                </span>
                <span className="text-gray-300">·</span>
                <span className="text-sm font-bold text-gray-800 truncate">
                  {event.title}
                </span>
                <span className={`ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${colors.bg} ${colors.text}`}>
                  {event.type.replace('_', ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full pb-20">
      <TopNav title="" />
      <main className="flex-1 px-4 md:px-8 lg:px-12 py-10 max-w-7xl mx-auto w-full">
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
              {renderSelectedDayEvents()}
              {renderUpcomingList()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
