"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Clock3, MapPin, Upload, ShieldCheck, Image as ImageIcon } from "lucide-react";
import { supabase } from "../supabase/client";

type Role = "Administrator" | "Supervisor" | "Team Leader" | "Employee" | "Super Admin";

type FieldWorkOrder = {
  id: string;
  ticketId: string;
  technician: string;
  customer: string;
  site: string;
  status: string;
};

type Profile = {
  id: string;
  full_name: string;
  role: Role;
};

type PhotoRow = {
  id: string;
  ticket_id: number | null;
  work_order_id: string | null;
  user_id: string;
  photo_type: "before" | "after";
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  captured_at: string;
  signed_url?: string | null;
};

type Props = {
  profile: Profile;
  fieldWorkOrders: FieldWorkOrder[];
};

function ticketIdFromWorkOrder(order: FieldWorkOrder) {
  const value = Number(order.ticketId);
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

export default function FieldMobileWorkforce({ profile, fieldWorkOrders }: Props) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isInsideFence, setIsInsideFence] = useState<boolean | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const myOrders = useMemo(() => {
    if (profile.role !== "Employee" && profile.role !== "Team Leader") return fieldWorkOrders;
    const name = profile.full_name.trim().toLowerCase();
    return fieldWorkOrders.filter((order) => order.technician.trim().toLowerCase() === name);
  }, [fieldWorkOrders, profile]);

  const loadPhotos = useCallback(async () => {
    if (!orgId) return;
    const ticketIds = myOrders
      .map(ticketIdFromWorkOrder)
      .filter((id): id is number => id !== null);

    let query = supabase
      .from("field_job_photos")
      .select("id,ticket_id,work_order_id,user_id,photo_type,storage_path,latitude,longitude,accuracy_meters,captured_at")
      .order("captured_at", { ascending: false })
      .limit(200);

    if (ticketIds.length > 0) {
      query = query.in("ticket_id", ticketIds);
    } else if (profile.role !== "Super Admin") {
      query = query.eq("user_id", profile.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Field photo load error:", error);
      return;
    }

    const rows = (data ?? []) as PhotoRow[];
    if (!rows.length) {
      setPhotos([]);
      return;
    }

    const paths = rows.map((row) => row.storage_path);
    const { data: signed } = await supabase.storage
      .from("field-job-photos")
      .createSignedUrls(paths, 3600);

    const signedMap = new Map((signed ?? []).map((item: any) => [item.path, item.signedUrl]));
    setPhotos(rows.map((row) => ({ ...row, signed_url: signedMap.get(row.storage_path) ?? null })));
  }, [orgId, myOrders, profile]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const { data } = await supabase
        .from("user_profiles")
        .select("org_id")
        .eq("id", profile.id)
        .maybeSingle();
      if (!cancelled) setOrgId(data?.org_id ?? null);
    }
    void bootstrap();
    return () => { cancelled = true; };
  }, [profile.id]);

  useEffect(() => {
    void loadPhotos();
    const channel = supabase
      .channel("workforceiq-field-photo-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "field_job_photos" }, () => void loadPhotos())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadPhotos]);

  async function verifyJobLocation(order: FieldWorkOrder) {
    if (!navigator.geolocation) throw new Error("This phone does not provide GPS location.");
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      });
    });

    const { data: sites, error } = await supabase
      .from("workforce_sites")
      .select("id,name,latitude,longitude,radius_m,enabled,enforce_geofence")
      .eq("enabled", true)
      .eq("enforce_geofence", true);
    if (error) throw error;

    const rad = (v: number) => (v * Math.PI) / 180;
    const distance = (a: number, b: number, c: number, d: number) => {
      const R = 6371000;
      const dl = rad(c - a);
      const dn = rad(d - b);
      const x = Math.sin(dl / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dn / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    let nearest: { name: string; distance: number; radius: number } | null = null;
    for (const site of sites ?? []) {
      if (typeof site.latitude !== "number" || typeof site.longitude !== "number") continue;
      const d = distance(position.coords.latitude, position.coords.longitude, site.latitude, site.longitude);
      if (!nearest || d < nearest.distance) nearest = { name: site.name, distance: d, radius: Number(site.radius_m || 100) };
    }

    if (nearest && nearest.distance > nearest.radius) {
      setIsInsideFence(false);
      throw new Error("GPS fence check: you are " + Math.round(nearest.distance) + "m from " + nearest.name + ". The allowed radius is " + Math.round(nearest.radius) + "m.");
    }
    setIsInsideFence(true);
    return position;
  }

  async function captureAndUpload(order: FieldWorkOrder, photoType: "before" | "after", file: File) {
    if (profile.role === "Super Admin") return;
    if (!orgId) {
      setMessage("Your tenant could not be identified.");
      return;
    }

    setUploading(order.id + ":" + photoType);
    setMessage("");

    try {
      const position = await verifyJobLocation(order);

      const { data: device } = await supabase
        .from("devices")
        .select("id")
        .eq("assigned_user", profile.id)
        .eq("org_id", orgId)
        .limit(1)
        .maybeSingle();

      const ticketId = ticketIdFromWorkOrder(order);
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeWorkOrder = order.id.replace(/[^a-zA-Z0-9_-]/g, "_");
      const path = [
        orgId,
        profile.id,
        safeWorkOrder,
        photoType,
        Date.now() + "-" + crypto.randomUUID() + "." + extension,
      ].join("/");

      const { error: uploadError } = await supabase.storage
        .from("field-job-photos")
        .upload(path, file, {
          contentType: file.type || "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: rowError } = await supabase
        .from("field_job_photos")
        .insert({
          org_id: orgId,
          ticket_id: ticketId,
          work_order_id: order.id,
          user_id: profile.id,
          device_id: device?.id ?? null,
          photo_type: photoType,
          storage_path: path,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_meters: position.coords.accuracy ?? null,
          captured_at: new Date().toISOString(),
        });

      if (rowError) {
        await supabase.storage.from("field-job-photos").remove([path]);
        throw rowError;
      }

      setMessage((photoType === "before" ? "Before" : "After") + " photo uploaded with GPS proof.");
      await loadPhotos();
    } catch (error: any) {
      console.error("Field photo upload error:", error);
      setMessage(error?.code === 1
        ? "GPS permission is required so the photo can carry a location proof."
        : error?.message ?? "Unable to upload the job photo.");
    } finally {
      setUploading(null);
    }
  }

  function requestPhoto(order: FieldWorkOrder, photoType: "before" | "after") {
    inputRefs.current[order.id + ":" + photoType]?.click();
  }

  const photosFor = (order: FieldWorkOrder, photoType: "before" | "after") =>
    photos.filter((photo) => photo.work_order_id === order.id && photo.photo_type === photoType);

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-950 via-slate-900 to-cyan-950 text-white p-5 sm:p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/20 border border-emerald-300/20 flex items-center justify-center">
            <Camera size={22} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-black text-emerald-200">Mobile Field Evidence</div>
            <h2 className="text-2xl font-black mt-1">Before & After GPS Proof</h2>
            <p className="text-sm text-slate-300 mt-1">
              Photos are stored against the field work order together with the phone GPS position, accuracy and capture time.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 text-sky-900 p-3 text-sm font-bold">{message}</div>
      )}

      {myOrders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <ImageIcon className="mx-auto text-slate-400" size={28} />
          <div className="font-black text-slate-800 mt-2">No field work orders available</div>
          <p className="text-sm text-slate-500 mt-1">Assigned field jobs will appear here for photo evidence.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myOrders.map((order) => {
            const before = photosFor(order, "before");
            const after = photosFor(order, "after");
            return (
              <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-400">{order.id} · Ticket #{order.ticketId}</div>
                    <div className="font-black text-slate-900 mt-1">{order.customer || "Field Service Job"}</div>
                    <div className="text-sm text-slate-500 flex items-center gap-1 mt-1"><MapPin size={14} />{order.site || "Site not specified"}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{order.status}</span>
                </div>

                {profile.role !== "Super Admin" && (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {(["before", "after"] as const).map((type) => {
                      const key = order.id + ":" + type;
                      const busy = uploading === key;
                      return (
                        <div key={type}>
                          <input
                            ref={(el) => { inputRefs.current[key] = el; }}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.currentTarget.value = "";
                              if (file) void captureAndUpload(order, type, file);
                            }}
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => requestPhoto(order, type)}
                            className={
                              "w-full rounded-xl px-3 py-3 font-black text-sm inline-flex items-center justify-center gap-2 " +
                              (type === "before"
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200") +
                              " disabled:opacity-50"
                            }
                          >
                            {busy ? <Upload size={16} className="animate-pulse" /> : <Camera size={16} />}
                            {busy ? "Uploading…" : "Take " + (type === "before" ? "Before" : "After") + " Photo"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {(["before", "after"] as const).map((type) => {
                    const list = type === "before" ? before : after;
                    return (
                      <div key={type} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="font-black text-xs uppercase text-slate-500">{type} evidence · {list.length}</div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {list.map((photo) => (
                            <div key={photo.id} className="rounded-lg overflow-hidden bg-white border border-slate-200">
                              {photo.signed_url ? (
                                <img src={photo.signed_url} alt={type + " job evidence"} className="w-full aspect-square object-cover" />
                              ) : (
                                <div className="aspect-square flex items-center justify-center text-slate-400"><ImageIcon size={18} /></div>
                              )}
                              <div className="p-1.5 text-[9px] text-slate-500 space-y-0.5">
                                <div className="flex items-center gap-1"><Clock3 size={9} />{new Date(photo.captured_at).toLocaleString()}</div>
                                <div className="flex items-center gap-1"><MapPin size={9} />{photo.latitude?.toFixed(5)}, {photo.longitude?.toFixed(5)}</div>
                                {photo.accuracy_meters != null && <div>±{Math.round(photo.accuracy_meters)}m GPS</div>}
                              </div>
                            </div>
                          ))}
                          {!list.length && <div className="col-span-3 text-xs text-slate-400 py-4 text-center">No {type} photo yet.</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex gap-2">
        <ShieldCheck size={15} className="shrink-0 text-emerald-600" />
        GPS is captured from the phone at upload time. The stored photo path is tenant-scoped; exact upload position comes from GPS, not IP address.
      </div>
    </section>
  );
}
