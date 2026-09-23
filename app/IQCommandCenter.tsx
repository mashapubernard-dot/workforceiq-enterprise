"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Bot, CheckCircle2, Clock3, Lightbulb, MessageSquare, RefreshCw, Sparkles, Ticket, Users, Wrench } from "lucide-react";

type Employee={id:string;name:string;role:string;status:string;clockInAt:string|null;statusStartedAt:string|null};
type Schedule={id:string;user_id:string;schedule_date:string;start_time:string;end_time:string;break_minutes:number;shift_type:string;employee_name?:string};
type TicketRecord={id:string;title:string;priority:string;status:string;createdAt:string;slaMinutes:number};
type FieldWorkOrder={id:string;customer:string;site:string;status:string;priority:string;technician:string};
type HRCase={id:string;employeeName:string;category:string;status:string;priority:string};
type Props={employees:Employee[];schedules:Schedule[];tickets:TicketRecord[];fieldWorkOrders:FieldWorkOrder[];hrCases:HRCase[];now:number;onNavigate:(tab:string)=>void};
type Insight={severity:"critical"|"warning"|"info"|"good";title:string;detail:string;action:string;tab?:string};

function minutesSince(value:string|null,now:number){return value?Math.max(0,Math.floor((now-new Date(value).getTime())/60000)):0}
function openTicket(t:TicketRecord){return t.status!=="Resolved"&&t.status!=="Closed"}
function breached(t:TicketRecord,now:number){return openTicket(t)&&new Date(t.createdAt).getTime()+t.slaMinutes*60000<now}

export default function IQCommandCenter({employees,schedules,tickets,fieldWorkOrders,hrCases,now,onNavigate}:Props){
 const [query,setQuery]=useState("");
 const [lastRefresh,setLastRefresh]=useState(now);
 const metrics=useMemo(()=>{
   const d=new Date(now), key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
   return {
     openTickets:tickets.filter(openTicket).length,
     breaches:tickets.filter(t=>breached(t,now)).length,
     clockedIn:employees.filter(e=>Boolean(e.clockInAt)).length,
     working:employees.filter(e=>e.status==="Working").length,
     auxed:employees.filter(e=>e.status!=="Working"&&e.status!=="Off Duty"&&Boolean(e.clockInAt)).length,
     scheduledToday:schedules.filter(s=>s.schedule_date===key&&s.shift_type!=="Off").length,
     fieldOpen:fieldWorkOrders.filter(w=>w.status!=="Completed").length,
     hrOpen:hrCases.filter(c=>c.status!=="Resolved").length
   };
 },[employees,schedules,tickets,fieldWorkOrders,hrCases,now]);

 const insights=useMemo<Insight[]>(()=>{
   const r:Insight[]=[];
   const overdue=employees.filter(e=>(e.status==="Break"&&minutesSince(e.statusStartedAt,now)>15)||(e.status==="Lunch"&&minutesSince(e.statusStartedAt,now)>30));
   const sla=tickets.filter(t=>breached(t,now));
   const critical=tickets.filter(t=>t.priority==="Critical"&&openTicket(t));
   const parts=fieldWorkOrders.filter(w=>w.status==="Waiting Parts");
   const unassigned=fieldWorkOrders.filter(w=>w.status==="Unassigned");
   if(sla.length) r.push({severity:"critical",title:sla.length+" SLA breach"+(sla.length===1?"":"es")+" detected",detail:sla.slice(0,3).map(t=>t.title).join(" • "),action:"Open Service Hub",tab:"Service Hub"});
   if(critical.length) r.push({severity:"critical",title:critical.length+" critical ticket"+(critical.length===1?"":"s")+" still open",detail:"Critical work remains in the operational queue.",action:"Review tickets",tab:"Service Hub"});
   if(overdue.length) r.push({severity:"warning",title:overdue.length+" attendance timer"+(overdue.length===1?"":"s")+" over limit",detail:overdue.slice(0,3).map(e=>e.name).join(", "),action:"Review attendance",tab:"Time & Attendance"});
   if(parts.length) r.push({severity:"warning",title:parts.length+" field job"+(parts.length===1?"":"s")+" waiting for parts",detail:parts.slice(0,3).map(w=>w.customer||w.site||w.id).join(" • "),action:"Open Field Operations",tab:"Field Operations"});
   if(unassigned.length) r.push({severity:"warning",title:unassigned.length+" field job"+(unassigned.length===1?"":"s")+" unassigned",detail:"These jobs have not yet been assigned to a technician.",action:"Dispatch work",tab:"Field Operations"});
   if(metrics.hrOpen) r.push({severity:"info",title:metrics.hrOpen+" HR case"+(metrics.hrOpen===1?"":"s")+" need follow-up",detail:"Open employee-support work remains in HR.",action:"Open HR Support",tab:"HR Support"});
   if(!r.length) r.push({severity:"good",title:"Operational command center is clear",detail:metrics.working+" of "+metrics.clockedIn+" clocked-in employees are currently Working.",action:"Review workforce",tab:"People"});
   return r;
 },[employees,tickets,fieldWorkOrders,metrics,now]);

 const answer=useMemo(()=>{
   const q=query.toLowerCase();
   if(!q)return "";
   if(q.includes("sla")||q.includes("ticket"))return metrics.openTickets+" tickets are open and "+metrics.breaches+" are currently beyond SLA.";
   if(q.includes("staff")||q.includes("people")||q.includes("employee")||q.includes("working"))return metrics.clockedIn+" employees are clocked in: "+metrics.working+" Working and "+metrics.auxed+" currently auxed.";
   if(q.includes("field")||q.includes("technician"))return metrics.fieldOpen+" field work orders remain open.";
   if(q.includes("hr"))return metrics.hrOpen+" HR cases remain unresolved.";
   if(q.includes("schedule"))return metrics.scheduledToday+" non-off shifts are scheduled for today.";
   return "I can answer from live WorkforceIQ data about staff, attendance, schedules, tickets, SLA, field work and HR cases.";
 },[metrics,query]);

 const severityClass=(s:Insight["severity"])=>s==="critical"?"border-red-200 bg-red-50 text-red-900":s==="warning"?"border-amber-200 bg-amber-50 text-amber-900":s==="info"?"border-blue-200 bg-blue-50 text-blue-900":"border-emerald-200 bg-emerald-50 text-emerald-900";

 return <div className="space-y-6">
  <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 sm:p-8 text-white shadow-xl">
   <div className="relative">
    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider"><Sparkles size={14}/> IQ Brain</div>
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
     <div><h2 className="text-3xl sm:text-4xl font-black mt-4">WorkforceIQ Intelligence Layer</h2><p className="text-indigo-100 mt-2 max-w-2xl">Live operational signals from the WorkforceIQ modules you already use. The Brain turns attendance, schedules, tickets, field work and HR data into an actionable command queue without replacing your existing WFM.</p></div>
     <button type="button" onClick={()=>setLastRefresh(Date.now())} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-slate-900 px-5 py-3 font-black hover:bg-indigo-50"><RefreshCw size={17}/> Refresh intelligence</button>
    </div>
    <div className="text-xs text-indigo-200 mt-5">Last intelligence refresh: {new Date(lastRefresh).toLocaleTimeString()}</div>
   </div>
  </section>

  <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
   {[["Open Tickets",metrics.openTickets,Ticket,"Service Hub"],["SLA Breaches",metrics.breaches,AlertTriangle,"Service Hub"],["Clocked In",metrics.clockedIn,Users,"People"],["Field Jobs Open",metrics.fieldOpen,Wrench,"Field Operations"]].map(([label,value,Icon,tab])=>{const I=Icon as typeof Activity;return <button type="button" key={String(label)} onClick={()=>onNavigate(String(tab))} className="rounded-2xl bg-white border border-slate-200 p-5 text-left shadow-sm hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-slate-400">{String(label)}</span><I size={18} className="text-indigo-600"/></div><div className="text-3xl font-black mt-2 text-slate-900">{String(value)}</div></button>})}
  </section>

  <section className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.8fr] gap-6">
   <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
    <div className="p-5 border-b border-slate-100"><h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><Bot size={21} className="text-indigo-600"/> Brain priority queue</h3><p className="text-sm text-slate-500 mt-1">Explainable signals generated from current operational data.</p></div>
    <div className="p-4 space-y-3">{insights.map((i,n)=><div key={i.title+n} className={"rounded-2xl border p-4 "+severityClass(i.severity)}><div className="flex items-start gap-3"><div className="mt-0.5">{i.severity==="good"?<CheckCircle2 size={20}/>:i.severity==="critical"?<AlertTriangle size={20}/>:<Lightbulb size={20}/>}</div><div className="min-w-0 flex-1"><div className="font-black">{i.title}</div><div className="text-sm mt-1 opacity-80">{i.detail}</div>{i.tab&&<button type="button" onClick={()=>onNavigate(i.tab as string)} className="mt-3 rounded-xl bg-white/70 border border-black/5 px-3 py-2 text-xs font-black">{i.action} →</button>}</div></div></div>)}</div>
   </div>

   <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
    <div className="flex items-center gap-2"><MessageSquare size={20} className="text-violet-600"/><h3 className="text-xl font-black">Ask IQ</h3></div>
    <p className="text-sm text-slate-500 mt-1">Ask about live operational data already loaded in this session.</p>
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. How many SLA breaches?" className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"/>
    <div className="flex flex-wrap gap-2 mt-3">{["SLA breaches","Who is working?","Field jobs","HR cases","Today's schedule"].map(p=><button type="button" key={p} onClick={()=>setQuery(p)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600">{p}</button>)}</div>
    {answer&&<div className="mt-4 rounded-2xl bg-indigo-50 border border-indigo-100 p-4"><div className="text-xs font-black uppercase tracking-wider text-indigo-500">Live answer</div><div className="font-bold text-indigo-950 mt-1">{answer}</div></div>}
   </div>
  </section>

  <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
   <div className="flex items-center gap-2"><Activity size={20} className="text-cyan-600"/><div><h3 className="text-xl font-black">The WorkforceIQ AI roadmap</h3><p className="text-sm text-slate-500 mt-1">This first layer is deliberately connected to real WFM state. No mock operational numbers are introduced.</p></div></div>
   <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">{[["Brain","Live operational signals","Active"],["Workforce","Attendance, people & schedules","Connected"],["Machine","Rules & future automations","Next"],["Research","Knowledge + external sources","Next"],["Content","Operational communications","Next"],["Sales","CRM + revenue intelligence","Next"],["Support","AI ticket triage","Next"],["Analysis","Forecasting + recommendations","Next"]].map(([t,n,s])=><div key={t} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><div className="font-black text-slate-800">{t}</div><span className={"text-[10px] font-black uppercase rounded-full px-2 py-1 "+(s==="Active"?"bg-emerald-100 text-emerald-700":s==="Connected"?"bg-blue-100 text-blue-700":"bg-slate-200 text-slate-600")}>{s}</span></div><div className="text-xs text-slate-500 mt-2">{n}</div></div>)}</div>
  </section>

  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex items-center gap-2 font-black"><Clock3 size={17}/> Safe-by-design first step</div><div className="mt-1">The Brain currently observes and explains live data. It does not automatically change schedules, tickets, attendance or employee records. Automation actions will be added as a separate controlled layer.</div></div>
 </div>;
}
