"use client";

import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  Clock3,
  HardDrive,
  MapPin,
  PhoneCall,
  Receipt,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

type AdvancedFeature = {
  id: number;
  name: string;
  icon: typeof Activity;
  description: string;
  status: "Live foundation" | "Existing module";
};

const features: AdvancedFeature[] = [
  { id: 1, name: "GPS Live Field Map", icon: MapPin, description: "Live tenant-scoped workforce location tracking.", status: "Live foundation" },
  { id: 2, name: "Real Phone Integration", icon: PhoneCall, description: "Telephony provider connection and call-event foundation.", status: "Live foundation" },
  { id: 3, name: "Notifications", icon: Bell, description: "Rule-based in-app, email, WhatsApp, SMS and push notification foundation.", status: "Live foundation" },
  { id: 4, name: "Billing / Inventory / Revenue", icon: Receipt, description: "Billing transactions connected to customers and invoices.", status: "Live foundation" },
  { id: 5, name: "Accurate Pauses", icon: Clock3, description: "Status history and pause-duration tracking foundation.", status: "Existing module" },
  { id: 6, name: "Intelligent Scheduling", icon: CalendarDays, description: "Schedules plus forecast-aware workforce planning foundation.", status: "Existing module" },
  { id: 7, name: "Intraday Management", icon: Activity, description: "Live operational events and intervention tracking.", status: "Live foundation" },
  { id: 8, name: "Automation Intelligence", icon: Sparkles, description: "Tenant-scoped automation rules and execution metadata.", status: "Live foundation" },
  { id: 9, name: "Powerful Service-Level Reporting", icon: BarChart3, description: "Interval service-level, abandonment and AHT snapshots.", status: "Live foundation" },
  { id: 10, name: "Advanced Device Tracking", icon: HardDrive, description: "Tenant-scoped device/session tracking foundation.", status: "Existing module" },
  { id: 11, name: "Live Field Technician Tracking", icon: MapPin, description: "Mobile workforce sessions and GPS location foundation.", status: "Live foundation" },
  { id: 12, name: "Asset Lifecycle Management", icon: HardDrive, description: "Asset event history for assignment, movement and lifecycle changes.", status: "Existing module" },
  { id: 13, name: "Preventative Maintenance Management", icon: Wrench, description: "Recurring maintenance plans, due dates and ownership.", status: "Live foundation" },
  { id: 14, name: "Workforce Forecasting", icon: Activity, description: "Interval forecasts for volume, AHT, required and scheduled agents.", status: "Live foundation" },
  { id: 15, name: "Mobile Workforce Experience", icon: Users, description: "Mobile session, presence and field-workforce foundation.", status: "Live foundation" },
];

export default function AdvancedWorkforcePlatform() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -left-20 -bottom-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider">
            <Sparkles size={15} />
            Advanced Workforce Platform
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mt-4">15 operational expansions</h2>
          <p className="text-indigo-100 mt-2 max-w-3xl">
            All 15 features live together here, while your existing WorkforceIQ modules remain unchanged.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="h-11 w-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <Icon size={21} />
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                  {String(feature.id).padStart(2, "0")}
                </span>
              </div>
              <h3 className="font-black text-slate-900 mt-4">{feature.name}</h3>
              <p className="text-sm text-slate-500 mt-2 leading-6">{feature.description}</p>
              <div className="mt-4 text-xs font-black text-emerald-700">{feature.status}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="font-black text-amber-900">Build status</div>
        <p className="text-sm text-amber-800 mt-1">
          This is the dedicated home for the 15-feature expansion. The next implementation work can turn each foundation into its full operational workflow without replacing the existing WFM.
        </p>
      </div>
    </div>
  );
}
