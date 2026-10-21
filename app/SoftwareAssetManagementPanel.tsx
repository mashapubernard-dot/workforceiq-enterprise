"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/client";
import { AppWindow, Plus, RefreshCw, Search, ShieldCheck, AlertTriangle, Users, CalendarClock, Trash2, X } from "lucide-react";

type License = {
  id: string; software_name: string; publisher: string | null; version: string | null;
  category: string; license_type: string; seats_purchased: number; purchase_cost: number;
  purchase_date: string | null; renewal_date: string | null; expiry_date: string | null;
  status: string; notes: string | null; created_at: string;
};
type Assignment = { id: string; license_id: string; employee_name: string; device_name: string | null; assigned_date: string; returned_date: string | null; notes: string | null };

const blankLicense = { software_name: "", publisher: "", version: "", category: "Business", license_type: "Subscription", seats_purchased: "1", purchase_cost: "0", purchase_date: "", renewal_date: "", expiry_date: "", status: "Active", notes: "" };
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100";

export default function SoftwareAssetManagementPanel() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [licenseForm, setLicenseForm] = useState(blankLicense);
  const [assignmentForm, setAssignmentForm] = useState({ license_id: "", employee_name: "", device_name: "", assigned_date: new Date().toISOString().slice(0,10), notes: "" });
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [l, a] = await Promise.all([
      supabase.from("software_licenses").select("*").order("software_name"),
      supabase.from("software_assignments").select("*").order("created_at", { ascending: false }),
    ]);
    if (l.error) setError(l.error.message);
    else setLicenses((l.data || []) as License[]);
    if (a.error) setError((current) => current || a.error.message);
    else setAssignments((a.data || []) as Assignment[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const activeAssignments = assignments.filter((a) => !a.returned_date);
  const assignedFor = (id: string) => activeAssignments.filter((a) => a.license_id === id).length;
  const expiring = licenses.filter((l) => l.expiry_date && l.status !== "Cancelled" && (new Date(l.expiry_date).getTime() - Date.now()) / 86400000 <= 30 && new Date(l.expiry_date).getTime() >= new Date(new Date().toDateString()).getTime());
  const expired = licenses.filter((l) => l.expiry_date && new Date(l.expiry_date).getTime() < new Date(new Date().toDateString()).getTime() && l.status !== "Cancelled");
  const filtered = useMemo(() => licenses.filter((l) => [l.software_name,l.publisher || "",l.category,l.license_type,l.status].join(" ").toLowerCase().includes(query.toLowerCase())), [licenses, query]);
  const totalCost = licenses.reduce((n,l) => n + Number(l.purchase_cost || 0), 0);
  const saveLicense = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    const payload = { ...licenseForm, seats_purchased: Number(licenseForm.seats_purchased), purchase_cost: Number(licenseForm.purchase_cost), publisher: licenseForm.publisher || null, version: licenseForm.version || null, purchase_date: licenseForm.purchase_date || null, renewal_date: licenseForm.renewal_date || null, expiry_date: licenseForm.expiry_date || null, notes: licenseForm.notes || null };
    const { error: err } = await supabase.from("software_licenses").insert(payload);
    if (err) setError(err.message); else { setLicenseForm(blankLicense); setShowLicenseForm(false); await load(); }
    setSaving(false);
  };
  const saveAssignment = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    const { error: err } = await supabase.from("software_assignments").insert({ ...assignmentForm, device_name: assignmentForm.device_name || null, notes: assignmentForm.notes || null });
    if (err) setError(err.message); else { setAssignmentForm({ license_id: "", employee_name: "", device_name: "", assigned_date: new Date().toISOString().slice(0,10), notes: "" }); setShowAssignmentForm(false); await load(); }
    setSaving(false);
  };
  const returnAssignment = async (id: string) => {
    const { error: err } = await supabase.from("software_assignments").update({ returned_date: new Date().toISOString().slice(0,10) }).eq("id", id);
    if (err) setError(err.message); else await load();
  };
  const deleteLicense = async (id: string) => {
    if (!window.confirm("Delete this software licence and its assignment records?")) return;
    const { error: err } = await supabase.from("software_licenses").delete().eq("id", id);
    if (err) setError(err.message); else await load();
  };
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-red-700 via-rose-700 to-slate-950 p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="rounded-2xl bg-white/15 p-3"><AppWindow size={28}/></div><div><div className="text-xs font-black uppercase tracking-[.2em] text-rose-100">Software Asset Management</div><h2 className="mt-1 text-3xl font-black">Software & Licences</h2></div></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => { setShowAssignmentForm(v=>!v); setShowLicenseForm(false); }} className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-bold hover:bg-white/10"><Users size={16}/> Assign licence</button><button onClick={() => { setShowLicenseForm(v=>!v); setShowAssignmentForm(false); }} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-rose-50"><Plus size={16}/> Register software</button></div>
      </div><p className="mt-3 max-w-3xl text-sm leading-6 text-rose-50">Track software purchases, licence seats, employee/device assignments, renewals and compliance indicators. Records are stored in your organisation's database.</p>
    </section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[{label:"Software products",value:licenses.length,icon:AppWindow},{label:"Seats assigned",value:activeAssignments.length,icon:Users},{label:"Renewals in 30 days",value:expiring.length,icon:CalendarClock},{label:"Recorded spend",value:totalCost.toLocaleString(undefined,{style:"currency",currency:"ZAR",maximumFractionDigits:2}),icon:ShieldCheck}].map(({label,value,icon:Icon})=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-500"><span>{label}</span><Icon size={18}/></div><div className="mt-2 text-2xl font-black text-slate-900">{value}</div></div>)}
    </section>
    {(expired.length>0 || expiring.length>0) && <section className="grid gap-3 sm:grid-cols-2">{expired.length>0&&<div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"><AlertTriangle/><div><b>{expired.length} expired licence{expired.length===1?"":"s"}</b><p className="mt-1 text-sm">Review renewal or cancellation status.</p></div></div>}{expiring.length>0&&<div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><CalendarClock/><div><b>{expiring.length} renewal{expiring.length===1?"":"s"} due within 30 days</b><p className="mt-1 text-sm">Check renewal dates and budget.</p></div></div>}</section>}
    {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {showLicenseForm&&<form onSubmit={saveLicense} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-lg font-black">Register software licence</h3><button type="button" onClick={()=>setShowLicenseForm(false)} aria-label="Close"><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-xs font-bold text-slate-600">Software name *<input required className={field+" mt-1"} value={licenseForm.software_name} onChange={e=>setLicenseForm(f=>({...f,software_name:e.target.value}))} placeholder="Microsoft 365"/></label>
      <label className="text-xs font-bold text-slate-600">Publisher<input className={field+" mt-1"} value={licenseForm.publisher} onChange={e=>setLicenseForm(f=>({...f,publisher:e.target.value}))} placeholder="Microsoft"/></label>
      <label className="text-xs font-bold text-slate-600">Version<input className={field+" mt-1"} value={licenseForm.version} onChange={e=>setLicenseForm(f=>({...f,version:e.target.value}))} placeholder="Business Premium"/></label>
      <label className="text-xs font-bold text-slate-600">Category<select className={field+" mt-1"} value={licenseForm.category} onChange={e=>setLicenseForm(f=>({...f,category:e.target.value}))}>{["Business","Security","Operating System","Development","Design","Communications","Utilities","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600">Licence type<select className={field+" mt-1"} value={licenseForm.license_type} onChange={e=>setLicenseForm(f=>({...f,license_type:e.target.value}))}>{["Subscription","Per User","Per Device","Perpetual","Open Source","Enterprise Agreement","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600">Seats purchased *<input required min="0" type="number" className={field+" mt-1"} value={licenseForm.seats_purchased} onChange={e=>setLicenseForm(f=>({...f,seats_purchased:e.target.value}))}/></label>
      <label className="text-xs font-bold text-slate-600">Purchase cost (ZAR)<input min="0" step="0.01" type="number" className={field+" mt-1"} value={licenseForm.purchase_cost} onChange={e=>setLicenseForm(f=>({...f,purchase_cost:e.target.value}))}/></label>
      <label className="text-xs font-bold text-slate-600">Purchase date<input type="date" className={field+" mt-1"} value={licenseForm.purchase_date} onChange={e=>setLicenseForm(f=>({...f,purchase_date:e.target.value}))}/></label>
      <label className="text-xs font-bold text-slate-600">Renewal date<input type="date" className={field+" mt-1"} value={licenseForm.renewal_date} onChange={e=>setLicenseForm(f=>({...f,renewal_date:e.target.value}))}/></label>
      <label className="text-xs font-bold text-slate-600">Expiry date<input type="date" className={field+" mt-1"} value={licenseForm.expiry_date} onChange={e=>setLicenseForm(f=>({...f,expiry_date:e.target.value}))}/></label>
      <label className="text-xs font-bold text-slate-600">Status<select className={field+" mt-1"} value={licenseForm.status} onChange={e=>setLicenseForm(f=>({...f,status:e.target.value}))}>{["Active","Pending","Expiring","Expired","Cancelled"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600 sm:col-span-2 lg:col-span-3">Notes<textarea className={field+" mt-1"} rows={2} value={licenseForm.notes} onChange={e=>setLicenseForm(f=>({...f,notes:e.target.value}))} placeholder="Contract reference or purchasing notes"/></label>
    </div><button disabled={saving} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving?"Saving…":"Save software licence"}</button></form>}
    {showAssignmentForm&&<form onSubmit={saveAssignment} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-lg font-black">Assign a licence seat</h3><button type="button" onClick={()=>setShowAssignmentForm(false)} aria-label="Close"><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-bold text-slate-600">Software licence *<select required className={field+" mt-1"} value={assignmentForm.license_id} onChange={e=>setAssignmentForm(f=>({...f,license_id:e.target.value}))}><option value="">Choose software</option>{licenses.filter(l=>assignedFor(l.id)<l.seats_purchased).map(l=><option key={l.id} value={l.id}>{l.software_name} — {l.seats_purchased-assignedFor(l.id)} seat(s) available</option>)}</select></label><label className="text-xs font-bold text-slate-600">Employee name *<input required className={field+" mt-1"} value={assignmentForm.employee_name} onChange={e=>setAssignmentForm(f=>({...f,employee_name:e.target.value}))} placeholder="Employee full name"/></label><label className="text-xs font-bold text-slate-600">Device name<input className={field+" mt-1"} value={assignmentForm.device_name} onChange={e=>setAssignmentForm(f=>({...f,device_name:e.target.value}))} placeholder="Laptop or workstation"/></label><label className="text-xs font-bold text-slate-600">Assigned date<input type="date" required className={field+" mt-1"} value={assignmentForm.assigned_date} onChange={e=>setAssignmentForm(f=>({...f,assigned_date:e.target.value}))}/></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Notes<input className={field+" mt-1"} value={assignmentForm.notes} onChange={e=>setAssignmentForm(f=>({...f,notes:e.target.value}))} placeholder="Optional"/></label></div><button disabled={saving||!licenses.length} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving?"Saving…":"Assign licence"}</button></form>}
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-black">Software register</h3><div className="flex gap-2"><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} className={field+" pl-9"} placeholder="Search software…"/></div><button onClick={()=>void load()} className="rounded-xl border border-slate-200 px-3 text-slate-600" title="Refresh"><RefreshCw size={16}/></button></div></div>
      {loading?<div className="py-10 text-center text-sm text-slate-500">Loading software records…</div>:filtered.length===0?<div className="rounded-xl bg-slate-50 p-8 text-center"><AppWindow size={28} className="mx-auto text-slate-400"/><p className="mt-2 font-bold text-slate-700">No software records found</p><p className="mt-1 text-sm text-slate-500">Register your first software product to start tracking licences.</p></div>:<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="px-3 py-3">Software</th><th className="px-3 py-3">Licence</th><th className="px-3 py-3">Seats</th><th className="px-3 py-3">Expiry / renewal</th><th className="px-3 py-3">Spend</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{filtered.map(l=>{const used=assignedFor(l.id);const over=used>l.seats_purchased;return <tr key={l.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-4"><div className="font-bold text-slate-900">{l.software_name}</div><div className="text-xs text-slate-500">{l.publisher||"Publisher not set"}{l.version?" · "+l.version:""} · {l.category}</div></td><td className="px-3 py-4">{l.license_type}</td><td className="px-3 py-4"><div className={over?"font-bold text-red-700":"font-semibold"}>{used} / {l.seats_purchased}</div><div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className={"h-full "+(over?"bg-red-500":"bg-emerald-500")} style={{width:Math.min(100,l.seats_purchased?used/l.seats_purchased*100:used?100:0)+"%"}}/></div>{over&&<span className="text-xs text-red-700">Over-licensed use</span>}</td><td className="px-3 py-4"><div>{l.expiry_date||"No expiry date"}</div><div className="text-xs text-slate-500">Renewal: {l.renewal_date||"Not set"}</div></td><td className="px-3 py-4">R {Number(l.purchase_cost||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td className="px-3 py-4"><span className={"rounded-full px-2.5 py-1 text-xs font-bold "+(l.status==="Active"?"bg-emerald-50 text-emerald-700":l.status==="Expired"||expired.some(x=>x.id===l.id)?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700")}>{expired.some(x=>x.id===l.id)?"Expired":l.status}</span></td><td className="px-3 py-4"><button onClick={()=>void deleteLicense(l.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Delete licence"><Trash2 size={16}/></button></td></tr>})}</tbody></table></div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h3 className="mb-3 text-lg font-black">Licence assignments</h3>{activeAssignments.length===0?<p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No active assignments recorded yet.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Software</th><th className="px-3 py-3">Device</th><th className="px-3 py-3">Assigned</th><th className="px-3 py-3">Action</th></tr></thead><tbody>{activeAssignments.map(a=><tr key={a.id} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{a.employee_name}</td><td className="px-3 py-3">{licenses.find(l=>l.id===a.license_id)?.software_name||"Software record"}</td><td className="px-3 py-3">{a.device_name||"—"}</td><td className="px-3 py-3">{a.assigned_date}</td><td className="px-3 py-3"><button onClick={()=>void returnAssignment(a.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50">Return seat</button></td></tr>)}</tbody></table></div>}</section>
    <p className="text-xs leading-5 text-slate-500">Compliance note: seat counts and expiry alerts are calculated from records entered here. WorkforceIQ does not independently scan devices or verify vendor entitlements unless a supported integration is configured.</p>
  </div>;
}
