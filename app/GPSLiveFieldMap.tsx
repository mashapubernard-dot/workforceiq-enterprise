"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, LocateFixed, MapPin, RefreshCw, Search, ShieldCheck, Smartphone, Wifi } from "lucide-react";
import { supabase } from "../supabase/client";

declare global {
  interface Window {
    L?: any;
  }
}

type LocationRow = {
  id: string;
  user_id: string;
  org_id: string;
  last_latitude: number | null;
  last_longitude: number | null;
  last_seen_at: string;
  status: string;
  platform: string | null;
  battery_percent: number | null;
  device_id: string | null;
};
type Device = { id:string; device_name:string; device_type:string|null; serial_number:string|null; assigned_user:string|null; status:string|null; location:string|null; org_id:string; mac_address:string|null; ip_address:string|null; };

type Person = {
  id: string;
  full_name: string;
  role: string;
};

type Props = {
  compact?: boolean;
};

const DEFAULT_CENTER: [number, number] = [-30.5595, 22.9375];

function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if (window.L) return Promise.resolve(window.L);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-workforceiq-leaflet="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", () => reject(new Error("Could not load map library")));
      return;
    }

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(style);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.workforceiqLeaflet = "true";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Could not load map library"));
    document.head.appendChild(script);
  });
}

export default function GPSLiveFieldMap({ compact = false }: Props) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const watchIdRef = useRef<number | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceSearchError, setDeviceSearchError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [gpsPermission, setGpsPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState("");
  const [lastGpsUpdate, setLastGpsUpdate] = useState<string | null>(null);

  const personMap = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people]
  );
  const deviceMap = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const normalizedSearch = deviceSearch.trim().toLowerCase();
  const deviceMatches = normalizedSearch
    ? devices.filter((d) =>
        [d.device_name, d.device_type, d.serial_number, d.mac_address, d.ip_address, d.location]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(normalizedSearch))
      )
    : [];
  const filteredLocations = normalizedSearch
    ? locations.filter((row) => {
        const d = row.device_id ? deviceMap.get(row.device_id) : undefined;
        const p = personMap.get(row.user_id);
        return [d?.device_name, d?.device_type, d?.serial_number, d?.mac_address, d?.ip_address, d?.location, p?.full_name, p?.role]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(normalizedSearch));
      })
    : locations;

  const refreshLocations = useCallback(async () => {
    const { data, error } = await supabase
      .from("mobile_workforce_sessions")
      .select("id,user_id,org_id,device_id,last_latitude,last_longitude,last_seen_at,status,platform,battery_percent")
      .not("last_latitude", "is", null)
      .not("last_longitude", "is", null)
      .order("last_seen_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("GPS map load error:", error);
      setMapError(error.message);
      return;
    }

    const newestByUser = new Map<string, LocationRow>();
    (data ?? []).forEach((row: LocationRow) => {
      if (!newestByUser.has(row.user_id)) newestByUser.set(row.user_id, row);
    });
    setLocations(Array.from(newestByUser.values()));
  }, []);

  const refreshDevices = useCallback(async () => {
    const { data, error } = await supabase.from("devices")
      .select("id,device_name,device_type,serial_number,assigned_user,status,location,org_id,mac_address,ip_address")
      .order("device_name", { ascending: true }).limit(500);
    if (!error) setDevices((data ?? []) as Device[]);
  }, []);

  const upsertCurrentLocation = useCallback(async (position: GeolocationPosition) => {
    if (!currentUserId || !orgId) return;

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const speedKmh =
      position.coords.speed == null || position.coords.speed < 0
        ? null
        : position.coords.speed * 3.6;

    const { data: existing, error: findError } = await supabase
      .from("mobile_workforce_sessions")
      .select("id")
      .eq("user_id", currentUserId)
      .eq("org_id", orgId)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("GPS session lookup error:", findError);
      return;
    }

    const { data: assignedDevice } = await supabase.from("devices").select("id").eq("assigned_user", currentUserId).eq("org_id", orgId).limit(1).maybeSingle();

    const payload = {
      user_id: currentUserId,
      device_id: assignedDevice?.id ?? null,
      org_id: orgId,
      last_latitude: latitude,
      last_longitude: longitude,
      last_seen_at: new Date().toISOString(),
      status: "Online",
      platform: /Android/i.test(navigator.userAgent) ? "Android" : /iPhone|iPad/i.test(navigator.userAgent) ? "iOS" : "Web",
    };

    const result = existing?.id
      ? await supabase.from("mobile_workforce_sessions").update(payload).eq("id", existing.id)
      : await supabase.from("mobile_workforce_sessions").insert(payload);

    if (result.error) {
      console.error("GPS location save error:", result.error);
      return;
    }

    setGpsPermission("granted");
    setLastGpsUpdate(new Date().toISOString());
    await refreshLocations();
  }, [currentUserId, orgId, refreshLocations]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("id,org_id,full_name,role")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const tenantId = profileData?.org_id ?? null;
      setOrgId(tenantId);

      if (tenantId) {
        const { data: peopleData } = await supabase
          .from("user_profiles")
          .select("id,full_name,role")
          .eq("org_id", tenantId)
          .order("full_name", { ascending: true });

        if (!cancelled) setPeople((peopleData ?? []) as Person[]);
      }

      await refreshLocations();
      await refreshDevices();

      const { data: attendance } = await supabase
        .from("attendance")
        .select("clock_in,clock_out")
        .eq("user_id", user.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled && attendance?.clock_in && !attendance.clock_out) {
        setTracking(true);
      }

      setLoading(false);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshLocations, refreshDevices]);

  useEffect(() => {
    const channel = supabase
      .channel("workforceiq-live-gps")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mobile_workforce_sessions" },
        () => void refreshLocations()
      )
      .subscribe();

    const timer = window.setInterval(() => void refreshLocations(), 15000);

    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [refreshLocations]);

  useEffect(() => {
    if (!tracking || !currentUserId) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setGpsPermission("denied");
      setMapError("This device/browser does not provide GPS location.");
      return;
    }

    setMapError("");
    const id = navigator.geolocation.watchPosition(
      (position) => void upsertCurrentLocation(position),
      (error) => {
        console.error("GPS permission/location error:", error);
        setGpsPermission(error.code === error.PERMISSION_DENIED ? "denied" : "unknown");
        setMapError(
          error.code === error.PERMISSION_DENIED
            ? "GPS permission was denied. Enable location permission for WorkforceIQ to appear on the live map."
            : "Unable to read the device GPS position."
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    watchIdRef.current = id;

    return () => {
      navigator.geolocation.clearWatch(id);
      if (watchIdRef.current === id) watchIdRef.current = null;
    };
  }, [tracking, currentUserId, upsertCurrentLocation]);

  useEffect(() => {
    if (!mapHostRef.current) return;

    let cancelled = false;
    void loadLeaflet()
      .then((L) => {
        if (cancelled || !mapHostRef.current) return;

        if (!mapRef.current) {
          mapRef.current = L.map(mapHostRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, 5);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(mapRef.current);
        }

        Object.values(markersRef.current).forEach((marker: any) => marker.remove());
        markersRef.current = {};

        const valid = filteredLocations.filter(
          (row) => typeof row.last_latitude === "number" && typeof row.last_longitude === "number"
        );

        valid.forEach((row) => {
          const name = personMap.get(row.user_id)?.full_name ?? "Technician";
          const device = row.device_id ? deviceMap.get(row.device_id) : undefined;
          const markerKey = row.device_id ?? row.user_id;
          const marker = L.circleMarker([row.last_latitude, row.last_longitude], {
            radius: row.user_id === currentUserId ? 10 : 8,
            weight: 3,
            color: row.user_id === currentUserId ? "#2563eb" : "#16a34a",
            fillOpacity: 0.85,
          }).addTo(mapRef.current);

          const ageSeconds = Math.max(0, Math.round((Date.now() - new Date(row.last_seen_at).getTime()) / 1000));
          const state = ageSeconds <= 60 ? "Live" : ageSeconds <= 180 ? "Recent" : "Stale";

          marker.bindPopup(
            `<div style="min-width:220px"><strong>${name}</strong><br/>Device: ${device?.device_name ?? "Unregistered device"}<br/>MAC: ${device?.mac_address ?? "—"}<br/>IP: ${device?.ip_address ?? "—"}<br/>Status: ${row.status ?? "Online"}<br/>Signal: ${state}<br/>Last GPS ping: ${new Date(row.last_seen_at).toLocaleTimeString()}</div>`
          );
          markersRef.current[markerKey] = marker;
        });

        if (valid.length === 1) {
          mapRef.current.setView([valid[0].last_latitude, valid[0].last_longitude], 15);
        } else if (valid.length > 1) {
          const bounds = L.latLngBounds(valid.map((row: LocationRow) => [row.last_latitude, row.last_longitude]));
          mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
        }
      })
      .catch((error) => {
        console.error("Leaflet load error:", error);
        if (!cancelled) setMapError("The map library could not be loaded. Location tracking still works when GPS permission is enabled.");
      });

    return () => {
      cancelled = true;
    };
  }, [locations, personMap, deviceMap, filteredLocations, currentUserId]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const liveCount = locations.filter(
    (row) => Date.now() - new Date(row.last_seen_at).getTime() <= 60000
  ).length;

  return (
    <section className={compact ? "space-y-4" : "space-y-5"}>
      <div className="rounded-3xl overflow-hidden border border-sky-200 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-xl">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider">
                <MapPin size={14} />
                Feature 01 · GPS Live Field Map
              </div>
              <h2 className="text-2xl sm:text-3xl font-black mt-3">Live Field Workforce</h2>
              <p className="text-sky-100 text-sm mt-1 max-w-2xl">
                Tenant-scoped technician locations from WorkforceIQ mobile/web GPS sessions.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void refreshLocations()}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm font-bold hover:bg-white/15"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              {tracking && (
                <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-2 text-sm font-black text-emerald-200">
                  <Activity size={16} />
                  GPS active
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-white/10">
          <div className="p-4"><div className="text-xs text-slate-400">Live</div><div className="text-2xl font-black">{liveCount}</div></div>
          <div className="p-4 border-l border-white/10"><div className="text-xs text-slate-400">Tracked</div><div className="text-2xl font-black">{locations.length}</div></div>
          <div className="p-4 border-l border-white/10"><div className="text-xs text-slate-400">Tenant</div><div className="text-sm font-black mt-1">{orgId ? "Protected" : "—"}</div></div>
          <div className="p-4 border-l border-white/10"><div className="text-xs text-slate-400">Last GPS</div><div className="text-sm font-black mt-1">{lastGpsUpdate ? new Date(lastGpsUpdate).toLocaleTimeString() : "Waiting"}</div></div>
        </div>
      </div>

      {mapError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-3">
          <LocateFixed size={18} className="mt-0.5 shrink-0" />
          <div><strong>GPS / map notice:</strong> {mapError}</div>
        </div>
      )}

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 font-black text-indigo-950"><Search size={17}/>Find a device on the live map</div>
        <p className="text-xs text-indigo-800 mt-1">Search a registered device name, serial, MAC address or IP address. If it has a GPS session, the map jumps to its latest ping.</p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-400"/>
            <input value={deviceSearch} onChange={(e)=>{setDeviceSearch(e.target.value);setDeviceSearchError("");}} placeholder="MAC, IP, serial or device name…" className="w-full rounded-xl border border-indigo-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <button type="button" onClick={()=>{
            const target=filteredLocations[0];
            if(target?.last_latitude!=null && target.last_longitude!=null && mapRef.current){
              mapRef.current.setView([target.last_latitude,target.last_longitude],17);
              markersRef.current[target.device_id ?? target.user_id]?.openPopup();
              setDeviceSearchError("");
            } else if(deviceMatches.length) setDeviceSearchError("Device found, but there is no GPS ping for this device yet.");
            else if(normalizedSearch) setDeviceSearchError("No registered device matched that MAC, IP, serial or name.");
          }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-sm font-black hover:bg-indigo-700"><MapPin size={16}/>Find on map</button>
        </div>
        {normalizedSearch && deviceMatches.length>0 && <div className="mt-3 flex flex-wrap gap-2">{deviceMatches.slice(0,8).map((d)=><button key={d.id} type="button" onClick={()=>{
          const loc=locations.find((x)=>x.device_id===d.id);
          if(loc?.last_latitude!=null && loc.last_longitude!=null && mapRef.current){mapRef.current.setView([loc.last_latitude,loc.last_longitude],17);markersRef.current[d.id]?.openPopup();setDeviceSearchError("");}
          else setDeviceSearchError(d.device_name+" is registered, but has no current GPS ping.");
        }} className="rounded-lg bg-white border border-indigo-200 px-3 py-2 text-left text-xs hover:bg-indigo-100"><div className="font-black text-slate-800">{d.device_name}</div><div className="text-slate-500">{d.mac_address ?? "No MAC"} · {d.ip_address ?? "No IP"}</div></button>)}</div>}
        {deviceSearchError && <div className="mt-2 text-xs font-bold text-amber-800">{deviceSearchError}</div>}
        <div className="mt-3 text-[11px] text-indigo-700 flex items-start gap-2"><Wifi size={14} className="mt-0.5 shrink-0"/>MAC/IP are identifiers. Exact map position comes from the device GPS ping; an IP address alone cannot provide an exact physical location.</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-5">
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div ref={mapHostRef} className="h-[420px] sm:h-[520px] w-full bg-slate-100" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-black text-slate-900">Technicians</div>
            <span className="text-xs font-bold text-slate-400">{locations.length}</span>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500 py-8 text-center">Loading GPS sessions…</div>
          ) : locations.length === 0 ? (
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-5 text-center">
              <Smartphone size={24} className="mx-auto text-slate-400" />
              <div className="font-bold text-slate-700 mt-2">No GPS sessions yet</div>
              <p className="text-xs text-slate-500 mt-1">
                A clocked-in mobile user must allow location access before a marker appears.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[470px] overflow-auto">
              {filteredLocations.map((row) => {
                const person = personMap.get(row.user_id);
                const ageSeconds = Math.max(0, Math.round((Date.now() - new Date(row.last_seen_at).getTime()) / 1000));
                const live = ageSeconds <= 60;

                return (
                  <button
                    key={row.user_id}
                    type="button"
                    onClick={() => {
                      if (mapRef.current && row.last_latitude != null && row.last_longitude != null) {
                        mapRef.current.setView([row.last_latitude, row.last_longitude], 16);
                        markersRef.current[row.device_id ?? row.user_id]?.openPopup();
                      }
                    }}
                    className="w-full text-left rounded-xl border border-slate-200 p-3 hover:bg-sky-50 hover:border-sky-200 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-800 truncate">{person?.full_name ?? "Technician"}</div>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full ${live ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {live ? "LIVE" : "STALE"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {row.last_latitude?.toFixed(5)}, {row.last_longitude?.toFixed(5)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {new Date(row.last_seen_at).toLocaleString()}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex gap-2">
            <ShieldCheck size={15} className="shrink-0 text-emerald-600" />
            GPS data is restricted by the existing WorkforceIQ tenant RLS policies.
          </div>
        </div>
      </div>
    </section>
  );
}
