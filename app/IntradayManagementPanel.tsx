"use client";

import { useMemo, useState, useEffect } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, Users, Coffee, CalendarClock } from "lucide-react";

type Employee = {
  id: string;
  name: string;
  role: string;
  status: string;
  clockInAt: string | null;
  clockOut: string;
  statusStartedAt: string | null;
};
type Schedule = {
  id: string;
  user_id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  shift_type: string;
  employee_name?: string;
};
type Props = {
  employees: Employee[];
  schedules: Schedule[];
  loading?: boolean;
  onRefresh?: () => void;
};

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function minutesOf(value: string) {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}
function timeLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function durationLabel(ms: number) {
  const total = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

export default function IntradayManagementPanel({ employees, schedules, loading = false, onRefresh }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const today = dateKey(new Date(now));
  const rows = useMemo(() => {
    const todaysSchedules = schedules.filter((s) => s.schedule_date === today);
    const employeeMap = new Map(employees.map((e) => [e.id, e]));
    const scheduledIds = new Set(todaysSchedules.map((s) => s.user_id));
    const scheduledRows = todaysSchedules.map((schedule) => {
      const employee = employeeMap.get(schedule.user_id);
      const clockedIn = Boolean(employee?.clockInAt && employee.clockOut === "—");
      const clockInDate = employee?.clockInAt ? new Date(employee.clockInAt) : null;
      const plannedStart = minutesOf(schedule.start_time);
      const actualStart = clockInDate && dateKey(clockInDate) === today
        ? clockInDate.getHours() * 60 + clockInDate.getMinutes()
        : null;
      const lateBy = actualStart === null ? 0 : Math.max(0, actualStart - plannedStart);
      const currentMinutes = new Date(now).getHours() * 60 + new Date(now).getMinutes();
      const missedClockIn = !clockedIn && !employee?.clockInAt && currentMinutes > plannedStart + 5;
      const isBreak = clockedIn && ["Break", "Lunch"].includes(employee?.status ?? "");
      const breakLimit = (employee?.status === "Lunch" ? 30 : 15) * 60000;
      const breakElapsed = isBreak && employee?.statusStartedAt ? now - new Date(employee.statusStartedAt).getTime() : 0;
      const breakOver = isBreak && breakElapsed > breakLimit;
      const status = !employee
        ? "Employee record unavailable"
        : clockedIn
          ? employee.status
          : missedClockIn
            ? "Not clocked in"
            : employee.clockInAt && employee.clockOut !== "—"
              ? "Shift ended"
              : "Awaiting shift";
      return {
        id: schedule.id,
        employeeName: employee?.name ?? schedule.employee_name ?? "Unknown employee",
        planned: `${schedule.start_time.slice(0, 5)}–${schedule.end_time.slice(0, 5)}`,
        actual: actualStart === null ? "—" : timeLabel(employee?.clockInAt ?? null),
        status,
        lateBy,
        missedClockIn,
        breakOver,
        breakElapsed,
        isBreak,
      };
    });
    const notScheduled = employees
      .filter((e) => !scheduledIds.has(e.id) && e.clockInAt && e.clockOut === "—")
      .map((e) => ({
        id: `unscheduled-${e.id}`,
        employeeName: e.name,
        planned: "Not scheduled",
        actual: timeLabel(e.clockInAt),
        status: e.status,
        lateBy: 0,
        missedClockIn: false,
        breakOver: false,
        breakElapsed: 0,
        isBreak: ["Break", "Lunch"].includes(e.status),
      }));
    return [...scheduledRows, ...notScheduled].sort((a, b) =>
      Number(b.missedClockIn || b.breakOver || b.lateBy > 5) - Number(a.missedClockIn || a.breakOver || a.lateBy > 5)
    );
  }, [employees, schedules, today, now]);

  const clockedIn = employees.filter((e) => Boolean(e.clockInAt && e.clockOut === "—")).length;
  const onBreak = employees.filter((e) => e.clockInAt && e.clockOut === "—" && ["Break", "Lunch"].includes(e.status)).length;
  const scheduledCount = schedules.filter((s) => s.schedule_date === today).length;
  const lateCount = rows.filter((r) => r.lateBy > 5).length;
  const missingCount = rows.filter((r) => r.missedClockIn).length;
  const breakOverCount = rows.filter((r) => r.breakOver).length;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-100">
              <Activity size={15} /> Live operations
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black">Intraday Management</h2>
            <p className="mt-2 text-sm text-slate-300">Compare today's planned shifts with available attendance and status records.</p>
            <p className="mt-1 text-xs text-slate-400">Today: {new Date(now).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Clock refresh: every 15 seconds</p>
          </div>
          <button type="button" onClick={onRefresh} disabled={loading || !onRefresh} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh workforce data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          { label: "Scheduled today", value: scheduledCount, icon: CalendarClock, tone: "text-blue-700 bg-blue-50" },
          { label: "Clocked in now", value: clockedIn, icon: Users, tone: "text-emerald-700 bg-emerald-50" },
          { label: "On break / lunch", value: onBreak, icon: Coffee, tone: "text-amber-700 bg-amber-50" },
          { label: "Late arrivals", value: lateCount, icon: Clock3, tone: "text-orange-700 bg-orange-50" },
          { label: "No clock-in", value: missingCount, icon: AlertTriangle, tone: "text-red-700 bg-red-50" },
        ].map((card) => {
          const Icon = card.icon;
          return <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}><Icon size={18} /></div>
            <div className="text-2xl font-black text-slate-900">{card.value}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">{card.label}</div>
          </div>;
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-black text-slate-900">Today's schedule adherence</h3>
            <p className="mt-1 text-xs text-slate-500">Late arrival threshold: more than 5 minutes after planned start. Break thresholds: 15 minutes; lunch: 30 minutes.</p>
          </div>
          <div className="text-xs font-semibold text-slate-500">{rows.length} workforce record(s)</div>
        </div>
        {rows.length === 0 ? <div className="p-8 text-center">
          <CalendarClock className="mx-auto mb-3 text-slate-300" size={32} />
          <p className="font-bold text-slate-700">No schedule records found for today</p>
          <p className="mt-1 text-sm text-slate-500">Create today's shifts or refresh the workforce data to populate this view.</p>
        </div> : <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Planned shift</th><th className="px-5 py-3">Actual clock-in</th><th className="px-5 py-3">Current status</th><th className="px-5 py-3">Variance / alert</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const alert = row.missedClockIn || row.breakOver || row.lateBy > 5;
                return <tr key={row.id} className={alert ? "bg-amber-50/50" : ""}>
                  <td className="px-5 py-4 font-bold text-slate-800">{row.employeeName}</td>
                  <td className="px-5 py-4 text-slate-600">{row.planned}</td>
                  <td className="px-5 py-4 text-slate-600">{row.actual}</td>
                  <td className="px-5 py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${row.status === "Not clocked in" || row.breakOver ? "bg-red-100 text-red-700" : row.status === "Working" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{row.status}</span></td>
                  <td className="px-5 py-4">
                    {row.missedClockIn ? <span className="font-bold text-red-700">No clock-in recorded</span>
                      : row.breakOver ? <span className="font-bold text-red-700">Break/lunch over limit ({durationLabel(row.breakElapsed)})</span>
                      : row.lateBy > 5 ? <span className="font-bold text-orange-700">{row.lateBy} min late</span>
                      : row.isBreak ? <span className="text-amber-700">On break / lunch</span>
                      : <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> No alert</span>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>}
      </div>
      <p className="text-xs text-slate-500">This panel reports the attendance and schedule data available to your account. It does not invent coverage targets or staffing requirements; alerts depend on recorded shift and status timestamps.</p>
    </div>
  );
}
