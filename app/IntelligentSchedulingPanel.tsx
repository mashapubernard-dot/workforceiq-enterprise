"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, MapPin, Sparkles, Users } from "lucide-react";

type Employee = { id: string; name: string; role?: string };
type Schedule = {
  id: string; user_id: string; schedule_date: string; start_time: string; end_time: string;
  break_minutes?: number; shift_type?: string; employee_name?: string;
};

function minutesOf(value: string) {
  const parts = String(value || "00:00").split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export default function IntelligentSchedulingPanel({
  employees, schedules, selectedDate, canManage,
}: {
  employees: Employee[]; schedules: Schedule[]; selectedDate: string; canManage: boolean;
}) {
  const [mode, setMode] = useState<"contact" | "field">("contact");
  const [callVolume, setCallVolume] = useState("120");
  const [aht, setAht] = useState("360");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [occupancy, setOccupancy] = useState("85");
  const [jobCount, setJobCount] = useState("18");
  const [jobHours, setJobHours] = useState("1.5");
  const [travelBuffer, setTravelBuffer] = useState("20");

  const daySchedules = useMemo(
    () => schedules.filter((s) => s.schedule_date === selectedDate),
    [schedules, selectedDate]
  );
  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    const grouped = new Map<string, Schedule[]>();
    for (const s of daySchedules) {
      const key = s.user_id;
      grouped.set(key, [...(grouped.get(key) || []), s]);
    }
    for (const [id, shifts] of grouped) {
      const sorted = [...shifts].sort((a,b) => minutesOf(a.start_time)-minutesOf(b.start_time));
      for (let i=1;i<sorted.length;i++) {
        const prevEnd = minutesOf(sorted[i-1].end_time) <= minutesOf(sorted[i-1].start_time)
          ? minutesOf(sorted[i-1].end_time)+1440 : minutesOf(sorted[i-1].end_time);
        const nextStart = minutesOf(sorted[i].start_time);
        if (nextStart < prevEnd) ids.add(id);
      }
    }
    return ids;
  }, [daySchedules]);

  const result = useMemo(() => {
    if (mode === "contact") {
      const volume = Math.max(0, Number(callVolume) || 0);
      const handle = Math.max(0, Number(aht) || 0);
      const interval = Math.max(1, Number(intervalMinutes) || 60);
      const occ = Math.min(100, Math.max(1, Number(occupancy) || 85)) / 100;
      const workloadHours = (volume * handle) / 3600;
      const required = Math.ceil(workloadHours / ((interval / 60) * occ));
      return { required, workloadHours, label: "agents needed", detail: "Workload estimate" };
    }
    const jobs = Math.max(0, Number(jobCount) || 0);
    const duration = Math.max(0, Number(jobHours) || 0);
    const travel = Math.max(0, Number(travelBuffer) || 0) / 60;
    const availableHours = 8;
    const totalHours = jobs * (duration + travel);
    return { required: Math.ceil(totalHours / availableHours), workloadHours: totalHours, label: "technicians needed", detail: "Daily capacity estimate" };
  }, [mode, callVolume, aht, intervalMinutes, occupancy, jobCount, jobHours, travelBuffer]);

  const scheduledPeople = new Set(daySchedules.map((s) => s.user_id)).size;
  const coverageDelta = scheduledPeople - result.required;
  const selectedLabel = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    : "Selected day";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-slate-950 via-red-950 to-rose-900 text-white p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider"><Sparkles size={14}/> Intelligent Scheduling</div>
            <h3 className="mt-3 text-2xl font-black">Plan the right people for the right work</h3>
            <p className="mt-1 text-sm text-white/75">Contact-centre staffing and field technician capacity in one planner.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 min-w-36">
            <div className="text-xs text-white/70">{selectedLabel}</div>
            <div className="text-2xl font-black">{daySchedules.length}</div>
            <div className="text-xs text-white/70">scheduled shifts</div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          <button type="button" onClick={() => setMode("contact")} className={`rounded-xl px-3 py-3 text-sm font-black flex items-center justify-center gap-2 ${mode === "contact" ? "bg-white text-red-700 shadow-sm" : "text-slate-600"}`}><HeadphonesIcon/>Contact centre</button>
          <button type="button" onClick={() => setMode("field")} className={`rounded-xl px-3 py-3 text-sm font-black flex items-center justify-center gap-2 ${mode === "field" ? "bg-white text-red-700 shadow-sm" : "text-slate-600"}`}><MapPin size={16}/>Field technicians</button>
        </div>

        {mode === "contact" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Field label="Expected contacts per interval" value={callVolume} setValue={setCallVolume} min="0"/>
            <Field label="Average handle time (seconds)" value={aht} setValue={setAht} min="0"/>
            <Field label="Interval length (minutes)" value={intervalMinutes} setValue={setIntervalMinutes} min="1"/>
            <Field label="Target occupancy (%)" value={occupancy} setValue={setOccupancy} min="1" max="100"/>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Jobs planned for the day" value={jobCount} setValue={setJobCount} min="0"/>
            <Field label="Average job duration (hours)" value={jobHours} setValue={setJobHours} min="0" step="0.25"/>
            <Field label="Travel buffer per job (minutes)" value={travelBuffer} setValue={setTravelBuffer} min="0"/>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Users size={15}/> Recommended staffing</div>
            <div className="mt-2 text-3xl font-black text-slate-900">{result.required}</div>
            <div className="text-sm text-slate-500">{result.label}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Clock3 size={15}/> Workload estimate</div>
            <div className="mt-2 text-3xl font-black text-slate-900">{result.workloadHours.toFixed(1)}h</div>
            <div className="text-sm text-slate-500">{result.detail}</div>
          </div>
          <div className={`rounded-2xl border p-4 ${coverageDelta < 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Activity size={15}/> Coverage snapshot</div>
            <div className="mt-2 text-3xl font-black text-slate-900">{scheduledPeople} / {result.required}</div>
            <div className={`text-sm font-semibold mt-1 ${coverageDelta < 0 ? "text-amber-800" : "text-emerald-800"}`}>
              {coverageDelta < 0 ? `${Math.abs(coverageDelta)} below target` : coverageDelta > 0 ? `${coverageDelta} above target` : "At target"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
            <div className="font-black text-slate-800">Schedule checks · {selectedLabel}</div>
            <span className="text-xs text-slate-500">{canManage ? "Manager view" : "Read-only view"}</span>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="p-4 flex items-start gap-3">
              {conflictIds.size ? <AlertTriangle className="text-red-600 shrink-0" size={19}/> : <CheckCircle2 className="text-emerald-600 shrink-0" size={19}/>}
              <div><div className="font-bold text-slate-800">Overlapping shifts</div><div className="text-sm text-slate-500">{conflictIds.size ? `${conflictIds.size} employee(s) have overlapping shifts on this date.` : "No overlapping shifts detected for this date."}</div></div>
            </div>
            <div className="p-4 flex items-start gap-3">
              {coverageDelta < 0 ? <AlertTriangle className="text-amber-600 shrink-0" size={19}/> : <CheckCircle2 className="text-emerald-600 shrink-0" size={19}/>}
              <div><div className="font-bold text-slate-800">Staffing coverage</div><div className="text-sm text-slate-500">{coverageDelta < 0 ? "Current schedule is below this estimate. Add shifts or adjust demand assumptions." : "Current scheduled headcount meets or exceeds this estimate."}</div></div>
            </div>
            <div className="p-4 flex items-start gap-3">
              <AlertTriangle className="text-slate-400 shrink-0" size={19}/>
              <div><div className="font-bold text-slate-800">Availability and skills</div><div className="text-sm text-slate-500">Not yet included in the live calculation. Employee availability, qualifications and travel routing need dedicated data before automatic publishing.</div></div>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">Planning estimate only: it does not create, edit or publish shifts. Existing schedules and attendance timers are left unchanged.</p>
      </div>
    </section>
  );
}

function HeadphonesIcon() { return <Activity size={16}/>; }
function Field({label, value, setValue, min, max, step}: {label:string; value:string; setValue:(v:string)=>void; min?:string; max?:string; step?:string}) {
  return <label className="block"><span className="text-sm font-bold text-slate-700">{label}</span><input type="number" value={value} min={min} max={max} step={step || "1"} onChange={(e)=>setValue(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-red-500"/></label>;
}
