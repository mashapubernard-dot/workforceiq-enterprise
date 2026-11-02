"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RealVoipPanel from "../RealVoipPanel";

export default function DialerPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft size={17} /> Back to dashboard
        </Link>
        <RealVoipPanel />
      </div>
    </main>
  );
}
