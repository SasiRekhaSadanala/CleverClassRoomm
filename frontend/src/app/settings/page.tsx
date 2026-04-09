"use client";

import React from 'react';
import TopNav from '@/components/layout/TopNav';

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-50">
      <TopNav title="Settings" />
      <main className="flex-1 p-8">
        <div className="max-w-2xl bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Profile Settings</h2>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Preferences and account settings will be configurable here.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
