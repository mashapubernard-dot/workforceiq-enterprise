"use client";
 
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  FileCheck2,
  Headphones,
  Laptop,
  Loader2,
  Lock,
  LogIn,
  Mail,
  MapPinned,
  Menu,
  PackageCheck,
  Phone,
  ShieldCheck,
  Ticket,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "../../supabase/client";
 
type Role =
  | "LemontreeCorp Administrator"
  | "Administrator"
  | "Supervisor"
  | "Team Leader"
  | "Employee"
  | "Super Admin";
 
type UserProfile = {
  id: string;
  full_name: string;
  role: Role;
};
 
const completedFeatures = [
  { icon: Activity, title: "Operations Control Panel", text: "A central workspace for monitoring daily operations and key workforce activity." },
  { icon: Users, title: "Workforce Data", text: "Manage employee information, workforce records and operational data in one place." },
  { icon: MapPinned, title: "Command Centre", text: "A live operational hub providing visibility across teams, activities and business performance." },
  { icon: Ticket, title: "Tickets", text: "Create, assign, track and manage customer and operational service tickets." },
  { icon: Activity, title: "Operations Control", text: "Coordinate workflows, teams and operational tasks efficiently." },
  { icon: LogIn, title: "Secure Login", text: "Protected, role-aware access to the WorklogIQ platform." },
  { icon: Wrench, title: "Field Operations", text: "Manage technicians, field activities and work performed outside the office." },
  { icon: Users, title: "Human Resources", text: "Support employee management, workforce administration and people processes." },
  { icon: ShieldCheck, title: "Supabase Security", text: "Secure authentication, session management and protected data access." },
  { icon: Phone, title: "Dialer", text: "Support communication and contact-centre calling operations." },
  { icon: Laptop, title: "Enterprise Workspace", text: "Bring multiple departments and operational tools together in one platform." },
  { icon: Users, title: "Customer & Site Management", text: "Maintain customer information, sites and associated operational records." },
  { icon: ClipboardList, title: "Customer Linked Tickets", text: "Connect service tickets directly to the relevant customer or site." },
  { icon: FileCheck2, title: "Bell Photo Proof", text: "Capture and store photographic proof connected to operational activities." },
  { icon: FileCheck2, title: "Customer Signatures", text: "Collect digital customer confirmation for completed work and services." },
  { icon: BarChart3, title: "Reporting & Analytics", text: "Transform operational data into useful business insights." },
  { icon: PackageCheck, title: "Asset Management", text: "Track company devices, equipment and assets throughout their lifecycle." },
  { icon: BookOpen, title: "Knowledge Base", text: "Store procedures, guides and important information for your teams." },
];
 
const roadmapFeatures = [
  "GPS Live Field Map",
  "Real Phone Integration",
  "Notifications",
  "Billing / Inventory / Revenue",
  "Accurate Pauses",
  "Intelligent Scheduling",
  "Intraday Management",
  "Automation Intelligence",
  "Powerful Service-Level Reporting",
  "Advanced Device Tracking",
  "Live Field Technician Tracking",
  "Asset Lifecycle Management",
  "Preventative Maintenance Management",
  "Workforce Forecasting",
  "Mobile Workforce Experience",
];
 
const allowedRoles = new Set([
  "lemontreecorp administrator",
  "administrator",
  "supervisor",
  "team leader",
  "employee",
  "super admin",
]);
 
function hasValidRole(role: unknown) {
  return allowedRoles.has(String(role ?? "").trim().toLowerCase());
}
 
export default function LoginPage() {
  const router = useRouter();
 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 
  useEffect(() => {
    let mounted = true;
 
    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
 
        if (!session?.user) {
          if (mounted) setCheckingSession(false);
          return;
        }
 
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, full_name, role")
          .eq("id", session.user.id)
          .single();
 
        if (profileError || !profileData) {
          await supabase.auth.signOut();
          if (mounted) setCheckingSession(false);
          return;
        }
        if (!hasValidRole(profileData.role)) {
          await supabase.auth.signOut();
 
          if (mounted) {
            setError("Your account does not have a valid WorklogIQ role.");
            setCheckingSession(false);
          }
 
          return;
        }
 
        localStorage.setItem(
          "workforceiq_profile",
          JSON.stringify({
            id: profileData.id,
            full_name: profileData.full_name,
            role: profileData.role,
          })
        );
 
        router.replace("/");
        router.refresh();
      } catch (err) {
        console.error("Session check failed:", err);
        if (mounted) setCheckingSession(false);
      }
    }
 
    checkSession();
 
    return () => {
      mounted = false;
    };
  }, [router]);
 
  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
 
    setError("");
 
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
 
    if (!password) {
      setError("Please enter your password.");
      return;
    }
 
    setLoading(true);
 
    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
 
      if (loginError || !data.user) {
        setError(loginError?.message || "Invalid email or password.");
        setLoading(false);
        return;
      }
 
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, full_name, role")
        .eq("id", data.user.id)
        .single();
 
      if (profileError || !profileData) {
        await supabase.auth.signOut();
        setError(
          "Your login worked, but your WorklogIQ profile could not be found."
        );
        setLoading(false);
        return;
      }
        if (!hasValidRole(profileData.role)) {
        await supabase.auth.signOut();
        setError("Your account does not have a valid WorklogIQ role.");
        setLoading(false);
        return;
      }
 
      localStorage.setItem(
        "workforceiq_profile",
        JSON.stringify({
          id: profileData.id,
          full_name: profileData.full_name,
          role: profileData.role,
        })
      );
 
      router.replace("/");
      router.refresh();
    } catch (err) {
      console.error("Unexpected login error:", err);
      setError("Something went wrong while signing in. Please try again.");
      setLoading(false);
    }
  }
 
  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-2xl font-black text-white shadow-xl">
            W
          </div>
          <Loader2 className="mx-auto mt-5 animate-spin text-blue-700" size={28} />
          <p className="mt-4 text-sm text-slate-500">
            Loading WorklogIQ…
          </p>
        </div>
      </main>
    );
  }
 
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#home" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-cyan-500 text-lg font-black text-white">
              W
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900">
                Worklog<span className="text-blue-700">IQ</span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Intelligent Operations
              </div>
            </div>
          </a>
 
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
            <a href="#solutions" className="transition hover:text-blue-700">Solutions</a>
            <a href="#features" className="transition hover:text-blue-700">Features</a>
            <a href="#roadmap" className="transition hover:text-blue-700">Roadmap</a>
            <a href="#insights" className="transition hover:text-blue-700">Insights</a>
            <a href="#contact" className="transition hover:text-blue-700">Contact</a>
          </nav>
 
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg border border-slate-200 p-2 text-slate-700 lg:hidden"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
 
          <a
            href="#login"
            className="hidden rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 lg:inline-flex"
          >
            Client Portal
          </a>
        </div>
 
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-5 py-4 lg:hidden">
            <div className="flex flex-col gap-3 text-sm font-medium text-slate-700">
              <a href="#solutions" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#roadmap" onClick={() => setMobileMenuOpen(false)}>Roadmap</a>
              <a href="#insights" onClick={() => setMobileMenuOpen(false)}>Insights</a>
              <a href="#login" onClick={() => setMobileMenuOpen(false)}>Client Portal</a>
            </div>
          </div>
        )}
      </header>
 
      {/* Hero */}
      <section id="home" className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-slate-100" />
        <div className="absolute right-0 top-0 h-full w-full bg-[linear-gradient(115deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.88)_43%,rgba(15,23,42,0.12)_43%,rgba(15,23,42,0.03)_100%)]" />
 
        <div className="relative mx-auto grid min-h-[650px] max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[1fr_1.05fr] lg:px-8">
          <div className="z-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              <CheckCircle2 size={16} />
              Enterprise Workforce Platform
            </div>
 
            <h1 className="max-w-2xl text-4xl font-black leading-[1.02] text-slate-900 sm:text-5xl lg:text-6xl">
              The smarter way to manage your
              <span className="block text-blue-700">workforce operations.</span>
            </h1>
 
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              WorklogIQ brings office teams, field technicians, customers,
              service tickets, devices, assets and operational intelligence
              together in one powerful platform.
            </p>
 
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#login"
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
              >
                Access WorklogIQ
                <ArrowRight size={17} />
              </a>
 
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                Explore Solutions
              </a>
            </div>
 
            <div className="mt-10 grid max-w-lg grid-cols-3 border-t border-slate-200 pt-7">
              <div>
                <div className="text-2xl font-black text-blue-700">18</div>
                <div className="mt-1 text-xs font-medium text-slate-500">Core capabilities live</div>
              </div>
              <div>
                <div className="text-2xl font-black text-blue-700">15</div>
                <div className="mt-1 text-xs font-medium text-slate-500">Roadmap improvements</div>
              </div>
              <div>
                <div className="text-2xl font-black text-blue-700">1</div>
                <div className="mt-1 text-xs font-medium text-slate-500">Connected workspace</div>
              </div>
            </div>
          </div>
 
          <div className="relative">
            <div className="absolute -left-10 top-10 h-[75%] w-28 bg-blue-700/90" />
            <img
              src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=90"
              alt="Professional team collaborating in an office"
              className="relative ml-auto h-[500px] w-full max-w-2xl object-cover shadow-2xl"
            />
            <div className="absolute bottom-7 left-0 max-w-xs bg-white p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <Activity size={21} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Live Operations</p>
                  <p className="text-xs text-slate-500">Office, field and assets connected</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
 
      {/* Trust / sectors */}
      <section className="border-y border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto max-w-7xl px-5 text-center lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Built for modern workforce operations
          </p>
          <div className="mt-7 grid grid-cols-2 gap-4 text-sm font-bold text-slate-500 sm:grid-cols-4 lg:grid-cols-6">
            <span>CONTACT CENTRES</span>
            <span>FIELD SERVICE</span>
            <span>WORKFORCE</span>
            <span>ASSETS</span>
            <span>CUSTOMERS</span>
            <span>OPERATIONS</span>
          </div>
        </div>
      </section>
 
      {/* About */}
      <section id="solutions" className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=85"
              alt="Business team working together"
              className="h-full min-h-[360px] w-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-blue-800 p-7 text-white">
              <p className="text-sm font-bold">One connected platform</p>
              <p className="mt-2 text-sm leading-6 text-blue-100">
                Replace disconnected workflows with one operational source of truth.
              </p>
            </div>
          </div>
 
          <div className="py-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              We are WorklogIQ
            </p>
            <h2 className="mt-4 text-4xl font-black leading-tight text-slate-900">
              Technology that works the way your business works.
            </h2>
            <p className="mt-6 leading-8 text-slate-600">
              From workforce planning and customer tickets to field service,
              communication and asset management, WorklogIQ gives your teams
              a single professional environment for getting work done.
            </p>
 
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {[
                ["Connected Operations", "Bring office and field teams together."],
                ["Operational Visibility", "Understand what is happening in real time."],
                ["Better Service", "Keep customers, tickets and work connected."],
                ["Built to Grow", "A platform designed to expand with your business."],
              ].map(([title, text]) => (
                <div key={title} className="border-l-4 border-blue-700 pl-4">
                  <h3 className="font-bold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
 
      {/* Feature cards */}
      <section id="features" className="bg-slate-100 py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              Platform capabilities
            </p>
            <h2 className="mt-4 text-4xl font-black text-slate-900">
              Everything you need to manage the work.
            </h2>
            <p className="mt-5 leading-7 text-slate-600">
              The WorklogIQ foundation already includes 18 core capabilities.
            </p>
          </div>
 
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {completedFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="group bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <Icon size={24} />
                  </div>
                  <h3 className="mt-6 text-lg font-bold text-slate-900">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{feature.text}</p>
                  <div className="mt-6 flex items-center gap-2 text-xs font-bold text-blue-700">
                    LIVE CAPABILITY <CheckCircle2 size={15} />
                  </div>
                </article>
              );
            })}
          </div>
 
          <div className="mt-8 text-center text-sm text-slate-500">
            Plus Command Centre, Operations Control, Secure Login, Human Resources,
            Supabase Security, Enterprise Workspace, Customer & Site Management,
            Customer Linked Tickets, Bell Photo Proof, Customer Signatures and Knowledge Base.
          </div>
        </div>
      </section>
 
      {/* Visual articles / solution blocks */}
      <section id="insights" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="mb-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              From WorklogIQ
            </p>
            <h2 className="mt-3 text-4xl font-black text-slate-900">
              Built around real operational challenges.
            </h2>
          </div>
 
          <div className="grid gap-8 lg:grid-cols-3">
            {[
              {
                title: "Smarter Asset Tracking",
                image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=900&q=85",
                text: "Know what equipment you have and how it supports your operations.",
              },
              {
                title: "Better Field Visibility",
                image: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=900&q=85",
                text: "Keep work, technicians, customers and field activity connected.",
              },
              {
                title: "Prepare for the Future of Work",
                image: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=900&q=85",
                text: "Build a stronger operational foundation with connected intelligence.",
              },
            ].map((item) => (
              <article key={item.title} className="overflow-hidden border border-slate-200 bg-white">
                <img src={item.image} alt={item.title} className="h-56 w-full object-cover" />
                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{item.text}</p>
                  <a href="#features" className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-700">
                    Read more <ArrowRight size={15} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
 
      {/* Roadmap */}
      <section id="roadmap" className="bg-blue-800 py-20 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
              Product roadmap
            </p>
            <h2 className="mt-4 text-4xl font-black">
              What WorklogIQ is building next.
            </h2>
            <p className="mt-5 leading-7 text-blue-100">
              Our next development phase focuses on deeper intelligence,
              automation, field visibility and workforce management.
            </p>
          </div>
 
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roadmapFeatures.map((feature, index) => (
              <div
                key={feature}
                className="flex items-center gap-4 border border-white/15 bg-white/10 p-5 backdrop-blur-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-200/30 bg-cyan-300/10 text-xs font-black text-cyan-100">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <span className="text-sm font-semibold">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* Login */}
      <section id="login" className="bg-slate-50 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[1fr_0.85fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              Secure client portal
            </p>
            <h2 className="mt-4 text-4xl font-black leading-tight text-slate-900">
              Ready to get back to work?
            </h2>
            <p className="mt-5 max-w-xl leading-8 text-slate-600">
              Sign in securely to access your WorklogIQ workspace and the
              operational tools available to your role.
            </p>
 
            <div className="mt-9 grid gap-4 sm:grid-cols-3">
              <div className="border border-slate-200 bg-white p-5">
                <Users className="text-blue-700" size={22} />
                <p className="mt-4 text-sm font-bold text-slate-900">Workforce</p>
              </div>
              <div className="border border-slate-200 bg-white p-5">
                <Wrench className="text-blue-700" size={22} />
                <p className="mt-4 text-sm font-bold text-slate-900">Field Service</p>
              </div>
              <div className="border border-slate-200 bg-white p-5">
                <PackageCheck className="text-blue-700" size={22} />
                <p className="mt-4 text-sm font-bold text-slate-900">Assets</p>
              </div>
            </div>
          </div>
 
          <div className="bg-white p-7 shadow-2xl shadow-slate-900/10 sm:p-10">
            <div className="flex h-14 w-14 items-center justify-center bg-blue-700 text-white">
              <LogIn size={26} />
            </div>
 
            <h2 className="mt-7 text-3xl font-black text-slate-900">
              Welcome back
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Sign in to access your WorklogIQ workspace.
            </p>
 
            {error && (
              <div className="mt-6 flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle size={19} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
 
            <form onSubmit={handleLogin} className="mt-7 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-700">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                    className="h-14 w-full border border-slate-300 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 disabled:opacity-60"
                  />
                </div>
              </div>
 
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-bold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                    className="h-14 w-full border border-slate-300 bg-white pl-12 pr-14 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
 
              <button
                type="submit"
                disabled={loading}
                className="flex h-14 w-full items-center justify-center gap-2 bg-blue-700 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={19} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to WorklogIQ
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
 
            <div className="mt-7 flex gap-3 border-t border-slate-200 pt-6">
              <ShieldCheck className="shrink-0 text-blue-700" size={22} />
              <div>
                <p className="text-sm font-bold text-slate-900">Secure enterprise access</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Authorized users only. Authentication and application access remain role-aware.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
 
      {/* Contact */}
      <section id="contact" className="bg-slate-100 py-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                Stay connected
              </p>
              <h2 className="mt-3 text-3xl font-black text-slate-900">
                Keep up with WorklogIQ.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">
                A professional workforce platform built to bring operations together.
              </p>
            </div>
 
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="h-12 border border-slate-300 bg-white px-4 text-sm outline-none focus:border-blue-700" placeholder="Your name" />
              <input className="h-12 border border-slate-300 bg-white px-4 text-sm outline-none focus:border-blue-700" placeholder="Your email" />
              <input className="h-12 border border-slate-300 bg-white px-4 text-sm outline-none focus:border-blue-700 sm:col-span-2" placeholder="How can we help?" />
              <button type="button" className="h-12 w-fit bg-orange-500 px-6 text-sm font-bold text-white hover:bg-orange-600">
                Stay in touch
              </button>
            </div>
          </div>
        </div>
      </section>
 
      <footer className="bg-blue-950 py-12 text-white">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-2xl font-black">
                Worklog<span className="text-cyan-300">IQ</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-6 text-blue-200">
                Intelligent workforce and operations management.
              </p>
            </div>
 
            <div>
              <p className="text-sm font-bold">Solutions</p>
              <div className="mt-4 space-y-2 text-sm text-blue-200">
                <p>Workforce Operations</p>
                <p>Field Service</p>
                <p>Asset Management</p>
                <p>Customer Operations</p>
              </div>
            </div>
 
            <div>
              <p className="text-sm font-bold">Platform</p>
              <div className="mt-4 space-y-2 text-sm text-blue-200">
                <p>Command Centre</p>
                <p>Tickets</p>
                <p>Dialer</p>
                <p>Reporting</p>
              </div>
            </div>
 
            <div>
              <p className="text-sm font-bold">WorklogIQ</p>
              <div className="mt-4 space-y-2 text-sm text-blue-200">
                <p>About</p>
                <p>Roadmap</p>
                <p>Contact</p>
                <p>Secure Access</p>
              </div>
            </div>
          </div>
 
          <div className="mt-10 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-xs text-blue-300 sm:flex-row">
            <span>© 2026 WorklogIQ. All rights reserved.</span>
            <span>Workforce • Field Service • Assets • Intelligence</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
