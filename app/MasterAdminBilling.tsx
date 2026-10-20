"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { supabase } from "../supabase/client";

type Org = { id: string; name: string; status: string | null };
type Plan = "Starter" | "Professional" | "Enterprise";
type Cycle = "Monthly" | "Annual";
type SubscriptionStatus = "Trial" | "Active" | "Past Due" | "Suspended" | "Cancelled";
type PaymentStatus = "Paid" | "Unpaid" | "Overdue" | "Waived";

type Subscription = {
  id: string;
  org_id: string;
  plan: Plan;
  billing_cycle: Cycle;
  monthly_price: number;
  employee_limit: number;
  subscription_status: SubscriptionStatus;
  payment_status: PaymentStatus;
  next_billing_at: string | null;
  last_payment_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Payment = {
  id: string;
  org_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  provider_reference: string | null;
  paid_at: string | null;
  created_at: string;
};

type Draft = {
  plan: Plan;
  billing_cycle: Cycle;
  monthly_price: string;
  employee_limit: string;
  subscription_status: SubscriptionStatus;
  payment_status: PaymentStatus;
  next_billing_at: string;
  notes: string;
};

const PLAN_DEFAULTS: Record<Plan, { price: number; limit: number }> = {
  Starter: { price: 499, limit: 10 },
  Professional: { price: 1499, limit: 50 },
  Enterprise: { price: 2999, limit: 250 },
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);

const dateLabel = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }) : "Not set";

function toDraft(subscription?: Subscription): Draft {
  return {
    plan: subscription?.plan ?? "Starter",
    billing_cycle: subscription?.billing_cycle ?? "Monthly",
    monthly_price: String(subscription?.monthly_price ?? PLAN_DEFAULTS.Starter.price),
    employee_limit: String(subscription?.employee_limit ?? PLAN_DEFAULTS.Starter.limit),
    subscription_status: subscription?.subscription_status ?? "Trial",
    payment_status: subscription?.payment_status ?? "Unpaid",
    next_billing_at: subscription?.next_billing_at ?? "",
    notes: subscription?.notes ?? "",
  };
}

export default function MasterAdminBilling() {
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  const [recordingOrgId, setRecordingOrgId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [orgResult, subscriptionResult, paymentResult] = await Promise.all([
        supabase.from("organizations").select("id,name,status").order("name"),
        supabase.from("platform_subscriptions").select("*").order("updated_at", { ascending: false }),
        supabase.from("platform_billing_payments").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      if (orgResult.error) throw orgResult.error;
      if (subscriptionResult.error) throw subscriptionResult.error;
      if (paymentResult.error) throw paymentResult.error;

      const orgRows = (orgResult.data ?? []) as Org[];
      const subscriptionRows = (subscriptionResult.data ?? []) as Subscription[];
      const paymentRows = (paymentResult.data ?? []) as Payment[];
      setOrganizations(orgRows);
      setSubscriptions(subscriptionRows);
      setPayments(paymentRows);
      setDrafts((current) => {
        const next: Record<string, Draft> = {};
        for (const org of orgRows) {
          const existing = subscriptionRows.find((item) => item.org_id === org.id);
          next[org.id] = toDraft(existing);
        }
        return next;
      });
    } catch (error: any) {
      console.error("Master Admin billing load failed:", error);
      setErrorMessage(error?.message ?? "Unable to load platform billing. Check the billing migration and Super Admin permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const subscriptionByOrg = useMemo(() => {
    const map = new Map<string, Subscription>();
    subscriptions.forEach((item) => map.set(item.org_id, item));
    return map;
  }, [subscriptions]);

  const filteredOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return organizations.filter((org) => !term || org.name.toLowerCase().includes(term));
  }, [organizations, search]);

  const activePaidSubscriptions = subscriptions.filter(
    (item) => item.subscription_status === "Active" && item.payment_status === "Paid"
  );
  const monthlyRecurringRevenue = activePaidSubscriptions.reduce(
    (sum, item) => sum + (item.billing_cycle === "Annual" ? Number(item.monthly_price) : Number(item.monthly_price)),
    0
  );
  const paidPayments = payments.filter((payment) => payment.status === "Paid");
  const collectedPayments = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const overdueCount = subscriptions.filter(
    (item) => item.payment_status === "Overdue" || item.subscription_status === "Past Due"
  ).length;

  function updateDraft(orgId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [orgId]: { ...(current[orgId] ?? toDraft()), ...patch },
    }));
    setSuccessMessage("");
  }

  async function saveSubscription(org: Org) {
    const draft = drafts[org.id];
    if (!draft) return;
    const monthlyPrice = Number(draft.monthly_price);
    const employeeLimit = Number(draft.employee_limit);
    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0 || !Number.isInteger(employeeLimit) || employeeLimit < 1) {
      setErrorMessage("Enter a valid non-negative price and an employee limit of at least 1.");
      return;
    }
    setSavingOrgId(org.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const { error } = await supabase.from("platform_subscriptions").upsert({
        org_id: org.id,
        plan: draft.plan,
        billing_cycle: draft.billing_cycle,
        monthly_price: monthlyPrice,
        employee_limit: employeeLimit,
        subscription_status: draft.subscription_status,
        payment_status: draft.payment_status,
        next_billing_at: draft.next_billing_at || null,
        notes: draft.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "org_id" });
      if (error) throw error;
      setSuccessMessage(`Billing settings saved for ${org.name}.`);
      await loadData();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Unable to save subscription settings.");
    } finally {
      setSavingOrgId(null);
    }
  }

  async function recordVerifiedPayment(org: Org) {
    const subscription = subscriptionByOrg.get(org.id);
    const draft = drafts[org.id];
    if (!subscription || !draft) {
      setErrorMessage("Save a subscription for this company before recording a payment.");
      return;
    }
    const amountText = window.prompt(`Enter the amount actually received from ${org.name} in ZAR:`, String(Number(draft.monthly_price) * (draft.billing_cycle === "Annual" ? 12 : 1)));
    if (amountText === null) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Payment amount must be greater than zero.");
      return;
    }
    if (!window.confirm(`Confirm that R ${amount.toFixed(2)} has already been received and verified from ${org.name}?`)) return;

    setRecordingOrgId(org.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const paidAt = new Date();
      const nextBilling = new Date(paidAt);
      if (draft.billing_cycle === "Annual") nextBilling.setFullYear(nextBilling.getFullYear() + 1);
      else nextBilling.setMonth(nextBilling.getMonth() + 1);
      const { error: paymentError } = await supabase.from("platform_billing_payments").insert({
        org_id: org.id,
        subscription_id: subscription.id,
        amount,
        currency: "ZAR",
        status: "Paid",
        provider: "Manual",
        provider_reference: null,
        paid_at: paidAt.toISOString(),
        notes: "Manually recorded by Master Admin after confirming receipt.",
      });
      if (paymentError) throw paymentError;
      const { error: subscriptionError } = await supabase.from("platform_subscriptions").update({
        payment_status: "Paid",
        subscription_status: "Active",
        last_payment_at: paidAt.toISOString(),
        next_billing_at: nextBilling.toISOString().slice(0, 10),
        updated_at: paidAt.toISOString(),
      }).eq("org_id", org.id);
      if (subscriptionError) throw subscriptionError;
      setSuccessMessage(`Verified payment recorded for ${org.name}. No payment was collected by this screen.`);
      await loadData();
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Unable to record payment.");
    } finally {
      setRecordingOrgId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs font-black uppercase tracking-[0.18em]">
              <ShieldCheck size={16} /> WorkforceIQ Master Admin
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black">Platform Billing</h2>
            <p className="mt-2 max-w-2xl text-emerald-100">Manage each tenant’s plan, subscription status, billing cycle, employee limit, renewals and verified payment records.</p>
          </div>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><CircleAlert size={17} className="mr-2 inline" />{errorMessage}</div>}
      {successMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={17} className="mr-2 inline" />{successMessage}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Tenants", value: organizations.length, icon: ShieldCheck },
          { label: "Active paid subscriptions", value: activePaidSubscriptions.length, icon: CheckCircle2 },
          { label: "Monthly recurring revenue", value: money(monthlyRecurringRevenue), icon: WalletCards },
          { label: "Past-due accounts", value: overdueCount, icon: CircleAlert },
        ].map((metric) => {
          const Icon = metric.icon;
          return <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm font-bold text-slate-500"><span>{metric.label}</span><Icon size={18} /></div>
            <div className="mt-3 text-2xl font-black text-slate-900">{metric.value}</div>
          </div>;
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-xl font-black text-slate-900">Tenant subscriptions</h3><p className="mt-1 text-sm text-slate-500">Set the agreed plan and billing status for each tenant.</p></div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies…" className="w-full sm:w-72 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        {loading ? <div className="p-12 text-center text-slate-500"><Loader2 className="mx-auto animate-spin" size={28} /><p className="mt-2">Loading billing data…</p></div> :
          filteredOrganizations.length === 0 ? <div className="p-10 text-center text-slate-500">No companies match this search.</div> :
          <div className="mt-5 space-y-4">
            {filteredOrganizations.map((org) => {
              const draft = drafts[org.id] ?? toDraft(subscriptionByOrg.get(org.id));
              const subscription = subscriptionByOrg.get(org.id);
              return <article key={org.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h4 className="text-lg font-black text-slate-900">{org.name}</h4><p className="mt-1 text-xs text-slate-500">Tenant status: {org.status || "Unknown"} · {subscription ? `Subscription updated ${dateLabel(subscription.updated_at)}` : "No billing plan configured"}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${draft.payment_status === "Paid" ? "bg-emerald-100 text-emerald-800" : draft.payment_status === "Overdue" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{draft.payment_status}</span>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <label className="text-xs font-bold text-slate-600">Plan<select value={draft.plan} onChange={(event) => { const plan = event.target.value as Plan; updateDraft(org.id, { plan, monthly_price: String(PLAN_DEFAULTS[plan].price), employee_limit: String(PLAN_DEFAULTS[plan].limit) }); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"><option>Starter</option><option>Professional</option><option>Enterprise</option></select></label>
                  <label className="text-xs font-bold text-slate-600">Billing cycle<select value={draft.billing_cycle} onChange={(event) => updateDraft(org.id, { billing_cycle: event.target.value as Cycle })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"><option>Monthly</option><option>Annual</option></select></label>
                  <label className="text-xs font-bold text-slate-600">Monthly price (ZAR)<input type="number" min="0" step="0.01" value={draft.monthly_price} onChange={(event) => updateDraft(org.id, { monthly_price: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                  <label className="text-xs font-bold text-slate-600">Employee limit<input type="number" min="1" step="1" value={draft.employee_limit} onChange={(event) => updateDraft(org.id, { employee_limit: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                  <label className="text-xs font-bold text-slate-600">Subscription status<select value={draft.subscription_status} onChange={(event) => updateDraft(org.id, { subscription_status: event.target.value as SubscriptionStatus })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"><option>Trial</option><option>Active</option><option>Past Due</option><option>Suspended</option><option>Cancelled</option></select></label>
                  <label className="text-xs font-bold text-slate-600">Payment status<select value={draft.payment_status} onChange={(event) => updateDraft(org.id, { payment_status: event.target.value as PaymentStatus })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"><option>Unpaid</option><option>Paid</option><option>Overdue</option><option>Waived</option></select></label>
                  <label className="text-xs font-bold text-slate-600">Next billing date<input type="date" value={draft.next_billing_at} onChange={(event) => updateDraft(org.id, { next_billing_at: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                  <label className="text-xs font-bold text-slate-600">Internal notes<input value={draft.notes} onChange={(event) => updateDraft(org.id, { notes: event.target.value })} placeholder="Optional billing notes" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900" /></label>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="text-sm text-slate-500"><CalendarClock size={15} className="mr-1 inline" />Next renewal: <strong className="text-slate-800">{dateLabel(draft.next_billing_at)}</strong>{draft.billing_cycle === "Annual" ? " · Annual plan" : " · Monthly plan"}</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={savingOrgId === org.id} onClick={() => void saveSubscription(org)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"><Save size={15} />{savingOrgId === org.id ? "Saving…" : "Save plan"}</button>
                    <button type="button" disabled={!subscription || recordingOrgId === org.id} onClick={() => void recordVerifiedPayment(org)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><CreditCard size={15} />{recordingOrgId === org.id ? "Recording…" : "Record received payment"}</button>
                  </div>
                </div>
              </article>;
            })}
          </div>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black text-slate-900">Recent payment records</h3><p className="mt-1 text-sm text-slate-500">Manual entries only. This screen does not charge a customer or verify a bank transfer.</p></div><div className="text-right"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Recorded paid total</div><div className="text-xl font-black text-emerald-700">{money(collectedPayments)}</div></div></div>
        {payments.length === 0 ? <div className="py-8 text-center text-sm text-slate-500">No payments recorded yet.</div> :
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="py-3 pr-4">Company</th><th className="py-3 pr-4">Amount</th><th className="py-3 pr-4">Method</th><th className="py-3 pr-4">Status</th><th className="py-3">Received</th></tr></thead><tbody className="divide-y divide-slate-100">{payments.map((payment) => <tr key={payment.id}><td className="py-3 pr-4 font-bold text-slate-800">{organizations.find((org) => org.id === payment.org_id)?.name ?? "Unknown tenant"}</td><td className="py-3 pr-4">{money(Number(payment.amount))}</td><td className="py-3 pr-4">{payment.provider}</td><td className="py-3 pr-4"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{payment.status}</span></td><td className="py-3">{dateLabel(payment.paid_at ?? payment.created_at)}</td></tr>)}</tbody></table></div>}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">Security note: this module is intended for the authenticated Super Admin only. Payment records entered here are administrative records, not payment-provider confirmations. Automated recurring charges and webhooks require a separate verified payment-provider integration.</p>
    </section>
  );
}
