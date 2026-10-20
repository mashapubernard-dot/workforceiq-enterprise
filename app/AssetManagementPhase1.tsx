"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Check, GitMerge, History, Link2, Loader2, Plus, RefreshCw, Wrench } from "lucide-react";
import { supabase } from "../supabase/client";

type AssetRow = {
  id: string;
  org_id: string | null;
  asset_tag: string;
  device_name: string;
  category: string;
  status: string;
  assigned_to: string;
  location: string;
  make: string | null;
  model_number: string | null;
  model_id: string | null;
  ip_address: string | null;
  cost_center: string | null;
  purchase_order: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  ownership_type: string;
  warranty_expires: string | null;
};

type HardwareModel = {
  id: string;
  org_id: string;
  manufacturer: string;
  canonical_name: string;
  model_number: string | null;
  category: string;
  reorder_threshold: number;
  merged_into_id: string | null;
  created_at: string;
};

type LifecycleEvent = {
  id: string;
  org_id: string | null;
  asset_id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
};

type OrganizationRow = { id: string; name: string; organization_name?: string | null };

type AssetRelationship = {
  id: string;
  org_id: string;
  asset_id: string;
  related_asset_id: string | null;
  service_name: string | null;
  relationship_type: string;
  notes: string | null;
  created_at: string;
};

type WorkspaceTab = "workspace" | "models" | "lifecycle" | "relationships";

const lifecycleTypes = ["procurement", "assignment", "transfer", "repair", "return", "disposal"];

export default function AssetManagementPhase1() {
  const [tab, setTab] = useState<WorkspaceTab>("workspace");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [actorName, setActorName] = useState<string | null>(null);
  const [isPlatformSuperAdmin, setIsPlatformSuperAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [legacyOrgSelections, setLegacyOrgSelections] = useState<Record<string, string>>({});
  const [mapAssetId, setMapAssetId] = useState("");
  const [mapModelId, setMapModelId] = useState("");
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [models, setModels] = useState<HardwareModel[]>([]);
  const [events, setEvents] = useState<LifecycleEvent[]>([]);
  const [relationships, setRelationships] = useState<AssetRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [modelForm, setModelForm] = useState({ manufacturer: "", canonical_name: "", model_number: "", category: "Laptop / Desktop", reorder_threshold: "1" });
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [eventForm, setEventForm] = useState({ event_type: "repair", notes: "" });
  const [relationshipForm, setRelationshipForm] = useState({ asset_id: "", related_asset_id: "", service_name: "", relationship_type: "Depends on", notes: "" });

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) throw new Error("Please sign in to access Asset Management.");
      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("org_id, organization_id, full_name, email, role")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      setActorName(profile?.full_name ?? profile?.email ?? user.email ?? null);
      const isSuperAdmin = profile?.role === "Super Admin" || profile?.role === "Platform Super Admin";
      setIsPlatformSuperAdmin(isSuperAdmin);
      if (isSuperAdmin) {
        const { data: orgData, error: orgError } = await supabase.from("organizations").select("id,name,organization_name").order("name");
        if (orgError) throw orgError;
        setOrganizations((orgData ?? []) as OrganizationRow[]);
      } else {
        setOrganizations([]);
      }
      const activeOrgId = profile?.org_id ?? profile?.organization_id ?? null;
      setOrgId(activeOrgId);

      const [assetResult, modelResult, eventResult, relationshipResult] = await Promise.all([
        supabase.from("assets").select("id,org_id,asset_tag,device_name,category,status,assigned_to,location,make,model_number,model_id,ip_address,cost_center,purchase_order,purchase_date,purchase_cost,ownership_type,warranty_expires").order("created_at", { ascending: false }),
        supabase.from("asset_models").select("id,org_id,manufacturer,canonical_name,model_number,category,reorder_threshold,merged_into_id,created_at").order("manufacturer").order("canonical_name"),
        supabase.from("asset_events").select("id,org_id,asset_id,event_type,from_value,to_value,notes,created_by,created_by_name,created_at").order("created_at", { ascending: false }).limit(250),
        supabase.from("asset_relationships").select("id,org_id,asset_id,related_asset_id,service_name,relationship_type,notes,created_at").order("created_at", { ascending: false }),
      ]);
      if (assetResult.error) throw assetResult.error;
      if (modelResult.error) throw modelResult.error;
      if (eventResult.error) throw eventResult.error;
      if (relationshipResult.error) throw relationshipResult.error;

      setAssets((assetResult.data ?? []) as AssetRow[]);
      setModels((modelResult.data ?? []) as HardwareModel[]);
      setEvents((eventResult.data ?? []) as LifecycleEvent[]);
      setRelationships((relationshipResult.data ?? []) as AssetRelationship[]);
      setSelectedAssetId((current) => current || assetResult.data?.find((a: any) => a.org_id === activeOrgId)?.id || assetResult.data?.[0]?.id || "");
      setRelationshipForm((current) => ({
        ...current,
        asset_id: current.asset_id || assetResult.data?.find((a: any) => a.org_id === activeOrgId)?.id || assetResult.data?.[0]?.id || "",
      }));
    } catch (e: any) {
      setError(e?.message ?? "Unable to load Hardware Asset Management.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const tenantAssets = useMemo(() => assets.filter((asset) => (orgId && asset.org_id === orgId) || (isPlatformSuperAdmin && asset.org_id === null)), [assets, orgId, isPlatformSuperAdmin]);
  const activeModels = useMemo(() => models.filter((model) => !model.merged_into_id), [models]);
  const selectedAsset = tenantAssets.find((asset) => asset.id === selectedAssetId) ?? tenantAssets[0];

  const stockRows = useMemo(() => {
    const grouped = new Map<string, { key: string; modelName: string; manufacturer: string; location: string; available: number; threshold: number; modelId: string | null }>();
    tenantAssets.forEach((asset) => {
      const model = activeModels.find((candidate) => candidate.id === asset.model_id);
      const key = model?.id ?? `unmapped:${(asset.make || "Unspecified").trim().toLowerCase()}:${(asset.model_number || asset.category).trim().toLowerCase()}`;
      const location = asset.location?.trim() || "Unspecified location";
      const rowKey = `${key}::${location}`;
      if (!grouped.has(rowKey)) grouped.set(rowKey, {
        key: rowKey,
        modelName: model?.canonical_name || asset.model_number || asset.category || "Unmapped model",
        manufacturer: model?.manufacturer || asset.make || "Unknown manufacturer",
        location,
        available: 0,
        threshold: model?.reorder_threshold ?? 0,
        modelId: model?.id ?? null,
      });
      const row = grouped.get(rowKey)!;
      if (["in storage", "in stock", "available"].includes((asset.status || "").toLowerCase())) row.available += 1;
    });
    return Array.from(grouped.values()).sort((a, b) => {
      const aLow = a.threshold > 0 && a.available <= a.threshold ? 0 : 1;
      const bLow = b.threshold > 0 && b.available <= b.threshold ? 0 : 1;
      return aLow - bLow || a.modelName.localeCompare(b.modelName) || a.location.localeCompare(b.location);
    });
  }, [tenantAssets, activeModels]);

  const lowStockRows = stockRows.filter((row) => row.modelId && row.threshold > 0 && row.available <= row.threshold);
  const availableCount = tenantAssets.filter((a) => ["in storage", "in stock", "available"].includes((a.status || "").toLowerCase())).length;
  const repairCount = tenantAssets.filter((a) => (a.status || "").toLowerCase() === "in repair").length;

  const createModel = async () => {
    if (!orgId) { setError("Your profile is not linked to an organisation. Ask an administrator to correct it."); return; }
    if (!modelForm.manufacturer.trim() || !modelForm.canonical_name.trim()) return;
    setSaving(true); setError("");
    try {
      const { error: saveError } = await supabase.from("asset_models").insert({
        org_id: orgId,
        manufacturer: modelForm.manufacturer.trim(),
        canonical_name: modelForm.canonical_name.trim(),
        model_number: modelForm.model_number.trim() || null,
        category: modelForm.category,
        reorder_threshold: Math.max(0, Number(modelForm.reorder_threshold) || 0),
        created_by: userId,
      });
      if (saveError) throw saveError;
      setModelForm({ manufacturer: "", canonical_name: "", model_number: "", category: "Laptop / Desktop", reorder_threshold: "1" });
      await loadWorkspace();
    } catch (e: any) {
      setError(e?.message ?? "Unable to save hardware model.");
    } finally { setSaving(false); }
  };

  const mergeModels = async () => {
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    const source = activeModels.find((m) => m.id === mergeSourceId);
    const target = activeModels.find((m) => m.id === mergeTargetId);
    if (!source || !target || source.org_id !== target.org_id || source.org_id !== orgId) {
      setError("Choose two models belonging to your organisation."); return;
    }
    if (!window.confirm(`Merge "${source.manufacturer} ${source.canonical_name}" into "${target.manufacturer} ${target.canonical_name}"? Asset records and lifecycle history will be preserved.`)) return;
    setSaving(true); setError("");
    try {
      const { error: moveError } = await supabase.from("assets").update({ model_id: target.id }).eq("org_id", orgId).eq("model_id", source.id);
      if (moveError) throw moveError;
      const { error: mergeError } = await supabase.from("asset_models").update({ merged_into_id: target.id, updated_at: new Date().toISOString() }).eq("org_id", orgId).eq("id", source.id);
      if (mergeError) throw mergeError;
      setMergeSourceId(""); setMergeTargetId("");
      await loadWorkspace();
    } catch (e: any) {
      setError(e?.message ?? "Unable to merge hardware models.");
    } finally { setSaving(false); }
  };

  const linkAssetToModel = async () => {
    if (!orgId || !mapAssetId || !mapModelId) return;
    const asset = tenantAssets.find((item) => item.id === mapAssetId && item.org_id === orgId);
    const model = activeModels.find((item) => item.id === mapModelId && item.org_id === orgId);
    if (!asset || !model) { setError("Choose an asset and canonical model from your organisation."); return; }
    setSaving(true); setError("");
    try {
      const { error: updateError } = await supabase.from("assets").update({ model_id: model.id }).eq("org_id", orgId).eq("id", asset.id);
      if (updateError) throw updateError;
      const { error: eventError } = await supabase.from("asset_events").insert({ org_id: orgId, asset_id: asset.id, event_type: "model_normalization", from_value: asset.model_number || asset.make || null, to_value: model.canonical_name, notes: "Linked asset to canonical hardware model.", created_by: userId, created_by_name: actorName });
      if (eventError) throw eventError;
      setMapAssetId(""); setMapModelId("");
      await loadWorkspace();
    } catch (e: any) { setError(e?.message ?? "Unable to link asset to model."); }
    finally { setSaving(false); }
  };

  const assignLegacyAsset = async (assetId: string) => {
    const targetOrgId = legacyOrgSelections[assetId];
    if (!isPlatformSuperAdmin || !targetOrgId) return;
    const asset = assets.find((item) => item.id === assetId && item.org_id === null);
    if (!asset) return;
    const target = organizations.find((item) => item.id === targetOrgId);
    if (!target || !window.confirm("Assign legacy asset " + asset.asset_tag + " to " + (target.organization_name || target.name) + "? Please verify the tenant before continuing.")) return;
    setSaving(true); setError("");
    try {
      const { error: updateError } = await supabase.from("assets").update({ org_id: targetOrgId }).eq("id", assetId).is("org_id", null);
      if (updateError) throw updateError;
      setLegacyOrgSelections((current) => ({ ...current, [assetId]: "" }));
      await loadWorkspace();
    } catch (e: any) { setError(e?.message ?? "Unable to assign the legacy asset."); }
    finally { setSaving(false); }
  };

  const updateThreshold = async (modelId: string, value: string) => {
    if (!orgId) return;
    const threshold = Math.max(0, Number(value) || 0);
    const { error: updateError } = await supabase.from("asset_models").update({ reorder_threshold: threshold, updated_at: new Date().toISOString() }).eq("org_id", orgId).eq("id", modelId);
    if (updateError) setError(updateError.message);
    else await loadWorkspace();
  };

  const addLifecycleEvent = async () => {
    if (!selectedAsset || !userId) return;
    setSaving(true); setError("");
    try {
      const { error: insertError } = await supabase.from("asset_events").insert({
        org_id: selectedAsset.org_id,
        asset_id: selectedAsset.id,
        event_type: eventForm.event_type,
        notes: eventForm.notes.trim() || null,
        created_by: userId,
        created_by_name: actorName,
      });
      if (insertError) throw insertError;
      setEventForm((current) => ({ ...current, notes: "" }));
      await loadWorkspace();
    } catch (e: any) {
      setError(e?.message ?? "Unable to record lifecycle event.");
    } finally { setSaving(false); }
  };

  const addRelationship = async () => {
    if (!orgId || !relationshipForm.asset_id || (!relationshipForm.related_asset_id && !relationshipForm.service_name.trim())) return;
    setSaving(true); setError("");
    try {
      const { error: insertError } = await supabase.from("asset_relationships").insert({
        org_id: orgId,
        asset_id: relationshipForm.asset_id,
        related_asset_id: relationshipForm.related_asset_id || null,
        service_name: relationshipForm.related_asset_id ? null : relationshipForm.service_name.trim(),
        relationship_type: relationshipForm.relationship_type,
        notes: relationshipForm.notes.trim() || null,
        created_by: userId,
      });
      if (insertError) throw insertError;
      setRelationshipForm((current) => ({ ...current, related_asset_id: "", service_name: "", notes: "" }));
      await loadWorkspace();
    } catch (e: any) {
      setError(e?.message ?? "Unable to create asset relationship.");
    } finally { setSaving(false); }
  };

  const tabs: { id: WorkspaceTab; label: string; icon: typeof Boxes }[] = [
    { id: "workspace", label: "Asset Workspace", icon: Boxes },
    { id: "models", label: "Hardware Models", icon: GitMerge },
    { id: "lifecycle", label: "Lifecycle Timeline", icon: History },
    { id: "relationships", label: "Relationships", icon: Link2 },
  ];

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-teal-700">Phase 1 · Hardware Asset Management</p>
          <h3 className="mt-1 text-2xl font-black text-slate-900">Asset Workspace</h3>
          <p className="mt-1 text-sm text-slate-600">Procurement, operational status, canonical models, stock warnings and lifecycle history in one place.</p>
        </div>
        <button type="button" onClick={() => void loadWorkspace()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {loading ? <div className="flex items-center justify-center gap-2 rounded-2xl bg-white p-10 text-slate-500"><Loader2 className="animate-spin" size={20} /> Loading asset workspace…</div> : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-sm font-semibold text-slate-500">Tenant assets</div><div className="mt-1 text-3xl font-black">{tenantAssets.length}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-sm font-semibold text-slate-500">Available stock</div><div className="mt-1 text-3xl font-black text-emerald-700">{availableCount}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-sm font-semibold text-slate-500">In repair</div><div className="mt-1 text-3xl font-black text-amber-700">{repairCount}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-sm font-semibold text-slate-500">Low-stock warnings</div><div className="mt-1 text-3xl font-black text-rose-700">{lowStockRows.length}</div></div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
            {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${tab === item.id ? "bg-teal-700 text-white" : "bg-white text-slate-600 hover:bg-teal-50"}`}><Icon size={16} />{item.label}</button>; })}
          </div>

          {tab === "workspace" && <div className="space-y-4">
            {isPlatformSuperAdmin && tenantAssets.some((asset) => asset.org_id === null) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h4 className="font-black text-amber-900">Legacy assets need tenant assignment</h4><p className="mt-1 text-sm text-amber-800">These older records did not have an organisation stored. Choose the correct tenant for each record; the system will not guess and risk mixing company data.</p><div className="mt-3 space-y-2">{tenantAssets.filter((asset) => asset.org_id === null).map((asset) => <div key={asset.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3"><div className="min-w-40 flex-1"><div className="font-bold">{asset.asset_tag} · {asset.device_name}</div><div className="text-xs text-slate-500">{asset.location} · {asset.status}</div></div><select value={legacyOrgSelections[asset.id] || ""} onChange={(e) => setLegacyOrgSelections((current) => ({ ...current, [asset.id]: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Choose tenant…</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.organization_name || org.name}</option>)}</select><button type="button" disabled={saving || !legacyOrgSelections[asset.id]} onClick={() => void assignLegacyAsset(asset.id)} className="rounded-xl bg-amber-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Assign tenant</button></div>)}</div></div>}
            {lowStockRows.length > 0 && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="flex items-center gap-2 font-black text-rose-800"><AlertTriangle size={18} /> Low-stock warning</div><p className="mt-1 text-sm text-rose-700">Available stock is at or below the reorder threshold for these model/location combinations.</p><div className="mt-3 space-y-2">{lowStockRows.map((row) => <div key={row.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 p-3 text-sm"><span className="font-bold text-slate-800">{row.manufacturer} {row.modelName} <span className="font-normal text-slate-500">· {row.location}</span></span><span className="font-black text-rose-700">{row.available} available / threshold {row.threshold}</span></div>)}</div></div>}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h4 className="font-black text-slate-900">Stock by hardware model and location</h4><p className="mt-1 text-xs text-slate-500">Available stock counts assets with status In Storage, In Stock, or Available. Set a threshold in Hardware Models.</p></div>
              {stockRows.length === 0 ? <p className="p-6 text-sm text-slate-500">No assets are registered for this organisation yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Manufacturer / model</th><th className="p-3">Location</th><th className="p-3">Available</th><th className="p-3">Reorder threshold</th><th className="p-3">Status</th></tr></thead><tbody>{stockRows.map((row) => <tr key={row.key} className="border-t border-slate-100"><td className="p-3 font-semibold">{row.manufacturer} {row.modelName}</td><td className="p-3">{row.location}</td><td className="p-3 font-black">{row.available}</td><td className="p-3">{row.threshold || "Not set"}</td><td className="p-3">{row.modelId && row.threshold > 0 && row.available <= row.threshold ? <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700">Reorder</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">OK</span>}</td></tr>)}</tbody></table></div>}
            </div>
          </div>}

          {tab === "models" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-black">Add canonical hardware model</h4><div className="mt-3 space-y-3">
              <input value={modelForm.manufacturer} onChange={(e) => setModelForm({ ...modelForm, manufacturer: e.target.value })} placeholder="Manufacturer (e.g. HP)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={modelForm.canonical_name} onChange={(e) => setModelForm({ ...modelForm, canonical_name: e.target.value })} placeholder="Canonical model name" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={modelForm.model_number} onChange={(e) => setModelForm({ ...modelForm, model_number: e.target.value })} placeholder="Model number (optional)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={modelForm.category} onChange={(e) => setModelForm({ ...modelForm, category: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option>Laptop / Desktop</option><option>POS Terminal</option><option>Network Equipment</option><option>Printer</option><option>Phone</option><option>Other</option></select>
              <label className="block text-sm font-semibold">Reorder threshold<input type="number" min="0" value={modelForm.reorder_threshold} onChange={(e) => setModelForm({ ...modelForm, reorder_threshold: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
              <button type="button" disabled={saving || !modelForm.manufacturer.trim() || !modelForm.canonical_name.trim()} onClick={() => void createModel()} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} /> Add model</button>
            </div></div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-black">Model catalogue</h4><div className="mt-3 space-y-2">{models.length === 0 ? <p className="text-sm text-slate-500">No canonical models yet.</p> : models.map((model) => <div key={model.id} className={`rounded-xl border p-3 ${model.merged_into_id ? "border-slate-100 bg-slate-50 text-slate-500" : "border-slate-200"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-bold">{model.manufacturer} {model.canonical_name}</div><div className="text-xs text-slate-500">{model.model_number || "No model number"} · {model.category}{model.merged_into_id ? " · merged duplicate" : ""}</div></div>{!model.merged_into_id && <label className="text-xs font-semibold text-slate-500">Reorder at<input type="number" min="0" defaultValue={model.reorder_threshold} onBlur={(e) => { if (Number(e.target.value) !== model.reorder_threshold) void updateThreshold(model.id, e.target.value); }} className="mt-1 w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900" /></label>}</div></div>)}</div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-black">Normalize existing assets</h4><p className="mt-1 text-xs text-slate-500">Map an asset's free-text make/model to one canonical hardware model.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={mapAssetId} onChange={(e) => setMapAssetId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Choose existing asset</option>{tenantAssets.filter((a) => a.org_id === orgId && orgId).map((a) => <option key={a.id} value={a.id}>{a.asset_tag} · {a.make || "Unknown make"} {a.model_number || a.device_name}</option>)}</select><select value={mapModelId} onChange={(e) => setMapModelId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Choose canonical model</option>{activeModels.filter((m) => m.org_id === orgId).map((m) => <option key={m.id} value={m.id}>{m.manufacturer} {m.canonical_name}</option>)}</select></div><button type="button" disabled={saving || !mapAssetId || !mapModelId} onClick={() => void linkAssetToModel()} className="mt-3 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Link asset to model</button></div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h4 className="font-black text-amber-900">Merge duplicate models</h4><p className="mt-1 text-xs text-amber-800">Assets are relinked to the canonical model. The duplicate model stays in history; hardware records are not deleted.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"><option value="">Duplicate model to merge</option>{activeModels.map((m) => <option key={m.id} value={m.id}>{m.manufacturer} {m.canonical_name}</option>)}</select><select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"><option value="">Canonical destination</option>{activeModels.map((m) => <option key={m.id} value={m.id}>{m.manufacturer} {m.canonical_name}</option>)}</select></div><button type="button" disabled={saving || !mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId} onClick={() => void mergeModels()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><GitMerge size={16} /> Merge selected models</button></div>
            </div>
          </div>}

          {tab === "lifecycle" && <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-black">Record lifecycle event</h4><label className="mt-3 block text-sm font-semibold">Asset<select value={selectedAsset?.id ?? ""} onChange={(e) => setSelectedAssetId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">{tenantAssets.map((a) => <option key={a.id} value={a.id}>{a.asset_tag} · {a.device_name}</option>)}</select></label><label className="mt-3 block text-sm font-semibold">Event type<select value={eventForm.event_type} onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">{lifecycleTypes.map((type) => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}</select></label><textarea value={eventForm.notes} onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })} placeholder="Notes: who handled it, repair details, return condition, etc." className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button type="button" disabled={saving || !selectedAsset} onClick={() => void addLifecycleEvent()} className="mt-3 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Record event</button><p className="mt-2 text-xs text-slate-500">The database records the current user and timestamp. Registration and status, assignment, and location changes also create timeline events automatically.</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-black">Asset timeline</h4>{!selectedAsset ? <p className="mt-3 text-sm text-slate-500">Register an asset to start its timeline.</p> : <><p className="mt-1 text-xs text-slate-500">{selectedAsset.asset_tag} · {selectedAsset.device_name}</p><div className="mt-4 space-y-3">{events.filter((event) => event.asset_id === selectedAsset.id).length === 0 ? <p className="text-sm text-slate-500">No lifecycle events yet.</p> : events.filter((event) => event.asset_id === selectedAsset.id).map((event) => <div key={event.id} className="relative border-l-2 border-teal-200 pl-4 pb-2"><span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-teal-600" /><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold capitalize">{event.event_type.replaceAll("_", " ")}</span><time className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</time></div>{(event.from_value || event.to_value) && <p className="mt-1 text-xs text-slate-600">{event.from_value || "—"} → {event.to_value || "—"}</p>}{event.notes && <p className="mt-1 text-sm text-slate-700">{event.notes}</p>}<p className="mt-1 text-xs text-slate-500">By {event.created_by_name || (event.created_by ? `user ${event.created_by.slice(0, 8)}…` : "system")}</p></div>)}</div></>}</div>
          </div>}

          {tab === "relationships" && <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-black">Link asset to hardware or service</h4><label className="mt-3 block text-sm font-semibold">Source asset<select value={relationshipForm.asset_id} onChange={(e) => setRelationshipForm({ ...relationshipForm, asset_id: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">{tenantAssets.map((a) => <option key={a.id} value={a.id}>{a.asset_tag} · {a.device_name}</option>)}</select></label><label className="mt-3 block text-sm font-semibold">Relationship type<select value={relationshipForm.relationship_type} onChange={(e) => setRelationshipForm({ ...relationshipForm, relationship_type: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option>Depends on</option><option>Connected to</option><option>Hosted on</option><option>Installed at</option><option>Supports</option></select></label><label className="mt-3 block text-sm font-semibold">Related asset (optional)<select value={relationshipForm.related_asset_id} onChange={(e) => setRelationshipForm({ ...relationshipForm, related_asset_id: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">Use a named service instead</option>{tenantAssets.filter((a) => a.id !== relationshipForm.asset_id).map((a) => <option key={a.id} value={a.id}>{a.asset_tag} · {a.device_name}</option>)}</select></label>{!relationshipForm.related_asset_id && <input value={relationshipForm.service_name} onChange={(e) => setRelationshipForm({ ...relationshipForm, service_name: e.target.value })} placeholder="Service name (e.g. Store network)" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />}<textarea value={relationshipForm.notes} onChange={(e) => setRelationshipForm({ ...relationshipForm, notes: e.target.value })} placeholder="Relationship notes (optional)" className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /><button type="button" disabled={saving || !relationshipForm.asset_id || (!relationshipForm.related_asset_id && !relationshipForm.service_name.trim())} onClick={() => void addRelationship()} className="mt-3 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save relationship</button></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-black">Asset relationships</h4><div className="mt-3 space-y-2">{relationships.length === 0 ? <p className="text-sm text-slate-500">No relationships recorded yet.</p> : relationships.map((r) => { const source = tenantAssets.find((a) => a.id === r.asset_id); const target = tenantAssets.find((a) => a.id === r.related_asset_id); return <div key={r.id} className="rounded-xl border border-slate-200 p-3"><div className="font-bold">{source?.asset_tag || "Asset"} <span className="font-normal text-teal-700">→ {r.relationship_type} →</span> {target?.asset_tag || r.service_name || "Service"}</div>{r.notes && <p className="mt-1 text-sm text-slate-600">{r.notes}</p>}<p className="mt-1 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</p></div>; })}</div></div>
          </div>}
        </>
      )}
    </section>
  );
}
