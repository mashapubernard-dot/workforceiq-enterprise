"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, KeyRound, MonitorSmartphone, RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "../supabase/client";

type Employee = { id: string; name: string; role?: string };
type PinStatus = { employee_id: string; enrolled_at: string };

export default function BiometricManagementPanel({ employees }: { employees: Employee[] }) {
  const [pins, setPins] = useState<PinStatus[]>([]);
  const [selected, setSelected] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPins() {
    setLoading(true);
    const { data, error: loadError } = await supabase.rpc("admin_list_kiosk_pins");
    if (loadError) setError(loadError.message);
    else setPins((data ?? []) as PinStatus[]);
    setLoading(false);
  }

  useEffect(() => { void loadPins(); }, []);

  async function savePin(event: React.FormEvent) {
    event.preventDefault();
    setMessage(""); setError("");
    if (!selected) return setError("Choose an employee first.");
    if (!/^\d{6}$/.test(pin)) return setError("PIN must contain exactly 6 digits.");
    if (pin !== confirmPin) return setError("The PIN entries do not match.");
    setBusy(true);
    const { error: saveError } = await supabase.rpc("admin_set_kiosk_pin", {
      p_employee_id: selected,
      p_pin: pin,
    });
    setBusy(false);
    if (saveError) return setError(saveError.message);
    setPin(""); setConfirmPin("");
    setMessage("Employee kiosk PIN saved securely.");
    await loadPins();
  }

  async function removePin(employeeId: string) {
    setError(""); setMessage("");
    const { error: removeError } = await supabase.rpc("admin_remove_kiosk_pin", { p_employee_id: employeeId });
    if (removeError) setError(removeError.message);
    else { setMessage("Kiosk PIN access removed."); await loadPins(); }
  }

  return <div className="space-y-6">
    <div className="rounded-3xl bg-gradient-to-br from-red-700 via-rose-700 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
      <div className="flex items-center gap-3"><ShieldCheck size={25}/><span className="text-xs font-black tracking-[.2em]">WORKFORCEIQ SECURITY</span></div>
      <h2 className="mt-4 text-3xl font-black">Biometric & Kiosk Management</h2>
      <p className="mt-2 max-w-3xl text-red-100">Register employee-specific kiosk PINs and manage the shared attendance station. Phone fingerprint sensors cannot identify different people, so this first release uses individual PINs; compatible external fingerprint terminals can be integrated later.</p>
      <a href="/kiosk" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-bold text-red-700">Open attendance kiosk <ExternalLink size={16}/></a>
    </div>

    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={savePin} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-red-50 p-3 text-red-600"><KeyRound/></div><div><h3 className="font-black text-slate-900">Register employee PIN</h3><p className="text-sm text-slate-500">PINs are hashed in the database; they are never displayed again.</p></div></div>
        <label className="block text-sm font-bold text-slate-700">Employee<select required value={selected} onChange={e=>setSelected(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3"><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}{e.role ? ` — ${e.role}` : ""}</option>)}</select></label>
        <label className="block text-sm font-bold text-slate-700">Six-digit PIN<input inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xl tracking-[.4em]" placeholder="••••••"/></label>
        <label className="block text-sm font-bold text-slate-700">Confirm PIN<input inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirmPin} onChange={e=>setConfirmPin(e.target.value.replace(/\D/g,"").slice(0,6))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xl tracking-[.4em]" placeholder="••••••"/></label>
        {error && <p className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={17}/>{error}</p>}
        {message && <p className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={17}/>{message}</p>}
        <button disabled={busy || !selected || pin.length!==6 || confirmPin.length!==6} className="w-full rounded-xl bg-red-600 p-3 font-black text-white disabled:opacity-50">{busy ? "Saving securely…" : "Save employee PIN"}</button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-sky-50 p-3 text-sky-700"><MonitorSmartphone/></div><div><h3 className="font-black text-slate-900">Registered kiosk access</h3><p className="text-sm text-slate-500">PIN status by employee</p></div></div><button onClick={loadPins} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Refresh"><RefreshCw size={17}/></button></div>
        {loading ? <p className="py-8 text-sm text-slate-500">Loading registrations…</p> : <div className="mt-4 max-h-[390px] divide-y divide-slate-100 overflow-y-auto">{employees.map(e=>{const enrolled=pins.some(p=>p.employee_id===e.id);return <div key={e.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-bold text-slate-800">{e.name}</p><p className="text-xs text-slate-500">{enrolled ? "PIN registered" : "Not registered"}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${enrolled?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{enrolled?"Active":"Pending"}</span>{enrolled && <button onClick={()=>removePin(e.id)} className="text-xs font-bold text-red-600 hover:underline">Remove</button>}</div></div>})}</div>}
      </div>
    </div>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Device setup:</strong> Open <code>/kiosk</code> on the dedicated company phone/tablet, sign in with the company kiosk account, then install WorkforceIQ from the browser's “Add to Home screen” option. Keep the device physically secured and enable Android screen pinning/kiosk mode. Do not use a shared administrator's everyday account for the kiosk in production.</div>
  </div>;
}
