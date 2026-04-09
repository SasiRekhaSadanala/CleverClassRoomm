import React from "react";
import TopNav from "@/components/layout/TopNav";
import { CalendarDays } from "lucide-react";

export default function GlobalCalendar() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50 border-t border-gray-100 w-full">
      <TopNav title="" />
      <main className="flex-1 p-8 max-w-5xl mx-auto w-full flex flex-col items-center justify-center">
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <CalendarDays className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-3">
             Calendar
          </h2>
          <p className="text-gray-500 font-medium max-w-sm">
            View your upcoming assignments and quizzes in a monthly view. This feature is coming soon!
          </p>
        </div>
      </main>
    </div>
  );
}
