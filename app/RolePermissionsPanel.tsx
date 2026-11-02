"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Save, ShieldCheck } from "lucide-react";
import { supabase } from "../supabase/client";
import { ROLE_DEFAULT_TABS, WORKFORCE_ROLES, type WorkforceRole } from "../lib/role-permissions";

type Props = {
  orgId: string | null;
  tabNames: string[];
  onSaved: (blockedByRole: Record<string, string[]>) => void;
};

const EDITABLE_ROLES = WORKFORCE_ROLES.filter(
  (role): role is Exclude<WorkforceRole, "Administrator"> => role !== "Administrator"
);

export default function RolePermissionsPanel({ orgId, tabNames, onSaved }: Props) {
  const [allowedByRole, setAllowedByRole] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [savedRole, setSavedRole] = useState("");

  const manageableTabs = useMemo(
    () => tabNames.filter((tab) => !["Tenant Management", "Platform Billing", "Role & Permissions"].includes(tab)),
    [tabNames]
  );

  useEffect(() => {
    let active = true;
    async function load() {
      if (!orgId) {
        setError("This account is not linked to an organisation.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("organization_role_tab_access")
        .select("role, blocked_tabs")
        .eq("org_id", orgId);
      if (!active) return;
      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }
      const next: Record<string, string[]> = {};
      for (const role of EDITABLE_ROLES) {
        const row = (data ?? []).find((item: any) => item.role === role);
        next[role] = row
          ? manageableTabs.filter((tab) => !(row.blocked_tabs ?? []).includes(tab))
          : (ROLE_DEFAULT_TABS[role] ?? []).filter((tab) => manageableTabs.includes(tab));
      }
      setAllowedByRole(next);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [orgId, manageableTabs]);

  function toggle(role: string, tab: string) {
    setAllowedByRole((current) => {
      const selected = current[role] ?? [];
      const next = selected.includes(tab)
        ? selected.filter((item) => item !== tab)
        : [...selected, tab];
      return { ...current, [role]: next };
    });
    setSavedRole("");
  }

  async function save(role: Exclude<WorkforceRole, "Administrator">) {
    if (!orgId) return;
    setSavingRole(role);
    setError("");
    setSavedRole("");
    const allowed = allowedByRole[role] ?? [];
    const blocked_tabs = manageableTabs.filter((tab) => !allowed.includes(tab));
    const { error: saveError } = await supabase
      .from("organization_role_tab_access")
      .upsert(
        { org_id: orgId, role, blocked_tabs, updated_at: new Date().toISOString() },
        { onConflict: "org_id,role" }
      );
    setSavingRole(null);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    const nextBlocked: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(allowedByRole)) {
      nextBlocked[key] = manageableTabs.filter((tab) => !value.includes(tab));
    }
    onSaved(nextBlocked);
    setSavedRole(role);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-red-700 via-rose-700 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <ShieldCheck size={26} />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-red-100">Company administration</p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black">Role & Permissions</h2>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-red-100">
          Choose which application tabs each role can access. These settings apply only to this organisation.
          Administrator retains full access and cannot be restricted here.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <strong>Administrator:</strong> Full access to all company modules, employee roles and permission settings.
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border bg-white py-16 text-slate-500">
          <Loader2 className="mr-2 animate-spin" size={20} /> Loading company permissions…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {EDITABLE_ROLES.map((role) => (
            <section key={role} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{role}</h3>
                  <p className="mt-1 text-xs text-slate-500">{(allowedByRole[role] ?? []).length} of {manageableTabs.length} tabs enabled</p>
                </div>
                <button
                  type="button"
                  onClick={() => void save(role)}
                  disabled={savingRole !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {savingRole === role ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Save
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-5">
                {manageableTabs.map((tab) => {
                  const checked = (allowedByRole[role] ?? []).includes(tab);
                  return (
                    <label key={tab} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(role, tab)}
                        className="h-4 w-4 accent-red-600"
                      />
                      <span className={checked ? "font-semibold text-slate-800" : "text-slate-500"}>{tab}</span>
                    </label>
                  );
                })}
              </div>
              {savedRole === role && <div className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700"><Check size={16} /> Permissions saved for this organisation.</div>}
            </section>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">
        Tab visibility is a navigation control. Sensitive records and actions must also be protected by backend and database permissions.
      </p>
    </div>
  );
}
