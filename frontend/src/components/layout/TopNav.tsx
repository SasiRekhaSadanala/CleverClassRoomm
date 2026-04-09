"use client";

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Bell, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAuthUser } from '@/lib/auth';

export default function TopNav({ title }: { title: string }) {
  const [initials, setInitials] = useState("U");

  useEffect(() => {
    const user = getAuthUser();
    if (user?.name) {
      const parts = user.name.trim().split(" ");
      setInitials(
        parts
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      );
    } else if (user?.email) {
      setInitials(user.email[0].toUpperCase());
    }
  }, []);

  return (
    <header className="flex items-center justify-between px-8 py-5 bg-white/70 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
      <div>
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-gray-800"
        >
          {title}
        </motion.h1>
        <p className="text-sm text-gray-500 font-medium">
          {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </p>
      </div>

      <div className="flex items-center space-x-6">
        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search AI agents, topics..." 
            className="pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all w-64 text-sm font-medium outline-none"
          />
        </div>

        {/* Notifications */}
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
        </motion.button>

        {/* Profile */}
        <div className="flex items-center space-x-3 cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5">
            <div className="w-full h-full rounded-full border-2 border-white bg-slate-900 flex items-center justify-center overflow-hidden">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
