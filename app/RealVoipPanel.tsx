"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Wifi, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "../supabase/client";

type TwilioCall = {
  disconnect: () => void;
  mute: (shouldMute: boolean) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
};

type TwilioDevice = {
  register: () => Promise<void>;
  connect: (options: { params: Record<string, string> }) => Promise<TwilioCall>;
  destroy: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
};

function normalizePhone(value: string) {
  return value.trim().replace(/[\s().-]/g, "");
}

export default function RealVoipPanel() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("Checking telephony setup…");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const deviceRef = useRef<TwilioDevice | null>(null);
  const callRef = useRef<TwilioCall | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let disposed = false;
    let createdDevice: TwilioDevice | null = null;

    async function setup() {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) {
          setStatus("Sign in required");
          return;
        }
        const response = await fetch("/api/telephony/token", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const tokenData = await response.json();
        if (!response.ok) {
          if (tokenData.code === "TELEPHONY_NOT_CONFIGURED") {
            setStatus("Provider setup required");
            setError(tokenData.error || "Configure Twilio in Vercel.");
          } else {
            setStatus("Unable to connect");
            setError(tokenData.error || "Could not obtain a calling token.");
          }
          return;
        }

        const sdk = await import("@twilio/voice-sdk");
        const device = new sdk.Device(tokenData.token, { logLevel: 1 });
        createdDevice = device as unknown as TwilioDevice;
        deviceRef.current = createdDevice;
        device.on("registered", () => {
          if (!disposed) {
            setReady(true);
            setStatus("Ready for internet calls");
            setError("");
          }
        });
        device.on("error", (err: Error) => {
          if (!disposed) {
            setReady(false);
            setStatus("Calling service error");
            setError(err.message || "Twilio reported a calling error.");
          }
        });
        device.on("unregistered", () => {
          if (!disposed) {
            setReady(false);
            setStatus("Disconnected");
          }
        });
        await device.register();
      } catch (err) {
        if (!disposed) {
          setStatus("Unable to connect");
          setError(err instanceof Error ? err.message : "Could not initialize internet calling.");
        }
      }
    }

    void setup();
    return () => {
      disposed = true;
      mountedRef.current = false;
      callRef.current?.disconnect();
      createdDevice?.destroy();
      deviceRef.current = null;
      callRef.current = null;
    };
  }, []);

  async function startCall() {
    const destination = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(destination)) {
      setError("Use international format, for example +27821234567.");
      return;
    }
    if (!deviceRef.current || !ready) {
      setError("Calling is not ready. Check the provider setup and connection status.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Connecting call…");
    try {
      const call = await deviceRef.current.connect({ params: { To: destination } });
      callRef.current = call;
      call.on("accept", () => {
        setConnected(true);
        setBusy(false);
        setStatus("Call connected");
      });
      call.on("disconnect", () => {
        callRef.current = null;
        setConnected(false);
        setMuted(false);
        setBusy(false);
        setStatus("Ready for internet calls");
      });
      call.on("cancel", () => {
        callRef.current = null;
        setConnected(false);
        setBusy(false);
        setStatus("Call cancelled");
      });
      call.on("error", (err: Error) => {
        setError(err.message || "The call failed.");
        setConnected(false);
        setBusy(false);
        setStatus("Call failed");
      });
    } catch (err) {
      setBusy(false);
      setStatus("Call failed");
      setError(err instanceof Error ? err.message : "Could not start the call.");
    }
  }

  function toggleMute() {
    const next = !muted;
    callRef.current?.mute(next);
    setMuted(next);
  }

  function endCall() {
    callRef.current?.disconnect();
    callRef.current = null;
    setConnected(false);
    setMuted(false);
    setBusy(false);
    setStatus("Ready for internet calls");
  }

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-5 py-4 text-white">
        <div>
          <div className="flex items-center gap-2 text-lg font-black"><Wifi size={19} /> Real Internet Calling</div>
          <p className="mt-1 text-xs text-indigo-200">Twilio Voice • live VoIP connection</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
          {ready ? <CheckCircle2 size={15} className="text-emerald-300" /> : <AlertCircle size={15} className="text-amber-300" />}
          {status}
        </div>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label htmlFor="real-voip-number" className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">Destination number</label>
          <input
            id="real-voip-number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+27821234567"
            inputMode="tel"
            autoComplete="tel"
            disabled={busy || connected}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <p className="mt-1.5 text-xs text-slate-500">Enter the full international number, including + and country code.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!connected ? (
            <button type="button" onClick={() => void startCall()} disabled={!ready || busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />} {busy ? "Connecting…" : "Start real call"}
            </button>
          ) : (
            <>
              <button type="button" onClick={toggleMute} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50">
                {muted ? <MicOff size={17} /> : <Mic size={17} />}{muted ? "Unmute" : "Mute"}
              </button>
              <button type="button" onClick={endCall} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-700">
                <PhoneOff size={18} /> End call
              </button>
            </>
          )}
        </div>
      </div>
      {error && <div role="alert" className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>}
      <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-500">
        Calls require a configured Twilio account, Voice SDK credentials, a TwiML App pointed at this app’s <code>/api/telephony/twiml</code> endpoint, and an approved caller ID. No call recording is enabled.
      </div>
    </section>
  );
}
