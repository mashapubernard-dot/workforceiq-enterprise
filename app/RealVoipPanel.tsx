"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Phone, PhoneOff, Mic, MicOff, Wifi, AlertCircle, CheckCircle2,
  Loader2, UserRound, PhoneIncoming,
} from "lucide-react";
import { supabase } from "../supabase/client";

type DirectoryUser = { id: string; full_name: string; role: string | null };
type CallRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  status: "ringing" | "accepted" | "declined" | "ended" | "missed";
};
type SignalRow = {
  id: number;
  call_id: string;
  sender_id: string;
  event_type: "offer" | "answer" | "ice-candidate";
  payload: Record<string, any>;
};
type ActiveCall = { id: string; peerId: string; peerName: string; direction: "outgoing" | "incoming" };

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export default function RealVoipPanel() {
  const [userId, setUserId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [incoming, setIncoming] = useState<{ call: CallRow; callerName: string } | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callState, setCallState] = useState<"idle" | "ringing" | "connecting" | "connected">("idle");
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Connecting to WorkforceIQ…");
  const [error, setError] = useState("");

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const inboxChannelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const callChannelRef = useRef<any>(null);
  const callStatusChannelRef = useRef<any>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  const userIdRef = useRef("");
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const processedSignalsRef = useRef<Set<number>>(new Set());
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCall = (call: ActiveCall | null) => {
    activeCallRef.current = call;
    setActiveCall(call);
  };

  const cleanupMedia = useCallback(() => {
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (callChannelRef.current) {
      void supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
    if (callStatusChannelRef.current) {
      void supabase.removeChannel(callStatusChannelRef.current);
      callStatusChannelRef.current = null;
    }
    pendingIceRef.current = [];
    processedSignalsRef.current.clear();
    setMuted(false);
    setCall(null);
    setCallState("idle");
    setBusy(false);
  }, []);

  const insertSignal = useCallback(async (
    callId: string,
    eventType: SignalRow["event_type"],
    payload: Record<string, any>,
  ) => {
    const { error: insertError } = await supabase.from("webrtc_call_signals").insert({
      call_id: callId,
      sender_id: userIdRef.current,
      event_type: eventType,
      payload,
    });
    if (insertError) throw insertError;
  }, []);

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return;
    const candidates = pendingIceRef.current.splice(0);
    for (const candidate of candidates) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* stale ICE candidate */ }
    }
  }, []);

  const processSignal = useCallback(async (signal: SignalRow) => {
    if (signal.sender_id === userIdRef.current || processedSignalsRef.current.has(signal.id)) return;
    processedSignalsRef.current.add(signal.id);
    const pc = peerConnectionRef.current;
    const current = activeCallRef.current;
    if (!pc || !current || signal.call_id !== current.id) return;

    try {
      if (signal.event_type === "offer" && current.direction === "incoming") {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.description));
        await flushPendingIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await insertSignal(current.id, "answer", { description: answer });
        setCallState("connecting");
        setStatus("Connecting audio…");
      } else if (signal.event_type === "answer" && current.direction === "outgoing") {
        if (!pc.remoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.description));
          await flushPendingIce(pc);
        }
      } else if (signal.event_type === "ice-candidate" && signal.payload.candidate) {
        const candidate = signal.payload.candidate as RTCIceCandidateInit;
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingIceRef.current.push(candidate);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not negotiate the call.");
      setStatus("Call connection failed");
    }
  }, [flushPendingIce, insertSignal]);

  const createPeerConnection = useCallback((callId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionRef.current = pc;
    localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void insertSignal(callId, "ice-candidate", { candidate: event.candidate.toJSON() })
          .catch((err) => setError(err instanceof Error ? err.message : "Could not send network information."));
      }
    };
    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        void remoteAudioRef.current.play().catch(() => {
          setError("Tap the audio player if your browser blocks automatic playback.");
        });
      }
      setCallState("connected");
      setStatus("Connected • internet audio");
      setError("");
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setStatus("Connection interrupted");
        if (pc.connectionState === "failed") {
          setError("The network could not establish a direct audio route. A TURN relay may be needed for this network.");
        }
      }
    };
    return pc;
  }, [insertSignal]);

  const subscribeToCall = useCallback(async (callId: string) => {
    if (callChannelRef.current) await supabase.removeChannel(callChannelRef.current);
    const channel = supabase
      .channel("wfiq-call-signals-" + callId)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "webrtc_call_signals",
        filter: "call_id=eq." + callId,
      }, (payload: any) => { void processSignal(payload.new as SignalRow); })
      .subscribe();
    callChannelRef.current = channel;
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        if (channel.state === "joined") resolve();
        else if (channel.state === "errored" || Date.now() - started > 10000) reject(new Error("Could not connect to the call signalling channel."));
        else setTimeout(check, 150);
      };
      check();
    });
  }, [processSignal]);

  const loadExistingSignals = useCallback(async (callId: string) => {
    const { data, error: queryError } = await supabase
      .from("webrtc_call_signals")
      .select("id, call_id, sender_id, event_type, payload")
      .eq("call_id", callId)
      .order("id", { ascending: true });
    if (queryError) throw queryError;
    for (const signal of (data ?? []) as SignalRow[]) await processSignal(signal);
  }, [processSignal]);

  const acceptCall = useCallback(async () => {
    if (!incoming || busy) return;
    const { call, callerName } = incoming;
    setBusy(true);
    setError("");
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      setCall({ id: call.id, peerId: call.caller_id, peerName: callerName, direction: "incoming" });
      createPeerConnection(call.id);
      await subscribeToCall(call.id);
      const { error: updateError } = await supabase.from("webrtc_call_sessions")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", call.id);
      if (updateError) throw updateError;
      const statusChannel = supabase.channel("wfiq-callee-status-" + call.id)
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "webrtc_call_sessions",
          filter: "id=eq." + call.id,
        }, (payload: any) => {
          const next = payload.new as CallRow;
          if (next.status === "ended" || next.status === "missed" || next.status === "declined") {
            cleanupMedia();
            setStatus("The other person ended the call.");
          }
        }).subscribe();
      callStatusChannelRef.current = statusChannel;
      setIncoming(null);
      setCallState("connecting");
      setStatus("Joining call…");
      await loadExistingSignals(call.id);
    } catch (err) {
      cleanupMedia();
      setError(err instanceof Error ? err.message : "Could not answer the call.");
      setStatus("Unable to answer");
    } finally {
      setBusy(false);
    }
  }, [incoming, busy, createPeerConnection, subscribeToCall, loadExistingSignals, cleanupMedia]);

  const declineCall = useCallback(async () => {
    if (!incoming) return;
    await supabase.from("webrtc_call_sessions")
      .update({ status: "declined", updated_at: new Date().toISOString(), ended_at: new Date().toISOString() })
      .eq("id", incoming.call.id);
    setIncoming(null);
  }, [incoming]);

  const startCall = useCallback(async (person: DirectoryUser) => {
    if (busy || callState !== "idle" || incoming) return;
    setBusy(true);
    setError("");
    setStatus("Requesting microphone…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone calling requires HTTPS and browser microphone support.");
      }
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const { data: created, error: createError } = await supabase
        .from("webrtc_call_sessions")
        .insert({ org_id: orgId, caller_id: userId, callee_id: person.id, status: "ringing" })
        .select("id, caller_id, callee_id, status")
        .single();
      if (createError || !created) throw createError ?? new Error("Could not create the call.");
      const callId = created.id as string;
      setCall({ id: callId, peerId: person.id, peerName: person.full_name, direction: "outgoing" });
      createPeerConnection(callId);
      await subscribeToCall(callId);
      const offer = await peerConnectionRef.current!.createOffer();
      await peerConnectionRef.current!.setLocalDescription(offer);
      await insertSignal(callId, "offer", { description: offer });
      setCallState("ringing");
      setStatus("Calling " + person.full_name + "…");
      ringTimeoutRef.current = setTimeout(async () => {
        if (activeCallRef.current?.id !== callId) return;
        await supabase.from("webrtc_call_sessions")
          .update({ status: "missed", updated_at: new Date().toISOString(), ended_at: new Date().toISOString() })
          .eq("id", callId).eq("status", "ringing");
        cleanupMedia();
        setStatus("No answer");
      }, 45000);
      const statusChannel = supabase.channel("wfiq-call-status-" + callId)
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "webrtc_call_sessions",
          filter: "id=eq." + callId,
        }, (payload: any) => {
          const next = payload.new as CallRow;
          if (next.status === "accepted") {
            if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
            setCallState("connecting");
            setStatus("Call accepted • connecting audio…");
          } else if (next.status === "declined" || next.status === "missed" || next.status === "ended") {
            cleanupMedia();
            setStatus(next.status === "declined" ? "Call declined" : next.status === "missed" ? "No answer" : "Call ended");
          }
        }).subscribe();
      callStatusChannelRef.current = statusChannel;
      await new Promise<void>((resolve, reject) => {
        const started = Date.now();
        const check = () => {
          if (statusChannel.state === "joined") resolve();
          else if (statusChannel.state === "errored" || Date.now() - started > 10000) reject(new Error("Could not monitor call status."));
          else setTimeout(check, 150);
        };
        check();
      });
      // Catch an answer that arrived while the caller was still setting up.
      const { data: latestCall } = await supabase.from("webrtc_call_sessions")
        .select("status").eq("id", callId).maybeSingle();
      if (latestCall?.status === "accepted") {
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        setCallState("connecting");
        setStatus("Call accepted • connecting audio…");
      } else if (latestCall?.status === "declined" || latestCall?.status === "missed") {
        cleanupMedia();
        setStatus(latestCall.status === "declined" ? "Call declined" : "No answer");
      }
    } catch (err) {
      cleanupMedia();
      setError(err instanceof Error ? err.message : "Could not start the call.");
      setStatus("Call could not start");
    } finally {
      setBusy(false);
    }
  }, [busy, callState, incoming, orgId, userId, createPeerConnection, subscribeToCall, insertSignal, cleanupMedia]);

  const endCall = useCallback(async () => {
    const current = activeCallRef.current;
    if (current) {
      await supabase.from("webrtc_call_sessions")
        .update({ status: "ended", updated_at: new Date().toISOString(), ended_at: new Date().toISOString() })
        .eq("id", current.id);
    }
    cleanupMedia();
    setStatus("Ready for app-to-app calls");
  }, [cleanupMedia]);

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  };

  useEffect(() => {
    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let presenceRefresh: ReturnType<typeof setInterval> | null = null;

    async function initialize() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error("Please sign in to use WorkforceIQ calling.");
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles").select("id, full_name, org_id").eq("id", auth.user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.org_id) throw new Error("Your user profile is not linked to a company.");
        if (cancelled) return;
        userIdRef.current = auth.user.id;
        setUserId(auth.user.id);
        setOrgId(profile.org_id);

        const { data: people, error: peopleError } = await supabase
          .from("user_profiles").select("id, full_name, role")
          .eq("org_id", profile.org_id).neq("id", auth.user.id).order("full_name");
        if (peopleError) throw peopleError;
        if (cancelled) return;
        setDirectory((people ?? []) as DirectoryUser[]);

        const { data: presence, error: presenceError } = await supabase
          .from("webrtc_user_presence").select("user_id, last_seen, is_clocked_in").eq("org_id", profile.org_id);
        if (presenceError) throw presenceError;
        const updateOnline = (rows: { user_id: string; last_seen: string; is_clocked_in?: boolean }[]) => {
          const cutoff = Date.now() - 90000;
          setOnlineIds(new Set(rows.filter((row) => row.is_clocked_in || new Date(row.last_seen).getTime() > cutoff).map((row) => row.user_id)));
        };
        updateOnline(presence ?? []);

        const inbox = supabase.channel("wfiq-incoming-" + auth.user.id)
          .on("postgres_changes", {
            event: "INSERT", schema: "public", table: "webrtc_call_sessions",
            filter: "callee_id=eq." + auth.user.id,
          }, (payload: any) => {
            const call = payload.new as CallRow;
            if (call.status !== "ringing" || activeCallRef.current) return;
            const caller = (people ?? []).find((person: any) => person.id === call.caller_id);
            setIncoming({ call, callerName: caller?.full_name ?? "WorkforceIQ colleague" });
          })
          .on("postgres_changes", {
            event: "UPDATE", schema: "public", table: "webrtc_call_sessions",
            filter: "callee_id=eq." + auth.user.id,
          }, (payload: any) => {
            const changed = payload.new as CallRow;
            if (changed.status !== "ringing") {
              setIncoming((current) => current?.call.id === changed.id ? null : current);
            }
          }).subscribe();
        inboxChannelRef.current = inbox;

        const presenceChannel = supabase.channel("wfiq-presence-changes-" + profile.org_id)
          .on("postgres_changes", {
            event: "*", schema: "public", table: "webrtc_user_presence",
            filter: "org_id=eq." + profile.org_id,
          }, async () => {
            const { data: rows } = await supabase.from("webrtc_user_presence")
              .select("user_id, last_seen, is_clocked_in").eq("org_id", profile.org_id);
            updateOnline(rows ?? []);
          }).subscribe();
        presenceChannelRef.current = presenceChannel;

        const publishPresence = async () => {
          await supabase.from("webrtc_user_presence").upsert({
            user_id: auth.user!.id, org_id: profile.org_id, last_seen: new Date().toISOString(),
          }, { onConflict: "user_id" });
        };
        await publishPresence();
        heartbeat = setInterval(() => { void publishPresence(); }, 25000);
        presenceRefresh = setInterval(async () => {
          const { data: rows } = await supabase.from("webrtc_user_presence")
            .select("user_id, last_seen, is_clocked_in").eq("org_id", profile.org_id);
          updateOnline(rows ?? []);
        }, 30000);

        setStatus("Ready • company-only calling");
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not initialize WorkforceIQ calling.");
          setStatus("Calling unavailable");
          setLoading(false);
        }
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (presenceRefresh) clearInterval(presenceRefresh);
      cleanupMedia();
      if (inboxChannelRef.current) void supabase.removeChannel(inboxChannelRef.current);
      if (presenceChannelRef.current) void supabase.removeChannel(presenceChannelRef.current);
    };
  }, [cleanupMedia]);

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-5 py-4 text-white">
        <div>
          <div className="flex items-center gap-2 text-lg font-black"><Wifi size={19} /> WorkforceIQ Wi-Fi Calling</div>
          <p className="mt-1 text-xs text-indigo-200">WebRTC audio • registered users in your company only</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
          {loading ? <Loader2 size={15} className="animate-spin text-amber-300" /> : error ? <AlertCircle size={15} className="text-amber-300" /> : <CheckCircle2 size={15} className="text-emerald-300" />}
          {status}
        </div>
      </div>

      {incoming && callState === "idle" && (
        <div className="m-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white"><PhoneIncoming /></div>
            <div><div className="font-black text-slate-900">Incoming call</div><div className="text-sm text-slate-600">{incoming.callerName}</div></div>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void declineCall()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700">Decline</button>
            <button type="button" disabled={busy} onClick={() => void acceptCall()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-black text-white disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />} Answer
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 p-5 md:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-black text-slate-800">Company directory</h3>
            <span className="text-xs font-semibold text-slate-500">{directory.length} colleagues</span>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {directory.length === 0 && !loading && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No other registered colleagues found in this company.</p>}
            {directory.map((person) => {
              const online = onlineIds.has(person.id);
              return (
                <div key={person.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700"><UserRound size={17} /><span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-slate-300"}`} /></div>
                    <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-800">{person.full_name || "WorkforceIQ user"}</div><div className="text-xs text-slate-500">{person.role || "Team member"} • {online ? "Online" : "Offline"}</div></div>
                  </div>
                  <button type="button" disabled={loading || busy || callState !== "idle" || !online || !userId} onClick={() => void startCall(person)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Phone size={14} /> Call</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-2xl bg-slate-50 p-5">
          {activeCall ? (
            <>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-700"><UserRound size={28} /></div>
              <div className="text-center text-lg font-black text-slate-900">{activeCall.peerName}</div>
              <div className="mb-5 text-center text-sm font-semibold text-slate-500">{callState === "ringing" ? "Ringing…" : callState === "connecting" ? "Connecting…" : "Audio call connected"}</div>
              <div className="flex justify-center gap-3">
                <button type="button" onClick={toggleMute} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700">{muted ? <MicOff size={17} /> : <Mic size={17} />}{muted ? "Unmute" : "Mute"}</button>
                <button type="button" onClick={() => void endCall()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-black text-white"><PhoneOff size={17} /> End call</button>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-700"><Wifi size={25} /></div>
              <div className="text-center font-black text-slate-800">App-to-app voice calls</div>
              <p className="mt-1 text-center text-sm leading-6 text-slate-500">Choose an online colleague to start a secure audio call over Wi-Fi or mobile data. External phone numbers are not supported.</p>
            </>
          )}
        </div>
      </div>

      {error && <div role="alert" className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>}
      <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-500">
        Calls are limited to users in the same company. Microphone permission and an HTTPS connection are required. Direct WebRTC connections use a public STUN server; some restricted networks may require a TURN relay.
      </div>
    </section>
  );
}
