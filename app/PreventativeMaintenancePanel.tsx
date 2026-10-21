"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, HardDrive, Wrench } from "lucide-react";

type Asset = { id:string; asset_tag:string; device_name:string; category:string; status:string; location:string; warranty_expires:string|null; created_at:string; };
type Plan = { lastService:string; intervalDays:number; notes:string; };
type Props = { assets:Asset[]; tenantKey:string };

function dateKey(d:Date){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function addDays(key:string,days:number){ const d=new Date(`${key}T12:00:00`); d.setDate(d.getDate()+days); return dateKey(d); }
function daysBetween(a:string,b:string){ return Math.ceil((new Date(`${b}T12:00:00`).getTime()-new Date(`${a}T12:00:00`).getTime())/86400000); }

export default function PreventativeMaintenancePanel({assets,tenantKey}:Props){
 const storageKey=`workforceiq-maintenance-v1-${tenantKey || "default"}`;
 const [plans,setPlans]=useState<Record<string,Plan>>({});
 const [ready,setReady]=useState(false);
 const [today]=useState(()=>dateKey(new Date()));
 const [selected,setSelected]=useState<string>("");
 useEffect(()=>{ try { const raw=window.localStorage.getItem(storageKey); if(raw) setPlans(JSON.parse(raw)); } catch(e){ console.warn("Maintenance plans could not be loaded",e); } setReady(true); },[storageKey]);
 useEffect(()=>{ if(ready){ try{ window.localStorage.setItem(storageKey,JSON.stringify(plans)); }catch(e){ console.warn("Maintenance plans could not be saved",e); } } },[plans,ready,storageKey]);
 const rows=useMemo(()=>assets.map(a=>{ const p=plans[a.id]??{lastService:a.created_at?dateKey(new Date(a.created_at)):"",intervalDays:90,notes:""}; const due=p.lastService?addDays(p.lastService,Math.max(1,p.intervalDays)): ""; const until=due?daysBetween(today,due):null; const warrantyDays=a.warranty_expires?daysBetween(today,a.warranty_expires):null; return {...a,plan:p,due,until,warrantyDays,overdue:until!==null&&until<0,dueSoon:until!==null&&until>=0&&until<=14}; }).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||(a.until??99999)-(b.until??99999)),[assets,plans,today]);
 const overdue=rows.filter(r=>r.overdue).length,soon=rows.filter(r=>r.dueSoon).length,noPlan=rows.filter(r=>!r.plan.lastService).length;
 function update(id:string,patch:Partial<Plan>){ const current=plans[id]??{lastService:"",intervalDays:90,notes:""}; setPlans(old=>({...old,[id]:{...current,...patch}})); }
 return <div className="space-y-6">
  <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
   <div className="flex items-center gap-3"><div className="rounded-2xl bg-white/10 p-3"><Wrench size={24}/></div><div><div className="text-xs font-black uppercase tracking-wider text-emerald-200">Asset reliability</div><h2 className="mt-1 text-2xl sm:text-3xl font-black">Preventative Maintenance</h2></div></div>
   <p className="mt-3 max-w-3xl text-sm text-emerald-100">Create service intervals for registered assets, track last-serviced dates, and surface upcoming or overdue maintenance before equipment fails.</p>
  </section>
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
   {[["Registered assets",assets.length,HardDrive],["Maintenance overdue",overdue,AlertTriangle],["Due in 14 days",soon,CalendarClock],["Need service setup",noPlan,ClipboardList]].map(([label,value,Icon]:any)=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-slate-500"><Icon size={17}/><span className="text-xs font-bold">{label}</span></div><div className="mt-2 text-2xl font-black text-slate-900">{value}</div></div>)}
  </div>
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
   <div className="border-b border-slate-100 p-5"><h3 className="font-black text-slate-900">Maintenance schedule</h3><p className="mt-1 text-xs text-slate-500">Choose a service interval and record each asset's most recent service.</p></div>
   {rows.length===0?<div className="p-10 text-center"><HardDrive size={34} className="mx-auto text-slate-300"/><p className="mt-3 font-bold text-slate-700">No assets found</p><p className="mt-1 text-sm text-slate-500">Register assets in Asset Management to create maintenance plans.</p></div>:<div className="divide-y divide-slate-100">{rows.map(a=><div key={a.id} className="grid gap-4 p-5 xl:grid-cols-[1.2fr_1fr_1fr] xl:items-center">
    <div><div className="flex flex-wrap items-center gap-2"><span className="font-black text-slate-900">{a.device_name}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{a.asset_tag}</span></div><p className="mt-1 text-xs text-slate-500">{a.category} · {a.location||"Location not set"} · {a.status}</p>{a.warranty_expires&&<p className={`mt-1 text-xs ${a.warrantyDays!==null&&a.warrantyDays<0?"text-red-600":"text-slate-400"}`}>Warranty {a.warrantyDays!==null&&a.warrantyDays<0?"expired":a.warrantyDays===0?"expires today":`expires ${a.warranty_expires}`}</p>}</div>
    <div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-bold text-slate-500">Last service date<input aria-label={`Last service date for ${a.device_name}`} type="date" value={a.plan.lastService} onChange={e=>update(a.id,{lastService:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-800"/></label><label className="text-[11px] font-bold text-slate-500">Interval<select aria-label={`Service interval for ${a.device_name}`} value={a.plan.intervalDays} onChange={e=>update(a.id,{intervalDays:Number(e.target.value)})} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-800"><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>365 days</option></select></label></div>
    <div><div className="flex items-center gap-2">{a.overdue?<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-700"><AlertTriangle size={13}/>Overdue {Math.abs(a.until!)}d</span>:a.dueSoon?<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800"><CalendarClock size={13}/>Due in {a.until}d</span>:a.due?<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700"><CheckCircle2 size={13}/>Due {a.due}</span>:<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Set last service</span>}</div><input aria-label={`Maintenance note for ${a.device_name}`} value={a.plan.notes} onChange={e=>update(a.id,{notes:e.target.value})} placeholder="Service notes / work required" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"/></div>
   </div>)}</div>}
  </section>
  <p className="text-xs leading-relaxed text-slate-500">Storage note: maintenance plans are currently saved in this browser for this organisation context; they are not yet shared or synchronised between users. Confirm the service date against maintenance records before relying on due dates for compliance.</p>
 </div>;
}
