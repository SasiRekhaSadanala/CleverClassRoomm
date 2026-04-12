"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { getAuthUser } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="h-screen w-full bg-gray-50 flex items-center justify-center text-gray-500 font-medium">
        Checking session...
      </div>
    );
  }

  const auth = getAuthUser();
  const role = auth?.role || "user";

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-[family-name:var(--font-geist-sans)]">
      <Sidebar role={role as any} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
