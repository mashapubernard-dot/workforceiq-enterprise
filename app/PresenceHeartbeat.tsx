"use client";

import { useEffect } from "react";
import { supabase } from "../supabase/client";

export default function PresenceHeartbeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let currentUserId: string | null = null;
    let stopped = false;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      currentUserId = null;
    };

    const publish = async (userId: string) => {
      const { data: profile } = await supabase.from("user_profiles")
        .select("id, org_id").eq("id", userId).maybeSingle();
      if (stopped || !profile?.org_id) return;
      await supabase.from("webrtc_user_presence").upsert({
        user_id: userId,
        org_id: profile.org_id,
        last_seen: new Date().toISOString(),
      }, { onConflict: "user_id" });
    };

    const start = (userId: string) => {
      if (currentUserId === userId) return;
      stop();
      currentUserId = userId;
      void publish(userId);
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void publish(userId);
      }, 25000);
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) start(data.session.user.id);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) stop();
      else start(session.user.id);
    });

    const onVisibility = () => {
      if (document.visibilityState === "visible" && currentUserId) void publish(currentUserId);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      stop();
      authListener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
