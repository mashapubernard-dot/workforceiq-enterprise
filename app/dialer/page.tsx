"use client";
 
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Grid3x3,
  StickyNote,
  Monitor,
  Wrench,
  ArrowRightLeft,
  Circle,
  X,
  ArrowLeft,
  Delete,
  Send,
} from "lucide-react";
import { supabase } from "../../supabase/client";
 
type CallOutcome = "Connected" | "No Answer" | "Voicemail" | "Busy" | "Wrong Number";
 
type QueueEntry = {
  id: string;
  name: string;
  phone: string;
  note: string;
};
 
type CallLogRow = {
  id: number;
  outcome: CallOutcome;
  contact_name: string;
  called_at: string;
};
 
function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
 
function ConsoleButton({
  icon: Icon,
  label,
  active,
  danger,
  onClick,
}: {
  icon: typeof Phone;
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
    >
      <div
        className={`h-12 w-12 rounded-full flex items-center justify-center border transition ${
          danger
            ? "bg-red-600 border-red-600"
            : active
            ? "bg-blue-600 border-blue-600 shadow-[0_0_0_4px_rgba(59,130,246,0.25)]"
            : "bg-white/10 border-white/20"
        }`}
      >
        <Icon size={19} className={danger || active ? "text-white" : "text-slate-300"} />
      </div>
      <span className="text-[10.5px] font-semibold text-slate-300">{label}</span>
    </button>
  );
}
 
export default function DialerPage() {
  const router = useRouter();
 
  const [loadingUser, setLoadingUser] = useState(true);
  const [profile, setProfile] = useState<{ id: string; full_name: string } | null>(null);
 
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [queueForm, setQueueForm] = useState({ name: "", phone: "" });
  const [selected, setSelected] = useState<QueueEntry | null>(null);
 
  const [dialInput, setDialInput] = useState("");
  const [inCall, setInCall] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
 
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome>("Connected");
  const [toast, setToast] = useState<string | null>(null);
 
  const [todaysCalls, setTodaysCalls] = useState<CallLogRow[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
 
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("user_profiles")
        .select("id, full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setProfile(data ?? { id: user.id, full_name: user.email ?? "Agent" });
        setLoadingUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);
 
  const loadTodaysCalls = useCallback(async () => {
    if (!profile) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("call_logs")
      .select("id, outcome, contact_name, called_at")
      .eq("agent_id", profile.id)
      .gte("called_at", startOfDay.toISOString())
      .order("called_at", { ascending: false });
    if (!error) setTodaysCalls((data ?? []) as CallLogRow[]);
  }, [profile]);
 
  useEffect(() => {
    void loadTodaysCalls();
  }, [loadTodaysCalls]);
 
  useEffect(() => {
    if (inCall && !held) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inCall, held]);
 
  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }
 
  function addToQueue() {
    if (!queueForm.name.trim() || !queueForm.phone.trim()) return;
    const entry: QueueEntry = {
      id: `${Date.now()}`,
      name: queueForm.name.trim(),
      phone: queueForm.phone.trim(),
      note: "",
    };
    setQueue((q) => [entry, ...q]);
    setQueueForm({ name: "", phone: "" });
  }
 
  function startCall(target?: QueueEntry) {
    const contact = target ?? selected;
    const phone = contact?.phone || dialInput;
    if (!phone.trim()) {
      flashToast("Enter a number or select a contact first.");
      return;
    }
    if (contact) setSelected(contact);
    setInCall(true);
    setSeconds(0);
    setMuted(false);
    setHeld(false);
    setSpeaker(false);
    setRecording(false);
    flashToast(`Calling ${contact?.name ?? phone}…`);
  }
 
  function endCall() {
    setInCall(false);
    setShowKeypad(false);
    setShowOutcomeModal(true);
  }
 
  async function saveOutcome() {
    if (!profile) return;
    try {
      const { error } = await supabase.from("call_logs").insert({
        agent_id: profile.id,
        agent_name: profile.full_name,
        contact_name: selected?.name || dialInput || "Unknown",
        phone: selected?.phone || dialInput,
        outcome,
        notes: note.trim(),
      });
      if (error) throw error;
      flashToast(`Call logged — ${outcome} (${fmtDuration(seconds)})`);
      setShowOutcomeModal(false);
      setShowNote(false);
      setNote("");
      setDialInput("");
      await loadTodaysCalls();
    } catch (error: any) {
      flashToast(error?.message ?? "Could not save call log.");
    }
  }
 
  const connectedToday = todaysCalls.filter((c) => c.outcome === "Connected").length;
  const connectRate =
    todaysCalls.length > 0 ? Math.round((connectedToday / todaysCalls.length) * 100) : null;
 
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
 
  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-400 font-semibold">
        Loading dialer…
      </div>
    );
  }
 
  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      {/* HEADER / CATALOG BAR */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-5 sm:px-8 py-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>
            <div>
              <div className="text-white font-black text-xl leading-tight">Workforce Dialer</div>
              <div className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
                <Circle size={7} className="fill-emerald-400 text-emerald-400" />
                Live • {profile?.full_name}
              </div>
            </div>
          </div>
 
          <div className="flex items-center gap-3 flex-wrap">
            {[
              ["Calls today", todaysCalls.length],
              ["Connected", connectedToday],
              ["Connect rate", connectRate !== null ? `${connectRate}%` : "—"],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="bg-white/10 rounded-xl px-4 py-2 min-w-[100px]"
              >
                <div className="text-[10px] text-slate-400 font-bold uppercase">{label}</div>
                <div className="text-white font-black text-lg mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
 
      {/* BODY */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 p-5">
        {/* QUEUE */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="font-black text-slate-800 mb-2">Add to queue</div>
            <input
              value={queueForm.name}
              onChange={(e) => setQueueForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contact name"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mb-2"
            />
            <input
              value={queueForm.phone}
              onChange={(e) => setQueueForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone number"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mb-2"
            />
            <button
              type="button"
              onClick={addToQueue}
              className="w-full rounded-xl bg-slate-900 text-white text-sm font-bold py-2 hover:bg-slate-800"
            >
              Add
            </button>
          </div>
 
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="border-t-4 border-blue-600 px-4 pt-3 pb-2 font-black text-slate-800">
              Call queue
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {queue.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-400">
                  No contacts queued. Add one above, or dial a number directly.
                </div>
              )}
              {queue.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelected(entry)}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition ${
                    selected?.id === entry.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="font-bold text-sm text-slate-800">{entry.name}</div>
                  <div className="text-xs text-slate-500">{entry.phone}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
 
        {/* MAIN DIALER */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs font-black uppercase text-slate-400">
                {inCall ? "Active call" : "Ready to dial"}
              </div>
              <div className="text-2xl font-black text-slate-800 mt-1">
                {selected?.name || (dialInput ? dialInput : "No contact selected")}
              </div>
              {selected && <div className="text-slate-500 text-sm mt-0.5">{selected.phone}</div>}
            </div>
            {inCall && (
              <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                {held ? "On hold" : fmtDuration(seconds)}
              </span>
            )}
          </div>
 
          {!inCall && (
            <div className="mt-6 max-w-xs mx-auto">
              <input
                value={dialInput}
                onChange={(e) => setDialInput(e.target.value)}
                placeholder="Enter number"
                className="w-full text-center text-2xl font-bold rounded-xl border border-slate-200 px-4 py-3 mb-4"
              />
              <div className="grid grid-cols-3 gap-3">
                {keys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDialInput((v) => v + k)}
                    className="aspect-square rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xl font-bold"
                  >
                    {k}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setDialInput((v) => v.slice(0, -1))}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 flex items-center justify-center text-slate-500"
                >
                  <Delete size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => startCall()}
                  className="flex-[2] rounded-xl bg-emerald-600 text-white font-black py-2.5 flex items-center justify-center gap-2 hover:bg-emerald-700"
                >
                  <Phone size={18} /> Call
                </button>
              </div>
            </div>
          )}
 
          {inCall && (
            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-5 bg-slate-900 rounded-2xl p-6">
              <ConsoleButton
                icon={muted ? MicOff : Mic}
                label={muted ? "Unmute" : "Mute"}
                active={muted}
                onClick={() => setMuted((v) => !v)}
              />
              <ConsoleButton
                icon={held ? Play : Pause}
                label={held ? "Unhold" : "Hold"}
                active={held}
                onClick={() => setHeld((v) => !v)}
              />
              <ConsoleButton
                icon={speaker ? Volume2 : VolumeX}
                label="Speaker"
                active={speaker}
                onClick={() => setSpeaker((v) => !v)}
              />
              <ConsoleButton icon={Grid3x3} label="Keypad" onClick={() => setShowKeypad(true)} />
              <ConsoleButton
                icon={StickyNote}
                label="Add note"
                active={showNote}
                onClick={() => setShowNote((v) => !v)}
              />
              <ConsoleButton
                icon={Circle}
                label={recording ? "Stop rec" : "Record"}
                active={recording}
                onClick={() => {
                  setRecording((v) => !v);
                  flashToast(recording ? "Recording stopped" : "Recording started");
                }}
              />
              <ConsoleButton
                icon={Monitor}
                label="Remote fix"
                onClick={() => flashToast("Connecting to client device via RustDesk…")}
              />
              <ConsoleButton
                icon={Wrench}
                label="Dispatch"
                onClick={() => flashToast("Field tech job created")}
              />
              <ConsoleButton
                icon={ArrowRightLeft}
                label="Transfer"
                onClick={() => flashToast("Select an agent to transfer to")}
              />
              <ConsoleButton icon={PhoneOff} label="End call" danger onClick={endCall} />
            </div>
          )}
 
          {showNote && (
            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Type notes while on the call…"
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          )}
 
          <div className="mt-6">
            <div className="text-xs font-black uppercase text-slate-400 mb-2">
              Your calls today
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {todaysCalls.length === 0 && (
                <div className="text-sm text-slate-400">No calls logged yet today.</div>
              )}
              {todaysCalls.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm border-b border-slate-100 py-1.5"
                >
                  <span className="font-semibold text-slate-700">{c.contact_name}</span>
                  <span
                    className={`text-xs font-bold ${
                      c.outcome === "Connected" ? "text-emerald-600" : "text-slate-400"
                    }`}
                  >
                    {c.outcome}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
 
      {/* KEYPAD OVERLAY (DTMF while in call) */}
      {showKeypad && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center"
          onClick={() => setShowKeypad(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-3xl p-6 w-72"
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-white font-bold">Keypad</span>
              <X
                size={18}
                className="text-slate-400 cursor-pointer"
                onClick={() => setShowKeypad(false)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="aspect-square rounded-full border border-white/10 bg-white/5 text-white text-lg font-bold"
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
 
      {/* CALL OUTCOME MODAL */}
      {showOutcomeModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="font-black text-lg text-slate-800">Log call outcome</div>
            <div className="text-sm text-slate-500 mt-1">
              {selected?.name || dialInput} • {fmtDuration(seconds)}
            </div>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as CallOutcome)}
              className="w-full mt-4 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option>Connected</option>
              <option>No Answer</option>
              <option>Voicemail</option>
              <option>Busy</option>
              <option>Wrong Number</option>
            </select>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              className="w-full mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowOutcomeModal(false)}
                className="text-sm font-bold text-slate-500 px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveOutcome()}
                className="rounded-xl bg-blue-700 text-white px-4 py-2 text-sm font-bold hover:bg-blue-800 flex items-center gap-2"
              >
                <Send size={14} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
 
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xl z-[60]">
          {toast}
        </div>
      )}
    </div>
  );
}
 
