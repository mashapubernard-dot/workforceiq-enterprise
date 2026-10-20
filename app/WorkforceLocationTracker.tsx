"use client";

import { useEffect } from "react";
import { supabase } from "../supabase/client";

type TrackerProfile = {
  id: string;
  role: string;
};

export default function WorkforceLocationTracker({
  profile,
  enabled = true,
}: {
  profile: TrackerProfile | null;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (
      !enabled ||
      !profile ||
      profile.role === "Super Admin" ||
      profile.role === "Platform Super Admin"
    ) return;

    let cancelled = false;
    let watchId: number | null = null;
    let intervalId: number | null = null;
    let orgId: string | null = null;
    let lastPingAt = 0;
    let checking = false;
    let writing = false;
    let gpsHeartbeatId: number | null = null;

    const stopWatch = () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const savePosition = async (position: GeolocationPosition) => {
      if (cancelled || !orgId || writing || Date.now() - lastPingAt < 15000) return;
      writing = true;
      lastPingAt = Date.now();
      try {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const speedKmh =
          position.coords.speed == null || position.coords.speed < 0
            ? null
            : position.coords.speed * 3.6;

        const [{ data: existing, error: lookupError }, { data: assignedDevice }] = await Promise.all([
          supabase
            .from("mobile_workforce_sessions")
            .select("id")
            .eq("user_id", profile.id)
            .eq("org_id", orgId)
            .order("last_seen_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("devices")
            .select("id")
            .eq("assigned_user", profile.id)
            .eq("org_id", orgId)
            .limit(1)
            .maybeSingle(),
        ]);

        if (lookupError) {
          console.warn("Workforce location session lookup failed:", lookupError.message);
          return;
        }
        if (cancelled) return;

        const payload = {
          user_id: profile.id,
          device_id: assignedDevice?.id ?? null,
          org_id: orgId,
          last_latitude: latitude,
          last_longitude: longitude,
          last_seen_at: new Date().toISOString(),
          status: "Online",
          platform: /Android/i.test(navigator.userAgent)
            ? "Android"
            : /iPhone|iPad/i.test(navigator.userAgent)
              ? "iOS"
              : "Web",
        };

        const sessionResult = existing?.id
          ? await supabase.from("mobile_workforce_sessions").update(payload).eq("id", existing.id)
          : await supabase.from("mobile_workforce_sessions").insert(payload);

        if (sessionResult.error) {
          console.warn("Workforce location session update failed:", sessionResult.error.message);
          return;
        }

        const historyResult = await supabase.from("workforce_locations").insert({
          org_id: orgId,
          user_id: profile.id,
          latitude,
          longitude,
          accuracy_meters: position.coords.accuracy ?? null,
          speed_kmh: speedKmh,
          heading: position.coords.heading ?? null,
          source: "web_gps",
          recorded_at: new Date().toISOString(),
        });
        if (historyResult.error) {
          console.warn("Workforce location history insert failed:", historyResult.error.message);
        }
      } catch (error) {
        console.warn("Workforce GPS ping failed:", error);
      } finally {
        writing = false;
      }
    };

    const startWatch = () => {
      if (cancelled || watchId !== null || !navigator.geolocation) return;
      watchId = navigator.geolocation.watchPosition(
        (position) => void savePosition(position),
        (error) => console.warn("Workforce GPS unavailable; allow location access for live map:", error.message),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
      if (gpsHeartbeatId === null) {
        gpsHeartbeatId = window.setInterval(() => {
          if (cancelled || !navigator.geolocation) return;
          navigator.geolocation.getCurrentPosition(
            (position) => void savePosition(position),
            (error) => console.warn("Workforce GPS heartbeat failed:", error.message),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
          );
        }, 15000);
      }
    };

    const initialize = async () => {
      if (checking || cancelled) return;
      checking = true;
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("org_id")
          .eq("id", profile.id)
          .maybeSingle();

        if (error) {
          console.warn("Could not load tenant for GPS tracker:", error.message);
          return;
        }
        orgId = data?.org_id ?? null;

        if (!orgId || cancelled) {
          stopWatch();
          return;
        }

        // A signed-in workforce user should appear online even before clock-in.
        // GPS is only available after the browser/device grants location permission.
        startWatch();
      } catch (error) {
        console.warn("Workforce GPS tracker initialization failed:", error);
      } finally {
        checking = false;
      }
    };

    void initialize();
    intervalId = window.setInterval(() => {
      if (!orgId) void initialize();
    }, 10000);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      if (gpsHeartbeatId !== null) window.clearInterval(gpsHeartbeatId);
      stopWatch();
      // The live dashboard considers a user offline when their last GPS ping is stale.
      // Do not delete the session or its last known location on logout/navigation.
    };
  }, [profile?.id, profile?.role, enabled]);

  return null;
}
