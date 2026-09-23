"use client";

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, Clock3, FileText, Mail, Play, ShieldCheck, Sparkles, Target, UserRound, Workflow, XCircle } from "lucide-react";

type Employee={id:string;name:string;role:string;status:string;clockInAt:string|null;statusStartedAt:string|null};
type TicketRecord={id:string;title:string;priority:string;status:string;createdAt:string;slaMinutes:number};
type FieldWorkOrder={id:string;customer:string;site:string;status:string;priority:string;technician:string};
type HRCase={id:string;employeeName:string;category:string;status:string;priority:string};
type Props={employees:Employee[];tickets:TicketRecord[];fieldWorkOrders:FieldWorkOrder[];hrCases:HRCase[]};

type Action={id:string;title:string;reason:string;target:string;requiresApproval:boolean;type:string};

function openTicket(t:TicketRecord){return t.status!=="Resolved"&&t.status!=="Closed"}

export default function IQAutomationMachine({employees,tickets,fieldWorkOrders,hrCases}:Props){
 const [enabled,setEnabled]=useState<Record<string,boolean>>({
  late:"true"==="true",sla:true,field:true,hr:false,content:false
 });
 const [approved,setApproved]=useState<Record<string,boolean>>({});
 const [tab,setTab]=useState("Machine");

 const actions=useMemo<Action[]>(()=>{
  const out:Action[]=[];
  const late=employees.filter(e=>e.status==="Break"||e.status==="Lunch").length;
  const breaches=tickets.filter(t=>openTicket(t)&&new Date(t.createdAt).getTime()+t.slaMinutes*60000<Date.now()).length;
  const unassigned=fieldWorkOrders.filter(w=>w.status==="Unassigned").length;
  const openHR=hrCases.filter(c=>c.status!=="Resolved").length;
  if(late) out.push({id:"late",title:"Attendance follow-up",reason:late+" employees are currently on Break/Lunch and can be monitored by the rules engine.",target:"Attendance",requiresApproval:true,type:"Workforce"});
  if(breaches) out.push({id:"sla",title:"SLA escalation",reason:breaches+" open ticket(s) are beyond their configured SLA window.",target:"Service Hub",requiresApproval:true,type:"Support"});
  if(unassigned) out.push({id:"field",title:"Dispatch review",reason:unassigned+" field job(s) are unassigned.",target:"Field Operations",requiresApproval:true,type:"Field"});
  if(openHR) out.push({id:"hr",title:"HR follow-up queue",reason:openHR+" HR case(s) remain unresolved.",target:"HR Support",requiresApproval:true,type:"HR"});
  out.push({id:"content",title:"Daily operations brief",reason:"Prepare a manager-facing summary from current WorkforceIQ signals.",target:"Communications",requiresApproval:true,type:"Content"});
  return out;
 },[employees,tickets,fieldWorkOrders,hrCases]);

 const nav=["Machine","Approval","Research","Content","Sales","Support","Analysis"];
 return <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
  <div className="bg-gradient-to-r from-violet-950 via-indigo-950 to-slate-950 p-6 text-white">
   <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase"><Workflow size={14}/> The Machine</div><h3 className="text-2xl sm:text-3xl font-black mt-3">AI Operations Engine</h3><p className="text-indigo-200 mt-1 max-w-2xl">Turns Brain detections into controlled, reviewable actions. Nothing is silently executed.</p></div>
    <div className="flex items-center gap-2 rounded-2xl bg-white/10 border border-white/10 px-4 py-3"><ShieldCheck size={18}/><span className="text-sm font-bold">Approval required</span></div>
   </div>
   <div className="flex gap-2 overflow-x-auto mt-6 pb-1">{nav.map(n=><button type="button" key={n} onClick={()=>setTab(n)} className={"whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black "+(tab===n?"bg-white text-slate-900":"bg-white/10 text-white hover:bg-white/15")}>{n}</button>)}</div>
  </div>

  {tab==="Machine"&&<div className="p-5 sm:p-6 space-y-5">
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[["Signals",actions.length],["Pending approval",actions.filter(a=>!approved[a.id]).length],["Enabled rules",Object.values(enabled).filter(Boolean).length],["Employees monitored",employees.length]].map(([l,v])=><div key={String(l)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-black uppercase text-slate-400">{l}</div><div className="text-2xl font-black mt-1">{v}</div></div>)}</div>
   <div className="space-y-3">{actions.map(a=><div key={a.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div className="flex gap-3"><div className="rounded-xl bg-indigo-50 p-2 h-fit"><Bot size={19} className="text-indigo-600"/></div><div><div className="font-black">{a.title}</div><div className="text-sm text-slate-500 mt-1">{a.reason}</div><div className="text-xs text-slate-400 mt-2">Target: {a.target} · {a.type}</div></div></div><div className="flex items-center gap-2"><button type="button" onClick={()=>setEnabled(x=>({...x,[a.id]:!x[a.id]}))} className={"rounded-xl px-3 py-2 text-xs font-black "+(enabled[a.id]?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500")}>{enabled[a.id]?"RULE ON":"RULE OFF"}</button><button type="button" disabled={!enabled[a.id]||approved[a.id]} onClick={()=>setApproved(x=>({...x,[a.id]:true}))} className={"rounded-xl px-3 py-2 text-xs font-black "+(approved[a.id]?"bg-emerald-600 text-white":"bg-indigo-600 text-white disabled:bg-slate-200 disabled:text-slate-400")}>{approved[a.id]?"Approved":"Approve"}</button></div></div></div>)}</div>
  </div>}

  {tab==="Approval"&&<div className="p-5 sm:p-6"><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-600"/><h4 className="text-xl font-black">Human approval queue</h4></div><p className="text-sm text-slate-500 mt-1">Every proposed action is visible before an external action layer is connected.</p><div className="mt-5 space-y-3">{actions.map(a=><div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4"><div><div className="font-black">{a.title}</div><div className="text-sm text-slate-500">{a.reason}</div></div><div className="flex items-center gap-2">{approved[a.id]?<span className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 text-emerald-700 px-3 py-2 text-xs font-black"><CheckCircle2 size={14}/> Approved</span>:<span className="inline-flex items-center gap-1 rounded-xl bg-amber-100 text-amber-700 px-3 py-2 text-xs font-black"><Clock3 size={14}/> Waiting</span>}</div></div>)}</div></div>}

  {tab==="Research"&&<Module icon={<Sparkles/>} title="Research" text="Create a controlled research workspace for policies, procedures, competitor information and approved external sources. Source links and timestamps should be stored with every research result." cards={["Knowledge sources","Source verification","Research briefs","Saved findings"]}/>}
  {tab==="Content"&&<Module icon={<FileText/>} title="Content" text="Prepare operational communications from WorkforceIQ data: daily briefs, manager updates, coaching notes and staff announcements. Draft first; publish only after approval." cards={["Daily brief","Staff announcement","Coaching draft","Manager report"]}/>}
  {tab==="Sales"&&<Module icon={<Target/>} title="Sales" text="The sales intelligence layer can later connect CRM opportunities, pipeline, conversion, targets and revenue signals without mixing tenants." cards={["Pipeline","Targets","Conversion","Revenue signals"]}/>}
  {tab==="Support"&&<Module icon={<Mail/>} title="Support" text="AI support can classify tickets, suggest priority, detect SLA risk and draft responses. Human approval remains available before sending or changing records." cards={["Triage","SLA risk","Suggested replies","Customer summary"]}/>}
  {tab==="Analysis"&&<Module icon={<Bot/>} title="Analysis" text="Turn existing WFM data into trend views and recommendations: staffing pressure, attendance patterns, ticket load, field workload and HR case volume." cards={["Workforce trends","Ticket trends","Field workload","HR trends"]}/>}
 </section>
}

function Module({icon,title,text:description,cards}:{icon:React.ReactNode;title:string;text:string;cards:string[]}){
 return <div className="p-5 sm:p-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">{icon}</div><div><h4 className="text-xl font-black">{title}</h4><p className="text-sm text-slate-500">{description}</p></div></div><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-6">{cards.map(c=><div key={c} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="font-black">{c}</div><div className="text-xs text-slate-500 mt-1">Module foundation ready for real data connections.</div></div>)}</div><div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><XCircle size={16} className="inline mr-2"/>No external action is executed from this screen yet.</div></div>
}
