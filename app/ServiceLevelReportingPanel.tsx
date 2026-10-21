"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock3, Download, Filter, Ticket as TicketIcon } from "lucide-react";

type Ticket = {
  id: string;
  department: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  requester: string;
  assignee: string;
  branch: string;
  slaMinutes: number;
  createdAt: string;
};

type Props = { tickets: Ticket[] };

function elapsedMinutes(createdAt: string, now: number) {
  const start = new Date(createdAt).getTime();
  return Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 60000)) : 0;
}
function durationLabel(minutes: number) {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function ServiceLevelReportingPanel({ tickets }: Props) {
  const [department, setDepartment] = useState("All");
  const [priority, setPriority] = useState("All");
  const [showClosed, setShowClosed] = useState(false);
  const [now] = useState(() => Date.now());

  const departments = useMemo(
    () => ["All", ...Array.from(new Set(tickets.map((t) => t.department).filter(Boolean))).sort()],
    [tickets]
  );

  const rows = useMemo(() => tickets
    .filter((t) => department === "All" || t.department === department)
    .filter((t) => priority === "All" || t.priority === priority)
    .filter((t) => showClosed || !["Resolved", "Closed"].includes(t.status))
    .map((ticket) => {
      const age = elapsedMinutes(ticket.createdAt, now);
      const sla = Math.max(0, Number(ticket.slaMinutes) || 0);
      const remaining = sla - age;
      const terminal = ["Resolved", "Closed"].includes(ticket.status);
      return { ...ticket, age, sla, remaining, terminal, breached: !terminal && sla > 0 && age > sla, atRisk: !terminal && sla > 0 && age >= sla * 0.8 && age <= sla };
    })
    .sort((a, b) => Number(b.breached) - Number(a.breached) || b.age - a.age),
  [tickets, department, priority, showClosed, now]);

  const openRows = rows.filter((r) => !r.terminal);
  const breached = openRows.filter((r) => r.breached).length;
  const atRisk = openRows.filter((r) => r.atRisk).length;
  const within = openRows.filter((r) => !r.breached && !r.atRisk && r.sla > 0).length;
  const noSla = openRows.filter((r) => r.sla <= 0).length;
  const compliance = openRows.length ? Math.round(((openRows.length - breached) / openRows.length) * 100) : 100;

  const departmentSummary = departments.filter((d) => d !== "All").map((name) => {
    const group = rows.filter((r) => r.department === name && !r.terminal);
    return { name, open: group.length, breached: group.filter((r) => r.breached).length, atRisk: group.filter((r) => r.atRisk).length };
  });

  function exportCsv() {
    const headers = ["Ticket ID", "Title", "Department", "Priority", "Status", "Requester", "Assignee", "Branch", "Created At", "Age Minutes", "SLA Minutes", "SLA State"];
    const data = rows.map((r) => [r.id, r.title, r.department, r.priority, r.status, r.requester, r.assignee, r.branch, r.createdAt, r.age, r.sla, r.terminal ? "Terminal status - resolution time unavailable" : r.sla <= 0 ? "SLA not configured" : r.breached ? "Breached" : r.atRisk ? "At risk" : "Within target"]);
    const csv = [headers, ...data].map((line) => line.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `workforceiq-service-level-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-100"><BarChart3 size={15} /> Service performance</div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black">Service-Level Reporting</h2>
            <p className="mt-2 max-w-2xl text-sm text-blue-100">Monitor open-ticket SLA risk, backlog age, priorities, and department performance using the ticket records available to your organisation.</p>
          </div>
          <button type="button" onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-blue-50"><Download size={16} /> Export CSV</button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: "Open tickets", value: openRows.length, icon: TicketIcon, tone: "bg-blue-50 text-blue-700" },
          { label: "SLA breached", value: breached, icon: AlertTriangle, tone: "bg-red-50 text-red-700" },
          { label: "Approaching SLA", value: atRisk, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
          { label: "Within target", value: within, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
          { label: "SLA not configured", value: noSla, icon: Activity, tone: "bg-slate-100 text-slate-700" },
        ].map((card) => {
          const Icon = card.icon;
          return <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}><Icon size={18} /></div><div className="text-2xl font-black text-slate-900">{card.value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{card.label}</div></div>;
        })}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><h3 className="font-black text-slate-900">Current open-ticket SLA posture</h3><p className="mt-1 text-sm text-slate-500">Age-based estimate against each ticket's configured SLA target.</p></div>
          <div className="rounded-xl bg-slate-50 px-4 py-3"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Not currently breached</div><div className="mt-1 text-2xl font-black text-slate-900">{compliance}%</div></div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${compliance}%` }} /></div>
        <p className="mt-2 text-xs text-slate-500">This percentage describes current open-ticket age versus configured SLA, not historical resolution compliance.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><h3 className="font-black text-slate-900">Backlog by department</h3><p className="mt-1 text-xs text-slate-500">Only departments represented in the current ticket data are shown.</p></div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><Filter size={14} /><select aria-label="Filter department" value={department} onChange={(e) => setDepartment(e.target.value)} className="bg-transparent outline-none">{departments.map((d) => <option key={d}>{d}</option>)}</select></label>
              <select aria-label="Filter priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><option>All</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Include resolved/closed</label>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {departmentSummary.map((item) => <div key={item.name} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="font-black text-slate-800">{item.name}</div><div className="mt-3 flex items-end justify-between"><div><div className="text-2xl font-black">{item.open}</div><div className="text-xs text-slate-500">open</div></div><div className="text-right"><div className="font-black text-red-700">{item.breached} breached</div><div className="text-xs font-semibold text-amber-700">{item.atRisk} approaching</div></div></div></div>)}
          {departmentSummary.length === 0 && <p className="p-4 text-sm text-slate-500">No department data available yet.</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h3 className="font-black text-slate-900">Ticket SLA queue</h3><p className="mt-1 text-xs text-slate-500">{rows.length} record(s) match your filters. Breach is based on ticket age exceeding configured SLA minutes.</p></div>
        {rows.length === 0 ? <div className="p-10 text-center"><TicketIcon size={34} className="mx-auto text-slate-300" /><p className="mt-3 font-bold text-slate-700">No tickets match these filters</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Priority / status</th><th className="px-4 py-3">Age</th><th className="px-4 py-3">SLA target</th><th className="px-4 py-3">SLA state</th><th className="px-4 py-3">Assignee</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => { const state = row.terminal ? "Resolved / closed" : row.sla <= 0 ? "No SLA target" : row.breached ? "Breached" : row.atRisk ? "Approaching" : "Within target"; const style = row.breached ? "bg-red-100 text-red-700" : row.atRisk ? "bg-amber-100 text-amber-800" : row.terminal ? "bg-slate-100 text-slate-600" : row.sla <= 0 ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"; return <tr key={row.id} className={row.breached ? "bg-red-50/40" : ""}><td className="px-4 py-4"><div className="font-black text-slate-800">{row.id}</div><div className="mt-1 max-w-xs truncate text-xs text-slate-500" title={row.title}>{row.title}</div><div className="mt-1 text-[11px] text-slate-400">{row.branch || "No branch"} · {row.requester || "No requester"}</div></td><td className="px-4 py-4 text-slate-600">{row.department}</td><td className="px-4 py-4"><div className="font-bold text-slate-800">{row.priority}</div><div className="mt-1 text-xs text-slate-500">{row.status}</div></td><td className="px-4 py-4 font-semibold text-slate-700">{durationLabel(row.age)}</td><td className="px-4 py-4 text-slate-600">{row.sla > 0 ? durationLabel(row.sla) : "Not set"}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>{state}</span>{!row.terminal && row.sla > 0 && <div className="mt-1 text-[11px] text-slate-400">{row.remaining >= 0 ? `${durationLabel(row.remaining)} left` : `${durationLabel(Math.abs(row.remaining))} overdue`}</div>}</td><td className="px-4 py-4 text-slate-600">{row.assignee || "Unassigned"}</td></tr>; })}</tbody></table></div>}
      </section>

      <p className="text-xs leading-relaxed text-slate-500">Reporting note: ticket records currently provide creation time and SLA minutes, but not a verified resolution timestamp/history in this panel. Resolved/closed tickets are therefore excluded from the live breach calculation by default, and this screen does not claim historical SLA resolution compliance. The report respects the ticket data returned to the signed-in organisation.</p>
    </div>
  );
}
