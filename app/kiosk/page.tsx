"use client";

import { useEffect, useState } from "react";
import { Clock3, Delete, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../../supabase/client";

type Result = { employee_name?: string; action?: "CLOCK_IN" | "CLOCK_OUT"; event_time?: string; message?: string };

export default function AttendanceKioskPage() {
  const [pin,setPin]=useState("");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<Result|null>(null);
  const [error,setError]=useState("");
  const [ready,setReady]=useState(false);
  const [signedIn,setSignedIn]=useState(false);
  useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSignedIn(!!data.session);setReady(true);});},[]);
  function press(value:string){if(busy)return;setError("");setResult(null);setPin(v=>(v+value).slice(0,6));}
  async function submit(){if(pin.length!==6){setError("Enter your six-digit employee PIN.");return;}setBusy(true);setError("");setResult(null);const {data,error:rpcError}=await supabase.rpc("kiosk_clock_action",{p_pin:pin});setBusy(false);setPin("");if(rpcError){setError(rpcError.message);return;}setResult(data as Result);}
  if(!ready)return <main className="min-h-screen grid place-items-center bg-slate-950 text-white"><p>Checking secure kiosk session…</p></main>;
  if(!signedIn)return <main className="min-h-screen grid place-items-center bg-slate-950 px-5 text-center text-white"><div><ShieldCheck className="mx-auto mb-4" size={42}/><h1 className="text-2xl font-black">Kiosk sign-in required</h1><p className="mt-2 max-w-sm text-slate-300">A company administrator must sign in on this device before employees can use the attendance kiosk.</p><a href="/login" className="mt-5 inline-block rounded-xl bg-red-600 px-5 py-3 font-bold">Sign in</a></div></main>;
  return <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 px-4 py-8 text-white">
    <div className="mx-auto flex min-h-[85vh] max-w-md flex-col items-center justify-center">
      <div className="mb-8 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-600 shadow-xl shadow-red-950/40"><Clock3 size={32}/></div><p className="mt-4 text-xs font-black tracking-[.3em] text-red-300">WORKFORCEIQ</p><h1 className="mt-2 text-3xl font-black">Attendance kiosk</h1><p className="mt-2 text-sm text-slate-300">Enter your personal employee PIN to clock in or out.</p></div>
      <section className="w-full rounded-3xl border border-white/10 bg-white/[.07] p-6 shadow-2xl backdrop-blur">
        <div className="mb-5 flex justify-center gap-3" aria-label={`${pin.length} of 6 digits entered`}>{Array.from({length:6},(_,i)=><span key={i} className={`h-3.5 w-3.5 rounded-full border ${i<pin.length?"border-red-400 bg-red-400":"border-slate-500"}`}/>)}</div>
        <div className="grid grid-cols-3 gap-3">{["1","2","3","4","5","6","7","8","9","clear","0","back"].map(k=><button key={k} onClick={()=>k==="clear"?setPin(""):k==="back"?setPin(v=>v.slice(0,-1)):press(k)} className="min-h-16 rounded-2xl border border-white/10 bg-white/10 text-2xl font-black transition hover:bg-white/20 active:scale-95">{k==="clear"?"C":k==="back"?<Delete className="mx-auto"/>:k}</button>)}</div>
        <button onClick={submit} disabled={busy||pin.length!==6} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 text-lg font-black shadow-lg hover:bg-red-500 disabled:opacity-50">{busy?<><Loader2 className="animate-spin"/> Verifying…</>:<><ShieldCheck/> Verify & clock</>}</button>
        {error&&<p className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/15 p-3 text-sm text-red-200"><AlertCircle size={17}/>{error}</p>}
        {result&&<div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center"><CheckCircle2 className="mx-auto text-emerald-300" size={28}/><p className="mt-2 text-lg font-black">{result.employee_name}</p><p className="mt-1 font-bold text-emerald-200">{result.action==="CLOCK_IN"?"Clock-in recorded":"Clock-out recorded"}</p><p className="mt-1 text-sm text-slate-300">{result.event_time?new Date(result.event_time).toLocaleString():""}</p></div>}
      </section>
      <p className="mt-6 text-center text-xs text-slate-400">This kiosk is linked to the company account signed in on this device.</p>
    </div>
  </main>;
}
