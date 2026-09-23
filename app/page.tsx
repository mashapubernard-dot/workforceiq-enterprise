"use client";
 
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  BarChart3,
  ClipboardCheck,
  Package,
  Clock3,
  LogOut,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Bell,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Activity,
  Headphones,
  Ticket,
  Wrench,
  UserCog,
  Workflow,
  PhoneCall,
  MapPin,
  BookOpen,
  CircleAlert,
  CheckCircle2,
  Search,
  Settings,
  HardDrive,
  Menu,
  Star,
  Receipt,
} from "lucide-react";
import { supabase } from "../supabase/client";
import OperationsControlPanel from "./OperationsControlPanel";
import WorkforceIQSessionGuard from "./WorkforceIQSessionGuard";
import IQCommandCenter from "./IQCommandCenter";
 
type Role =
  | "Administrator"
  | "Supervisor"
  | "Team Leader"
  | "Employee"
  | "Super Admin";
 
type AttendanceStatus =
  | "Working"
  | "Break"
  | "Lunch"
  | "Away"
  | "After Call Work"
  | "Off Duty";
 
type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  orgName: string | null;
};
 
type AttendanceRecord = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  status: AttendanceStatus;
  status_started_at: string | null;
};
 
type Employee = {
  id: string;
  initials: string;
  name: string;
  role: Role;
  status: AttendanceStatus;
  clockIn: string;
  clockInAt: string | null;
  clockOut: string;
  hours: string;
  statusStartedAt: string | null;
};
 
type Schedule = {
  id: string;
  user_id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  shift_type: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string;
};
 
type TicketPriority =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";
 
type TicketDepartment = "Service Hub" | "Field Dispatch" | "HR";
 
type TicketStatus =
  | "New"
  | "Assigned"
  | "In Progress"
  | "Waiting"
  | "Resolved"
  | "Closed";
 
type TicketRecord = {
  id: string;
  department: TicketDepartment;
  title: string;
  type: string;
  priority: TicketPriority;
  status: TicketStatus;
  requester: string;
  employeeId: string;
  assignee: string;
  branch: string;
  slaMinutes: number;
  createdAt: string;
  notes: string;
  component?: string;
  contactPhone: string;
};
 
type TicketComment = {
  id: string;
  ticketId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
};
 
type FieldWorkOrder = {
  id: string;
  ticketId: string;
  technician: string;
  customer: string;
  site: string;
  status: "Unassigned" | "Dispatched" | "On Site" | "Waiting Parts" | "Completed";
  priority: TicketPriority;
  part: string;
  quantity: number;
  eta: string;
  notes: string;
  signatureDataUrl?: string;
  signedBy?: string;
  signedAt?: string;
  photoProofDataUrls?: string[];
};
function getTicketDepartment(ticketType: string | null | undefined): TicketDepartment {
  if ((ticketType ?? "").trim().toLowerCase() === "hr") return "HR";
  if ((ticketType ?? "").trim().toLowerCase() === "field service") return "Field Dispatch";
  return "Service Hub";
}
 
function getFieldWorkOrderStatus(ticketStatus: TicketStatus): FieldWorkOrder["status"] {
  switch (ticketStatus) {
    case "Assigned":
      return "Dispatched";
    case "In Progress":
      return "On Site";
    case "Waiting":
      return "Waiting Parts";
    case "Resolved":
    case "Closed":
      return "Completed";
    default:
      return "Unassigned";
  }
}
 
function getTicketStatusFromFieldWorkOrder(status: FieldWorkOrder["status"]): TicketStatus {
  switch (status) {
    case "Dispatched":
      return "Assigned";
    case "On Site":
      return "In Progress";
    case "Waiting Parts":
      return "Waiting";
    case "Completed":
      return "Resolved";
    default:
      return "New";
  }
}
type HRCase = {
  id: string;
  employeeId: string;
  employeeName: string;
  category: string;
  status: "New" | "Under Review" | "Awaiting Employee" | "Resolved";
  priority: TicketPriority;
  owner: string;
  createdAt: string;
  dueDate: string;
  notes: string;
};
 
 
const allNavItems = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
      "Employee",
    ] as Role[],
    color: "from-red-600 to-red-700",
    light: "bg-red-50 text-red-700 border-red-200",
    iconBg: "bg-red-100 text-red-600",
  },
  {
    name: "Time & Attendance",
    icon: Clock3,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
      "Employee",
    ] as Role[],
    color: "from-emerald-500 to-teal-600",
    light: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
  {
    name: "EOD Report",
    icon: ClipboardCheck,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
    ] as Role[],
    color: "from-violet-500 to-purple-600",
    light: "bg-violet-50 text-violet-700 border-violet-200",
    iconBg: "bg-violet-100 text-violet-600",
  },
  {
    name: "Schedules",
    icon: CalendarDays,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
      "Employee",
    ] as Role[],
    color: "from-orange-500 to-amber-500",
    light: "bg-orange-50 text-orange-700 border-orange-200",
    iconBg: "bg-orange-100 text-orange-600",
  },
  {
    name: "People",
    icon: Users,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
    ] as Role[],
    color: "from-pink-500 to-rose-600",
    light: "bg-pink-50 text-pink-700 border-pink-200",
    iconBg: "bg-pink-100 text-pink-600",
  },
  {
    name: "Performance",
    icon: BarChart3,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
    ] as Role[],
    color: "from-cyan-500 to-sky-600",
    light: "bg-cyan-50 text-cyan-700 border-cyan-200",
    iconBg: "bg-cyan-100 text-cyan-600",
  },
  {
    name: "Tasks",
    icon: ClipboardCheck,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
    ] as Role[],
    color: "from-fuchsia-500 to-pink-600",
    light: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    iconBg: "bg-fuchsia-100 text-fuchsia-600",
  },
  {
    name: "Inventory",
    icon: Package,
    roles: [
      "Administrator",
      "Supervisor",
    ] as Role[],
    color: "from-slate-500 to-gray-700",
    light: "bg-slate-50 text-slate-700 border-slate-200",
    iconBg: "bg-slate-100 text-slate-600",
  },
  {
    name: "Asset Management",
    icon: HardDrive,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
    ] as Role[],
    color: "from-teal-600 to-cyan-700",
    light: "bg-teal-50 text-teal-700 border-teal-200",
    iconBg: "bg-teal-100 text-teal-600",
  },
  {
    name: "Command Center",
    icon: Workflow,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
    ] as Role[],
    color: "from-indigo-600 to-violet-700",
    light: "bg-indigo-50 text-indigo-700 border-indigo-200",
    iconBg: "bg-indigo-100 text-indigo-600",
  },
  {
    name: "Service Hub",
    icon: Ticket,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
      "Employee",
    ] as Role[],
    color: "from-red-500 to-orange-600",
    light: "bg-red-50 text-red-700 border-red-200",
    iconBg: "bg-red-100 text-red-600",
  },
  {
    name: "Field Operations",
    icon: Wrench,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
      "Employee",
    ] as Role[],
    color: "from-sky-500 to-cyan-600",
    light: "bg-sky-50 text-sky-700 border-sky-200",
    iconBg: "bg-sky-100 text-sky-600",
  },
  {
    name: "HR Support",
    icon: UserCog,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
    ] as Role[],
    color: "from-rose-500 to-pink-600",
    light: "bg-rose-50 text-rose-700 border-rose-200",
    iconBg: "bg-rose-100 text-rose-600",
  },
  {
    name: "Knowledge Base",
    icon: BookOpen,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
      "Employee",
    ] as Role[],
    color: "from-amber-500 to-yellow-600",
    light: "bg-amber-50 text-amber-700 border-amber-200",
    iconBg: "bg-amber-100 text-amber-600",
  },
  {
    name: "Billing",
    icon: Receipt,
    roles: [
      "Administrator",
      "Supervisor",
    ] as Role[],
    color: "from-green-600 to-emerald-700",
    light: "bg-green-50 text-green-700 border-green-200",
    iconBg: "bg-green-100 text-green-600",
  },
  {
    name: "Dialer",
    icon: PhoneCall,
    roles: [
      "Administrator",
      "Supervisor",
      "Team Leader",
      "Employee",
    ] as Role[],
    color: "from-sky-600 to-blue-700",
    light: "bg-sky-50 text-sky-700 border-sky-200",
    iconBg: "bg-sky-100 text-sky-600",
  },
  {
    name: "Tenant Management",
    icon: ShieldCheck,
    roles: [
      "Super Admin",
    ] as Role[],
    color: "from-fuchsia-700 to-purple-900",
    light: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    iconBg: "bg-fuchsia-100 text-fuchsia-600",
  },
];
 
const statusOptions: AttendanceStatus[] = [
  "Working",
  "Break",
  "Lunch",
  "Away",
  "After Call Work",
  "Off Duty",
];
 
function getStatusLabel(status: AttendanceStatus) {
  if (status === "Lunch") return "Working Lunch";
  if (status === "Break") return "Break";
  if (status === "Off Duty") return "Off Duty";
  return status;
}
 
function getStatusClasses(status: AttendanceStatus) {
  switch (status) {
    case "Working":
      return {
        badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
        card: "border-emerald-200 bg-emerald-50",
      };
    case "Break":
      return {
        badge: "bg-amber-100 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
        card: "border-amber-200 bg-amber-50",
      };
    case "Lunch":
      return {
        badge: "bg-orange-100 text-orange-700 border-orange-200",
        dot: "bg-orange-500",
        card: "border-orange-200 bg-orange-50",
      };
    case "Away":
      return {
        badge: "bg-purple-100 text-purple-700 border-purple-200",
        dot: "bg-purple-500",
        card: "border-purple-200 bg-purple-50",
      };
    case "After Call Work":
      return {
        badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
        dot: "bg-cyan-500",
        card: "border-cyan-200 bg-cyan-50",
      };
    default:
      return {
        badge: "bg-slate-100 text-slate-600 border-slate-200",
        dot: "bg-slate-400",
        card: "border-slate-200 bg-slate-50",
      };
  }
}
 
function canAccess(role: Role, section: string) {
  const item = allNavItems.find(
    (navItem) => navItem.name === section
  );
  return item ? item.roles.includes(role) : false;
}
 
function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
 
const analyticsRoadmapItems: { title: string; note: string }[] = [
  { title: "Sales / revenue", note: "Ready for sales data" },
  { title: "QA scores", note: "Ready for QA data" },
  { title: "Calls / AHT", note: "Ready for telephony data" },
  { title: "Tasks / tickets", note: "Connected to current modules" },
  { title: "Schedule adherence", note: "Connected to schedules + attendance" },
  { title: "Labor vs output", note: "Ready for payroll / sales inputs" },
  { title: "Leave trends", note: "Ready for HR case + leave data" },
  { title: "Field productivity", note: "Connected to work orders" },
];
 
function EmployeeCommentSection({
  tabName,
  profile,
  tabComments,
  setTabComments,
  tabNoteDraft,
  setTabNoteDraft,
}: {
  tabName: string;
  profile: Profile | null;
  tabComments: Record<
    string,
    { id: string; author: string; body: string; createdAt: string }[]
  >;
  setTabComments: (
    updater: (
      prev: Record<string, { id: string; author: string; body: string; createdAt: string }[]>
    ) => Record<string, { id: string; author: string; body: string; createdAt: string }[]>
  ) => void;
  tabNoteDraft: string;
  setTabNoteDraft: (value: string) => void;
}) {
  const allForTab = tabComments[tabName] ?? [];
 
  // Employees only see and manage their own notes on this tab; everyone
  // else (Administrator / Supervisor / Team Leader) sees all notes left
  // on the tab so it still functions as a shared, editable log.
  const visible =
    profile?.role === "Employee"
      ? allForTab.filter((c) => c.author === profile.full_name)
      : allForTab;
 
  function addComment() {
    if (!tabNoteDraft.trim() || !profile) return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author: profile.full_name,
      body: tabNoteDraft.trim(),
      createdAt: new Date().toISOString(),
    };
    setTabComments((prev) => ({
      ...prev,
      [tabName]: [...(prev[tabName] ?? []), entry],
    }));
    setTabNoteDraft("");
  }
 
  function removeComment(id: string) {
    setTabComments((prev) => ({
      ...prev,
      [tabName]: (prev[tabName] ?? []).filter((c) => c.id !== id),
    }));
  }
 
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black text-slate-800">
          {profile?.role === "Employee" ? "My notes" : "Notes"} — {tabName}
        </h3>
        <span className="text-xs font-semibold text-slate-400">
          {visible.length} {visible.length === 1 ? "note" : "notes"}
        </span>
      </div>
 
      <div className="mt-3 flex gap-2">
        <input
          value={tabNoteDraft}
          onChange={(e) => setTabNoteDraft(e.target.value)}
          placeholder={`Add a note on ${tabName}...`}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") addComment();
          }}
        />
        <button
          type="button"
          onClick={addComment}
          className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-bold hover:bg-slate-800"
        >
          Add
        </button>
      </div>
 
      <div className="mt-4 space-y-2">
        {visible.length === 0 && (
          <div className="text-sm text-slate-400">No notes yet.</div>
        )}
        {visible.map((c) => (
          <div
            key={c.id}
            className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm flex items-start justify-between gap-3"
          >
            <div>
              <div className="font-bold text-slate-700">{c.author}</div>
              <div className="text-slate-600 mt-0.5">{c.body}</div>
              <div className="text-xs text-slate-400 mt-1">
                {new Date(c.createdAt).toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeComment(c.id)}
              className="text-slate-400 hover:text-red-500 text-xs font-bold"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
 
function formatTicketNumber(id: string | number) {
const numericId = Number(id);
if (!Number.isFinite(numericId)) return `INC${String(id).padStart(6, "0")}`;
return `INC${String(Math.trunc(numericId)).padStart(6, "0")}`;
}
 
 
function formatClockTime(value: string | null) {
  if (!value) return "—";
 
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
 
function formatDuration(milliseconds: number) {
  if (milliseconds <= 0) {
    return "0h 0m 0s";
  }
 
  const totalSeconds = Math.floor(
    milliseconds / 1000
  );
 
  const hours = Math.floor(
    totalSeconds / 3600
  );
 
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
 
  const seconds = totalSeconds % 60;
 
  return `${hours}h ${minutes}m ${seconds}s`;
}
 
function formatShortDuration(milliseconds: number) {
  if (milliseconds <= 0) {
    return "0h 0m";
  }
 
  const totalMinutes = Math.floor(
    milliseconds / 1000 / 60
  );
 
  const hours = Math.floor(
    totalMinutes / 60
  );
 
  const minutes = totalMinutes % 60;
 
  return `${hours}h ${minutes}m`;
}
 
function getEmployeeDuration(
  employee: Employee,
  now: number
) {
  if (!employee.clockInAt) {
    return "0h 0m";
  }
 
  const start = new Date(
    employee.clockInAt
  ).getTime();
 
  const end =
    employee.clockOut === "—"
      ? now
      : new Date(
          employee.clockOut
        ).getTime();
 
  return formatShortDuration(
    Math.max(0, end - start)
  );
}
 
function getShiftMinutes(
  startTime: string,
  endTime: string
) {
  if (!startTime || !endTime) return 0;
 
  const [
    startHour,
    startMinute,
  ] = startTime
    .split(":")
    .map(Number);
 
  const [
    endHour,
    endMinute,
  ] = endTime
    .split(":")
    .map(Number);
 
  if (
    [
      startHour,
      startMinute,
      endHour,
      endMinute,
    ].some(Number.isNaN)
  ) {
    return 0;
  }
 
  let start =
    startHour * 60 +
    startMinute;
 
  let end =
    endHour * 60 +
    endMinute;
 
  if (end <= start) {
    end += 24 * 60;
  }
 
  return end - start;
}
 
function getStatusLimitMinutes(
  status: AttendanceStatus
) {
  if (status === "Break") return 15;
  if (status === "Lunch") return 30;
  return null;
}
 
function isStatusOverLimit(
  status: AttendanceStatus,
  startedAt: string | null,
  now: number
) {
  const limit =
    getStatusLimitMinutes(status);
 
  if (!limit || !startedAt) {
    return false;
  }
 
  return (
    now -
      new Date(
        startedAt
      ).getTime() >
    limit * 60 * 1000
  );
}
 
function formatStatusTimer(
  status: AttendanceStatus,
  startedAt: string | null,
  now: number
) {
  if (
    !startedAt ||
    status === "Working" ||
    status === "Off Duty"
  ) {
    return "0h 0m 0s";
  }
 
  return formatDuration(
    Math.max(
      0,
      now -
        new Date(
          startedAt
        ).getTime()
    )
  );
}
 
function formatScheduleTime(
  time: string
) {
  if (!time) return "";
 
  const parts =
    time.split(":");
 
  if (parts.length < 2) {
    return time;
  }
 
  return `${parts[0]}:${parts[1]}`;
}
 
function formatSlaRemaining(
  ticket: TicketRecord,
  now: number
) {
  const remaining =
    ticket.slaMinutes * 60 * 1000 -
    (now - new Date(ticket.createdAt).getTime());
 
  const absolute = Math.abs(remaining);
  const minutes = Math.floor(absolute / 60000);
  const hours = Math.floor(minutes / 60);
  const displayMinutes = minutes % 60;
 
  const text =
    hours > 0
      ? `${hours}h ${displayMinutes}m`
      : `${displayMinutes}m`;
 
  return remaining < 0
    ? `-${text}`
    : text;
}
 
function isTicketSlaBreached(
  ticket: TicketRecord,
  now: number
) {
  return (
    ticket.status !== "Resolved" &&
    ticket.status !== "Closed" &&
    new Date(ticket.createdAt).getTime() +
      ticket.slaMinutes * 60 * 1000 <
      now
  );
}
 
function getPriorityClasses(
  priority: TicketPriority
) {
  switch (priority) {
    case "Critical":
      return "bg-red-100 text-red-700 border-red-200";
    case "High":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "Medium":
      return "bg-amber-100 text-amber-700 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}
 
 
 
function getMonthName(date: Date) {
  return date.toLocaleDateString(
    undefined,
    {
      month: "long",
      year: "numeric",
    }
  );
}
 
function getDateKey(date: Date) {
  const year =
    date.getFullYear();
 
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
 
  const day = String(
    date.getDate()
  ).padStart(2, "0");
 
  return `${year}-${month}-${day}`;
}
 
function getCalendarDays(
  monthDate: Date
) {
  const year =
    monthDate.getFullYear();
 
  const month =
    monthDate.getMonth();
 
  const firstDay = new Date(
    year,
    month,
    1
  );
 
  const startDay =
    firstDay.getDay();
 
  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();
 
  const totalCells =
    Math.ceil(
      (startDay +
        daysInMonth) /
        7
    ) * 7;
 
  const days: Date[] = [];
 
  for (
    let i = 0;
    i < totalCells;
    i++
  ) {
    days.push(
      new Date(
        year,
        month,
        i - startDay + 1
      )
    );
  }
 
  return days;
}
 
export default function Home() {
  const router = useRouter();
 
  const [
    activeTab,
    setActiveTab,
  ] = useState("Dashboard");
 
  const [
    profile,
    setProfile,
  ] = useState<Profile | null>(null);
 
  const [
    employees,
    setEmployees,
  ] = useState<Employee[]>([]);
 
  const [
    loadingUser,
    setLoadingUser,
  ] = useState(true);
 
  const [
    loadingEmployees,
    setLoadingEmployees,
  ] = useState(false);
 
  const [
    signingOut,
    setSigningOut,
  ] = useState(false);
 
  const [
    clockActionLoading,
    setClockActionLoading,
  ] = useState(false);
 
  const [
    statusActionLoading,
    setStatusActionLoading,
  ] = useState(false);
 
  const [
    clockError,
    setClockError,
  ] = useState("");
 
  const [
    statusStartedAt,
    setStatusStartedAt,
  ] = useState<string | null>(
    null
  );
 
  const [now, setNow] =
    useState(Date.now());
 
  const [notifOpen, setNotifOpen] = useState(false);
 
  const [leftMenuOpen, setLeftMenuOpen] = useState(false);
  const [favoriteTabs, setFavoriteTabs] = useState<string[]>([]);
 
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("workforceiq_favorite_tabs");
      if (stored) setFavoriteTabs(JSON.parse(stored));
    } catch {
      // ignore malformed storage
    }
  }, []);
 
  function toggleFavoriteTab(name: string) {
    setFavoriteTabs((current) => {
      const next = current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name];
      try {
        window.localStorage.setItem("workforceiq_favorite_tabs", JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }
 
  const [tabComments, setTabComments] = useState<
    Record<string, { id: string; author: string; body: string; createdAt: string }[]>
  >({});
 
  const [tabNoteDraft, setTabNoteDraft] = useState("");
 
  const [
    schedules,
    setSchedules,
  ] = useState<Schedule[]>([]);
 
  const [
    loadingSchedules,
    setLoadingSchedules,
  ] = useState(false);
 
  const [
    scheduleError,
    setScheduleError,
  ] = useState("");
 
  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    )
  );
 
  const [
    selectedDate,
    setSelectedDate,
  ] = useState<string | null>(
    null
  );
 
  const [
    scheduleModalOpen,
    setScheduleModalOpen,
  ] = useState(false);
 
  const [
    scheduleEditMode,
    setScheduleEditMode,
  ] = useState(false);
 
  const [
    eodDate,
    setEodDate,
  ] = useState(
    getDateKey(new Date())
  );
 
  const [
    eodRecords,
    setEodRecords,
  ] = useState<
    AttendanceRecord[]
  >([]);
 
  const [
    loadingEod,
    setLoadingEod,
  ] = useState(false);
 
  const [
    eodError,
    setEodError,
  ] = useState("");
 
  const [
    editingSchedule,
    setEditingSchedule,
  ] = useState<Schedule | null>(
    null
  );
 
  const [
    savingSchedule,
    setSavingSchedule,
  ] = useState(false);
 
  const [
    deletingScheduleId,
    setDeletingScheduleId,
  ] = useState<string | null>(
    null
  );
 
  const [
    scheduleForm,
    setScheduleForm,
  ] = useState({
    user_id: "",
    start_date: "",
    end_date: "",
    start_time: "08:00",
    end_time: "17:00",
    break_minutes: "15",
    shift_type: "Regular",
    notes: "",
    repeat_two_days_off: false,
  });
 
 
  const [
    tickets,
    setTickets,
  ] = useState<TicketRecord[]>([]);
 
  const [
    ticketComments,
    setTicketComments,
  ] = useState<TicketComment[]>([]);
 
  type AssetRecord = {
    id: string;
    asset_tag: string;
    device_name: string;
    category: string;
    status: string;
    assigned_to: string;
    location: string;
    warranty_expires: string;
    notes: string;
    created_at: string;
  };
 
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetForm, setAssetForm] = useState({
    asset_tag: "",
    device_name: "",
    category: "POS Terminal",
    status: "In Service",
    assigned_to: "",
    location: "",
    warranty_expires: "",
    notes: "",
  });
  const [showAssetForm, setShowAssetForm] = useState(false);
 
  type KBArticle = {
    id: string;
    title: string;
    category: string;
    body: string;
    author_name: string;
    updated_at: string;
  };
 
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbSearch, setKbSearch] = useState("");
  const [kbCategoryFilter, setKbCategoryFilter] = useState("All");
  const [kbSelectedId, setKbSelectedId] = useState<string | null>(null);
  const [kbForm, setKbForm] = useState({
    title: "",
    category: "General",
    body: "",
  });
  const [showKbForm, setShowKbForm] = useState(false);
 
  type InvoiceItem = { description: string; quantity: number; unit_price: number };
  type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue" | "Void";
 
  type Invoice = {
    id: string;
    customer_name: string;
    customer_phone: string;
    branch: string;
    items: InvoiceItem[];
    tax_rate: number;
    status: InvoiceStatus;
    due_date: string;
    created_at: string;
    paid_at: string | null;
  };
 
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
 
  type Organization = { id: string; name: string; created_at: string; status: string };
  type TenantPerson = { id: string; full_name: string; role: Role; org_id: string | null };
 
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [tenantPeople, setTenantPeople] = useState<TenantPerson[]>([]);
  const [tenantDataLoading, setTenantDataLoading] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showAddOrgForm, setShowAddOrgForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [invoiceForm, setInvoiceForm] = useState<{
    customer_name: string;
    customer_phone: string;
    branch: string;
    items: InvoiceItem[];
    tax_rate: string;
    due_date: string;
  }>({
    customer_name: "",
    customer_phone: "",
    branch: "",
    items: [{ description: "", quantity: 1, unit_price: 0 }],
    tax_rate: "15",
    due_date: "",
  });
 
  type CallLog = {
    id: string;
    agent_id: string;
    agent_name: string;
    contact_name: string;
    phone: string;
    outcome: "Connected" | "No Answer" | "Voicemail" | "Busy" | "Wrong Number";
    notes: string;
    called_at: string;
  };
 
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [callLogsLoading, setCallLogsLoading] = useState(false);
  const [callLogForm, setCallLogForm] = useState({
    contact_name: "",
    phone: "",
    outcome: "Connected" as CallLog["outcome"],
    notes: "",
  });
 
  const [
    commentDraft,
    setCommentDraft,
  ] = useState("");
 
  const [
    commentsLoading,
    setCommentsLoading,
  ] = useState(false);
 
  const [
    commentSaving,
    setCommentSaving,
  ] = useState(false);
 
  const [
    ticketModalOpen,
    setTicketModalOpen,
  ] = useState(false);
 
  const [
    selectedTicketId,
    setSelectedTicketId,
  ] = useState<string | null>(null);
 
  const [
    ticketSearch,
    setTicketSearch,
  ] = useState("");
 
  const [
    ticketStatusFilter,
    setTicketStatusFilter,
  ] = useState<"All" | TicketStatus>("All");
 
  const [
    ticketForm,
    setTicketForm,
  ] = useState({
    title: "",
    type: "Operations",
    priority: "Medium" as TicketPriority,
    employeeId: "",
    assignee: "",
    branch: "",
    slaMinutes: "120",
    component: "",
    notes: "",
    initialComment: "",
    contactPhone: "",
  });
 
  const [
    fieldWorkOrders,
    setFieldWorkOrders,
  ] = useState<FieldWorkOrder[]>([]);
 
  const [signaturePadOpenFor, setSignaturePadOpenFor] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureDrawingRef = useRef(false);
 
  const [
    hrCases,
    setHrCases,
  ] = useState<HRCase[]>([]);
 
  const [
    featureControls,
    setFeatureControls,
  ] = useState({
    ticketing: true,
    slaMonitoring: true,
    autoEscalation: true,
    fieldOperations: true,
    hrSupport: true,
  });
 
  const [
    featureSettingsOpen,
    setFeatureSettingsOpen,
  ] = useState(false);
 
  const [
    hrCaseModalOpen,
    setHrCaseModalOpen,
  ] = useState(false);
 
  const [
    fieldOrderModalOpen,
    setFieldOrderModalOpen,
  ] = useState(false);
 
  const [
    hrForm,
    setHrForm,
  ] = useState({
    employeeId: "",
    category: "Employee Support",
    priority: "Medium" as TicketPriority,
    dueDate: getDateKey(new Date()),
    notes: "",
  });
 
  const [
    fieldForm,
    setFieldForm,
  ] = useState({
    technician: "",
    customer: "",
    site: "",
    priority: "Medium" as TicketPriority,
    part: "",
    quantity: "1",
    eta: "",
    notes: "",
  });
 
  const canCreateSchedule =
    profile?.role ===
    "Administrator";
 
  const canEditSchedule =
    profile?.role ===
      "Administrator" ||
    profile?.role ===
      "Supervisor";
 
  const canDeleteSchedule =
    profile?.role ===
    "Administrator";
 
  const canViewAllSchedules =
    profile?.role ===
      "Administrator" ||
    profile?.role ===
      "Supervisor";
 
  // Shared derived state for the upper navigation tabs.
  // These values are calculated from existing attendance/schedule state only.
  // Ticket creation, department routing, and ticket status update logic below
  // are intentionally left unchanged.
  const currentUserEmployee = useMemo(
    () =>
      profile
        ? employees.find((employee) => employee.id === profile.id) ?? null
        : null,
    [employees, profile]
  );
 
  const isClockedIn = Boolean(
    currentUserEmployee?.clockInAt &&
      currentUserEmployee.clockOut === "—"
  );
 
  const currentStatus: AttendanceStatus =
    currentUserEmployee?.status ?? "Off Duty";
 
  const overallDuration = currentUserEmployee?.clockInAt
    ? Math.max(
        0,
        now -
          new Date(currentUserEmployee.clockInAt).getTime()
      )
    : 0;
 
  const statusDuration =
    currentUserEmployee?.statusStartedAt
      ? Math.max(
          0,
          now -
            new Date(
              currentUserEmployee.statusStartedAt
            ).getTime()
        )
      : 0;
 
  const currentStatusOverLimit = Boolean(
    currentUserEmployee &&
      isStatusOverLimit(
        currentUserEmployee.status,
        currentUserEmployee.statusStartedAt,
        now
      )
  );
 
  const todayKey = getDateKey(new Date());
 
  const currentShift = useMemo(
    () => {
      if (!profile) return null;
      return (
        schedules.find(
          (schedule) =>
            schedule.user_id === profile.id &&
            schedule.schedule_date === todayKey
        ) ?? null
      );
    },
    [schedules, profile, todayKey]
  );
 
  const currentShiftOverLimit = Boolean(
    currentShift &&
      currentShift.shift_type === "Regular" &&
      getShiftMinutes(
        currentShift.start_time,
        currentShift.end_time
      ) > 8 * 60
  );
 
  const calendarDays = useMemo(
    () => getCalendarDays(calendarMonth),
    [calendarMonth]
  );
 
  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, Schedule[]>();
 
    schedules.forEach((schedule) => {
      const existing = grouped.get(schedule.schedule_date) ?? [];
      existing.push(schedule);
      grouped.set(schedule.schedule_date, existing);
    });
 
    return grouped;
  }, [schedules]);
 
  const selectedDateSchedules = useMemo(() => {
    const date = selectedDate ?? todayKey;
    return schedulesByDate.get(date) ?? [];
  }, [selectedDate, schedulesByDate, todayKey]);
 
  const adminAlerts = useMemo(
    () =>
      employees.filter((employee) => {
        if (
          employee.status === "Off Duty" ||
          !employee.statusStartedAt
        ) {
          return false;
        }
 
        const statusOver = isStatusOverLimit(
          employee.status,
          employee.statusStartedAt,
          now
        );
 
        const shiftOver =
          Boolean(employee.clockInAt) &&
          now -
            new Date(
              employee.clockInAt as string
            ).getTime() >
            8 * 60 * 60 * 1000;
 
        return statusOver || shiftOver;
      }),
    [employees, now]
  );
 
  const performanceData = useMemo(() => {
    const total = employees.length || 1;
 
    const statusRows = statusOptions.map((status) => {
      const value = employees.filter(
        (employee) => employee.status === status
      ).length;
 
      return {
        label: getStatusLabel(status),
        value,
        percent: (value / total) * 100,
      };
    });
 
    const workedHours = employees
      .filter((employee) => Boolean(employee.clockInAt))
      .map((employee) => {
        const start = new Date(
          employee.clockInAt as string
        ).getTime();
 
        const end =
          employee.clockOut === "—"
            ? now
            : new Date(
                employee.clockOut
              ).getTime();
 
        return {
          name: employee.name,
          minutes: Math.max(
            0,
            Math.floor(
              (end - start) / 60000
            )
          ),
        };
      })
      .sort((a, b) => b.minutes - a.minutes);
 
    return {
      statusRows,
      workedHours,
    };
  }, [employees, now]);
 
  const goToday = useCallback(() => {
    const today = new Date();
 
    setCalendarMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );
 
    setSelectedDate(
      getDateKey(today)
    );
  }, []);
 
  const goPreviousMonth = useCallback(() => {
    setCalendarMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() - 1,
          1
        )
    );
  }, []);
 
  const goNextMonth = useCallback(() => {
    setCalendarMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          1
        )
    );
  }, []);
 
  function getStoredStatusStartedAt(
    userId: string
  ) {
    if (
      typeof window ===
      "undefined"
    ) {
      return null;
    }
 
    return localStorage.getItem(
      `workforceiq_status_started_${userId}`
    );
  }
 
  function setStoredStatusStartedAt(
    userId: string,
    value: string
  ) {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }
 
    localStorage.setItem(
      `workforceiq_status_started_${userId}`,
      value
    );
  }
 
  function clearStoredStatusStartedAt(
    userId: string
  ) {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }
 
    localStorage.removeItem(
      `workforceiq_status_started_${userId}`
    );
  }
 
  const loadWorkforce =
    useCallback(
      async (
        currentProfile: Profile
      ) => {
        setLoadingEmployees(
          true
        );
 
        try {
          const {
            data: profileData,
            error: profileError,
          } =
            await supabase
              .from(
                "user_profiles"
              )
              .select(
                "id, full_name, role"
              )
              .order(
                "full_name",
                {
                  ascending:
                    true,
                }
              );
 
          if (
            profileError
          ) {
            console.error(
              "Could not load employees:",
              profileError
            );
 
            setClockError(
              profileError.message
            );
 
            return;
          }
 
          const {
            data: attendanceData,
            error:
              attendanceError,
          } =
            await supabase
              .from(
                "attendance"
              )
              .select(
                "id, user_id, clock_in, clock_out, status, status_started_at"
              )
              .is(
                "clock_out",
                null
              );
 
          if (
            attendanceError
          ) {
            console.error(
              "Could not load active attendance:",
              attendanceError
            );
 
            setClockError(
              attendanceError.message
            );
          }
 
          const activeAttendance =
            new Map<
              String,
              AttendanceRecord
            >();
 
          (
            attendanceData ??
            []
          ).forEach(
            (record) => {
              if (
                !activeAttendance.has(
                  record.user_id
                )
              ) {
                activeAttendance.set(
                  record.user_id,
                  {
                    id:
                      record.id,
                    user_id:
                      record.user_id,
                    clock_in:
                      record.clock_in,
                    clock_out:
                      record.clock_out,
                    status:
                      record.status as AttendanceStatus,
                    status_started_at:
                      record.status_started_at ??
                      null,
                  }
                );
              }
            }
          );
 
          const realEmployees: Employee[] =
            (
              profileData ??
              []
            ).map(
              (person) => {
                const attendance =
                  activeAttendance.get(
                    person.id
                  );
 
                const employee: Employee =
                  {
                    id:
                      person.id,
                    initials:
                      getInitials(
                        person.full_name
                      ),
                    name:
                      person.full_name,
                    role:
                      person.role as Role,
                    status:
                      attendance?.status ??
                      "Off Duty",
                    clockIn:
                      formatClockTime(
                        attendance?.clock_in ??
                          null
                      ),
                    clockInAt:
                      attendance?.clock_in ??
                      null,
                    clockOut:
                      attendance?.clock_out
                        ? formatClockTime(
                            attendance.clock_out
                          )
                        : "—",
                    hours:
                      "0h 0m",
                    statusStartedAt:
                      attendance?.status_started_at ??
                      null,
                  };
 
                employee.hours =
                  getEmployeeDuration(
                    employee,
                    Date.now()
                  );
 
                return employee;
              }
            );
 
          setEmployees(
            realEmployees
          );
 
          const currentAttendance =
            activeAttendance.get(
              currentProfile.id
            );
 
          setStatusStartedAt(
            currentAttendance?.status_started_at ??
              null
          );
        } finally {
          setLoadingEmployees(
            false
          );
        }
      },
      []
    );
 
  const loadSchedules =
    useCallback(
      async (
        currentProfile: Profile
      ) => {
        setLoadingSchedules(
          true
        );
 
        setScheduleError(
          ""
        );
 
        try {
          const {
            data: scheduleData,
            error: scheduleLoadError,
          } =
            await supabase
              .from(
                "schedules"
              )
              .select(
                "id, user_id, schedule_date, start_time, end_time, break_minutes, shift_type, notes, created_by, created_at, updated_at"
              )
              .order(
                "schedule_date",
                {
                  ascending:
                    true,
                }
              )
              .order(
                "start_time",
                {
                  ascending:
                    true,
                }
              );
 
          if (
            scheduleLoadError
          ) {
            console.error(
              "Could not load schedules:",
              scheduleLoadError
            );
 
            setScheduleError(
              scheduleLoadError.message
            );
 
            return;
          }
 
          const {
            data: peopleData,
            error: peopleError,
          } =
            await supabase
              .from(
                "user_profiles"
              )
              .select(
                "id, full_name, role"
              )
              .order(
                "full_name",
                {
                  ascending:
                    true,
                }
              );
 
          if (
            peopleError
          ) {
            console.error(
              "Could not load schedule users:",
              peopleError
            );
          }
 
          const peopleMap =
            new Map<
              String,
              String
            >();
 
          (
            peopleData ??
            []
          ).forEach(
            (person) => {
              peopleMap.set(
                person.id,
                person.full_name
              );
            }
          );
 
          let visibleSchedules =
            (
              scheduleData ??
              []
            ) as Schedule[];
 
          if (
            !canViewAllSchedules
          ) {
            visibleSchedules =
              visibleSchedules.filter(
                (schedule) =>
                  schedule.user_id ===
                  currentProfile.id
              );
          }
 
          const schedulesWithNames =
            visibleSchedules.map(
              (schedule) => ({
                ...schedule,
                employee_name:
                  peopleMap.get(
                    schedule.user_id
                  ) ??
                  "Unknown employee",
              })
            );
 
          setSchedules(
            schedulesWithNames
          );
        } finally {
          setLoadingSchedules(
            false
          );
        }
      },
      [canViewAllSchedules]
    );
 
  const loadEod =
    useCallback(
      async (date: string) => {
        if (
          !profile ||
          profile.role ===
            "Employee"
        ) {
          return;
        }
 
        setLoadingEod(
          true
        );
 
        setEodError("");
 
        try {
          const start =
            new Date(
              `${date}T00:00:00`
            );
 
          const end =
            new Date(start);
 
          end.setDate(
            end.getDate() + 1
          );
 
          const {
            data,
            error,
          } = await supabase
            .from(
              "attendance"
            )
            .select(
              "id, user_id, clock_in, clock_out, status, status_started_at"
            )
            .gte(
              "clock_in",
              start.toISOString()
            )
            .lt(
              "clock_in",
              end.toISOString()
            )
            .order(
              "clock_in",
              {
                ascending:
                  true,
              }
            );
 
          if (error) {
            throw error;
          }
 
          setEodRecords(
            (
              data ?? []
            ).map(
              (record) => ({
                id:
                  record.id,
                user_id:
                  record.user_id,
                clock_in:
                  record.clock_in,
                clock_out:
                  record.clock_out,
                status:
                  record.status as AttendanceStatus,
                status_started_at:
                  record.status_started_at ??
                  null,
              })
            )
          );
        } catch (error: any) {
          console.error(
            "EOD load error:",
            error
          );
 
          setEodError(
            error?.message ??
              "Unable to load EOD report."
          );
 
          setEodRecords(
            []
          );
        } finally {
          setLoadingEod(
            false
          );
        }
      },
      [profile]
    );
 
  useEffect(() => {
    if (
      !profile ||
      profile.role ===
        "Employee"
    ) {
      return;
    }
 
    loadEod(eodDate);
  }, [
    profile,
    eodDate,
    loadEod,
  ]);
 
  useEffect(() => {
    let mounted = true;
 
    async function loadUser() {
      try {
        const {
          data: {
            user,
          },
          error: userError,
        } =
          await supabase.auth.getUser();
 
        if (
          userError ||
          !user
        ) {
          router.replace(
            "/login"
          );
          return;
        }
 
        const {
          data: profileData,
          error: profileError,
        } =
          await supabase
            .from(
              "user_profiles"
            )
            .select(
              "id, full_name, role, org_id, organizations!org_id(name, status)"
            )
            .eq(
              "id",
              user.id
            )
            .single();
 
        if (
          profileError ||
          !profileData
        ) {
          console.error(
            "Could not load WorkforceIQ profile:",
            profileError
          );
 
          await supabase.auth.signOut();
 
          router.replace(
            "/login"
          );
 
          return;
        }
 
        const allowedRoles: Role[] =
          [
            "Administrator",
            "Supervisor",
            "Team Leader",
            "Employee",
            "Super Admin",
          ];
 
        if (
          !allowedRoles.includes(
            profileData.role as Role
          )
        ) {
          await supabase.auth.signOut();
 
          router.replace(
            "/login"
          );
 
          return;
        }
 
        const orgStatus = (profileData as any).organizations?.status ?? "Active";
        if (profileData.role !== "Super Admin" && orgStatus !== "Active") {
          await supabase.auth.signOut();
          window.alert(
            orgStatus === "Terminated"
              ? "This organization's WorkforceIQ service has been terminated. Contact your administrator."
              : "This organization's WorkforceIQ service is currently suspended. Contact your administrator."
          );
          router.replace("/login");
          return;
        }
 
        if (!mounted) {
          return;
        }
 
        const userProfile: Profile =
          {
            id: user.id,
            email:
              user.email ??
              "",
            full_name:
              profileData.full_name,
            role:
              profileData.role as Role,
            orgName:
              (profileData as any).organizations?.name ?? null,
          };
 
        setProfile(
          userProfile
        );
 
        localStorage.setItem(
          "workforceiq_profile",
          JSON.stringify(
            userProfile
          )
        );
 
        setStatusStartedAt(
          getStoredStatusStartedAt(
            user.id
          )
        );
 
        setLoadingUser(
          false
        );
 
        await loadWorkforce(
          userProfile
        );
 
        await loadSchedules(
          userProfile
        );
      } catch (error) {
        console.error(
          "User loading error:",
          error
        );
 
        if (mounted) {
          router.replace(
            "/login"
          );
        }
      }
    }
 
    loadUser();
 
    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          event,
          session
        ) => {
          if (!mounted) {
            return;
          }
 
          if (
            event ===
              "SIGNED_OUT" ||
            !session
          ) {
            router.replace(
              "/login"
            );
          }
        }
      );
 
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [
    router,
    loadWorkforce,
    loadSchedules,
  ]);
 
  useEffect(() => {
    if (!profile) {
      return;
    }
 
    const timer =
      window.setInterval(
        () => {
          setNow(
            Date.now()
          );
        },
        1000
      );
 
    const refresh =
      window.setInterval(
        () => {
          loadWorkforce(
            profile
          );
 
          loadSchedules(
            profile
          );
        },
        10000
      );
 
    const attendanceChannel =
      supabase
        .channel(
          "workforceiq-attendance-live"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "attendance",
          },
          () => {
            loadWorkforce(
              profile
            );
          }
        )
        .subscribe();
 
    const scheduleChannel =
      supabase
        .channel(
          "workforceiq-schedules-live"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "schedules",
          },
          () => {
            loadSchedules(
              profile
            );
          }
        )
        .subscribe();
 
    return () => {
      window.clearInterval(
        timer
      );
 
      window.clearInterval(
        refresh
      );
 
      supabase.removeChannel(
        attendanceChannel
      );
 
      supabase.removeChannel(
        scheduleChannel
      );
    };
  }, [
    profile,
    loadWorkforce,
    loadSchedules,
  ]);
 
  async function handleClockToggle() {
    if (
      !profile ||
      clockActionLoading
    ) {
      return;
    }
 
    setClockActionLoading(
      true
    );
 
    setClockError("");
 
    try {
      const currentEmployee =
        employees.find(
          (employee) =>
            employee.id ===
            profile.id
        );
 
      if (
        currentEmployee?.clockInAt
      ) {
        const {
          error,
        } =
          await supabase
            .from(
              "attendance"
            )
            .update({
              clock_out:
                new Date().toISOString(),
              status:
                "Off Duty",
              status_started_at:
                null,
            })
            .eq(
              "user_id",
              profile.id
            )
            .is(
              "clock_out",
              null
            );
 
        if (error) {
          throw error;
        }
 
        clearStoredStatusStartedAt(
          profile.id
        );
 
        setStatusStartedAt(
          null
        );
      } else {
        const {
          error,
        } =
          await supabase
            .from(
              "attendance"
            )
            .insert({
              user_id:
                profile.id,
              clock_in:
                new Date().toISOString(),
              status:
                "Working",
              status_started_at:
                null,
            });
 
        if (error) {
          throw error;
        }
 
        clearStoredStatusStartedAt(
          profile.id
        );
 
        setStatusStartedAt(
          null
        );
      }
 
      await loadWorkforce(
        profile
      );
    } catch (error: any) {
      console.error(
        "Clock action error:",
        error
      );
 
      setClockError(
        error?.message ??
          "Unable to update attendance."
      );
    } finally {
      setClockActionLoading(
        false
      );
    }
  }
 
  async function handleStatusToggle(
    newStatus: AttendanceStatus
  ) {
    if (
      !profile ||
      statusActionLoading
    ) {
      return;
    }
 
    setStatusActionLoading(
      true
    );
 
    setClockError("");
 
    try {
      const currentEmployee =
        employees.find(
          (employee) =>
            employee.id ===
            profile.id
        );
 
      if (
        !currentEmployee?.clockInAt
      ) {
        setClockError(
          "You must be clocked in before changing your status."
        );
 
        return;
      }
 
      const targetStatus =
        currentEmployee.status ===
        newStatus
          ? "Working"
          : newStatus;
 
      const startedAt =
        targetStatus ===
          "Working" ||
        targetStatus ===
          "Off Duty"
          ? null
          : new Date().toISOString();
 
      const {
        error,
      } =
        await supabase
          .from(
            "attendance"
          )
          .update({
            status:
              targetStatus,
            status_started_at:
              startedAt,
          })
          .eq(
            "user_id",
            profile.id
          )
          .is(
            "clock_out",
            null
          );
 
      if (error) {
        throw error;
      }
 
      if (startedAt) {
        setStoredStatusStartedAt(
          profile.id,
          startedAt
        );
      } else {
        clearStoredStatusStartedAt(
          profile.id
        );
      }
 
      setStatusStartedAt(
        startedAt
      );
 
      await loadWorkforce(
        profile
      );
    } catch (error: any) {
      console.error(
        "Status update error:",
        error
      );
 
      setClockError(
        error?.message ??
          "Unable to change status."
      );
    } finally {
      setStatusActionLoading(
        false
      );
    }
  }
 
  function openCreateSchedule(
    date?: string
  ) {
    if (
      !canCreateSchedule
    ) {
      return;
    }
 
    const defaultUser =
      employees[0]?.id ??
      "";
 
    setEditingSchedule(
      null
    );
 
    const defaultDate =
      Date ??
      getDateKey(new Date());
 
    setScheduleForm({
      user_id:
        defaultUser,
      start_date:
        defaultDate,
      end_date:
        defaultDate,
      start_time:
        "08:00",
      end_time:
        "17:00",
      break_minutes:
        "15",
      shift_type:
        "Regular",
      notes: "",
      repeat_two_days_off:
        false,
    });
 
    setScheduleModalOpen(
      true
    );
  }
 
  function openEditSchedule(
    schedule: Schedule
  ) {
    if (
      !canEditSchedule
    ) {
      return;
    }
 
    setEditingSchedule(
      schedule
    );
 
    setScheduleForm({
      user_id:
        schedule.user_id,
      start_date:
        schedule.schedule_date,
      end_date:
        schedule.schedule_date,
      start_time:
        formatScheduleTime(
          schedule.start_time
        ),
      end_time:
        formatScheduleTime(
          schedule.end_time
        ),
      break_minutes:
        String(
          schedule.break_minutes ??
            0
        ),
      shift_type:
        schedule.shift_type ||
        "Regular",
      notes:
        schedule.notes ??
        "",
      repeat_two_days_off:
        false,
    });
 
    setScheduleModalOpen(
      true
    );
  }
 
  function closeScheduleModal() {
    if (
      savingSchedule
    ) {
      return;
    }
 
    setScheduleModalOpen(
      false
    );
 
    setEditingSchedule(
      null
    );
  }
 
  async function handleSaveSchedule() {
    if (
      !profile ||
      savingSchedule
    ) {
      return;
    }
 
    setSavingSchedule(
      true
    );
 
    setScheduleError("");
 
    try {
      if (
        !scheduleForm.user_id
      ) {
        throw new Error(
          "Please select an employee."
        );
      }
 
      if (
        !scheduleForm.start_date ||
        !scheduleForm.end_date
      ) {
        throw new Error(
          "Please select a start date and end date."
        );
      }
 
      if (
        scheduleForm.end_date <
        scheduleForm.start_date
      ) {
        throw new Error(
          "End date cannot be before the start date."
        );
      }
 
      if (
        !scheduleForm.start_time ||
        !scheduleForm.end_time
      ) {
        throw new Error(
          "Please enter a start and end time."
        );
      }
 
      if (
        scheduleForm.shift_type ===
          "Regular" &&
        getShiftMinutes(
          scheduleForm.start_time,
          scheduleForm.end_time
        ) >
          8 * 60
      ) {
        setScheduleError(
          "This Regular shift exceeds 8 hours. It will be flagged red for management."
        );
      }
 
      const breakMinutes =
        Number(
          scheduleForm.break_minutes
        );
 
      if (
        Number.isNaN(
          breakMinutes
        ) ||
        breakMinutes < 0
      ) {
        throw new Error(
          "Break minutes must be 0 or greater."
        );
      }
 
      if (
        !editingSchedule &&
        !canCreateSchedule
      ) {
        throw new Error(
          "Only an Administrator can create schedules."
        );
      }
 
      if (
        editingSchedule &&
        !canEditSchedule
      ) {
        throw new Error(
          "You do not have permission to edit schedules."
        );
      }
 
      if (
        editingSchedule
      ) {
        const {
          error,
        } =
          await supabase
            .from(
              "schedules"
            )
            .update({
              user_id:
                scheduleForm.user_id,
              schedule_date:
                scheduleForm.start_date,
              start_time:
                scheduleForm.start_time,
              end_time:
                scheduleForm.end_time,
              break_minutes:
                breakMinutes,
              shift_type:
                scheduleForm.shift_type,
              notes:
                scheduleForm.notes ||
                null,
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              editingSchedule.id
            );
 
        if (error) {
          throw error;
        }
      } else {
        const rows: Array<{
          user_id: string;
          schedule_date: string;
          start_time: string;
          end_time: string;
          break_minutes: number;
          shift_type: string;
          notes: string | null;
          created_by: string;
        }> = [];
 
        const [
          startYear,
          startMonth,
          startDay,
        ] =
          scheduleForm.start_date
            .split("-")
            .map(Number);
 
        const [
          endYear,
          endMonth,
          endDay,
        ] =
          scheduleForm.end_date
            .split("-")
            .map(Number);
 
        const cursor =
          new Date(
            startYear,
            startMonth - 1,
            startDay
          );
 
        const lastDate =
          new Date(
            endYear,
            endMonth - 1,
            endDay
          );
 
        while (
          cursor <= lastDate
        ) {
          rows.push({
            user_id:
              scheduleForm.user_id,
            schedule_date:
              getDateKey(
                cursor
              ),
            start_time:
              scheduleForm.start_time,
            end_time:
              scheduleForm.end_time,
            break_minutes:
              breakMinutes,
            shift_type:
              scheduleForm.shift_type,
            notes:
              scheduleForm.notes ||
              null,
            created_by:
              profile.id,
          });
 
          cursor.setDate(
            cursor.getDate() +
              (scheduleForm.repeat_two_days_off
                ? 3
                : 1)
          );
        }
 
        const {
          error,
        } = await supabase
          .from(
            "schedules"
          )
          .upsert(rows, {
            onConflict:
              "user_id,schedule_date",
          });
 
        if (error) {
          throw error;
        }
      }
 
      setScheduleModalOpen(
        false
      );
 
      setEditingSchedule(
        null
      );
 
      await loadSchedules(
        profile
      );
    } catch (error: any) {
      console.error(
        "Schedule save error:",
        error
      );
 
      setScheduleError(
        error?.message ??
          "Unable to save schedule."
      );
    } finally {
      setSavingSchedule(
        false
      );
    }
  }
 
  async function handleDeleteSchedule(
    schedule: Schedule
  ) {
    if (
      !profile ||
      !canDeleteSchedule
    ) {
      return;
    }
 
    const confirmed =
      window.confirm(
        `Delete ${
          schedule.employee_name ??
          "this employee"
        }'s schedule for ${
          schedule.schedule_date
        }?`
      );
 
    if (!confirmed) {
      return;
    }
 
    setDeletingScheduleId(
      schedule.id
    );
 
    setScheduleError("");
 
    try {
      const {
        error,
      } =
        await supabase
          .from(
            "schedules"
          )
          .delete()
          .eq(
            "id",
            schedule.id
          );
 
      if (error) {
        throw error;
      }
 
      await loadSchedules(
        profile
      );
    } catch (error: any) {
      console.error(
        "Schedule delete error:",
        error
      );
 
      setScheduleError(
        error?.message ??
          "Unable to delete schedule."
      );
    } finally {
      setDeletingScheduleId(
        null
      );
    }
  }
 
  async function handleSignOut() {
    setSigningOut(
      true
    );
 
    await supabase.auth.signOut();
 
    router.replace(
      "/login"
    );
  }
 
 
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
 
    try {
      const savedFieldOrders = window.localStorage.getItem(
        "workforceiq_field_orders_v1"
      );
      const savedHrCases = window.localStorage.getItem(
        "workforceiq_hr_cases_v1"
      );
      const savedControls = window.localStorage.getItem(
        "workforceiq_feature_controls_v1"
      );
 
      if (savedFieldOrders) {
        setFieldWorkOrders(JSON.parse(savedFieldOrders));
      }
      if (savedHrCases) {
        setHrCases(JSON.parse(savedHrCases));
      }
      if (savedControls) {
        setFeatureControls({
          ticketing: true,
          slaMonitoring: true,
          autoEscalation: true,
          fieldOperations: true,
          hrSupport: true,
          ...JSON.parse(savedControls),
        });
      }
    } catch (error) {
      console.error("WorkforceIQ local module restore error:", error);
    }
  }, []);
 
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      "workforceiq_field_orders_v1",
      JSON.stringify(fieldWorkOrders)
    );
  }, [fieldWorkOrders]);
 
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      "workforceiq_hr_cases_v1",
      JSON.stringify(hrCases)
    );
  }, [hrCases]);
 
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      "workforceiq_feature_controls_v1",
      JSON.stringify(featureControls)
    );
  }, [featureControls]);
 
  const mapSupabaseTicket = useCallback((row: any): TicketRecord => ({
    id: String(row.id),
    department: getTicketDepartment(row.ticket_type),
    title: row.title ?? "Untitled ticket",
    type: row.ticket_type ?? "Operations",
    priority: (row.priority ?? "Medium") as TicketPriority,
    status: (row.status ?? "New") as TicketStatus,
    requester: row.requester ?? "WorkforceIQ user",
    employeeId: row.employee_id ?? "",
    assignee: row.assignee ?? "",
    branch: row.branch ?? "",
    slaMinutes: Math.max(15, Number(row.sla_minutes) || 120),
    createdAt: row.created_at ?? new Date().toISOString(),
    component: row.component ?? "",
    notes: row.notes ?? row.description ?? "",
    contactPhone: row.contact_phone ?? "",
  }), []);
 
  const loadTicketsFromSupabase = useCallback(async () => {
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const { data, error } = await supabase
          .from("tickets")
          .select("id,device_id,title,description,status,priority,created_at,ticket_type,requester,employee_id,assignee,branch,sla_minutes,component,notes,contact_phone")
          .order("created_at", { ascending: false });
        if (error) throw error;
 
        const mappedTickets: TicketRecord[] = (data ?? []).map(mapSupabaseTicket);
        setTickets(mappedTickets);
 
        // Department bins are derived from the persisted ticket_type. Status changes
        // never change department, so New -> Waiting -> New stays in the same bin.
        const fieldServiceOrders: FieldWorkOrder[] = mappedTickets
          .filter((ticket) => ticket.department === "Field Dispatch")
          .map((ticket) => {
            const quantityMatch = ticket.notes.match(/Quantity:\s*(\d+)/i);
            const etaMatch = ticket.notes.match(/ETA:\s*([^|]+)/i);
            const siteMatch = ticket.notes.match(/Site:\s*([^|]+)/i);
            const partMatch = ticket.notes.match(/Part:\s*([^|]+)/i);
            return {
              id: `WO-${ticket.id}`,
              ticketId: ticket.id,
              technician: ticket.assignee || "",
              customer: ticket.title.replace(/^Field Service\s*-\s*/i, "").trim(),
              site: ticket.branch || siteMatch?.[1]?.trim() || "",
              status: getFieldWorkOrderStatus(ticket.status),
              priority: ticket.priority,
              part: ticket.component || partMatch?.[1]?.trim() || "",
              quantity: quantityMatch ? Math.max(1, Number(quantityMatch[1]) || 1) : 1,
              eta: etaMatch?.[1]?.trim() || "",
              notes: ticket.notes
                .replace(/Site:\s*[^|]+\s*\|?\s*/i, "")
                .replace(/Part:\s*[^|]+\s*\|?\s*/i, "")
                .replace(/Quantity:\s*\d+\s*\|?\s*/i, "")
                .replace(/ETA:\s*[^|]+\s*\|?\s*/i, "")
                .trim(),
            };
          });
        setFieldWorkOrders(fieldServiceOrders);
 
        // Rebuild HR cases from the same persisted tickets so HR never falls back
        // into the Service Hub after a refresh.
        const restoredHrCases: HRCase[] = mappedTickets
          .filter((ticket) => ticket.department === "HR")
          .map((ticket) => {
            const categoryMatch = ticket.notes.match(/HR category:\s*([^.|]+)/i);
            const dueDateMatch = ticket.notes.match(/Due date:\s*(\d{4}-\d{2}-\d{2})/i);
            const category = categoryMatch?.[1]?.trim() || ticket.component || "Employee Support";
            const employeeName = ticket.requester || "Employee";
            const existing = hrCases.find((item) => item.id === `HR-${ticket.id}`);
            return {
              id: `HR-${ticket.id}`,
              employeeId: ticket.employeeId,
              employeeName,
              category,
              status: existing?.status ?? "New",
              priority: ticket.priority,
              owner: ticket.assignee || "HR Support",
              createdAt: ticket.createdAt,
              dueDate: dueDateMatch?.[1] || getDateKey(new Date(ticket.createdAt)),
              notes: ticket.notes,
            };
          });
        setHrCases(restoredHrCases);
        return;
      } catch (error: any) {
        lastError = error;
        console.error(`Supabase ticket load attempt ${attempt} failed:`, error);
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
    console.error("Supabase ticket load failed after 3 attempts:", lastError);
    window.alert(lastError?.message ?? "Unable to load tickets from Supabase.");
  }, [mapSupabaseTicket]);
  const loadTicketComments = useCallback(async (ticketId: string | null) => {
    if (!ticketId) {
      setTicketComments([]);
      return;
    }
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ticket_comments")
        .select("id,ticket_id,author_id,author_name,body,created_at")
        .eq("ticket_id", Number(ticketId))
        .order("created_at", { ascending: true });
      if (error) throw error;
      setTicketComments((data ?? []).map((row: any) => ({
        id: String(row.id), ticketId: String(row.ticket_id), authorId: row.author_id ?? null,
        authorName: row.author_name ?? "WorkforceIQ user", body: row.body ?? "", createdAt: row.created_at,
      })));
    } catch (error: any) {
      console.error("Ticket comment load error:", error);
      window.alert(error?.message ?? "Unable to load ticket comments.");
    } finally {
      setCommentsLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!selectedTicketId) {
      setTicketComments([]);
      return;
    }
    void loadTicketComments(selectedTicketId);
  }, [selectedTicketId, loadTicketComments]);
  useEffect(() => {
    let cancelled = false;
    const loadAfterAuthReady = async () => {
      if (!profile) await new Promise((resolve) => setTimeout(resolve, 500));
      if (!cancelled) void loadTicketsFromSupabase();
    };
    void loadAfterAuthReady();
    const channel = supabase
      .channel("workforceiq-ticket-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        void loadTicketsFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_comments" }, (payload: any) => {
        const changedTicketId = payload?.new?.ticket_id ?? payload?.old?.ticket_id;
        if (selectedTicketId && String(changedTicketId) === String(selectedTicketId)) {
          void loadTicketComments(selectedTicketId);
        }
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [loadTicketsFromSupabase, loadTicketComments, selectedTicketId, profile?.id]);
 
  const loadAssetsFromSupabase = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const { data, error } = await supabase
        .from("assets")
        .select("id,asset_tag,device_name,category,status,assigned_to,location,warranty_expires,notes,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAssets((data ?? []) as AssetRecord[]);
    } catch (error: any) {
      console.error("Asset load error:", error);
    } finally {
      setAssetsLoading(false);
    }
  }, []);
 
  const addAsset = useCallback(async () => {
    if (!assetForm.asset_tag.trim() || !assetForm.device_name.trim()) return;
    try {
      const { error } = await supabase.from("assets").insert({
        asset_tag: assetForm.asset_tag.trim(),
        device_name: assetForm.device_name.trim(),
        category: assetForm.category,
        status: assetForm.status,
        assigned_to: assetForm.assigned_to.trim(),
        location: assetForm.location.trim(),
        warranty_expires: assetForm.warranty_expires || null,
        notes: assetForm.notes.trim(),
      });
      if (error) throw error;
      setAssetForm({
        asset_tag: "",
        device_name: "",
        category: "POS Terminal",
        status: "In Service",
        assigned_to: "",
        location: "",
        warranty_expires: "",
        notes: "",
      });
      setShowAssetForm(false);
      await loadAssetsFromSupabase();
    } catch (error: any) {
      window.alert(error?.message ?? "Unable to save asset.");
    }
  }, [assetForm, loadAssetsFromSupabase]);
 
  const updateAssetStatus = useCallback(async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("assets").update({ status }).eq("id", id);
      if (error) throw error;
      await loadAssetsFromSupabase();
    } catch (error: any) {
      window.alert(error?.message ?? "Unable to update asset.");
    }
  }, [loadAssetsFromSupabase]);
 
  const deleteAsset = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("assets").delete().eq("id", id);
      if (error) throw error;
      await loadAssetsFromSupabase();
    } catch (error: any) {
      window.alert(error?.message ?? "Unable to delete asset.");
    }
  }, [loadAssetsFromSupabase]);
 
  const loadKbArticlesFromSupabase = useCallback(async () => {
    setKbLoading(true);
    try {
      const { data, error } = await supabase
        .from("kb_articles")
        .select("id,title,category,body,author_name,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setKbArticles((data ?? []) as KBArticle[]);
    } catch (error: any) {
      console.error("Knowledge base load error:", error);
    } finally {
      setKbLoading(false);
    }
  }, []);
 
  const addKbArticle = useCallback(async () => {
    if (!kbForm.title.trim() || !kbForm.body.trim() || !profile) return;
    try {
      const { error } = await supabase.from("kb_articles").insert({
        title: kbForm.title.trim(),
        category: kbForm.category,
        body: kbForm.body.trim(),
        author_id: profile.id,
        author_name: profile.full_name,
      });
      if (error) throw error;
      setKbForm({ title: "", category: "General", body: "" });
      setShowKbForm(false);
      await loadKbArticlesFromSupabase();
    } catch (error: any) {
      window.alert(error?.message ?? "Unable to save article.");
    }
  }, [kbForm, profile, loadKbArticlesFromSupabase]);
 
  const deleteKbArticle = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("kb_articles").delete().eq("id", id);
      if (error) throw error;
      if (kbSelectedId === id) setKbSelectedId(null);
      await loadKbArticlesFromSupabase();
    } catch (error: any) {
      window.alert(error?.message ?? "Unable to delete article.");
    }
  }, [loadKbArticlesFromSupabase, kbSelectedId]);
 
  useEffect(() => {
    let cancelled = false;
    const loadAfterAuthReady = async () => {
      if (!profile) await new Promise((resolve) => setTimeout(resolve, 500));
      if (cancelled) return;
      void loadAssetsFromSupabase();
      void loadKbArticlesFromSupabase();
    };
    void loadAfterAuthReady();
    const channel = supabase
      .channel("workforceiq-asset-kb-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "assets" }, () => {
        void loadAssetsFromSupabase();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kb_articles" }, () => {
        void loadKbArticlesFromSupabase();
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [loadAssetsFromSupabase, loadKbArticlesFromSupabase, profile?.id]);
 
  const loadInvoicesFromSupabase = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id,customer_name,customer_phone,branch,items,tax_rate,status,due_date,created_at,paid_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInvoices((data ?? []) as Invoice[]);
    } catch (error: any) {
      console.error("Invoice load error:", error);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);
 
  function invoiceTotal(inv: { items: InvoiceItem[]; tax_rate: number }) {
    const subtotal = inv.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
    const tax = subtotal * (inv.tax_rate / 100);
    return { subtotal, tax, total: subtotal + tax };
  }
 
  const addInvoice = useCallback(async () => {
    if (!invoiceForm.customer_name.trim() || invoiceForm.items.length === 0) return;
    const cleanItems = invoiceForm.items.filter((it) => it.description.trim());
    if (cleanItems.length === 0) {
      window.alert("Add at least one line item with a description.");
      return;
    }
    try {
      const { error } = await supabase.from("invoices").insert({
        customer_name: invoiceForm.customer_name.trim(),
        customer_phone: invoiceForm.customer_phone.trim(),
        branch: invoiceForm.branch.trim(),
        items: cleanItems,
        tax_rate: Number(invoiceForm.tax_rate) || 0,
        status: "Draft",
        due_date: invoiceForm.due_date || null,
      });
      if (error) throw error;
      setInvoiceForm({
        customer_name: "",
        customer_phone: "",
        branch: "",
        items: [{ description: "", quantity: 1, unit_price: 0 }],
        tax_rate: "15",
        due_date: "",
      });
      setShowInvoiceForm(false);
      await loadInvoicesFromSupabase();
    } catch (error: any) {
      window.alert(error?.message ?? "Unable to save invoice.");
    }
  }, [invoiceForm, loadInvoicesFromSupabase]);
 
  const updateInvoiceStatus = useCallback(
    async (id: string, status: InvoiceStatus) => {
      try {
        const { error } = await supabase
          .from("invoices")
          .update({ status, paid_at: status === "Paid" ? new Date().toISOString() : null })
          .eq("id", id);
        if (error) throw error;
        await loadInvoicesFromSupabase();
      } catch (error: any) {
        window.alert(error?.message ?? "Unable to update invoice.");
      }
    },
    [loadInvoicesFromSupabase]
  );
 
  const deleteInvoice = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from("invoices").delete().eq("id", id);
        if (error) throw error;
        await loadInvoicesFromSupabase();
      } catch (error: any) {
        window.alert(error?.message ?? "Unable to delete invoice.");
      }
    },
    [loadInvoicesFromSupabase]
  );
 
  useEffect(() => {
    let cancelled = false;
    const loadAfterAuthReady = async () => {
      if (!profile) await new Promise((resolve) => setTimeout(resolve, 500));
      if (!cancelled) void loadInvoicesFromSupabase();
    };
    void loadAfterAuthReady();
    const channel = supabase
      .channel("workforceiq-invoice-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        void loadInvoicesFromSupabase();
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [loadInvoicesFromSupabase, profile?.id]);
 
  const loadTenantData = useCallback(async () => {
    if (profile?.role !== "Super Admin") return;
    setTenantDataLoading(true);
    try {
      const [orgsRes, peopleRes] = await Promise.all([
        supabase.from("organizations").select("id,name,created_at,status").order("name"),
        supabase.from("user_profiles").select("id,full_name,role,org_id").order("full_name"),
      ]);
      if (orgsRes.error) throw orgsRes.error;
      if (peopleRes.error) throw peopleRes.error;
      setOrganizations((orgsRes.data ?? []) as Organization[]);
      setTenantPeople((peopleRes.data ?? []) as TenantPerson[]);
    } catch (error: any) {
      console.error("Tenant data load error:", error);
    } finally {
      setTenantDataLoading(false);
    }
  }, [profile]);
 
  useEffect(() => {
    void loadTenantData();
  }, [loadTenantData]);
 
  const addOrganization = useCallback(async () => {
    if (!newOrgName.trim()) return;
    try {
      const { error } = await supabase
        .from("organizations")
        .insert({ name: newOrgName.trim() });
      if (error) throw error;
      setNewOrgName("");
      setShowAddOrgForm(false);
      await loadTenantData();
    } catch (error: any) {
      window.alert(error?.message ?? "Unable to create tenant.");
    }
  }, [newOrgName, loadTenantData]);
 
  const reassignPersonOrg = useCallback(
    async (personId: string, orgId: string) => {
      try {
        const { error } = await supabase
          .from("user_profiles")
          .update({ org_id: orgId })
          .eq("id", personId);
        if (error) throw error;
        await loadTenantData();
      } catch (error: any) {
        window.alert(error?.message ?? "Unable to reassign this person.");
      }
    },
    [loadTenantData]
  );
 
  const updateOrgStatus = useCallback(
    async (orgId: string, status: "Active" | "Suspended" | "Terminated") => {
      if (
        status !== "Active" &&
        !window.confirm(
          `Are you sure you want to ${status.toLowerCase()} this tenant's access? Their users will be signed out and unable to log back in until reactivated.`
        )
      ) {
        return;
      }
      try {
        const { error } = await supabase
          .from("organizations")
          .update({ status })
          .eq("id", orgId);
        if (error) throw error;
        await loadTenantData();
      } catch (error: any) {
        window.alert(error?.message ?? "Unable to update tenant status.");
      }
    },
    [loadTenantData]
  );
 
  const loadCallLogsFromSupabase = useCallback(async () => {
    setCallLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from("call_logs")
        .select("id,agent_id,agent_name,contact_name,phone,outcome,notes,called_at")
        .order("called_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setCallLogs((data ?? []) as CallLog[]);
    } catch (error: any) {
      console.error("Call log load error:", error);
    } finally {
      setCallLogsLoading(false);
    }
  }, []);
 
  const addCallLog = useCallback(async () => {
    if (!callLogForm.contact_name.trim() || !profile) return;
    try {
      const { error } = await supabase.from("call_logs").insert({
        agent_id: profile.id,
        agent_name: profile.full_name,
        contact_name: callLogForm.contact_name.trim(),
        phone: callLogForm.phone.trim(),
        outcome: callLogForm.outcome,
        notes: callLogForm.notes.trim(),
      });
      if (error) throw error;
      setCallLogForm({ contact_name: "", phone: "", outcome: "Connected", notes: "" });
      await loadCallLogsFromSupabase();
    } catch (error: any) {
      window.alert(error?.message ?? "Unable to save call log.");
    }
  }, [callLogForm, profile, loadCallLogsFromSupabase]);
 
  useEffect(() => {
    let cancelled = false;
    const loadAfterAuthReady = async () => {
      if (!profile) await new Promise((resolve) => setTimeout(resolve, 500));
      if (!cancelled) void loadCallLogsFromSupabase();
    };
    void loadAfterAuthReady();
    const channel = supabase
      .channel("workforceiq-call-log-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "call_logs" }, () => {
        void loadCallLogsFromSupabase();
      })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [loadCallLogsFromSupabase, profile?.id]);
 
 
 
 
 
 
 
 
 
 
 
 
  async function addTicketComment(
    ticketId: string,
    body: string,
    options?: { required?: boolean; silent?: boolean }
  ) {
    const cleanBody = body.trim();
    if (!cleanBody) {
      if (options?.required) {
        window.alert("A comment is required. Please describe what was reported or done.");
      }
      return false;
    }
 
    setCommentSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
 
      const user = authData.user;
      if (!user) throw new Error("You must be signed in to add a ticket comment.");
 
      const authorName = profile?.full_name?.trim() || user.email || "WorkforceIQ user";
 
      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: Number(ticketId),
        author_id: user.id,
        author_name: authorName,
        body: cleanBody,
      });
 
      if (error) throw error;
 
      if (!options?.silent) {
        setCommentDraft("");
        await loadTicketComments(ticketId);
      }
      return true;
    } catch (error: any) {
      console.error("Ticket comment save error:", error);
      if (!options?.silent) {
        window.alert(error?.message ?? "Unable to save ticket comment.");
      }
      return false;
    } finally {
      setCommentSaving(false);
    }
  }
 
  async function createTicket() {
    if (!ticketForm.title.trim()) return;
    if (!ticketForm.initialComment.trim()) {
      window.alert("A first comment is compulsory when creating a ticket.");
      return;
    }
 
    try {
      const initialComment = ticketForm.initialComment.trim();
      const status: TicketStatus = ticketForm.assignee ? "Assigned" : "New";
      const slaMinutes = Math.max(15, Number(ticketForm.slaMinutes) || 120);
 
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          title: ticketForm.title.trim(),
          description: ticketForm.notes.trim(),
          status,
          priority: ticketForm.priority,
          ticket_type: ticketForm.type,
          requester: profile?.full_name ?? "WorkforceIQ user",
          employee_id: ticketForm.employeeId || null,
          assignee: ticketForm.assignee || null,
          branch: ticketForm.branch.trim() || null,
          sla_minutes: slaMinutes,
          component: ticketForm.component.trim() || null,
          notes: ticketForm.notes.trim() || null,
          contact_phone: ticketForm.contactPhone.trim() || null,
        })
        .select("id,device_id,title,description,status,priority,created_at,ticket_type,requester,employee_id,assignee,branch,sla_minutes,component,notes,contact_phone")
        .single();
 
      if (error) throw error;
 
      const createdTicket = mapSupabaseTicket(data);
      const commentSaved = await addTicketComment(createdTicket.id, initialComment, {
        required: true,
        silent: true,
      });
 
      if (!commentSaved) {
        window.alert("The ticket was not completed because its compulsory first comment could not be saved. Please try again.");
        return;
      }
 
      setTickets((current) => [createdTicket, ...current.filter((item) => item.id !== createdTicket.id)]);
      setSelectedTicketId(createdTicket.id);
      setTicketModalOpen(false);
      setTicketForm({
        title: "",
        type: "Operations",
        priority: "Medium",
        employeeId: "",
        assignee: "",
        branch: "",
        slaMinutes: "120",
        component: "",
        notes: "",
        initialComment: "",
      });
      await loadTicketComments(createdTicket.id);
    } catch (error: any) {
      console.error("Supabase ticket create error:", error);
      window.alert(error?.message ?? "Unable to create ticket in Supabase.");
    }
  }
 
  async function updateTicketStatus(ticketId: string, status: TicketStatus) {
    const ticket = tickets.find((item) => item.id === ticketId);
 
    if (ticket && (status === "Resolved" || status === "Closed") && !ticket.component?.trim()) {
      window.alert("A component is required before this ticket can be resolved or closed.");
      return;
    }
 
    try {
      const { data, error } = await supabase
        .from("tickets")
        .update({ status })
        .eq("id", Number(ticketId))
        .select("id,status");
      if (error) throw error;
 
      // Supabase does not error when a Row Level Security policy blocks the
      // write — it just matches 0 rows and reports success. If nothing came
      // back, the update was silently rejected server-side, which is why a
      // status can appear to "bounce back" a second later. Surface it.
      if (!data || data.length === 0) {
        throw new Error(
          "The status change was rejected by the database (0 rows updated). This is almost always a Row Level Security policy on the 'tickets' table blocking UPDATE for your current role — the app has no way to force it through."
        );
      }
 
      setTickets((current) =>
        current.map((item) =>
          item.id === ticketId ? { ...item, status } : item
        )
      );
 
      if (ticket && ticket.status !== status) {
        await addTicketComment(
          ticketId,
          `Status changed from ${ticket.status} to ${status}.`,
          { silent: true }
        );
      }
 
      // Re-read the saved row so a realtime refresh cannot put the ticket
      // back into its old status after the user changes it.
      await loadTicketsFromSupabase();
    } catch (error: any) {
      console.error("Ticket status update error:", error);
      window.alert(error?.message ?? "Unable to update ticket status.");
      // Make sure the UI reflects what's actually in the database rather
      // than an optimistic value that never persisted.
      await loadTicketsFromSupabase();
    }
  }
 
  async function updateTicketAssignee(ticketId: string, assignee: string) {
    const ticket = tickets.find((item) => item.id === ticketId);
    const cleanAssignee = assignee.trim();
    const nextStatus: TicketStatus =
      cleanAssignee && ticket && ticket.status === "New" ? "Assigned" : (ticket?.status ?? "New");
 
    try {
      const { data, error } = await supabase
        .from("tickets")
        .update({
          assignee: cleanAssignee || null,
          status: nextStatus,
        })
        .eq("id", Number(ticketId))
        .select("id,assignee,status");
      if (error) throw error;
 
      if (!data || data.length === 0) {
        throw new Error(
          "The assignment was rejected by the database (0 rows updated). Check the Row Level Security UPDATE policy on the 'tickets' table."
        );
      }
 
      setTickets((current) =>
        current.map((item) =>
          item.id === ticketId
            ? { ...item, assignee: cleanAssignee, status: nextStatus }
            : item
        )
      );
 
      if (ticket && (ticket.assignee || "") !== cleanAssignee) {
        await addTicketComment(
          ticketId,
          cleanAssignee
            ? `Assigned to ${cleanAssignee}.`
            : "Unassigned.",
          { silent: true }
        );
      }
 
      await loadTicketsFromSupabase();
    } catch (error: any) {
      console.error("Ticket assignee update error:", error);
      window.alert(error?.message ?? "Unable to assign the ticket.");
      await loadTicketsFromSupabase();
    }
  }
 
  async function updateFieldWorkOrderStatus(
    orderId: string,
    status: FieldWorkOrder["status"]
  ) {
    const order = fieldWorkOrders.find((item) => item.id === orderId);
    if (!order) return;
 
    const ticketStatus = getTicketStatusFromFieldWorkOrder(status);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: ticketStatus })
        .eq("id", Number(order.ticketId));
      if (error) throw error;
 
      setFieldWorkOrders((current) =>
        current.map((item) =>
          item.id === orderId ? { ...item, status } : item
        )
      );
      setTickets((current) =>
        current.map((item) =>
          item.id === order.ticketId
            ? { ...item, status: ticketStatus }
            : item
        )
      );
 
      if (order.status !== status) {
        await addTicketComment(
          order.ticketId,
          `Field Work Order status changed from ${order.status} to ${status}.`,
          { silent: true }
        );
      }
 
      await loadTicketsFromSupabase();
    } catch (error: any) {
      console.error("Field Work Order status update error:", error);
      window.alert(error?.message ?? "Unable to update the Work Order status.");
    }
  }
 
  async function saveFieldWorkOrderSignature(orderId: string, dataUrl: string, signedByName: string) {
    const order = fieldWorkOrders.find((item) => item.id === orderId);
    if (!order) return;
 
    setFieldWorkOrders((current) =>
      current.map((item) =>
        item.id === orderId
          ? {
              ...item,
              signatureDataUrl: dataUrl,
              signedBy: signedByName.trim() || "Customer",
              signedAt: new Date().toISOString(),
            }
          : item
      )
    );
 
    await addTicketComment(
      order.ticketId,
      `Customer signature captured (signed by ${signedByName.trim() || "Customer"}).`,
      { silent: true }
    );
  }
 
  async function addFieldWorkOrderPhotoProof(orderId: string, dataUrl: string) {
    const order = fieldWorkOrders.find((item) => item.id === orderId);
    if (!order) return;
 
    setFieldWorkOrders((current) =>
      current.map((item) =>
        item.id === orderId
          ? {
              ...item,
              photoProofDataUrls: [...(item.photoProofDataUrls ?? []), dataUrl],
            }
          : item
      )
    );
 
    await addTicketComment(
      order.ticketId,
      `Photo proof attached (${(order.photoProofDataUrls?.length ?? 0) + 1} photo${
        (order.photoProofDataUrls?.length ?? 0) + 1 === 1 ? "" : "s"
      } total).`,
      { silent: true }
    );
  }
 
  function removeFieldWorkOrderPhotoProof(orderId: string, index: number) {
    setFieldWorkOrders((current) =>
      current.map((item) =>
        item.id === orderId
          ? {
              ...item,
              photoProofDataUrls: (item.photoProofDataUrls ?? []).filter((_, i) => i !== index),
            }
          : item
      )
    );
  }
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
  async function updateTicketComponent(ticketId: string, component: string) {
    const cleanComponent = component.trim();
    setTickets((current) =>
      current.map((ticket) => ticket.id === ticketId ? { ...ticket, component } : ticket)
    );
 
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ component: cleanComponent || null })
        .eq("id", Number(ticketId));
      if (error) throw error;
    } catch (error: any) {
      console.error("Ticket component update error:", error);
      window.alert(error?.message ?? "Unable to save the ticket component.");
      void loadTicketsFromSupabase();
    }
  }
 
  function toggleFeature(
    key: keyof typeof featureControls
  ) {
    setFeatureControls((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }
 
  async function createHrCase() {
    if (!hrForm.employeeId) {
      return;
    }
 
    const employee = employees.find(
      (person) => person.id === hrForm.employeeId
    );
    const employeeName = employee?.name ?? "Employee";
    const cleanNotes = hrForm.notes.trim();
    const title = `${hrForm.category} - ${employeeName}`;
    const initialComment = cleanNotes || `${hrForm.category} case created for ${employeeName}.`;
 
    try {
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          title,
          description: cleanNotes || initialComment,
          status: "New",
          priority: hrForm.priority,
          ticket_type: "HR",
          requester: employeeName,
          employee_id: hrForm.employeeId,
          assignee: profile?.role === "Employee" ? null : (profile?.full_name ?? null),
          branch: null,
          sla_minutes: 120,
          component: hrForm.category,
          notes: `HR category: ${hrForm.category}. Due date: ${hrForm.dueDate}.${cleanNotes ? ` ${cleanNotes}` : ""}`,
        })
        .select("id,device_id,title,description,status,priority,created_at,ticket_type,requester,employee_id,assignee,branch,sla_minutes,component,notes,contact_phone")
        .single();
 
      if (error) throw error;
 
      const createdTicket = mapSupabaseTicket(data);
      const commentSaved = await addTicketComment(createdTicket.id, initialComment, {
        required: true,
        silent: true,
      });
      if (!commentSaved) {
        window.alert("The HR case ticket was created, but its first comment could not be saved. Please check the ticket before continuing.");
        return;
      }
 
      const newCase: HRCase = {
        id: `HR-${createdTicket.id}`,
        employeeId: hrForm.employeeId,
        employeeName,
        category: hrForm.category,
        status: "New",
        priority: hrForm.priority,
        owner: profile?.role === "Employee" ? "HR Support" : (profile?.full_name ?? "HR Support"),
        createdAt: createdTicket.createdAt,
        dueDate: hrForm.dueDate,
        notes: cleanNotes,
      };
 
      setHrCases((current) => [newCase, ...current]);
      setTickets((current) => [createdTicket, ...current.filter((item) => item.id !== createdTicket.id)]);
 
      setHrCaseModalOpen(false);
      setHrForm({
        employeeId: "",
        category: "Employee Support",
        priority: "Medium",
        dueDate: getDateKey(new Date()),
        notes: "",
      });
      await loadTicketsFromSupabase();
      await loadTicketComments(createdTicket.id);
    } catch (error: any) {
      console.error("Supabase HR ticket create error:", error);
      window.alert(error?.message ?? "Unable to create the HR case ticket.");
    }
  }
  async function createFieldWorkOrder() {
    if (
      !fieldForm.customer.trim() &&
      !fieldForm.site.trim() &&
      !fieldForm.technician.trim()
    ) {
      return;
    }
 
    const customer = fieldForm.customer.trim();
    const site = fieldForm.site.trim();
    const technician = fieldForm.technician.trim();
    const part = fieldForm.part.trim();
    const quantity = Math.max(1, Number(fieldForm.quantity) || 1);
    const notes = fieldForm.notes.trim();
    const title = customer
      ? `Field Service - ${customer}`
      : `Field Service - ${site || "Work Order"}`;
    const initialComment = notes || `Field service request created${customer ? ` for ${customer}` : ""}${site ? ` at ${site}` : ""}.`;
    const fieldNotes = [
      site ? `Site: ${site}` : "",
      part ? `Part: ${part}` : "",
      `Quantity: ${quantity}`,
      fieldForm.eta ? `ETA: ${fieldForm.eta}` : "",
      notes,
    ].filter(Boolean).join(" | ");
 
    try {
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          title,
          description: fieldNotes || initialComment,
          status: technician ? "Assigned" : "New",
          priority: fieldForm.priority,
          ticket_type: "Field Service",
          requester: profile?.full_name ?? "WorkforceIQ user",
          employee_id: null,
          assignee: technician || null,
          branch: site || null,
          sla_minutes: 120,
          component: part || null,
          notes: fieldNotes || null,
        })
        .select("id,device_id,title,description,status,priority,created_at,ticket_type,requester,employee_id,assignee,branch,sla_minutes,component,notes,contact_phone")
        .single();
 
      if (error) throw error;
 
      const createdTicket = mapSupabaseTicket(data);
      const commentSaved = await addTicketComment(createdTicket.id, initialComment, {
        required: true,
        silent: true,
      });
      if (!commentSaved) {
        window.alert("The field ticket was created, but its first comment could not be saved. Please check the ticket before continuing.");
        return;
      }
 
      const order: FieldWorkOrder = {
        id: `WO-${createdTicket.id}`,
        ticketId: createdTicket.id,
        technician,
        customer,
        site,
        status: technician ? "Dispatched" : "Unassigned",
        priority: fieldForm.priority,
        part,
        quantity,
        eta: fieldForm.eta,
        notes,
      };
 
      setFieldWorkOrders((current) => [order, ...current]);
      setTickets((current) => [createdTicket, ...current.filter((item) => item.id !== createdTicket.id)]);
      // Keep the new Work Order in Field Operations; do not redirect to Tickets.
      setFieldOrderModalOpen(false);
      setFieldForm({
        technician: "",
        customer: "",
        site: "",
        priority: "Medium",
        part: "",
        quantity: "1",
        eta: "",
        notes: "",
      });
      await loadTicketsFromSupabase();
      await loadTicketComments(createdTicket.id);
    } catch (error: any) {
      console.error("Supabase field ticket create error:", error);
      window.alert(error?.message ?? "Unable to create the field service ticket.");
    }
  }
  const ticketMetrics = useMemo(() => {
    const serviceTickets = tickets.filter((ticket) => ticket.department === "Service Hub");
    const open = serviceTickets.filter((ticket) => ticket.status !== "Resolved" && ticket.status !== "Closed").length;
    const critical = serviceTickets.filter((ticket) => ticket.priority === "Critical" && ticket.status !== "Closed").length;
    const waiting = serviceTickets.filter((ticket) => ticket.status === "Waiting").length;
    const resolved = serviceTickets.filter((ticket) => ticket.status === "Resolved" || ticket.status === "Closed").length;
    return { open, critical, waiting, resolved, total: serviceTickets.length };
  }, [tickets]);
 
  const ticketStatusBins = useMemo(() => {
    const serviceTickets = tickets.filter((ticket) => ticket.department === "Service Hub");
    const statuses: TicketStatus[] = [
      "New",
      "Assigned",
      "In Progress",
      "Waiting",
      "Resolved",
      "Closed",
    ];
    return statuses.map((status) => ({
      status,
      count: serviceTickets.filter((ticket) => ticket.status === status).length,
    }));
  }, [tickets]);
 
  const filteredTickets = useMemo(() => {
    const query = ticketSearch.trim().toLowerCase();
    let serviceTickets = tickets.filter((ticket) => ticket.department === "Service Hub");
    if (ticketStatusFilter !== "All") {
      serviceTickets = serviceTickets.filter((ticket) => ticket.status === ticketStatusFilter);
    }
    if (!query) return serviceTickets;
    return serviceTickets.filter((ticket) => [
      ticket.id, ticket.title, ticket.type, ticket.priority, ticket.status,
      ticket.requester, ticket.assignee, ticket.branch, ticket.department,
    ].join(" ").toLowerCase().includes(query));
  }, [tickets, ticketSearch, ticketStatusFilter]);
 
  if (loadingUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-2xl">
            <Loader2
              className="animate-spin text-white"
              size={32}
            />
          </div>
 
          <div className="text-white font-bold text-xl">
            WorkforceIQ
          </div>
 
          <div className="text-red-100 text-sm mt-1">
            loading command center...
          </div>
        </div>
      </div>
    );
  }
 
  const activeNav =
    allNavItems.find(
      (item) =>
        item.name ===
        activeTab
    );
 
  const activeGradient =
    activeNav?.color ??
    "from-red-600 to-red-700";
 
  const tenantThemeClass =
    profile?.orgName === "LemontreeCorp"
      ? "theme-lemontree"
      : profile?.orgName === "Mash IT Solutions"
        ? "theme-mashit"
        : "";
 
  return (
    <div className={`flex h-screen overflow-hidden ${tenantThemeClass}`}>
      <style jsx global>{`
        /* === TENANT THEMES === */
 
        /* ---------- LEMON TREE ---------- */
        .theme-lemontree {
          background:
            radial-gradient(circle at 12% 15%, rgba(250, 204, 21, 0.20), transparent 38%),
            radial-gradient(circle at 88% 10%, rgba(74, 222, 128, 0.16), transparent 42%),
            radial-gradient(circle at 90% 90%, rgba(250, 204, 21, 0.14), transparent 40%),
            linear-gradient(180deg, #fdfaf0 0%, #fdf9e8 100%);
          position: relative;
        }
        .theme-lemontree::before,
        .theme-lemontree::after {
          content: "";
          position: fixed;
          width: 220px;
          height: 220px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cg opacity='0.55'%3E%3Cellipse cx='60' cy='90' rx='34' ry='24' fill='%23facc15' transform='rotate(-20 60 90)'/%3E%3Cellipse cx='120' cy='60' rx='30' ry='20' fill='%23fde047' transform='rotate(15 120 60)'/%3E%3Cpath d='M40 40 Q70 10 110 30 Q90 45 70 55 Q55 50 40 40Z' fill='%2386efac'/%3E%3Cpath d='M140 100 Q170 80 180 120 Q155 125 140 115 Q135 108 140 100Z' fill='%234ade80'/%3E%3C/g%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-size: contain;
          pointer-events: none;
          z-index: 0;
          opacity: 0.9;
        }
        .theme-lemontree::before { top: -30px; left: -30px; }
        .theme-lemontree::after { bottom: -30px; right: -30px; transform: rotate(180deg); }
 
        .theme-lemontree header {
          background: linear-gradient(90deg, rgba(254,249,195,0.95), rgba(220,252,231,0.95)) !important;
          border-bottom-color: #bbf7d0 !important;
          backdrop-filter: blur(10px);
        }
        .theme-lemontree ::selection { background: #fde047; }
 
        .theme-lemontree .bg-white,
        .theme-lemontree .bg-white\/90 {
          background-color: rgba(255, 253, 244, 0.92) !important;
        }
        .theme-lemontree .border-slate-200 {
          border-color: #d9f5df !important;
        }
        .theme-lemontree .rounded-2xl.border-slate-200,
        .theme-lemontree .rounded-2xl.bg-white {
          box-shadow: 0 2px 14px rgba(163, 190, 40, 0.10) !important;
        }
        .theme-lemontree .text-slate-900 { color: #1a3a1a !important; }
        .theme-lemontree .text-slate-700 { color: #2f5233 !important; }
        .theme-lemontree .text-slate-600,
        .theme-lemontree .text-slate-500 { color: #5c7a5f !important; }
        .theme-lemontree .divide-slate-100 > * + * { border-color: #eaf7ea !important; }
 
        /* ---------- MASH IT: SPACE ---------- */
        .theme-mashit {
          background:
            radial-gradient(circle at 15% 10%, rgba(217, 70, 239, 0.18), transparent 35%),
            radial-gradient(circle at 85% 20%, rgba(56, 189, 248, 0.16), transparent 40%),
            radial-gradient(circle at 30% 85%, rgba(139, 92, 246, 0.18), transparent 40%),
            radial-gradient(circle at 20% 20%, rgba(255,255,255,0.9) 0.5px, transparent 1px),
            radial-gradient(circle at 60% 70%, rgba(255,255,255,0.7) 0.5px, transparent 1px),
            radial-gradient(circle at 80% 30%, rgba(255,255,255,0.8) 0.5px, transparent 1px),
            radial-gradient(circle at 40% 85%, rgba(255,255,255,0.6) 0.5px, transparent 1px),
            radial-gradient(circle at 90% 60%, rgba(255,255,255,0.7) 0.5px, transparent 1px),
            linear-gradient(180deg, #0a0e27 0%, #1a1140 50%, #0d0a2b 100%);
          background-size:
            100% 100%, 100% 100%, 100% 100%,
            200px 200px, 250px 250px, 300px 300px, 220px 220px, 280px 280px,
            100% 100%;
        }
        .theme-mashit header {
          background: rgba(13, 10, 43, 0.85) !important;
          border-bottom-color: rgba(217, 70, 239, 0.25) !important;
          backdrop-filter: blur(14px);
        }
        .theme-mashit ::selection { background: rgba(217, 70, 239, 0.4); }
 
        .theme-mashit .bg-white,
        .theme-mashit .bg-white\/90 {
          background-color: rgba(23, 18, 60, 0.72) !important;
          backdrop-filter: blur(8px);
        }
        .theme-mashit .border-slate-200 {
          border-color: rgba(139, 92, 246, 0.28) !important;
        }
        .theme-mashit .rounded-2xl.border-slate-200,
        .theme-mashit .rounded-2xl.bg-white {
          box-shadow: 0 0 18px rgba(139, 92, 246, 0.12), inset 0 1px 0 rgba(255,255,255,0.04) !important;
        }
        .theme-mashit .text-slate-900 { color: #e9e7ff !important; }
        .theme-mashit .text-slate-700 { color: #c7c3f0 !important; }
        .theme-mashit .text-slate-600,
        .theme-mashit .text-slate-500 { color: #9a94d1 !important; }
        .theme-mashit .divide-slate-100 > * + * { border-color: rgba(139, 92, 246, 0.15) !important; }
 
        /* ---------- UNIFIED NAV / ICON ACCENTS ---------- */
        .theme-mashit [class~="border-transparent"] {
          background: linear-gradient(90deg, #7c3aed, #06b6d4) !important;
          box-shadow: 0 0 14px rgba(6, 182, 212, 0.45), 0 0 10px rgba(139, 92, 246, 0.35) !important;
        }
        .theme-mashit [class~="bg-gradient-to-br"][class~="shadow-lg"],
        .theme-mashit [class~="bg-gradient-to-b"][class~="shadow-lg"] {
          background: linear-gradient(135deg, #7c3aed, #06b6d4) !important;
          box-shadow: 0 0 12px rgba(6, 182, 212, 0.5) !important;
        }
        .theme-mashit [class~="border-slate-200"] {
          box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.15) inset !important;
        }
 
        .theme-lemontree [class~="border-transparent"] {
          background: linear-gradient(90deg, #facc15, #4ade80) !important;
          box-shadow: 0 0 10px rgba(250, 204, 21, 0.35) !important;
        }
        .theme-lemontree [class~="bg-gradient-to-br"][class~="shadow-lg"],
        .theme-lemontree [class~="bg-gradient-to-b"][class~="shadow-lg"] {
          background: linear-gradient(135deg, #facc15, #4ade80) !important;
          box-shadow: 0 0 10px rgba(74, 222, 128, 0.35) !important;
        }
      `}</style>
      <WorkforceIQSessionGuard />
      {/* SIDEBAR */}
      {leftMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50"
          onClick={() => setLeftMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 z-50 flex flex-col bg-slate-900 text-white overflow-y-auto transform transition-transform duration-200 ${
          leftMenuOpen ? "translate-x-0" : "-translate-x-full lg:-translate-x-full lg:hidden"
        }`}
      >
        {/* BRAND */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-red-600 via-red-500 to-red-700 flex items-center justify-center shadow-lg">
              <Activity
                size={24}
                className="text-white"
              />
            </div>
 
            <div>
              <div className="text-xl font-black tracking-tight">
                Workforce
                <span className="text-red-500">
                  IQ
                </span>
              </div>
 
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Workforce Command Center
              </div>
            </div>
          </div>
        </div>
 
        {/* PROFILE */}
        {profile && (
          <div className="p-4">
            <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg">
                  {getInitials(
                    profile.full_name
                  )}
                </div>
 
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {
                      profile.full_name
                    }
                  </div>
 
                  <div className="text-xs text-slate-400 truncate">
                    {
                      profile.role
                    }
                  </div>
                </div>
              </div>
 
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live connection
              </div>
            </div>
          </div>
        )}
 
        {/* NAVIGATION */}
        <nav className="flex-1 px-3 py-2 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
              All tabs
            </span>
            <button
              type="button"
              onClick={() => setLeftMenuOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-3 pb-2 text-[10px] text-slate-500">
            Tap the star to pin a tab to the top bar.
          </div>
 
          {allNavItems
            .filter(
              (item) =>
                profile &&
                canAccess(
                  profile.role,
                  item.name
                )
            )
            .map(
              (item) => {
                const Icon =
                  item.icon;
 
                const active =
                  activeTab ===
                  item.name;
 
                const isFavorite = favoriteTabs.includes(item.name);
 
                return (
                  <div
                    key={item.name}
                    className={`group w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                      active
                        ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (item.name === "Dialer") {
                          router.push("/dialer");
                        } else {
                          setActiveTab(item.name);
                        }
                        setLeftMenuOpen(false);
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center transition flex-shrink-0 ${
                          active
                            ? "bg-white/20"
                            : `${item.iconBg} group-hover:scale-105`
                        }`}
                      >
                        <Icon size={19} />
                      </div>
                      <span className="font-semibold text-sm truncate">{item.name}</span>
                    </button>
 
                    <button
                      type="button"
                      onClick={() => toggleFavoriteTab(item.name)}
                      className="flex-shrink-0"
                      title={isFavorite ? "Remove from top bar" : "Pin to top bar"}
                    >
                      <Star
                        size={16}
                        className={isFavorite ? "fill-amber-400 text-amber-400" : "text-slate-500"}
                      />
                    </button>
                  </div>
                );
              }
            )}
        </nav>
 
        {/* SIGN OUT */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={
              handleSignOut
            }
            disabled={
              signingOut
            }
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
          >
            {signingOut ? (
              <Loader2
                size={19}
                className="animate-spin"
              />
            ) : (
              <LogOut
                size={19}
              />
            )}
 
            <span className="font-semibold text-sm">
              {signingOut
                ? "Signing out..."
                : "Sign Out"}
            </span>
          </button>
        </div>
      </aside>
 
      {/* MAIN */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* TOP HEADER */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLeftMenuOpen(true)}
                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 flex-shrink-0"
                  title="All tabs"
                >
                  <Menu size={18} className="text-slate-600" />
                </button>
 
                <div
                  className={`h-11 w-11 rounded-xl bg-gradient-to-br ${activeGradient} flex items-center justify-center text-white shadow-lg`}
                >
                  {activeNav &&
                    (() => {
                      const Icon =
                        activeNav.icon;
 
                      return (
                        <Icon
                          size={22}
                        />
                      );
                    })()}
                </div>
 
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    WorkforceIQ
                  </div>
 
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                    {
                      activeTab
                    }
                  </h1>
                </div>
              </div>
 
              <div className="hidden sm:flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </div>
 
                {profile && (
                  <div className="rounded-full bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                    {
                      profile.role
                    }
                  </div>
                )}
 
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNotifOpen((v) => !v)}
                    className="relative inline-flex items-center justify-center h-10 w-10 rounded-full bg-slate-100 border border-slate-200 hover:bg-slate-200 transition"
                    title="Notifications"
                  >
                    <Bell size={17} className="text-slate-600" />
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                      {analyticsRoadmapItems.length}
                    </span>
                  </button>
 
                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 shadow-xl z-40 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                        <div className="font-black text-slate-800 text-sm">
                          Analytics roadmap updates
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Visible to every role, including Employees.
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {analyticsRoadmapItems.map((item) => (
                          <div key={item.title} className="px-4 py-3">
                            <div className="font-bold text-slate-700 text-sm">
                              {item.title}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {item.note}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
 
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-bold hover:bg-slate-800 disabled:opacity-60 transition shadow-sm"
                  title="Sign out"
                >
                  {signingOut ? (
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                  ) : (
                    <LogOut size={15} />
                  )}
                  <span className="hidden md:inline">
                    Sign Out
                  </span>
                </button>
              </div>
            </div>
 
            {/* FAVORITES BAR (top). All other tabs live in the left menu. */}
            <div className="mt-4 overflow-x-auto">
              <div className="flex gap-2 min-w-max pb-1">
                {allNavItems.filter(
                  (item) =>
                    profile &&
                    canAccess(profile.role, item.name) &&
                    favoriteTabs.includes(item.name)
                ).length === 0 && (
                  <button
                    type="button"
                    onClick={() => setLeftMenuOpen(true)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold border border-dashed border-slate-300 text-slate-400"
                  >
                    <Star size={14} /> Pin tabs from the menu to see them here
                  </button>
                )}
                {allNavItems
                  .filter(
                    (item) =>
                      profile &&
                      canAccess(
                        profile.role,
                        item.name
                      ) &&
                      favoriteTabs.includes(item.name)
                  )
                  .map(
                    (item) => {
                      const Icon =
                        item.icon;
 
                      const active =
                        activeTab ===
                        item.name;
 
                      return (
                        <button
                          key={
                            item.name
                          }
                          onClick={() =>
                            item.name === "Dialer"
                              ? router.push("/dialer")
                              : setActiveTab(
                                  item.name
                                )
                          }
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold border transition ${
                            active
                              ? `bg-gradient-to-r ${item.color} text-white border-transparent shadow-md`
                              : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          <Icon
                            size={15}
                          />
 
                          {
                            item.name
                          }
                        </button>
                      );
                    }
                  )}
              </div>
            </div>
          </div>
        </header>
 
        <div className="p-4 sm:p-6 lg:p-8">
          {/* GLOBAL ATTENDANCE ERROR */}
          {clockError && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-4 text-red-700 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle
                    size={18}
                  />
                </div>
 
                <div>
                  <div className="font-bold">
                    attendance error
                  </div>
 
                  <div className="text-sm mt-1 break-words">
                    {
                      clockError
                    }
                  </div>
                </div>
              </div>
            </div>
          )}
 
          {/* DASHBOARD */}
          {activeTab ===
            "Dashboard" && (
            <div className="space-y-6">
 
              <EmployeeCommentSection
                tabName="Dashboard"
                profile={profile}
                tabComments={tabComments}
                setTabComments={setTabComments}
                tabNoteDraft={tabNoteDraft}
                setTabNoteDraft={setTabNoteDraft}
              />
              {/* HERO */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-800 p-6 sm:p-8 text-white shadow-xl">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
 
                <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-bold">
                      <Sparkles
                        size={14}
                      />
                      COMMAND CENTER
                    </div>
 
                    <h2 className="text-3xl sm:text-4xl font-black mt-4">
                      Welcome back,{" "}
                      {
                        profile?.full_name
                      }!
                    </h2>
 
                    <p className="text-blue-100 mt-2 max-w-2xl">
                      Your live WorkforceIQ
                      Overview. Monitor
                      attendance,
                      schedules and
                      Workforce activity
                      From one place.
                    </p>
                  </div>
 
                  <div className="rounded-2xl bg-white/10 border border-white/20 p-5 min-w-[190px]">
                    <div className="flex items-center gap-2 text-blue-100 text-sm">
                      <Users
                        size={16}
                      />
                      Live workforce
                    </div>
 
                    <div className="text-4xl font-black mt-1">
                      {
                        employees.length
                      }
                    </div>
 
                    <div className="text-xs text-red-100 mt-1">
                      employees / users
                    </div>
                  </div>
                </div>
              </div>
 
              {/* KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  {
                    label:
                      "Working",
                    value:
                      employees.filter(
                        e =>
                          e.status ===
                          "Working"
                      ).length,
                    note:
                      "currently available",
                    tab:
                      "Time & Attendance",
                    gradient:
                      "from-emerald-500 to-teal-600",
                    bg:
                      "bg-emerald-50",
                    text:
                      "text-emerald-700",
                    icon:
                      Activity,
                  },
                  {
                    label:
                      "Break / Lunch / Away",
                    value:
                      employees.filter(
                        e =>
                          e.status !==
                            "Working" &&
                          e.status !==
                            "Off Duty"
                      ).length,
                    note:
                      "non-working states",
                    tab:
                      "Time & Attendance",
                    gradient:
                      "from-amber-500 to-orange-600",
                    bg:
                      "bg-amber-50",
                    text:
                      "text-amber-700",
                    icon:
                      Clock3,
                  },
                  {
                    label:
                      "Off Duty",
                    value:
                      employees.filter(
                        e =>
                          e.status ===
                          "Off Duty"
                      ).length,
                    note:
                      "not clocked in",
                    tab:
                      "Time & Attendance",
                    gradient:
                      "from-slate-500 to-slate-700",
                    bg:
                      "bg-slate-50",
                    text:
                      "text-slate-700",
                    icon:
                      LogOut,
                  },
                  {
                    label:
                      "Schedules",
                    value:
                      schedules.length,
                    note:
                      "loaded schedule entries",
                    tab:
                      "Schedules",
                    gradient:
                      "from-orange-500 to-rose-600",
                    bg:
                      "bg-orange-50",
                    text:
                      "text-orange-700",
                    icon:
                      CalendarDays,
                  },
                ].map(
                  (card) => {
                    const CardIcon =
                      card.icon;
 
                    return (
                      <button
                        key={
                          card.label
                        }
                        type="button"
                        onClick={() =>
                          setActiveTab(
                            card.tab
                          )
                        }
                        className={`group text-left bg-white rounded-2xl border border-slate-200 p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 overflow-hidden relative`}
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${card.gradient}`}
                        />
 
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-500">
                              {
                                card.label
                              }
                            </div>
 
                            <div className="text-4xl font-black text-slate-900 mt-2">
                              {
                                card.value
                              }
                            </div>
 
                            <div className="text-xs text-slate-400 mt-1">
                              {
                                card.note
                              }
                            </div>
                          </div>
 
                          <div
                            className={`h-11 w-11 rounded-xl ${card.bg} ${card.text} flex items-center justify-center group-hover:scale-110 transition`}
                          >
                            <CardIcon
                              size={21}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
 
              {/* SUMMARY */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Live status summary
                      </h3>
 
                      <p className="text-sm text-slate-500 mt-1">
                        Real-time workforce
                        State overview.
                      </p>
                    </div>
 
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          "Time & Attendance"
                        )
                      }
                      className="text-sm font-bold text-blue-600 hover:text-blue-700"
                    >
                      Open →
                    </button>
                  </div>
 
                  <div className="space-y-3">
                    {statusOptions.map(
                      (status) => {
                        const count =
                          employees.filter(
                            (employee) =>
                              employee.status ===
                              status
                          ).length;
 
                        const style =
                          getStatusClasses(
                            status
                          );
 
                        return (
                          <div
                            key={
                              status
                            }
                            className={`flex items-center justify-between rounded-xl border p-3 ${style.card}`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`h-3 w-3 rounded-full ${style.dot}`}
                              />
 
                              <span className="text-sm font-bold">
                                {getStatusLabel(
                                  status
                                )}
                              </span>
                            </div>
 
                            <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-black">
                              {
                                count
                              }
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
 
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="mb-5">
                    <h3 className="text-lg font-bold text-slate-900">
                      Workforce modules
                    </h3>
 
                    <p className="text-sm text-slate-500 mt-1">
                      Jump directly into
                      Any WorkforceIQ
                      module.
                    </p>
                  </div>
 
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      [
                        "EOD Report",
                        "Daily attendance, hours and adherence",
                        "EOD Report",
                      ],
                      [
                        "Schedules",
                        `${schedules.length} schedule entries loaded`,
                        "Schedules",
                      ],
                      [
                        "People",
                        `${employees.length} people loaded`,
                        "People",
                      ],
                      [
                        "Performance",
                        "Performance overview",
                        "Performance",
                      ],
                      [
                        "Tasks",
                        "Task management overview",
                        "Tasks",
                      ],
                      [
                        "Inventory",
                        "Inventory overview",
                        "Inventory",
                      ],
                    ]
                      .filter(
                        (item) =>
                          profile &&
                          canAccess(
                            profile.role,
                            item[2]
                          )
                      )
                      .map(
                        ([
                          title,
                          note,
                          tab,
                        ]) => {
                          const module =
                            allNavItems.find(
                              (item) =>
                                item.name ===
                                tab
                            );
 
                          return (
                            <button
                              key={
                                title
                              }
                              type="button"
                              onClick={() =>
                                setActiveTab(
                                  tab
                                )
                              }
                              className="group rounded-xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm transition"
                            >
                              <div className="flex items-center gap-3">
                                {module && (
                                  <div
                                    className={`h-9 w-9 rounded-lg ${module.iconBg} flex items-center justify-center`}
                                  >
                                    {(() => {
                                      const ModuleIcon =
                                        module.icon;
 
                                      return (
                                        <ModuleIcon
                                          size={
                                            17
                                          }
                                        />
                                      );
                                    })()}
                                  </div>
                                )}
 
                                <div className="font-bold text-slate-800 group-hover:text-blue-700">
                                  {
                                    title
                                  }
                                </div>
                              </div>
 
                              <div className="text-xs text-slate-500 mt-3">
                                {
                                  note
                                }
                              </div>
                            </button>
                          );
                        }
                      )}
                  </div>
                </div>
              </div>
            </div>
          )}
 
          {/* TIME & ATTENDANCE */}
          {activeTab ===
            "Time & Attendance" && (
            <div className="space-y-6">
 
              <EmployeeCommentSection
                tabName="Time & Attendance"
                profile={profile}
                tabComments={tabComments}
                setTabComments={setTabComments}
                tabNoteDraft={tabNoteDraft}
                setTabNoteDraft={setTabNoteDraft}
              />
              {profile?.role ===
                "Administrator" &&
                adminAlerts.length >
                  0 && (
                  <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-5 text-red-800 shadow-sm">
                    <div className="flex items-center gap-3 font-bold">
                      <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
                        <Bell
                          size={20}
                        />
                      </div>
 
                      <div>
                        attendance alerts (
                        {
                          adminAlerts.length
                        }
                        )
                      </div>
                    </div>
 
                    <div className="mt-4 space-y-2 text-sm">
                      {adminAlerts.map(
                        (employee) => {
                          const breakOver =
                            isStatusOverLimit(
                              employee.status,
                              employee.statusStartedAt,
                              now
                            );
 
                          const shiftOver =
                            !!employee.clockInAt &&
                            now -
                              new Date(
                                employee.clockInAt
                              ).getTime() >
                              8 *
                                60 *
                                60 *
                                1000;
 
                          return (
                            <div
                              key={
                                employee.id
                              }
                              className="rounded-lg bg-white/70 border border-red-100 p-3"
                            >
                              <strong>
                                {
                                  employee.name
                                }
                              </strong>
                              :{" "}
                              {breakOver
                                ? `${employee.status} exceeded its limit`
                                : "Shift exceeded 8 hours"}
                              .
                              {breakOver &&
                              shiftOver
                                ? " Shift also exceeded 8 hours."
                                : ""}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
 
              {currentStatusOverLimit && (
                <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-700 font-bold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      size={19}
                    />
                    {
                      currentStatus
                    }{" "}
                    Has exceeded its
                    Allowed time.
                  </div>
                </div>
              )}
 
              {currentShiftOverLimit && (
                <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-red-700 font-bold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      size={19}
                    />
                    Your shift has
                    Exceeded 8 hours.
                  </div>
                </div>
              )}
 
              {/* CLOCK CARD */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
                <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
 
                <div className="relative">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 text-blue-300 text-sm font-bold uppercase tracking-wider">
                        <Clock3
                          size={17}
                        />
                        Time & Attendance
                      </div>
 
                      <h3 className="text-2xl sm:text-3xl font-black mt-2">
                        {isClockedIn
                          ? "You are clocked in"
                          : "You are currently off duty"}
                      </h3>
 
                      <p className="text-slate-400 mt-1">
                        Your overall clock
                        Keeps running while
                        Your current status
                        timer tracks your
                        Active state.
                      </p>
                    </div>
 
                    <button
                      onClick={
                        handleClockToggle
                      }
                      disabled={
                        clockActionLoading
                      }
                      className={`px-7 py-4 rounded-2xl font-black text-lg shadow-xl transition hover:-translate-y-0.5 disabled:opacity-50 ${
                        isClockedIn
                          ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
                          : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                      }`}
                    >
                      {clockActionLoading && (
                        <Loader2
                          size={20}
                          className="animate-spin inline mr-2"
                        />
                      )}
 
                      {isClockedIn
                        ? "Clock Out"
                        : "Clock In"}
                    </button>
                  </div>
 
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-7">
                    <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                      <div className="text-xs text-slate-400 uppercase tracking-wider">
                        Clock In
                      </div>
 
                      <div className="text-xl font-black mt-1">
                        {
                          currentUserEmployee?.clockIn ??
                          "—"
                        }
                      </div>
                    </div>
 
                    <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                      <div className="text-xs text-slate-400 uppercase tracking-wider">
                        Overall Time
                      </div>
 
                      <div className="text-xl font-black mt-1">
                        {
                          formatShortDuration(overallDuration)
                        }
                      </div>
                    </div>
 
                    <div className="rounded-2xl bg-white/10 border border-white/10 p-4">
                      <div className="text-xs text-slate-400 uppercase tracking-wider">
                        current Status
                      </div>
 
                      <div className="text-xl font-black mt-1 flex items-center gap-2">
                        <span
                          className={`h-3 w-3 rounded-full ${
                            getStatusClasses(
                              currentStatus
                            ).dot
                          }`}
                        />
 
                        {
                          getStatusLabel(
                            currentStatus
                          )
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
 
              {/* STATUS CENTER */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="mb-5">
                  <h3 className="text-xl font-black text-slate-900">
                    status Center
                  </h3>
 
                  <p className="text-sm text-slate-500 mt-1">
                    Select your current
                    Workforce state.
                  </p>
                </div>
 
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {statusOptions.map(
                    (status) => {
                      const isActive =
                        currentStatus ===
                        status;
 
                      const style =
                        getStatusClasses(
                          status
                        );
 
                      return (
                        <button
                          key={
                            status
                          }
                          type="button"
                          disabled={
                            !isClockedIn ||
                            statusActionLoading
                          }
                          onClick={() =>
                            handleStatusToggle(
                              status
                            )
                          }
                          className={`min-h-[135px] p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center ${
                            isActive
                              ? `${style.card} border-current shadow-lg scale-[1.02]`
                              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                          } ${
                            !isClockedIn ||
                            statusActionLoading
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer"
                          }`}
                        >
                          <span
                            className={`h-10 w-10 rounded-full flex items-center justify-center mb-3 ${
                              isActive
                                ? style.badge
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <span
                              className={`h-3 w-3 rounded-full ${
                                style.dot
                              }`}
                            />
                          </span>
 
                          {statusActionLoading &&
                            isActive && (
                              <Loader2
                                size={18}
                                className="animate-spin mb-1"
                              />
                            )}
 
                          <div className="font-bold text-sm">
                            {getStatusLabel(
                              status
                            )}
                          </div>
 
                          {!isClockedIn && (
                            <div className="text-[10px] text-slate-400 mt-2">
                              Clock in first
                            </div>
                          )}
 
                          {isClockedIn &&
                            !isActive && (
                              <div className="text-[10px] text-slate-400 mt-2">
                                Click to start
                              </div>
                            )}
 
                          {isActive &&
                            status !==
                              "Working" &&
                            statusStartedAt && (
                              <>
                                <div
                                  className={`text-xs font-bold mt-2 ${
                                    isStatusOverLimit(
                                      status,
                                      statusStartedAt,
                                      now
                                    )
                                      ? "text-red-600"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {formatStatusTimer(
                                    status,
                                    statusStartedAt,
                                    now
                                  )}
                                </div>
 
                                {(status ===
                                  "Break" ||
                                  status ===
                                    "Lunch") && (
                                  <div
                                    className={`text-[10px] mt-1 ${
                                      isStatusOverLimit(
                                        status,
                                        statusStartedAt,
                                        now
                                      )
                                        ? "text-red-600 font-bold"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    Limit:{" "}
                                    {getStatusLimitMinutes(
                                      status
                                    )}{" "}
                                    Min
                                  </div>
                                )}
                              </>
                            )}
 
                          {isActive &&
                            status ===
                              "Working" && (
                              <div className="text-[10px] text-emerald-600 font-bold mt-2">
                                current status
                              </div>
                            )}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
 
              {/* CURRENT STATUS */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-black text-slate-900 mb-5">
                  My Current Status
                </h3>
 
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-500">
                      status
                    </div>
 
                    <div className="text-2xl font-black text-slate-900 mt-2">
                      {
                        getStatusLabel(
                          currentStatus
                        )
                      }
                    </div>
                  </div>
 
                  <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-violet-500">
                      status Duration
                    </div>
 
                    <div className="text-2xl font-black text-slate-900 mt-2">
                      {
                        statusDuration
                      }
                    </div>
                  </div>
 
                  <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                      Overall Clock
                    </div>
 
                    <div className="text-2xl font-black text-slate-900 mt-2">
                      {
                        formatShortDuration(overallDuration)
                      }
                    </div>
                  </div>
                </div>
              </div>
 
              {/* TEAM STATUS */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      Team Status
                    </h3>
 
                    <p className="text-sm text-slate-500 mt-1">
                      Live workforce activity.
                    </p>
                  </div>
 
                  {loadingEmployees && (
                    <Loader2
                      size={20}
                      className="animate-spin text-blue-600"
                    />
                  )}
                </div>
 
                {employees.length ===
                0 ? (
                  <div className="text-slate-500 rounded-xl bg-slate-50 p-6 text-center">
                    No employees found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {employees.map(
                      (
                        employee
                      ) => {
                        const employeeDuration =
                          employee.clockInAt
                            ? getEmployeeDuration(
                                employee,
                                now
                              )
                            : "0h 0m";
 
                        const style =
                          getStatusClasses(
                            employee.status
                          );
 
                        const needsAttention =
                          isStatusOverLimit(
                            employee.status,
                            employee.statusStartedAt,
                            now
                          ) ||
                          (!!employee.clockInAt &&
                            now -
                              new Date(
                                employee.clockInAt
                              ).getTime() >
                              8 *
                                60 *
                                60 *
                                1000);
 
                        return (
                          <div
                            key={
                              employee.id
                            }
                            className={`rounded-2xl border p-4 transition hover:shadow-md ${
                              needsAttention
                                ? "border-red-200 bg-red-50/50"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white flex items-center justify-center font-black shrink-0">
                                  {
                                    employee.initials
                                  }
                                </div>
 
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 truncate">
                                    {
                                      employee.name
                                    }
                                  </div>
 
                                  <div className="text-xs text-slate-500">
                                    {
                                      employee.role
                                    }
                                  </div>
                                </div>
                              </div>
 
                              <div
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap ${style.badge}`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${style.dot}`}
                                />
 
                                {
                                  getStatusLabel(
                                    employee.status
                                  )
                                }
                              </div>
                            </div>
 
                            <div className="grid grid-cols-2 gap-3 mt-4">
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                  Overall
                                </div>
 
                                <div className="text-sm font-black text-slate-700 mt-1">
                                  {
                                    employeeDuration
                                  }
                                </div>
                              </div>
 
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                  Clock In
                                </div>
 
                                <div className="text-sm font-black text-slate-700 mt-1">
                                  {
                                    employee.clockIn
                                  }
                                </div>
                              </div>
                            </div>
 
                            {employee.statusStartedAt &&
                              employee.status !==
                                "Working" &&
                              employee.status !==
                                "Off Duty" && (
                                <div
                                  className={`text-xs mt-3 font-semibold ${
                                    isStatusOverLimit(
                                      employee.status,
                                      employee.statusStartedAt,
                                      now
                                    )
                                      ? "text-red-600"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {
                                    getStatusLabel(
                                      employee.status
                                    )
                                  }
                                  :{" "}
                                  {formatStatusTimer(
                                    employee.status,
                                    employee.statusStartedAt,
                                    now
                                  )}
                                </div>
                              )}
 
                            {profile?.role ===
                              "Administrator" &&
                              needsAttention && (
                                <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-red-600">
                                  <AlertTriangle
                                    size={
                                      13
                                    }
                                  />
                                  Attention required
                                </div>
                              )}
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
 
          {/* SCHEDULES */}
          {activeTab ===
            "Schedules" && (
            <div className="space-y-6">
 
              <EmployeeCommentSection
                tabName="Schedules"
                profile={profile}
                tabComments={tabComments}
                setTabComments={setTabComments}
                tabNoteDraft={tabNoteDraft}
                setTabNoteDraft={setTabNoteDraft}
              />
              <div className="rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-rose-600 p-6 text-white shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                  <div>
                    <div className="inline-flex items-center gap-2 text-orange-100 text-xs font-bold uppercase tracking-wider">
                      <CalendarDays
                        size={15}
                      />
                      Workforce Planning
                    </div>
 
                    <h3 className="text-2xl sm:text-3xl font-black mt-2">
                      schedule Calendar
                    </h3>
 
                    <p className="text-orange-100 mt-1">
                      {canViewAllSchedules
                        ? "Viewing team schedules."
                        : "Showing your personal schedule only."}
                    </p>
                  </div>
 
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={
                        goToday
                      }
                      className="px-3 py-2 bg-white/15 border border-white/20 rounded-xl hover:bg-white/25 font-semibold"
                    >
                      Today
                    </button>
 
                    <button
                      type="button"
                      onClick={
                        goPreviousMonth
                      }
                      className="p-2 bg-white/15 border border-white/20 rounded-xl hover:bg-white/25"
                    >
                      <ChevronLeft
                        size={20}
                      />
                    </button>
 
                    <button
                      type="button"
                      onClick={
                        goNextMonth
                      }
                      className="p-2 bg-white/15 border border-white/20 rounded-xl hover:bg-white/25"
                    >
                      <ChevronRight
                        size={20}
                      />
                    </button>
                  </div>
                </div>
 
                <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h4 className="text-3xl font-black">
                    {
                      getMonthName(
                        calendarMonth
                      )
                    }
                  </h4>
 
                  <div className="flex items-center gap-3">
                    {canEditSchedule && (
                      <button
                        type="button"
                        onClick={() =>
                          setScheduleEditMode(
                            (value) =>
                              !value
                          )
                        }
                        className={`flex items-center gap-3 rounded-full border px-3 py-2 text-sm font-bold transition ${
                          scheduleEditMode
                            ? "border-white bg-white text-orange-700"
                            : "border-white/30 bg-white/10 text-white"
                        }`}
                        aria-pressed={
                          scheduleEditMode
                        }
                      >
                        <span
                          className={`relative h-6 w-11 rounded-full transition ${
                            scheduleEditMode
                              ? "bg-orange-500"
                              : "bg-white/30"
                          }`}
                        >
                          <span
                            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                              scheduleEditMode
                                ? "left-6"
                                : "left-1"
                            }`}
                          />
                        </span>
 
                        Edit schedules
                      </button>
                    )}
 
                    {canCreateSchedule && (
                      <button
                        type="button"
                        onClick={() =>
                          openCreateSchedule()
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-white text-orange-700 rounded-xl hover:bg-orange-50 font-bold shadow-lg"
                      >
                        <Plus
                          size={18}
                        />
                        Add Schedule
                      </button>
                    )}
                  </div>
                </div>
              </div>
 
              {scheduleError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl">
                  <div className="font-bold">
                    schedule error
                  </div>
 
                  <div className="text-sm mt-1 break-words">
                    {
                      scheduleError
                    }
                  </div>
                </div>
              )}
 
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loadingSchedules ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2
                      size={32}
                      className="animate-spin text-orange-500"
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-7 border-b bg-slate-50">
                      {[
                        "Sun",
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                      ].map(
                        (
                          Day
                        ) => (
                          <div
                            key={
                              Day
                            }
                            className="p-3 text-center text-xs font-black uppercase tracking-wider text-slate-500 border-r last:border-r-0"
                          >
                            {
                              Day
                            }
                          </div>
                        )
                      )}
                    </div>
 
                    <div className="grid grid-cols-7">
                      {calendarDays.map(
                        (
                          calendarDate,
                          index
                        ) => {
                          const dateKey =
                            getDateKey(
                              calendarDate
                            );
 
                          const daySchedules =
                            schedulesByDate.get(
                              dateKey
                            ) ??
                            [];
 
                          const isCurrentMonth =
                            calendarDate.getMonth() ===
                            calendarMonth.getMonth();
 
                          const isToday =
                            dateKey ===
                            getDateKey(
                              new Date()
                            );
 
                          const isSelected =
                            selectedDate ===
                            dateKey;
 
                          return (
                            <button
                              key={`${dateKey}-${index}`}
                              type="button"
                              onClick={() =>
                                setSelectedDate(
                                  dateKey
                                )
                              }
                              className={`min-h-[125px] text-left border-r border-b p-2 transition ${
                                isCurrentMonth
                                  ? "bg-white"
                                  : "bg-slate-50 text-slate-400"
                              } ${
                                isSelected
                                  ? "ring-2 ring-inset ring-orange-500 bg-orange-50"
                                  : ""
                              } hover:bg-orange-50`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-sm font-black ${
                                    isToday
                                      ? "bg-gradient-to-br from-orange-500 to-rose-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-md"
                                      : ""
                                  }`}
                                >
                                  {
                                    calendarDate.getDate()
                                  }
                                </span>
 
                                {daySchedules.length >
                                  0 && (
                                  <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                    {
                                      daySchedules.length
                                    }
                                  </span>
                                )}
                              </div>
 
                              <div className="mt-2 space-y-1">
                                {daySchedules
                                  .slice(
                                    0,
                                    3
                                  )
                                  .map(
                                    (
                                      schedule
                                    ) => (
                                      <div
                                        key={
                                          schedule.id
                                        }
                                        className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-lg px-2 py-1.5"
                                      >
                                        <div className="text-xs font-bold text-orange-800 truncate">
                                          {
                                            canViewAllSchedules
                                              ? schedule.employee_name
                                              : schedule.shift_type
                                          }
                                        </div>
 
                                        <div className="text-[11px] text-orange-600 font-medium">
                                          {
                                            formatScheduleTime(
                                              schedule.start_time
                                            )
                                          }
                                          {" - "}
                                          {
                                            formatScheduleTime(
                                              schedule.end_time
                                            )
                                          }
                                        </div>
                                      </div>
                                    )
                                  )}
 
                                {daySchedules.length >
                                  3 && (
                                  <div className="text-[10px] font-bold text-slate-500">
                                    +
                                    {
                                      daySchedules.length -
                                        3
                                    }{" "}
                                    More
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </>
                )}
              </div>
 
              {selectedDate && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">
                        {new Date(
                          `${selectedDate}T12:00:00`
                        ).toLocaleDateString(
                          undefined,
                          {
                            weekday:
                              "long",
                            month:
                              "long",
                            day:
                              "numeric",
                            year:
                              "numeric",
                          }
                        )}
                      </h3>
 
                      <p className="text-sm text-slate-500 mt-1">
                        {
                          selectedDateSchedules.length
                        }{" "}
                        schedule
                        {selectedDateSchedules.length ===
                        1
                          ? ""
                          : "s"}
                      </p>
                    </div>
 
                    {canCreateSchedule && (
                      <button
                        type="button"
                        onClick={() =>
                          openCreateSchedule(
                            selectedDate
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl hover:shadow-lg font-bold"
                      >
                        <Plus
                          size={18}
                        />
                        Add
                      </button>
                    )}
                  </div>
 
                  {selectedDateSchedules.length ===
                  0 ? (
                    <div className="border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500 bg-slate-50">
                      No schedules for this
                      Date.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDateSchedules.map(
                        (
                          schedule
                        ) => (
                          <div
                            key={
                              schedule.id
                            }
                            className="border border-slate-200 rounded-2xl p-4 hover:shadow-md transition"
                          >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div>
                                <div className="font-black text-lg text-slate-900">
                                  {
                                    schedule.employee_name
                                  }
                                </div>
 
                                <div className="text-orange-600 font-black mt-1">
                                  {
                                    formatScheduleTime(
                                      schedule.start_time
                                    )
                                  }
                                  {" - "}
                                  {
                                    formatScheduleTime(
                                      schedule.end_time
                                    )
                                  }
                                </div>
 
                                {schedule.shift_type ===
                                  "Regular" &&
                                  getShiftMinutes(
                                    schedule.start_time,
                                    schedule.end_time
                                  ) >
                                    8 *
                                      60 && (
                                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                                      <AlertTriangle
                                        size={
                                          13
                                        }
                                      />
                                      Shift exceeds 8 hours
                                    </div>
                                  )}
 
                                <div className="text-sm text-slate-500 mt-1">
                                  {
                                    schedule.shift_type
                                  }
                                  {" • "}
                                  Break:{" "}
                                  {
                                    schedule.break_minutes
                                  }{" "}
                                  Min
                                </div>
 
                                {schedule.notes && (
                                  <div className="text-sm text-slate-600 mt-2">
                                    {
                                      schedule.notes
                                    }
                                  </div>
                                )}
                              </div>
 
                              {canEditSchedule &&
                                scheduleEditMode && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openEditSchedule(
                                          schedule
                                        )
                                      }
                                      className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 font-semibold"
                                    >
                                      <Pencil
                                        size={
                                          16
                                        }
                                      />
                                      Edit
                                    </button>
 
                                    {canDeleteSchedule && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteSchedule(
                                            schedule
                                          )
                                        }
                                        disabled={
                                          deletingScheduleId ===
                                          schedule.id
                                        }
                                        className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-semibold"
                                      >
                                        {deletingScheduleId ===
                                        schedule.id ? (
                                          <Loader2
                                            size={
                                              16
                                            }
                                            className="animate-spin"
                                          />
                                        ) : (
                                          <Trash2
                                            size={
                                              16
                                            }
                                          />
                                        )}
 
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
 
              {!canEditSchedule && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800 flex items-center gap-3">
                  <ShieldCheck
                    size={20}
                  />
 
                  <span>
                    Your schedule is
                    View-only. You
                    Cannot create or
                    Edit schedules.
                  </span>
                </div>
              )}
 
              {profile?.role ===
                "Supervisor" && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-600">
                  Supervisors can edit
                  existing schedules.
                  schedule creation and
                  Deletion are restricted
                  To Administrators.
                </div>
              )}
            </div>
          )}
 
          {/* EOD REPORT */}
          {activeTab ===
            "EOD Report" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-violet-600 via-purple-700 to-fuchsia-700 p-6 text-white shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="text-violet-200 text-xs font-bold uppercase tracking-wider">
                      Workforce Analytics
                    </div>
 
                    <h3 className="text-2xl sm:text-3xl font-black mt-2">
                      end of Day Report
                    </h3>
 
                    <p className="text-violet-200 mt-1">
                      attendance, status and
                      schedule adherence.
                    </p>
                  </div>
 
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={
                        eodDate
                      }
                      onChange={(
                        event
                      ) =>
                        setEodDate(
                          event
                            .target
                            .value
                        )
                      }
                      className="border border-white/20 bg-white/10 text-white rounded-xl px-3 py-2 outline-none"
                    />
 
                    <button
                      type="button"
                      onClick={() =>
                        loadEod(
                          eodDate
                        )
                      }
                      disabled={
                        loadingEod
                      }
                      className="flex items-center gap-2 border border-white/20 bg-white/10 rounded-xl px-3 py-2 hover:bg-white/20 font-semibold"
                    >
                      <RefreshCw
                        size={
                          15
                        }
                        className={
                          loadingEod
                            ? "animate-spin"
                            : ""
                        }
                      />
                      refresh
                    </button>
                  </div>
                </div>
              </div>
 
              {eodError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl">
                  {
                    eodError
                  }
                </div>
              )}
 
              {(() => {
                const names =
                  new Map(
                    employees.map(
                      (
                        employee
                      ) => [
                        employee.id,
                        employee.name,
                      ]
                    )
                  );
 
                const scheduledToday =
                  schedules.filter(
                    (
                      schedule
                    ) =>
                      schedule.schedule_date ===
                      eodDate
                  );
 
                const scheduledIds =
                  new Set(
                    scheduledToday.map(
                      (
                        schedule
                      ) =>
                        schedule.user_id
                    )
                  );
 
                const uniqueWorkedIds =
                  new Set(
                    eodRecords.map(
                      (
                        record
                      ) =>
                        record.user_id
                    )
                  );
 
                const worked =
                  eodRecords.length;
 
                const scheduled =
                  scheduledToday.length;
 
                const presentScheduled =
                  scheduledToday.filter(
                    (
                      schedule
                    ) =>
                      uniqueWorkedIds.has(
                        schedule.user_id
                      )
                  ).length;
 
                const adherence =
                  scheduled ===
                  0
                    ? 0
                    : Math.round(
                        (presentScheduled /
                          scheduled) *
                          100
                      );
 
                const totalMs =
                  eodRecords.reduce(
                    (
                      Sum,
                      record
                    ) => {
                      const end =
                        record.clock_out
                          ? new Date(
                              record.clock_out
                            ).getTime()
                          : now;
 
                      return (
                        Sum +
                        Math.max(
                          0,
                          end -
                            new Date(
                              record.clock_in
                            ).getTime()
                        )
                      );
                    },
                    0
                  );
 
                const statusCounts =
                  statusOptions.map(
                    (
                      status
                    ) => ({
                      status,
                      count:
                        eodRecords.filter(
                          (
                            record
                          ) =>
                            record.status ===
                            status
                        ).length,
                    })
                  );
 
                return (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      {[
                        [
                          "Employees clocked in",
                          worked,
                          "from-red-600 to-red-700",
                        ],
                        [
                          "Scheduled",
                          scheduled,
                          "from-orange-500 to-amber-500",
                        ],
                        [
                          "Schedule adherence",
                          `${adherence}%`,
                          "from-emerald-500 to-teal-600",
                        ],
                        [
                          "Attendance records",
                          eodRecords.length,
                          "from-violet-500 to-purple-600",
                        ],
                        [
                          "Gross clock time",
                          formatShortDuration(
                            totalMs
                          ),
                          "from-pink-500 to-rose-600",
                        ],
                      ].map(
                        ([
                          label,
                          value,
                          gradient,
                        ]) => (
                          <div
                            key={
                              label
                            }
                            className="bg-white rounded-2xl border border-slate-200 p-5 relative overflow-hidden shadow-sm"
                          >
                            <div
                              className={`absolute left-0 top-0 right-0 h-1 bg-gradient-to-r ${gradient}`}
                            />
 
                            <div className="text-sm text-slate-500">
                              {
                                label
                              }
                            </div>
 
                            <div className="text-2xl font-black mt-2 text-slate-900">
                              {
                                value
                              }
                            </div>
                          </div>
                        )
                      )}
                    </div>
 
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h3 className="text-lg font-black mb-4">
                          attendance adherence
                        </h3>
 
                        {loadingEod ? (
                          <div className="py-10 text-center text-slate-500">
                            loading...
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {eodRecords.length ===
                              0 && (
                              <div className="text-sm text-slate-500">
                                No attendance
                                Records for
                                This date.
                              </div>
                            )}
 
                            {eodRecords.map(
                              (
                                record
                              ) => {
                                const schedule =
                                  scheduledToday.find(
                                    (
                                      item
                                    ) =>
                                      item.user_id ===
                                      record.user_id
                                  );
 
                                const scheduledStart =
                                  schedule
                                    ? schedule.start_time.slice(
                                        0,
                                        5
                                      )
                                    : null;
 
                                const actualStart =
                                  formatClockTime(
                                    record.clock_in
                                  );
 
                                const late =
                                  scheduledStart &&
                                  actualStart !==
                                    "—" &&
                                  actualStart >
                                    scheduledStart;
 
                                return (
                                  <div
                                    key={
                                      record.id
                                    }
                                    className="flex items-center justify-between border-b border-slate-100 last:border-b-0 pb-3 last:pb-0"
                                  >
                                    <div>
                                      <div className="font-bold">
                                        {
                                          names.get(
                                            record.user_id
                                          ) ??
                                          "Unknown employee"
                                        }
                                      </div>
 
                                      <div className="text-xs text-slate-500">
                                        {
                                          actualStart
                                        }
                                        {scheduledStart
                                          ? ` • scheduled ${scheduledStart}`
                                          : ""}
                                      </div>
                                    </div>
 
                                    <div className="text-right">
                                      <div
                                        className={`text-sm font-black ${
                                          late
                                            ? "text-red-600"
                                            : "text-emerald-600"
                                        }`}
                                      >
                                        {late
                                          ? "Late"
                                          : "On time / no schedule"}
                                      </div>
 
                                      <div className="text-xs text-slate-500">
                                        {getStatusLabel(
                                          record.status
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>
 
                      <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h3 className="text-lg font-black mb-4">
                          Final status mix
                        </h3>
 
                        <div className="space-y-4">
                          {statusCounts.map(
                            ({
                              status,
                              count,
                            }) => {
                              const percentage =
                                worked
                                  ? Math.min(
                                      100,
                                      (count /
                                        worked) *
                                        100
                                    )
                                  : 0;
 
                              const style =
                                getStatusClasses(
                                  status
                                );
 
                              return (
                                <div
                                  key={
                                    status
                                  }
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                      <span
                                        className={`h-2.5 w-2.5 rounded-full ${style.dot}`}
                                      />
 
                                      {getStatusLabel(
                                        status
                                      )}
                                    </div>
 
                                    <span className="text-sm font-black">
                                      {
                                        count
                                      }
                                    </span>
                                  </div>
 
                                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${style.dot}`}
                                      style={{
                                        width: `${percentage}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
 
                    {scheduled > 0 &&
                      presentScheduled <
                        scheduled && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900">
                          <div className="flex items-center gap-2 font-bold">
                            <AlertTriangle
                              size={
                                18
                              }
                            />
                            attendance exceptions
                          </div>
 
                          <div className="text-sm mt-1">
                            {scheduled -
                              presentScheduled}{" "}
                            scheduled
                            employee(s)
                            have no
                            clock-in
                            record for{" "}
                            {
                              eodDate
                            }
                            .
                          </div>
 
                          <div className="text-xs mt-2">
                            scheduled
                            employees:{" "}
                            {
                              scheduledIds.size
                            }
                          </div>
                        </div>
                      )}
                  </>
                );
              })()}
            </div>
          )}
 
 
          {/* COMMAND CENTER */}
          {activeTab === "Command Center" && (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 p-6 sm:p-8 text-white shadow-xl">
                <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wider">
                      <Workflow size={15} />
                      Operations Command Center
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-black mt-4">
                      Everything happening in one place
                    </h2>
                    <p className="text-indigo-100 mt-2 max-w-2xl">
                      Workforce, tickets, field operations and HR support are
                      connected here without changing your existing workforce
                      controls.
                    </p>
                  </div>
 
                  <button
                    type="button"
                    onClick={() => setFeatureSettingsOpen((value) => !value)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 border border-white/20 px-5 py-3 font-black hover:bg-white/20 transition"
                  >
                    <Settings size={18} />
                    Controls
                  </button>
                </div>
              </div>
 
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  ["Live Workforce", employees.filter((e) => e.status !== "Off Duty").length, "from-emerald-500 to-teal-600"],
                  ["Open Tickets", ticketMetrics.open, "from-red-500 to-orange-600"],
                  ["Critical", ticketMetrics.critical, "from-rose-600 to-red-700"],
                  ["Field Active", fieldWorkOrders.filter((w) => w.status !== "Completed").length, "from-sky-500 to-cyan-600"],
                ].map(([label, value, gradient]) => (
                  <div
                    key={String(label)}
                    className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
                  >
                    <div className={`absolute left-0 top-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
                    <div className="text-sm font-semibold text-slate-500">{label}</div>
                    <div className="text-3xl font-black text-slate-900 mt-2">{value}</div>
                  </div>
                ))}
              </div>
 
              {featureSettingsOpen && (
                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        Operational Controls
                      </h3>
                      <p className="text-sm text-slate-500">
                        These switches are local controls for the new modules and
                        do not alter your existing attendance or schedule logic.
                      </p>
                    </div>
                    <Settings size={20} className="text-slate-400" />
                  </div>
 
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                    {[
                      ["ticketing", "Ticketing", "Enable Service Hub workflows"],
                      ["slaMonitoring", "SLA Monitoring", "Track ticket response windows"],
                      ["autoEscalation", "Auto Escalation", "Flag overdue operational work"],
                      ["fieldOperations", "Field Operations", "Enable technician workflow"],
                      ["hrSupport", "HR Support", "Enable HR case workflow"],
                    ].map(([key, label, note]) => {
                      const enabled =
                        featureControls[key as keyof typeof featureControls];
 
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            toggleFeature(
                              key as keyof typeof featureControls
                            )
                          }
                          className={`rounded-2xl border p-4 text-left transition ${
                            enabled
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={`relative inline-flex h-7 w-12 rounded-full transition ${
                                enabled ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                            >
                              <span
                                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                                  enabled ? "left-6" : "left-1"
                                }`}
                              />
                            </span>
                            <span
                              className={`text-xs font-black ${
                                enabled ? "text-emerald-700" : "text-slate-500"
                              }`}
                            >
                              {enabled ? "ON" : "OFF"}
                            </span>
                          </div>
                          <div className="font-black text-slate-900 mt-3">
                            {label}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{note}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
 
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-lg font-black">Live Workforce</h3>
                      <p className="text-sm text-slate-500">
                        Current employee states and timers.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("Time & Attendance")}
                      className="text-sm font-black text-blue-700 hover:text-blue-900"
                    >
                      Open Attendance
                    </button>
                  </div>
 
                  <div className="space-y-2">
                    {employees.slice(0, 8).map((employee) => {
                      const style = getStatusClasses(employee.status);
                      return (
                        <div
                          key={employee.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                              {employee.initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold truncate">{employee.name}</div>
                              <div className="text-xs text-slate-500">
                                {employee.role}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-bold ${style.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                              {getStatusLabel(employee.status)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              {formatStatusTimer(
                                employee.status,
                                employee.statusStartedAt,
                                now
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
 
                    {employees.length === 0 && (
                      <div className="py-8 text-center text-sm text-slate-500">
                        No workforce records loaded yet.
                      </div>
                    )}
                  </div>
                </div>
 
                <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <CircleAlert className="text-red-600" size={20} />
                    <div>
                      <h3 className="text-lg font-black">Attention Queue</h3>
                      <p className="text-sm text-slate-500">
                        Items requiring management attention.
                      </p>
                    </div>
                  </div>
 
                  <div className="space-y-3">
                    {adminAlerts.slice(0, 4).map((employee) => (
                      <button
                        type="button"
                        key={employee.id}
                        onClick={() => setActiveTab("Time & Attendance")}
                        className="w-full text-left rounded-xl border border-red-100 bg-red-50 p-4 hover:bg-red-100 transition"
                      >
                        <div className="font-black text-red-800">
                          {employee.name}
                        </div>
                        <div className="text-sm text-red-700 mt-1">
                          {getStatusLabel(employee.status)} timer or shift limit
                          requires attention.
                        </div>
                      </button>
                    ))}
 
                    {tickets
                      .filter((ticket) => isTicketSlaBreached(ticket, now))
                      .slice(0, 4)
                      .map((ticket) => (
                        <button
                          type="button"
                          key={ticket.id}
                          onClick={() => {
                            setSelectedTicketId(ticket.id);
                            setActiveTab("Service Hub");
                          }}
                          className="w-full text-left rounded-xl border border-orange-100 bg-orange-50 p-4 hover:bg-orange-100 transition"
                        >
                          <div className="font-black text-orange-800">
                            {formatTicketNumber(ticket.id)} • SLA breached
                          </div>
                          <div className="text-sm text-orange-700 mt-1">
                            {ticket.title}
                          </div>
                        </button>
                      ))}
 
                    {adminAlerts.length === 0 &&
                      tickets.filter((ticket) =>
                        isTicketSlaBreached(ticket, now)
                      ).length === 0 && (
                        <div className="py-10 text-center">
                          <CheckCircle2
                            size={32}
                            className="mx-auto text-emerald-500"
                          />
                          <div className="font-black text-slate-800 mt-3">
                            No urgent items
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            The command center is clear.
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
 
              <OperationsControlPanel
                profile={profile!}
                employees={employees}
                schedules={schedules}
                tickets={tickets}
                fieldWorkOrders={fieldWorkOrders}
                hrCases={hrCases}
                now={now}
                onNavigate={(tab) => setActiveTab(tab)}
                onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
              />
 
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ["Create Ticket", Ticket, () => setTicketModalOpen(true), "from-red-500 to-orange-600"],
                  ["Field Work Order", Wrench, () => setFieldOrderModalOpen(true), "from-sky-500 to-cyan-600"],
                  ["HR Case", UserCog, () => setHrCaseModalOpen(true), "from-rose-500 to-pink-600"],
                  ["Performance", BarChart3, () => setActiveTab("Performance"), "from-cyan-500 to-indigo-600"],
                ].map(([label, Icon, action, gradient]) => {
                  const ActionIcon = Icon as typeof Activity;
                  return (
                    <button
                      key={String(label)}
                      type="button"
                      onClick={action as () => void}
                      className={`rounded-2xl bg-gradient-to-br ${gradient} p-4 text-white text-left shadow-sm hover:shadow-lg transition`}
                    >
                      <ActionIcon size={22} />
                      <div className="font-black mt-4">{label}</div>
                    </button>
                  );
                })}
              </div>
 
              {(() => {
                const myCalls = callLogs.filter((c) => c.agent_id === profile?.id);
                const myConnected = myCalls.filter((c) => c.outcome === "Connected").length;
                const myConnectRate =
                  myCalls.length > 0 ? Math.round((myConnected / myCalls.length) * 100) : null;
 
                return (
                  <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h3 className="text-lg font-black flex items-center gap-2">
                        <PhoneCall size={18} /> Log a call
                      </h3>
                      {myConnectRate !== null && (
                        <span className="text-xs font-bold text-slate-500">
                          Your connect rate: {myConnectRate}% ({myConnected}/{myCalls.length})
                        </span>
                      )}
                    </div>
 
                    <div className="grid sm:grid-cols-2 gap-3 mt-4">
                      <input
                        value={callLogForm.contact_name}
                        onChange={(e) =>
                          setCallLogForm((f) => ({ ...f, contact_name: e.target.value }))
                        }
                        placeholder="Contact name"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <input
                        value={callLogForm.phone}
                        onChange={(e) => setCallLogForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone number"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <select
                        value={callLogForm.outcome}
                        onChange={(e) =>
                          setCallLogForm((f) => ({
                            ...f,
                            outcome: e.target.value as CallLog["outcome"],
                          }))
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option>Connected</option>
                        <option>No Answer</option>
                        <option>Voicemail</option>
                        <option>Busy</option>
                        <option>Wrong Number</option>
                      </select>
                      <input
                        value={callLogForm.notes}
                        onChange={(e) => setCallLogForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Notes (optional)"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex justify-end mt-3">
                      <button
                        type="button"
                        onClick={() => void addCallLog()}
                        className="rounded-xl bg-blue-700 text-white px-4 py-2 text-sm font-bold hover:bg-blue-800"
                      >
                        Save call
                      </button>
                    </div>
 
                    {myCalls.length > 0 && (
                      <div className="mt-5 space-y-1.5 max-h-56 overflow-y-auto">
                        <div className="text-xs font-black uppercase text-slate-400">
                          Your recent calls
                        </div>
                        {myCalls.slice(0, 8).map((call) => (
                          <div
                            key={call.id}
                            className="flex items-center justify-between text-sm border-b border-slate-100 py-1.5"
                          >
                            <span className="font-semibold text-slate-700">
                              {call.contact_name}
                            </span>
                            <span
                              className={`text-xs font-bold ${
                                call.outcome === "Connected"
                                  ? "text-emerald-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {call.outcome}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
 
          {/* SERVICE HUB / TICKETS */}
          {activeTab === "Service Hub" && (
            <div className="space-y-6">
 
              <EmployeeCommentSection
                tabName="Service Hub"
                profile={profile}
                tabComments={tabComments}
                setTabComments={setTabComments}
                tabNoteDraft={tabNoteDraft}
                setTabNoteDraft={setTabNoteDraft}
              />
              {!featureControls.ticketing ? (
                <div className="rounded-3xl bg-white border border-slate-200 p-8 text-center shadow-sm">
                  <Ticket size={44} className="mx-auto text-slate-400" />
                  <h3 className="text-2xl font-black mt-4">
                    Ticketing is switched off
                  </h3>
                  <p className="text-slate-500 mt-2">
                    Turn Ticketing on from Command Center → Controls.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("Command Center")}
                    className="mt-5 rounded-xl bg-slate-900 text-white px-5 py-3 font-black"
                  >
                    Open Controls
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-orange-600 to-amber-500 p-6 sm:p-8 text-white shadow-xl">
                    <div className="relative flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                      <div>
                        <div className="inline-flex items-center gap-2 text-red-100 text-xs font-black uppercase tracking-wider">
                          <Headphones size={16} />
                          WorkforceIQ Service Hub
                        </div>
                        <h3 className="text-3xl font-black mt-2">
                          Tickets, requests & incidents
                        </h3>
                        <p className="text-red-100 mt-1 max-w-2xl">
                          A workforce-specific service desk for operations,
                          HR, field service, parts, shipping and support.
                        </p>
                      </div>
 
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTicketForm((current) => ({
                              ...current,
                              type: "Call",
                              title: "",
                            }));
                            setTicketModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-white text-red-700 px-4 py-3 font-black shadow-sm hover:bg-red-50"
                        >
                          <PhoneCall size={17} />
                          Log Call
                        </button>
                        <button
                          type="button"
                          onClick={() => setTicketModalOpen(true)}
                          className="inline-flex items-center gap-2 rounded-xl bg-white/15 border border-white/20 px-4 py-3 font-black hover:bg-white/20"
                        >
                          <Ticket size={17} />
                          New Ticket
                        </button>
                      </div>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
                    {[
                      ["All", ticketMetrics.total],
                      ["Open", ticketMetrics.open],
                      ["Critical", ticketMetrics.critical],
                      ["Waiting", ticketMetrics.waiting],
                      ["Resolved", ticketMetrics.resolved],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
                      >
                        <div className="text-sm text-slate-500 font-semibold">
                          {label}
                        </div>
                        <div className="text-3xl font-black text-slate-900 mt-1">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
 
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={ticketSearch}
                        onChange={(event) =>
                          setTicketSearch(event.target.value)
                        }
                        placeholder="Search ticket, customer, employee, status..."
                        className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setTicketModalOpen(true)}
                      className="rounded-xl bg-slate-900 text-white px-5 py-3 font-black hover:bg-slate-800"
                    >
                      + New Ticket
                    </button>
                  </div>
 
                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                    <div className="xl:col-span-3 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-slate-100">
                        <h3 className="font-black text-lg">Ticket Queue</h3>
 
                        <div className="flex flex-wrap gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => setTicketStatusFilter("All")}
                            className={`rounded-xl border px-3 py-2 text-xs font-black ${
                              ticketStatusFilter === "All"
                                ? "bg-orange-600 text-white border-orange-600"
                                : "bg-white text-slate-600 border-slate-200"
                            }`}
                          >
                            All ({tickets.filter((t) => t.department === "Service Hub").length})
                          </button>
                          {ticketStatusBins.map(({ status, count }) => (
                            <button
                              type="button"
                              key={status}
                              onClick={() => setTicketStatusFilter(status)}
                              className={`rounded-xl border px-3 py-2 text-xs font-black ${
                                ticketStatusFilter === status
                                  ? "bg-orange-600 text-white border-orange-600"
                                  : "bg-white text-slate-600 border-slate-200"
                              }`}
                            >
                              {status} ({count})
                            </button>
                          ))}
                        </div>
                      </div>
 
                      <div className="divide-y divide-slate-100">
                        {filteredTickets.map((ticket) => {
                          const selected =
                            selectedTicketId === ticket.id;
                          const breached =
                            featureControls.slaMonitoring &&
                            isTicketSlaBreached(ticket, now);
 
                          return (
                            <button
                              type="button"
                              key={ticket.id}
                              onClick={() => setSelectedTicketId(ticket.id)}
                              className={`w-full text-left p-4 transition ${
                                selected
                                  ? "bg-red-50"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-black text-slate-500">
                                      {formatTicketNumber(ticket.id)}
                                    </span>
                                    <span
                                      className={`rounded-full border px-2 py-1 text-[11px] font-black ${getPriorityClasses(
                                        ticket.priority
                                      )}`}
                                    >
                                      {ticket.priority}
                                    </span>
                                    {breached && (
                                      <span className="rounded-full bg-red-600 text-white px-2 py-1 text-[11px] font-black">
                                        SLA BREACH
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-black text-slate-900 mt-2">
                                    {ticket.title}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {ticket.department} • {ticket.type} • {ticket.requester}
                                    {ticket.branch ? ` • ${ticket.branch}` : ""}
                                  </div>
                                </div>
 
                                <div className="text-right shrink-0">
                                  <div className="text-xs font-black text-slate-700">
                                    {ticket.status}
                                  </div>
                                  {featureControls.slaMonitoring && (
                                    <div
                                      className={`text-[11px] mt-1 ${
                                        breached
                                          ? "text-red-600"
                                          : "text-slate-500"
                                      }`}
                                    >
                                      SLA{" "}
                                      {formatSlaRemaining(ticket, now)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
 
                        {filteredTickets.length === 0 && (
                          <div className="p-10 text-center">
                            <Ticket
                              size={34}
                              className="mx-auto text-slate-300"
                            />
                            <div className="font-black text-slate-700 mt-3">
                              No tickets yet
                            </div>
                            <div className="text-sm text-slate-500 mt-1">
                              Create the first request or log a customer call.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
 
                    <div className="xl:col-span-2 rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                      {(() => {
                        const ticket = filteredTickets.find(
                          (item) => item.id === selectedTicketId
                        );
 
                        if (!ticket) {
                          return (
                            <div className="py-12 text-center">
                              <Ticket
                                size={40}
                                className="mx-auto text-slate-300"
                              />
                              <div className="font-black text-slate-700 mt-4">
                                Select a ticket
                              </div>
                              <div className="text-sm text-slate-500 mt-1">
                                Full case details will appear here.
                              </div>
                            </div>
                          );
                        }
 
                        return (
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-black text-slate-500">
                                  {formatTicketNumber(ticket.id)}
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mt-1">
                                  {ticket.title}
                                </h3>
                              </div>
                              <span
                                className={`rounded-full border px-2 py-1 text-xs font-black ${getPriorityClasses(
                                  ticket.priority
                                )}`}
                              >
                                {ticket.priority}
                              </span>
                            </div>
 
                            <div className="grid grid-cols-2 gap-3 mt-5">
                              {[
                                ["Department", ticket.department],
                                ["Type", ticket.type],
                                ["Status", ticket.status],
                                ["Requester", ticket.requester],
                                ["Branch", ticket.branch || "—"],
                                ["Component", ticket.component || "⚠ Missing"],
                                [
                                  "SLA",
                                  featureControls.slaMonitoring
                                    ? formatSlaRemaining(ticket, now)
                                    : "Off",
                                ],
                              ].map(([label, value]) => (
                                <div
                                  key={label}
                                  className="rounded-xl bg-slate-50 border border-slate-100 p-3"
                                >
                                  <div className="text-[11px] uppercase tracking-wider font-black text-slate-400">
                                    {label}
                                  </div>
                                  <div className="text-sm font-bold text-slate-800 mt-1 break-words">
                                    {value}
                                  </div>
                                </div>
                              ))}
                            </div>
 
                            <div className="mt-5">
                              <div className="text-sm font-black text-slate-700">
                                Assigned To
                              </div>
                              <div className="flex gap-2 mt-2">
                                <input
                                  key={`${ticket.id}-assignee-${ticket.assignee}`}
                                  defaultValue={ticket.assignee || ""}
                                  placeholder="Unassigned — type a name"
                                  onBlur={(event) => {
                                    const value = event.target.value;
                                    if (value !== (ticket.assignee || "")) {
                                      void updateTicketAssignee(ticket.id, value);
                                    }
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      (event.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="flex-1 rounded-xl border border-slate-200 px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
                                />
                                {ticket.assignee && (
                                  <button
                                    type="button"
                                    onClick={() => void updateTicketAssignee(ticket.id, "")}
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            </div>
 
                            <div className="mt-5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-black text-slate-700">
                                  Component
                                </div>
                                {!ticket.component?.trim() && (
                                  <span className="text-xs font-black text-red-600">Required before resolve/close</span>
                                )}
                              </div>
                              <input
                                value={ticket.component ?? ""}
                                onChange={(event) => updateTicketComponent(ticket.id, event.target.value)}
                                placeholder="Enter the affected component"
                                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
                              />
                            </div>
 
                            <div className="mt-5">
                              <div className="text-sm font-black text-slate-700">
                                Description / Notes
                              </div>
                              <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 whitespace-pre-wrap min-h-[100px]">
                                {ticket.notes || "No notes added."}
                              </div>
                            </div>
 
                            <div className="mt-5">
                              <div className="text-sm font-black text-slate-700 mb-2">
                                Workflow
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    "New",
                                    "Assigned",
                                    "In Progress",
                                    "Waiting",
                                    "Resolved",
                                    "Closed",
                                  ] as TicketStatus[]
                                ).map((status) => (
                                  <button
                                    type="button"
                                    key={status}
                                    onClick={() =>
                                      updateTicketStatus(
                                        ticket.id,
                                        status
                                      )
                                    }
                                    className={`rounded-xl px-3 py-2 text-xs font-black border transition ${
                                      ticket.status === status
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    }`}
                                  >
                                    {status}
                                  </button>
                                ))}
                              </div>
                            </div>
 
                            <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
                              <div className="px-4 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-red-50">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-black text-slate-800">Comment Stream</div>
                                    <div className="text-xs text-slate-500 mt-1">Permanent ticket history stored in Supabase</div>
                                  </div>
                                  <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-1 text-xs font-black">
                                    {ticketComments.length} {ticketComments.length === 1 ? "comment" : "comments"}
                                  </span>
                                </div>
                              </div>
 
                              <div className="max-h-[360px] overflow-y-auto p-4 space-y-3">
                                {commentsLoading ? (
                                  <div className="flex items-center gap-2 text-sm font-bold text-slate-500 py-4">
                                    <Loader2 size={16} className="animate-spin" /> Loading previous comments...
                                  </div>
                                ) : ticketComments.length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                    No comments found. A comment is compulsory for every new ticket.
                                  </div>
                                ) : (
                                  ticketComments.map((comment) => (
                                    <div key={comment.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="font-black text-slate-800 text-sm">{comment.authorName}</div>
                                        <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                                          {new Intl.DateTimeFormat([], { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.createdAt))}
                                        </div>
                                      </div>
                                      <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{comment.body}</div>
                                    </div>
                                  ))
                                )}
                              </div>
 
                              <div className="border-t border-slate-100 p-4 bg-slate-50">
                                <label className="text-sm font-black text-slate-700">Add Comment</label>
                                <textarea
                                  rows={3}
                                  value={commentDraft}
                                  onChange={(event) => setCommentDraft(event.target.value)}
                                  placeholder="Record the next update, troubleshooting step, customer response or resolution..."
                                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 resize-none outline-none focus:ring-2 focus:ring-red-500"
                                />
                                <div className="mt-2 flex justify-end">
                                  <button
                                    type="button"
                                    disabled={!commentDraft.trim() || commentSaving}
                                    onClick={() => void addTicketComment(ticket.id, commentDraft)}
                                    className="rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-black disabled:opacity-50 inline-flex items-center gap-2"
                                  >
                                    {commentSaving && <Loader2 size={15} className="animate-spin" />}
                                    Add Comment
                                  </button>
                                </div>
                              </div>
                            </div>
 
                            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                              <div className="flex items-center gap-2 font-black">
                                <PhoneCall size={17} />
                                Future voice-ready workflow
                              </div>
                              <p className="mt-1">
                                Calls can later create or update this same ticket,
                                preserving the case history instead of creating a
                                separate workflow.
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
 
          {/* FIELD OPERATIONS */}
          {activeTab === "Field Operations" && (
            <div className="space-y-6">
 
              <EmployeeCommentSection
                tabName="Field Operations"
                profile={profile}
                tabComments={tabComments}
                setTabComments={setTabComments}
                tabNoteDraft={tabNoteDraft}
                setTabNoteDraft={setTabNoteDraft}
              />
              {!featureControls.fieldOperations ? (
                <div className="rounded-3xl bg-white border border-slate-200 p-8 text-center">
                  <Wrench size={44} className="mx-auto text-slate-400" />
                  <h3 className="text-2xl font-black mt-4">
                    Field Operations is switched off
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("Command Center")}
                    className="mt-5 rounded-xl bg-slate-900 text-white px-5 py-3 font-black"
                  >
                    Open Controls
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-3xl bg-gradient-to-br from-sky-600 via-cyan-600 to-teal-600 p-6 sm:p-8 text-white shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                      <div>
                        <div className="inline-flex items-center gap-2 text-cyan-100 text-xs font-black uppercase tracking-wider">
                          <Wrench size={15} />
                          Field Operations
                        </div>
                        <h3 className="text-3xl font-black mt-2">
                          Dispatch & technician workflow
                        </h3>
                        <p className="text-cyan-100 mt-1 max-w-2xl">
                          Connect tickets, technicians, sites, parts, shipment
                          status, ETA and close-out in one operational view.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFieldOrderModalOpen(true)}
                        className="rounded-xl bg-white text-cyan-700 px-5 py-3 font-black hover:bg-cyan-50"
                      >
                        + New Work Order
                      </button>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
                    {[
                      ["Total", fieldWorkOrders.length],
                      ["Dispatched", fieldWorkOrders.filter((w) => w.status === "Dispatched").length],
                      ["On Site", fieldWorkOrders.filter((w) => w.status === "On Site").length],
                      ["Waiting Parts", fieldWorkOrders.filter((w) => w.status === "Waiting Parts").length],
                      ["Completed", fieldWorkOrders.filter((w) => w.status === "Completed").length],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                        <div className="text-sm text-slate-500 font-semibold">{label}</div>
                        <div className="text-3xl font-black mt-1">{value}</div>
                      </div>
                    ))}
                  </div>
 
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-slate-100">
                        <h3 className="font-black text-lg">Work Orders</h3>
                      </div>
 
                      <div className="divide-y divide-slate-100">
                        {fieldWorkOrders.map((order) => (
                          <div key={order.id} className="p-5">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-black text-slate-500">
                                    {order.id}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-1 text-[11px] font-black ${getPriorityClasses(
                                      order.priority
                                    )}`}
                                  >
                                    {order.priority}
                                  </span>
                                </div>
                                <div className="font-black text-slate-900 mt-2">
                                  {order.customer || "Customer not entered"}
                                </div>
                                <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                                  <MapPin size={14} />
                                  {order.site || "Site not entered"}
                                </div>
                              </div>
 
                              <div className="text-right">
                                <div className="text-sm font-black text-slate-800">
                                  {order.status}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Technician: {order.technician || "Unassigned"}
                                </div>
                              </div>
                            </div>
 
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-[10px] uppercase font-black text-slate-400">
                                  Part
                                </div>
                                <div className="text-sm font-bold mt-1">
                                  {order.part || "None recorded"}
                                </div>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-[10px] uppercase font-black text-slate-400">
                                  Quantity
                                </div>
                                <div className="text-sm font-bold mt-1">
                                  {order.quantity}
                                </div>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-[10px] uppercase font-black text-slate-400">
                                  ETA
                                </div>
                                <div className="text-sm font-bold mt-1">
                                  {order.eta || "Not set"}
                                </div>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-[10px] uppercase font-black text-slate-400">
                                  Notes
                                </div>
                                <div className="text-sm font-bold mt-1 truncate">
                                  {order.notes || "—"}
                                </div>
                              </div>
                            </div>
 
                            <div className="flex flex-wrap gap-2 mt-4">
                              {(
                                [
                                  "Unassigned",
                                  "Dispatched",
                                  "On Site",
                                  "Waiting Parts",
                                  "Completed",
                                ] as FieldWorkOrder["status"][]
                              ).map((status) => (
                                <button
                                  type="button"
                                  key={status}
                                  onClick={() =>
                                    void updateFieldWorkOrderStatus(order.id, status)
                                  }
                                  className={`rounded-xl border px-3 py-2 text-xs font-black ${
                                    order.status === status
                                      ? "bg-cyan-600 text-white border-cyan-600"
                                      : "bg-white text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
 
                            {(() => {
                              const linkedEvents = [
                                ...fieldWorkOrders
                                .filter(
                                  (w) =>
                      w.id !==
                      order.id &&
                      (w.customer || '').trim().toLowerCase() ===
                      (order.customer || '').trim().toLowerCase() &&
                      (order.customer || '').trim() !== ""
                  )
                  .map((w) => ({
                    label: `Field work order ${w.id} - ${w.status}`,
                    detail:
                  w.site || "Site not entered",
                  })),
                ...tickets
                  .filter(
                    (t) =>
                      (t.customer || '').trim().toLowerCase() ===
                      (order.customer || '').trim().toLowerCase() &&
                      (order.customer || '').trim() !== "" &&
                      String(t.id) !== String(order.ticketId)
                  )
                                  .map((t) => ({
                                    label: `Ticket #${t.id} — ${t.status}`,
                                    detail: t.category,
                                  })),
                              ];
 
                              return linkedEvents.length > 0 ? (
                                <div className="mt-4 rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                                  <div className="text-[10px] uppercase font-black text-indigo-500">
                                    Linked events for {order.customer}
                                  </div>
                                  <div className="mt-2 space-y-1">
                                    {linkedEvents.map((event, idx) => (
                                      <div key={idx} className="text-xs text-indigo-800">
                                        {event.label}{" "}
                                        <span className="text-indigo-400">— {event.detail}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null;
                            })()}
 
                            <div className="mt-4 rounded-xl border border-slate-200 p-3">
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] uppercase font-black text-slate-400">
                                  Customer signature
                                </div>
                                {order.signatureDataUrl && (
                                  <span className="text-[11px] font-bold text-emerald-600">
                                    Signed by {order.signedBy} •{" "}
                                    {order.signedAt ? new Date(order.signedAt).toLocaleString() : ""}
                                  </span>
                                )}
                              </div>
 
                              {order.signatureDataUrl ? (
                                <div className="mt-2 flex items-center gap-3">
                                  <img
                                    src={order.signatureDataUrl}
                                    alt="Customer signature"
                                    className="h-16 border border-slate-200 rounded-lg bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSignaturePadOpenFor(order.id);
                                      setSignerName(order.signedBy ?? "");
                                    }}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-800"
                                  >
                                    Re-capture
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSignaturePadOpenFor(order.id);
                                    setSignerName("");
                                  }}
                                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-slate-800"
                                >
                                  <Pencil size={13} /> Capture signature
                                </button>
                              )}
 
                              {signaturePadOpenFor === order.id && (
                                <div className="mt-3 space-y-2">
                                  <input
                                    value={signerName}
                                    onChange={(e) => setSignerName(e.target.value)}
                                    placeholder="Signed by (customer name)"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                                  />
                                  <canvas
                                    ref={signatureCanvasRef}
                                    width={400}
                                    height={140}
                                    className="w-full h-36 rounded-lg border border-slate-300 bg-white touch-none"
                                    onPointerDown={(e) => {
                                      signatureDrawingRef.current = true;
                                      const canvas = signatureCanvasRef.current;
                                      const ctx = canvas?.getContext("2d");
                                      if (!canvas || !ctx) return;
                                      const rect = canvas.getBoundingClientRect();
                                      ctx.beginPath();
                                      ctx.moveTo(
                                        (e.clientX - rect.left) * (canvas.width / rect.width),
                                        (e.clientY - rect.top) * (canvas.height / rect.height)
                                      );
                                    }}
                                    onPointerMove={(e) => {
                                      if (!signatureDrawingRef.current) return;
                                      const canvas = signatureCanvasRef.current;
                                      const ctx = canvas?.getContext("2d");
                                      if (!canvas || !ctx) return;
                                      const rect = canvas.getBoundingClientRect();
                                      ctx.lineWidth = 2;
                                      ctx.lineCap = "round";
                                      ctx.strokeStyle = "#0f172a";
                                      ctx.lineTo(
                                        (e.clientX - rect.left) * (canvas.width / rect.width),
                                        (e.clientY - rect.top) * (canvas.height / rect.height)
                                      );
                                      ctx.stroke();
                                    }}
                                    onPointerUp={() => {
                                      signatureDrawingRef.current = false;
                                    }}
                                    onPointerLeave={() => {
                                      signatureDrawingRef.current = false;
                                    }}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const canvas = signatureCanvasRef.current;
                                        const ctx = canvas?.getContext("2d");
                                        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                                      }}
                                      className="text-xs font-bold text-slate-500"
                                    >
                                      Clear
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSignaturePadOpenFor(null)}
                                      className="text-xs font-bold text-slate-500"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const canvas = signatureCanvasRef.current;
                                        if (!canvas) return;
                                        const dataUrl = canvas.toDataURL("image/png");
                                        void saveFieldWorkOrderSignature(order.id, dataUrl, signerName);
                                        setSignaturePadOpenFor(null);
                                      }}
                                      className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-700"
                                    >
                                      Save signature
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
 
                            <div className="mt-3 rounded-xl border border-slate-200 p-3">
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] uppercase font-black text-slate-400">
                                  Photo proof
                                </div>
                                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
                                  <Plus size={13} /> Add photo
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = () => {
                                        if (typeof reader.result === "string") {
                                          void addFieldWorkOrderPhotoProof(order.id, reader.result);
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              </div>
 
                              {(order.photoProofDataUrls?.length ?? 0) === 0 ? (
                                <div className="text-xs text-slate-400 mt-2">
                                  No photos attached yet.
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {(order.photoProofDataUrls ?? []).map((url, idx) => (
                                    <div key={idx} className="relative">
                                      <img
                                        src={url}
                                        alt={`Photo proof ${idx + 1}`}
                                        className="h-16 w-16 object-cover rounded-lg border border-slate-200"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeFieldWorkOrderPhotoProof(order.id, idx)}
                                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-slate-900 text-white flex items-center justify-center"
                                      >
                                        <X size={11} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
 
                        {fieldWorkOrders.length === 0 && (
                          <div className="p-10 text-center">
                            <Wrench size={38} className="mx-auto text-slate-300" />
                            <div className="font-black mt-3">No work orders yet</div>
                            <div className="text-sm text-slate-500 mt-1">
                              Create a work order to start the dispatch workflow.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
 
                    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                      <h3 className="font-black text-lg">Field Workflow</h3>
                      <div className="mt-5 space-y-3">
                        {[
                          ["1", "Ticket / request received"],
                          ["2", "Technician assigned"],
                          ["3", "Parts checked"],
                          ["4", "Shipment / ETA tracked"],
                          ["5", "Technician checks in"],
                          ["6", "Work completed & signed off"],
                          ["7", "RCA / close-out recorded"],
                        ].map(([number, label]) => (
                          <div key={number} className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-black">
                              {number}
                            </div>
                            <div className="text-sm font-semibold text-slate-700">
                              {label}
                            </div>
                          </div>
                        ))}
                      </div>
 
                      <div className="mt-6 rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-800">
                        <div className="font-black">Parts & shipping ready</div>
                        <div className="mt-1">
                          Field work orders already capture the part, quantity
                          and ETA needed for a future inventory/shipping
                          integration.
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
 
          {/* HR SUPPORT */}
          {activeTab === "HR Support" && (
            <div className="space-y-6">
              {!featureControls.hrSupport ? (
                <div className="rounded-3xl bg-white border border-slate-200 p-8 text-center">
                  <UserCog size={44} className="mx-auto text-slate-400" />
                  <h3 className="text-2xl font-black mt-4">
                    HR Support is switched off
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("Command Center")}
                    className="mt-5 rounded-xl bg-slate-900 text-white px-5 py-3 font-black"
                  >
                    Open Controls
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-3xl bg-gradient-to-br from-rose-600 via-pink-600 to-fuchsia-700 p-6 sm:p-8 text-white shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                      <div>
                        <div className="inline-flex items-center gap-2 text-rose-100 text-xs font-black uppercase tracking-wider">
                          <UserCog size={15} />
                          HR Support
                        </div>
                        <h3 className="text-3xl font-black mt-2">
                          Employee support & HR cases
                        </h3>
                        <p className="text-rose-100 mt-1 max-w-2xl">
                          A structured place for employee support, leave and
                          absence requests, employee relations, onboarding,
                          benefits, wellness and data-protection workflows.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHrCaseModalOpen(true)}
                        className="rounded-xl bg-white text-rose-700 px-5 py-3 font-black hover:bg-rose-50"
                      >
                        + New HR Case
                      </button>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                      ["Cases", hrCases.length],
                      ["New", hrCases.filter((item) => item.status === "New").length],
                      ["Under Review", hrCases.filter((item) => item.status === "Under Review").length],
                      ["Resolved", hrCases.filter((item) => item.status === "Resolved").length],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                        <div className="text-sm text-slate-500 font-semibold">{label}</div>
                        <div className="text-3xl font-black mt-1">{value}</div>
                      </div>
                    ))}
                  </div>
 
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-slate-100">
                        <h3 className="font-black text-lg">HR Case Queue</h3>
                      </div>
 
                      <div className="divide-y divide-slate-100">
                        {hrCases.map((item) => (
                          <div key={item.id} className="p-5">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-black text-slate-500">
                                    {item.id}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-1 text-[11px] font-black ${getPriorityClasses(
                                      item.priority
                                    )}`}
                                  >
                                    {item.priority}
                                  </span>
                                </div>
                                <div className="font-black text-slate-900 mt-2">
                                  {item.category}
                                </div>
                                <div className="text-sm text-slate-500 mt-1">
                                  {item.employeeName} • Owner: {item.owner}
                                </div>
                              </div>
 
                              <select
                                value={item.status}
                                onChange={(event) =>
                                  setHrCases((current) =>
                                    current.map((caseItem) =>
                                      caseItem.id === item.id
                                        ? {
                                            ...caseItem,
                                            status:
                                              event.target.value as HRCase["status"],
                                          }
                                        : caseItem
                                    )
                                  )
                                }
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                              >
                                <option>New</option>
                                <option>Under Review</option>
                                <option>Awaiting Employee</option>
                                <option>Resolved</option>
                              </select>
                            </div>
 
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-[10px] uppercase font-black text-slate-400">
                                  Due
                                </div>
                                <div className="text-sm font-bold mt-1">{item.dueDate}</div>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3">
                                <div className="text-[10px] uppercase font-black text-slate-400">
                                  Created
                                </div>
                                <div className="text-sm font-bold mt-1">
                                  {formatClockTime(item.createdAt)}
                                </div>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-3 md:col-span-2">
                                <div className="text-[10px] uppercase font-black text-slate-400">
                                  Notes
                                </div>
                                <div className="text-sm font-bold mt-1">
                                  {item.notes || "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
 
                        {hrCases.length === 0 && (
                          <div className="p-10 text-center">
                            <UserCog size={38} className="mx-auto text-slate-300" />
                            <div className="font-black mt-3">No HR cases yet</div>
                            <div className="text-sm text-slate-500 mt-1">
                              Start an employee support case when needed.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
 
                    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                      <h3 className="font-black text-lg">HR Support Areas</h3>
                      <div className="space-y-3 mt-5">
                        {[
                          ["Leave & Absence", "Requests, supporting documents and approvals"],
                          ["Employee Relations", "Cases, notes, ownership and escalation"],
                          ["Onboarding", "Employee setup, checklists and progress"],
                          ["Benefits & Remuneration", "Employee support requests and follow-up"],
                          ["Wellness", "Structured employee support workflows"],
                          ["Data Protection", "Controlled handling and audit trail for employee information"],
                          ["Employment Equity", "Structured records and reporting workflows"],
                        ].map(([title, note]) => (
                          <div
                            key={title}
                            className="rounded-xl border border-rose-100 bg-rose-50 p-4"
                          >
                            <div className="font-black text-rose-900">{title}</div>
                            <div className="text-xs text-rose-700 mt-1">{note}</div>
                          </div>
                        ))}
                      </div>
 
                      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <div className="flex items-center gap-2 font-black text-blue-900">
                          <ShieldCheck size={17} />
                          Controlled employee data
                        </div>
                        <div className="text-sm text-blue-800 mt-1">
                          HR cases are separated from normal operational tickets
                          so access can be tightened as the database permissions
                          are expanded.
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
 
          {/* PERFORMANCE ANALYTICS */}
          {activeTab === "Performance" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-cyan-600 via-sky-600 to-indigo-700 p-6 sm:p-8 text-white shadow-xl">
                <div className="flex items-center gap-3">
                  <BarChart3 size={24} />
                  <div>
                    <div className="text-cyan-100 text-xs font-black uppercase tracking-wider">
                      Workforce Analytics
                    </div>
                    <h3 className="text-3xl font-black mt-1">
                      Performance & operational data
                    </h3>
                  </div>
                </div>
                <p className="text-cyan-100 mt-2 max-w-3xl">
                  Charts below use the live workforce and attendance data
                  already available to WorkforceIQ. Additional sales, QA,
                  calls and task metrics can plug into the same chart layer as
                  those data sources are connected.
                </p>
              </div>
 
              <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
                {[
                  ["Employees", employees.length],
                  ["Working", employees.filter((e) => e.status === "Working").length],
                  ["Auxed", employees.filter((e) => e.status !== "Working" && e.status !== "Off Duty").length],
                  ["Tickets", tickets.length],
                  ["Field Orders", fieldWorkOrders.length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                    <div className="text-sm text-slate-500 font-semibold">{label}</div>
                    <div className="text-3xl font-black mt-1">{value}</div>
                  </div>
                ))}
              </div>
 
              {(() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const todaysSchedules = schedules.filter(
                  (s) => s.schedule_date === todayStr
                );
 
                const adherenceRows = todaysSchedules.map((sched) => {
                  const [startH, startM] = sched.start_time.split(":").map(Number);
                  const [endH, endM] = sched.end_time.split(":").map(Number);
                  const scheduledMinutes = Math.max(
                    0,
                    endH * 60 + endM - (startH * 60 + startM) - (sched.break_minutes || 0)
                  );
 
                  const employee = employees.find((e) => e.id === sched.user_id);
                  const workedMinutes =
                    employee?.clockInAt
                      ? Math.max(
                          0,
                          Math.floor((now - new Date(employee.clockInAt).getTime()) / 60000)
                        )
                      : 0;
 
                  const adherencePct =
                    scheduledMinutes > 0
                      ? Math.min(100, Math.round((workedMinutes / scheduledMinutes) * 100))
                      : null;
 
                  return {
                    name: sched.employee_name || employee?.name || "Unknown",
                    scheduledMinutes,
                    workedMinutes,
                    adherencePct,
                  };
                });
 
                const validAdherence = adherenceRows.filter((r) => r.adherencePct !== null);
                const avgAdherence =
                  validAdherence.length > 0
                    ? Math.round(
                        validAdherence.reduce((sum, r) => sum + (r.adherencePct ?? 0), 0) /
                          validAdherence.length
                      )
                    : null;
 
                const clockedIn = employees.filter((e) => Boolean(e.clockInAt));
                const activelyWorking = clockedIn.filter((e) => e.status === "Working");
                const utilizationPct =
                  clockedIn.length > 0
                    ? Math.round((activelyWorking.length / clockedIn.length) * 100)
                    : null;
 
                const statusCounts: Record<string, number> = {};
                clockedIn.forEach((e) => {
                  statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1;
                });
 
                const connectedCalls = callLogs.filter((c) => c.outcome === "Connected").length;
                const connectRatePct =
                  callLogs.length > 0
                    ? Math.round((connectedCalls / callLogs.length) * 100)
                    : null;
 
                const perAgentCalls: Record<string, { total: number; connected: number }> = {};
                callLogs.forEach((c) => {
                  if (!perAgentCalls[c.agent_name]) {
                    perAgentCalls[c.agent_name] = { total: 0, connected: 0 };
                  }
                  perAgentCalls[c.agent_name].total += 1;
                  if (c.outcome === "Connected") perAgentCalls[c.agent_name].connected += 1;
                });
 
                return (
                  <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h3 className="text-lg font-black">WFM % — Adherence &amp; Utilization</h3>
                      <span className="text-xs text-slate-400 font-semibold">
                        Live, based on today's schedules and current clock-in status
                      </span>
                    </div>
 
                    <div className="grid sm:grid-cols-3 gap-4 mt-4">
                      <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                        <div className="text-xs font-black uppercase text-indigo-500">
                          Schedule adherence (today)
                        </div>
                        <div className="text-4xl font-black text-indigo-700 mt-1">
                          {avgAdherence !== null ? `${avgAdherence}%` : "—"}
                        </div>
                        <div className="text-xs text-indigo-400 mt-1">
                          {validAdherence.length} of {todaysSchedules.length} scheduled shift
                          {todaysSchedules.length === 1 ? "" : "s"} compared against clock-in time
                        </div>
                      </div>
 
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                        <div className="text-xs font-black uppercase text-emerald-600">
                          Team utilization (right now)
                        </div>
                        <div className="text-4xl font-black text-emerald-700 mt-1">
                          {utilizationPct !== null ? `${utilizationPct}%` : "—"}
                        </div>
                        <div className="text-xs text-emerald-500 mt-1">
                          {activelyWorking.length} of {clockedIn.length} clocked-in staff
                          currently in "Working" status
                        </div>
                      </div>
 
                      <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                        <div className="text-xs font-black uppercase text-amber-600">
                          Real phone interaction (connect rate)
                        </div>
                        <div className="text-4xl font-black text-amber-700 mt-1">
                          {connectRatePct !== null ? `${connectRatePct}%` : "—"}
                        </div>
                        <div className="text-xs text-amber-500 mt-1">
                          {connectedCalls} of {callLogs.length} logged calls reached a real person
                        </div>
                      </div>
                    </div>
 
                    {adherenceRows.length > 0 && (
                      <div className="mt-5 space-y-2">
                        <div className="text-xs font-black uppercase text-slate-400">
                          Per-employee adherence today
                        </div>
                        {adherenceRows.map((row, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-32 text-sm font-bold text-slate-700 truncate">
                              {row.name}
                            </div>
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500"
                                style={{ width: `${row.adherencePct ?? 0}%` }}
                              />
                            </div>
                            <div className="w-12 text-xs font-bold text-slate-500 text-right">
                              {row.adherencePct !== null ? `${row.adherencePct}%` : "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
 
                    {Object.keys(perAgentCalls).length > 0 && (
                      <div className="mt-5 space-y-2">
                        <div className="text-xs font-black uppercase text-slate-400">
                          Connect rate by agent
                        </div>
                        {Object.entries(perAgentCalls).map(([name, stats]) => {
                          const pct = Math.round((stats.connected / stats.total) * 100);
                          return (
                            <div key={name} className="flex items-center gap-3">
                              <div className="w-32 text-sm font-bold text-slate-700 truncate">
                                {name}
                              </div>
                              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-amber-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="w-12 text-xs font-bold text-slate-500 text-right">
                                {pct}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
 
                    {Object.keys(statusCounts).length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {Object.entries(statusCounts).map(([status, count]) => (
                          <span
                            key={status}
                            className="text-xs font-bold rounded-full bg-slate-100 text-slate-600 px-3 py-1"
                          >
                            {status}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
 
              {(() => {
                const nowMs = Date.now();
                const openTickets = tickets.filter(
                  (t) => t.status !== "Resolved" && t.status !== "Closed"
                );
                const breached = openTickets.filter(
                  (t) => nowMs - new Date(t.createdAt).getTime() > t.slaMinutes * 60000
                );
                const servicePct =
                  openTickets.length > 0
                    ? Math.round(
                        ((openTickets.length - breached.length) / openTickets.length) * 100
                      )
                    : null;
 
                const breachByBranch: Record<string, number> = {};
                breached.forEach((t) => {
                  const key = t.branch || "Unassigned branch";
                  breachByBranch[key] = (breachByBranch[key] ?? 0) + 1;
                });
                const worstBranch = Object.entries(breachByBranch).sort(
                  (a, b) => b[1] - a[1]
                )[0];
 
                const last7Days = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (6 - i));
                  return d.toISOString().slice(0, 10);
                });
                const callsByDay = last7Days.map((day) => {
                  const dayCalls = callLogs.filter(
                    (c) => c.called_at.slice(0, 10) === day
                  );
                  const connected = dayCalls.filter((c) => c.outcome === "Connected").length;
                  return {
                    day,
                    total: dayCalls.length,
                    connected,
                    pct: dayCalls.length > 0 ? Math.round((connected / dayCalls.length) * 100) : 0,
                  };
                });
                const maxCallsInWindow = Math.max(1, ...callsByDay.map((d) => d.total));
 
                return (
                  <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h3 className="text-lg font-black">Powerful Reporting</h3>
                      <span className="text-xs text-slate-400 font-semibold">
                        Service level, branch gaps, and call trends from live data
                      </span>
                    </div>
 
                    <div className="grid sm:grid-cols-2 gap-4 mt-4">
                      <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
                        <div className="text-xs font-black uppercase text-rose-500">
                          Service level (open tickets)
                        </div>
                        <div className="text-4xl font-black text-rose-700 mt-1">
                          {servicePct !== null ? `${servicePct}%` : "—"}
                        </div>
                        <div className="text-xs text-rose-400 mt-1">
                          {breached.length} of {openTickets.length} open tickets past SLA
                        </div>
                      </div>
 
                      <div className="rounded-xl bg-orange-50 border border-orange-100 p-4">
                        <div className="text-xs font-black uppercase text-orange-500">
                          Most underserved branch
                        </div>
                        <div className="text-2xl font-black text-orange-700 mt-1">
                          {worstBranch ? worstBranch[0] : "—"}
                        </div>
                        <div className="text-xs text-orange-400 mt-1">
                          {worstBranch
                            ? `${worstBranch[1]} breached ticket${worstBranch[1] === 1 ? "" : "s"}`
                            : "No SLA breaches right now"}
                        </div>
                      </div>
                    </div>
 
                    <div className="mt-6">
                      <div className="text-xs font-black uppercase text-slate-400 mb-2">
                        Call volume &amp; connect rate — last 7 days
                      </div>
                      <div className="flex items-end gap-3 h-32">
                        {callsByDay.map((d) => (
                          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                            <div className="text-[10px] font-bold text-slate-500">
                              {d.total > 0 ? `${d.pct}%` : ""}
                            </div>
                            <div className="w-full flex-1 flex items-end">
                              <div
                                className="w-full bg-indigo-500 rounded-t-md"
                                style={{
                                  height: `${(d.total / maxCallsInWindow) * 100}%`,
                                  minHeight: d.total > 0 ? 4 : 0,
                                }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(d.day).toLocaleDateString(undefined, { weekday: "short" })}
                            </div>
                            <div className="text-[10px] font-bold text-slate-600">{d.total}</div>
                          </div>
                        ))}
                      </div>
                    </div>
 
                    {Object.keys(breachByBranch).length > 0 && (
                      <div className="mt-6 space-y-2">
                        <div className="text-xs font-black uppercase text-slate-400">
                          SLA breaches by branch
                        </div>
                        {Object.entries(breachByBranch)
                          .sort((a, b) => b[1] - a[1])
                          .map(([branch, count]) => (
                            <div key={branch} className="flex items-center gap-3">
                              <div className="w-32 text-sm font-bold text-slate-700 truncate">
                                {branch}
                              </div>
                              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-rose-500"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (count / (worstBranch?.[1] || 1)) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <div className="w-8 text-xs font-bold text-slate-500 text-right">
                                {count}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
 
                    <div className="text-[11px] text-slate-400 mt-5">
                      Service level is based on currently open tickets only (no resolved-at
                      timestamp is stored yet, so historical resolution time isn't available).
                    </div>
                  </div>
                );
              })()}
 
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-lg font-black">Workforce status distribution</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Current status mix from the attendance table.
                  </p>
 
                  <div className="space-y-4 mt-6">
                    {performanceData.statusRows.map((row) => {
                      const style =
                        getStatusClasses(
                          statusOptions.find(
                            (status) =>
                              getStatusLabel(status) === row.label
                          ) ?? "Working"
                        );
 
                      return (
                        <div key={row.label}>
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <div className="flex items-center gap-2 font-bold">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${style.dot}`}
                              />
                              {row.label}
                            </div>
                            <span className="font-black">
                              {row.value} ({Math.round(row.percent)}%)
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${style.dot}`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  row.percent
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
 
                <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                  <h3 className="text-lg font-black">Live hours by employee</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Based on current clock-in time.
                  </p>
 
                  <div className="space-y-4 mt-6">
                    {performanceData.workedHours.map((row) => {
                      const max =
                        performanceData.workedHours[0]?.minutes || 1;
                      const width = Math.min(
                        100,
                        (row.minutes / max) * 100
                      );
 
                      return (
                        <div key={row.name}>
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="font-bold truncate max-w-[70%]">
                              {row.name}
                            </span>
                            <span className="font-black">
                              {Math.floor(row.minutes / 60)}h{" "}
                              {row.minutes % 60}m
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
 
                    {performanceData.workedHours.length === 0 && (
                      <div className="py-10 text-center text-sm text-slate-500">
                        No employees are currently clocked in.
                      </div>
                    )}
                  </div>
                </div>
              </div>
 
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">
                      Analytics roadmap
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      The chart framework is ready for more connected data.
                    </p>
                  </div>
                  <BarChart3 className="text-cyan-600" />
                </div>
 
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
                  {[
                    ["Sales / revenue", "Ready for sales data"],
                    ["QA scores", "Ready for QA data"],
                    ["Calls / AHT", "Ready for telephony data"],
                    ["Tasks / tickets", "Connected to current modules"],
                    ["Schedule adherence", "Connected to schedules + attendance"],
                    ["Labor vs output", "Ready for payroll / sales inputs"],
                    ["Leave trends", "Ready for HR case + leave data"],
                    ["Field productivity", "Connected to work orders"],
                  ].map(([title, note]) => (
                    <div
                      key={title}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="font-black text-slate-800">{title}</div>
                      <div className="text-xs text-slate-500 mt-1">{note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
 
          {/* PEOPLE */}
          {activeTab === "People" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-pink-600 via-rose-600 to-fuchsia-700 p-6 sm:p-8 text-white shadow-xl">
                <div className="flex items-center gap-3">
                  <Users size={24} />
                  <div>
                    <div className="text-pink-100 text-xs font-black uppercase tracking-wider">
                      Workforce
                    </div>
                    <h3 className="text-3xl font-black mt-1">People</h3>
                  </div>
                </div>
                <p className="text-pink-100 mt-2">
                  Live employee status, role and clock information.
                </p>
              </div>
 
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  ["Total", employees.length],
                  ["Working", employees.filter((e) => e.status === "Working").length],
                  ["Auxed", employees.filter((e) => e.status !== "Working" && e.status !== "Off Duty").length],
                  ["Off Duty", employees.filter((e) => e.status === "Off Duty").length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl bg-white border border-slate-200 p-5">
                    <div className="text-sm text-slate-500">{label}</div>
                    <div className="text-3xl font-black mt-1">{value}</div>
                  </div>
                ))}
              </div>
 
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {employees.map((employee) => {
                  const style = getStatusClasses(employee.status);
                  return (
                    <div
                      key={employee.id}
                      className={`rounded-2xl border p-5 shadow-sm ${style.card}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-white flex items-center justify-center font-black">
                          {employee.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-black truncate">{employee.name}</div>
                          <div className="text-xs text-slate-500">{employee.role}</div>
                        </div>
                      </div>
 
                      <div className="mt-4 flex items-center justify-between">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${style.badge}`}
                        >
                          {getStatusLabel(employee.status)}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {employee.hours}
                        </span>
                      </div>
 
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-white/70 p-3">
                          <div className="text-slate-400 font-black">Clock In</div>
                          <div className="font-bold mt-1">{employee.clockIn}</div>
                        </div>
                        <div className="rounded-xl bg-white/70 p-3">
                          <div className="text-slate-400 font-black">Timer</div>
                          <div className="font-bold mt-1">
                            {formatStatusTimer(
                              employee.status,
                              employee.statusStartedAt,
                              now
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
 
          {/* TASKS */}
          {activeTab === "Tasks" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600 p-6 sm:p-8 text-white shadow-xl">
                <div className="flex items-center gap-3">
                  <ClipboardCheck size={24} />
                  <div>
                    <div className="text-fuchsia-100 text-xs font-black uppercase tracking-wider">
                      Operational Work
                    </div>
                    <h3 className="text-3xl font-black mt-1">
                      Tasks & follow-ups
                    </h3>
                  </div>
                </div>
                <p className="text-fuchsia-100 mt-2">
                  Tickets, HR cases and field work can feed this operational queue.
                </p>
              </div>
 
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {[
                  ["Open Tickets", ticketMetrics.open, "Service Hub"],
                  ["Field Work", fieldWorkOrders.filter((w) => w.status !== "Completed").length, "Field Operations"],
                  ["HR Cases", hrCases.filter((item) => item.status !== "Resolved").length, "HR Support"],
                ].map(([label, value, tab]) => (
                  <button
                    type="button"
                    key={String(label)}
                    onClick={() => setActiveTab(String(tab))}
                    className="rounded-2xl bg-white border border-slate-200 p-6 text-left shadow-sm hover:border-fuchsia-300 hover:bg-fuchsia-50 transition"
                  >
                    <div className="text-sm text-slate-500 font-semibold">
                      {label}
                    </div>
                    <div className="text-3xl font-black mt-1">{value}</div>
                    <div className="text-xs font-black text-fuchsia-700 mt-3">
                      Open module →
                    </div>
                  </button>
                ))}
              </div>
 
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-black">Operational checklist</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                  {[
                    ["Review overdue tickets", ticketMetrics.open > 0],
                    ["Check critical tickets", ticketMetrics.critical > 0],
                    ["Review waiting parts", fieldWorkOrders.some((w) => w.status === "Waiting Parts")],
                    ["Review HR cases", hrCases.some((item) => item.status !== "Resolved")],
                    ["Review attendance alerts", adminAlerts.length > 0],
                    ["Review performance", employees.length > 0],
                  ].map(([label, attention]) => (
                    <div
                      key={String(label)}
                      className={`rounded-xl border p-4 flex items-center justify-between ${
                        attention
                          ? "border-amber-200 bg-amber-50"
                          : "border-emerald-200 bg-emerald-50"
                      }`}
                    >
                      <span className="font-bold">{label}</span>
                      {attention ? (
                        <CircleAlert size={18} className="text-amber-600" />
                      ) : (
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
 
          {/* INVENTORY */}
          {activeTab === "Inventory" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-slate-700 via-slate-800 to-indigo-900 p-6 sm:p-8 text-white shadow-xl">
                <div className="flex items-center gap-3">
                  <Package size={24} />
                  <div>
                    <div className="text-slate-300 text-xs font-black uppercase tracking-wider">
                      Parts & stock operations
                    </div>
                    <h3 className="text-3xl font-black mt-1">
                      Inventory workflow
                    </h3>
                  </div>
                </div>
                <p className="text-slate-300 mt-2">
                  Existing Inventory access remains in place, with field work
                  orders now ready to connect parts, quantities and shipments.
                </p>
              </div>
 
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  ["Part Requests", fieldWorkOrders.filter((w) => !!w.part).length],
                  ["Units Requested", fieldWorkOrders.reduce((sum, w) => sum + (w.part ? w.quantity : 0), 0)],
                  ["Waiting Parts", fieldWorkOrders.filter((w) => w.status === "Waiting Parts").length],
                  ["Completed Work", fieldWorkOrders.filter((w) => w.status === "Completed").length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                    <div className="text-sm text-slate-500 font-semibold">{label}</div>
                    <div className="text-3xl font-black mt-1">{value}</div>
                  </div>
                ))}
              </div>
 
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="font-black text-lg">Parts requests from Field Operations</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {fieldWorkOrders
                    .filter((order) => order.part)
                    .map((order) => (
                      <div
                        key={order.id}
                        className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                      >
                        <div>
                          <div className="font-black">{order.part}</div>
                          <div className="text-sm text-slate-500 mt-1">
                            {order.customer || "Customer"} • {order.site || "Site"} • {order.id}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm font-black">
                            Qty {order.quantity}
                          </div>
                          <div className="text-xs font-bold text-slate-500">
                            {order.status}
                          </div>
                        </div>
                      </div>
                    ))}
 
                  {fieldWorkOrders.filter((order) => order.part).length === 0 && (
                    <div className="p-10 text-center">
                      <Package size={38} className="mx-auto text-slate-300" />
                      <div className="font-black mt-3">No part requests yet</div>
                      <div className="text-sm text-slate-500 mt-1">
                        Field work orders with parts will appear here.
                      </div>
                    </div>
                  )}
                </div>
              </div>
 
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-center gap-2 font-black text-blue-900">
                  <BookOpen size={18} />
                  Future inventory integrations
                </div>
                <p className="text-sm text-blue-800 mt-1">
                  This page is deliberately additive: it does not invent a
                  Supabase inventory schema. When your real inventory table is
                  connected, these same cards can switch from workflow data to
                  live stock balances.
                </p>
              </div>
            </div>
          )}
 
          {activeTab === "Asset Management" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-teal-700 via-cyan-800 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <HardDrive size={24} />
                    <div>
                      <div className="text-teal-200 text-xs font-black uppercase tracking-wider">
                        Serialized equipment
                      </div>
                      <h3 className="text-3xl font-black mt-1">Asset Management</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAssetForm((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-bold hover:bg-teal-50 transition"
                  >
                    <Plus size={16} /> Add asset
                  </button>
                </div>
                <p className="text-teal-100 mt-2">
                  Track POS terminals, RFID readers, tills, and other field
                  equipment — who has it, where it is, and its warranty status.
                </p>
              </div>
 
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  ["Total Assets", assets.length],
                  ["In Service", assets.filter((a) => a.status === "In Service").length],
                  ["In Repair", assets.filter((a) => a.status === "In Repair").length],
                  ["Retired", assets.filter((a) => a.status === "Retired").length],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                    <div className="text-sm text-slate-500 font-semibold">{label}</div>
                    <div className="text-3xl font-black mt-1">{value}</div>
                  </div>
                ))}
              </div>
 
              {showAssetForm && (
                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="font-black text-lg">Register a new asset</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      value={assetForm.asset_tag}
                      onChange={(e) => setAssetForm((f) => ({ ...f, asset_tag: e.target.value }))}
                      placeholder="Asset tag (e.g. POS-0412)"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={assetForm.device_name}
                      onChange={(e) => setAssetForm((f) => ({ ...f, device_name: e.target.value }))}
                      placeholder="Device name"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <select
                      value={assetForm.category}
                      onChange={(e) => setAssetForm((f) => ({ ...f, category: e.target.value }))}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option>POS Terminal</option>
                      <option>RFID Reader</option>
                      <option>Payment Device</option>
                      <option>Network Equipment</option>
                      <option>Audio Visual</option>
                      <option>Laptop / Desktop</option>
                      <option>Other</option>
                    </select>
                    <select
                      value={assetForm.status}
                      onChange={(e) => setAssetForm((f) => ({ ...f, status: e.target.value }))}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option>In Service</option>
                      <option>In Repair</option>
                      <option>In Storage</option>
                      <option>Retired</option>
                    </select>
                    <input
                      value={assetForm.assigned_to}
                      onChange={(e) => setAssetForm((f) => ({ ...f, assigned_to: e.target.value }))}
                      placeholder="Assigned to"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={assetForm.location}
                      onChange={(e) => setAssetForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="Location / branch"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="date"
                      value={assetForm.warranty_expires}
                      onChange={(e) => setAssetForm((f) => ({ ...f, warranty_expires: e.target.value }))}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={assetForm.notes}
                      onChange={(e) => setAssetForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Notes"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAssetForm(false)}
                      className="text-sm font-bold text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void addAsset()}
                      className="rounded-xl bg-teal-600 text-white px-4 py-2 text-sm font-bold hover:bg-teal-700"
                    >
                      Save asset
                    </button>
                  </div>
                </div>
              )}
 
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="font-black text-lg">All assets</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {assetsLoading && (
                    <div className="p-10 text-center text-slate-400">
                      <Loader2 size={28} className="mx-auto animate-spin" />
                    </div>
                  )}
                  {!assetsLoading && assets.length === 0 && (
                    <div className="p-10 text-center">
                      <HardDrive size={38} className="mx-auto text-slate-300" />
                      <div className="font-black mt-3">No assets registered yet</div>
                      <div className="text-sm text-slate-500 mt-1">
                        Add POS terminals, RFID readers, and other equipment above.
                      </div>
                    </div>
                  )}
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div>
                        <div className="font-black">
                          {asset.device_name}{" "}
                          <span className="text-slate-400 font-semibold text-sm">
                            ({asset.asset_tag})
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                          {asset.category} • {asset.assigned_to || "Unassigned"} •{" "}
                          {asset.location || "No location set"}
                        </div>
                        {asset.warranty_expires && (
                          <div className="text-xs text-slate-400 mt-1">
                            Warranty expires {asset.warranty_expires}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={asset.status}
                          onChange={(e) => void updateAssetStatus(asset.id, e.target.value)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold"
                        >
                          <option>In Service</option>
                          <option>In Repair</option>
                          <option>In Storage</option>
                          <option>Retired</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void deleteAsset(asset.id)}
                          className="text-slate-400 hover:text-red-500"
                          title="Delete asset"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
 
          {activeTab === "Knowledge Base" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-amber-500 via-yellow-600 to-orange-700 p-6 sm:p-8 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <BookOpen size={24} />
                    <div>
                      <div className="text-amber-100 text-xs font-black uppercase tracking-wider">
                        Self-service & agent reference
                      </div>
                      <h3 className="text-3xl font-black mt-1">Knowledge Base</h3>
                    </div>
                  </div>
                  {profile?.role !== "Employee" && (
                    <button
                      type="button"
                      onClick={() => setShowKbForm((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-bold hover:bg-amber-50 transition"
                    >
                      <Plus size={16} /> New article
                    </button>
                  )}
                </div>
                <p className="text-amber-100 mt-2">
                  Everyone can search and read articles here. Administrators,
                  Supervisors, and Team Leaders can publish and maintain them.
                </p>
              </div>
 
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <Search size={16} className="text-slate-400" />
                  <input
                    value={kbSearch}
                    onChange={(e) => setKbSearch(e.target.value)}
                    placeholder="Search articles..."
                    className="flex-1 text-sm outline-none"
                  />
                </div>
                <select
                  value={kbCategoryFilter}
                  onChange={(e) => setKbCategoryFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option>All</option>
                  <option>General</option>
                  <option>Dialer / Calls</option>
                  <option>Field Service</option>
                  <option>Point of Sale</option>
                  <option>HR & Policies</option>
                  <option>Troubleshooting</option>
                </select>
              </div>
 
              {showKbForm && profile?.role !== "Employee" && (
                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
                  <h3 className="font-black text-lg">Publish a new article</h3>
                  <input
                    value={kbForm.title}
                    onChange={(e) => setKbForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Article title"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <select
                    value={kbForm.category}
                    onChange={(e) => setKbForm((f) => ({ ...f, category: e.target.value }))}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option>General</option>
                    <option>Dialer / Calls</option>
                    <option>Field Service</option>
                    <option>Point of Sale</option>
                    <option>HR & Policies</option>
                    <option>Troubleshooting</option>
                  </select>
                  <textarea
                    value={kbForm.body}
                    onChange={(e) => setKbForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder="Article content..."
                    rows={6}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowKbForm(false)}
                      className="text-sm font-bold text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void addKbArticle()}
                      className="rounded-xl bg-amber-600 text-white px-4 py-2 text-sm font-bold hover:bg-amber-700"
                    >
                      Publish
                    </button>
                  </div>
                </div>
              )}
 
              <div className="grid md:grid-cols-[320px_1fr] gap-4">
                <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                  <div className="divide-y divide-slate-100 max-h-[32rem] overflow-y-auto">
                    {kbLoading && (
                      <div className="p-8 text-center text-slate-400">
                        <Loader2 size={24} className="mx-auto animate-spin" />
                      </div>
                    )}
                    {!kbLoading &&
                      kbArticles
                        .filter(
                          (a) =>
                            (kbCategoryFilter === "All" || a.category === kbCategoryFilter) &&
                            (kbSearch.trim() === "" ||
                              a.title.toLowerCase().includes(kbSearch.toLowerCase()))
                        )
                        .map((article) => (
                          <button
                            key={article.id}
                            type="button"
                            onClick={() => setKbSelectedId(article.id)}
                            className={`w-full text-left p-4 hover:bg-amber-50 transition ${
                              kbSelectedId === article.id ? "bg-amber-50" : ""
                            }`}
                          >
                            <div className="font-bold text-sm text-slate-800">{article.title}</div>
                            <div className="text-xs text-slate-400 mt-1">{article.category}</div>
                          </button>
                        ))}
                    {!kbLoading && kbArticles.length === 0 && (
                      <div className="p-8 text-center text-sm text-slate-400">
                        No articles published yet.
                      </div>
                    )}
                  </div>
                </div>
 
                <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
                  {(() => {
                    const selected = kbArticles.find((a) => a.id === kbSelectedId);
                    if (!selected) {
                      return (
                        <div className="text-center py-16 text-slate-400">
                          <BookOpen size={38} className="mx-auto text-slate-300" />
                          <div className="font-black mt-3 text-slate-500">
                            Select an article to read it
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xs font-black uppercase tracking-wider text-amber-600">
                              {selected.category}
                            </div>
                            <h3 className="text-2xl font-black mt-1">{selected.title}</h3>
                            <div className="text-xs text-slate-400 mt-1">
                              By {selected.author_name} • Updated{" "}
                              {new Date(selected.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                          {profile?.role !== "Employee" && (
                            <button
                              type="button"
                              onClick={() => void deleteKbArticle(selected.id)}
                              className="text-slate-400 hover:text-red-500"
                              title="Delete article"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <p className="text-slate-600 mt-4 whitespace-pre-wrap leading-relaxed">
                          {selected.body}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
 
          {activeTab === "Billing" && (
            <div className="space-y-6">
              {(() => {
                const paid = invoices.filter((i) => i.status === "Paid");
                const outstanding = invoices.filter(
                  (i) => i.status === "Sent" || i.status === "Overdue"
                );
                const overdue = invoices.filter((i) => i.status === "Overdue");
                const totalRevenue = paid.reduce(
                  (sum, i) => sum + invoiceTotal(i).total,
                  0
                );
                const totalOutstanding = outstanding.reduce(
                  (sum, i) => sum + invoiceTotal(i).total,
                  0
                );
 
                return (
                  <>
                    <div className="rounded-3xl bg-gradient-to-br from-emerald-700 via-green-800 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <Receipt size={24} />
                          <div>
                            <div className="text-emerald-200 text-xs font-black uppercase tracking-wider">
                              Billing &amp; Invoicing
                            </div>
                            <h3 className="text-3xl font-black mt-1">Billing</h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowInvoiceForm((v) => !v)}
                          className="inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-bold hover:bg-emerald-50 transition"
                        >
                          <Plus size={16} /> New invoice
                        </button>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                      {[
                        ["Total revenue", `R ${totalRevenue.toFixed(2)}`],
                        ["Outstanding", `R ${totalOutstanding.toFixed(2)}`],
                        ["Overdue", overdue.length],
                        ["Invoices", invoices.length],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
                        >
                          <div className="text-sm text-slate-500 font-semibold">{label}</div>
                          <div className="text-2xl font-black mt-1">{value}</div>
                        </div>
                      ))}
                    </div>
 
                    {showInvoiceForm && (
                      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-3">
                        <h3 className="font-black text-lg">Create invoice</h3>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <input
                            value={invoiceForm.customer_name}
                            onChange={(e) =>
                              setInvoiceForm((f) => ({ ...f, customer_name: e.target.value }))
                            }
                            placeholder="Customer name"
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <input
                            value={invoiceForm.customer_phone}
                            onChange={(e) =>
                              setInvoiceForm((f) => ({ ...f, customer_phone: e.target.value }))
                            }
                            placeholder="Customer phone"
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <input
                            value={invoiceForm.branch}
                            onChange={(e) =>
                              setInvoiceForm((f) => ({ ...f, branch: e.target.value }))
                            }
                            placeholder="Branch"
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <input
                            type="date"
                            value={invoiceForm.due_date}
                            onChange={(e) =>
                              setInvoiceForm((f) => ({ ...f, due_date: e.target.value }))
                            }
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
 
                        <div className="space-y-2">
                          <div className="text-xs font-black uppercase text-slate-400">
                            Line items
                          </div>
                          {invoiceForm.items.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_70px_100px_32px] gap-2">
                              <input
                                value={item.description}
                                onChange={(e) =>
                                  setInvoiceForm((f) => ({
                                    ...f,
                                    items: f.items.map((it, i) =>
                                      i === idx ? { ...it, description: e.target.value } : it
                                    ),
                                  }))
                                }
                                placeholder="Description"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  setInvoiceForm((f) => ({
                                    ...f,
                                    items: f.items.map((it, i) =>
                                      i === idx
                                        ? { ...it, quantity: Number(e.target.value) || 1 }
                                        : it
                                    ),
                                  }))
                                }
                                className="rounded-xl border border-slate-200 px-2 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) =>
                                  setInvoiceForm((f) => ({
                                    ...f,
                                    items: f.items.map((it, i) =>
                                      i === idx
                                        ? { ...it, unit_price: Number(e.target.value) || 0 }
                                        : it
                                    ),
                                  }))
                                }
                                placeholder="Price"
                                className="rounded-xl border border-slate-200 px-2 py-2 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setInvoiceForm((f) => ({
                                    ...f,
                                    items: f.items.filter((_, i) => i !== idx),
                                  }))
                                }
                                className="text-slate-400 hover:text-red-500"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setInvoiceForm((f) => ({
                                ...f,
                                items: [...f.items, { description: "", quantity: 1, unit_price: 0 }],
                              }))
                            }
                            className="text-xs font-bold text-emerald-700"
                          >
                            + Add line item
                          </button>
                        </div>
 
                        <div className="flex items-center gap-3">
                          <label className="text-sm font-black text-slate-700">Tax rate %</label>
                          <input
                            type="number"
                            min={0}
                            value={invoiceForm.tax_rate}
                            onChange={(e) =>
                              setInvoiceForm((f) => ({ ...f, tax_rate: e.target.value }))
                            }
                            className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <div className="ml-auto text-sm font-black text-slate-700">
                            Total: R{" "}
                            {invoiceTotal({
                              items: invoiceForm.items,
                              tax_rate: Number(invoiceForm.tax_rate) || 0,
                            }).total.toFixed(2)}
                          </div>
                        </div>
 
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowInvoiceForm(false)}
                            className="text-sm font-bold text-slate-500"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void addInvoice()}
                            className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-bold hover:bg-emerald-700"
                          >
                            Save invoice
                          </button>
                        </div>
                      </div>
                    )}
 
                    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-slate-100">
                        <h3 className="font-black text-lg">All invoices</h3>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {invoicesLoading && (
                          <div className="p-10 text-center text-slate-400">
                            <Loader2 size={28} className="mx-auto animate-spin" />
                          </div>
                        )}
                        {!invoicesLoading && invoices.length === 0 && (
                          <div className="p-10 text-center">
                            <Receipt size={38} className="mx-auto text-slate-300" />
                            <div className="font-black mt-3">No invoices yet</div>
                          </div>
                        )}
                        {invoices.map((inv) => {
                          const totals = invoiceTotal(inv);
                          return (
                            <div
                              key={inv.id}
                              className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                            >
                              <div>
                                <div className="font-black">
                                  {inv.customer_name}{" "}
                                  <span className="text-slate-400 font-semibold text-sm">
                                    ({inv.branch || "no branch"})
                                  </span>
                                </div>
                                <div className="text-sm text-slate-500 mt-1">
                                  {inv.items.length} item{inv.items.length === 1 ? "" : "s"} •
                                  Due {inv.due_date || "—"}
                                </div>
                                <div className="text-lg font-black text-emerald-700 mt-1">
                                  R {totals.total.toFixed(2)}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <select
                                  value={inv.status}
                                  onChange={(e) =>
                                    void updateInvoiceStatus(
                                      inv.id,
                                      e.target.value as InvoiceStatus
                                    )
                                  }
                                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold"
                                >
                                  <option>Draft</option>
                                  <option>Sent</option>
                                  <option>Paid</option>
                                  <option>Overdue</option>
                                  <option>Void</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => void deleteInvoice(inv.id)}
                                  className="text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
 
          {activeTab === "Tenant Management" && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-fuchsia-800 via-purple-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={24} />
                    <div>
                      <div className="text-fuchsia-200 text-xs font-black uppercase tracking-wider">
                        WorkforceIQ Super Admin
                      </div>
                      <h3 className="text-3xl font-black mt-1">Tenant Management</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddOrgForm((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full bg-white text-slate-900 px-4 py-2 text-sm font-bold hover:bg-fuchsia-50 transition"
                  >
                    <Plus size={16} /> Onboard tenant
                  </button>
                </div>
                <p className="text-fuchsia-100 mt-2">
                  Every tenant on WorkforceIQ, and everyone in them, in one place.
                </p>
              </div>
 
              {showAddOrgForm && (
                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-black text-lg mb-3">Onboard a new tenant</h3>
                  <div className="flex gap-2">
                    <input
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Tenant / company name"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void addOrganization()}
                      className="rounded-xl bg-fuchsia-700 text-white px-4 py-2 text-sm font-bold hover:bg-fuchsia-800"
                    >
                      Create
                    </button>
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    This creates the tenant record. To give them a login, sign someone up
                    normally through the app, then reassign them to this tenant below.
                  </div>
                </div>
              )}
 
              <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                  <div className="border-t-4 border-fuchsia-600 px-4 pt-3 pb-2 font-black text-slate-800">
                    Tenants
                  </div>
                  <div className="divide-y divide-slate-100">
                    {tenantDataLoading && (
                      <div className="p-8 text-center text-slate-400">
                        <Loader2 size={24} className="mx-auto animate-spin" />
                      </div>
                    )}
                    {!tenantDataLoading &&
                      organizations.map((org) => {
                        const count = tenantPeople.filter((p) => p.org_id === org.id).length;
                        return (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => setSelectedOrgId(org.id)}
                            className={`w-full text-left px-4 py-3 hover:bg-fuchsia-50 transition ${
                              selectedOrgId === org.id ? "bg-fuchsia-50" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-slate-800">{org.name}</div>
                              {org.status !== "Active" && (
                                <span
                                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    org.status === "Terminated"
                                      ? "bg-red-100 text-red-600"
                                      : "bg-amber-100 text-amber-600"
                                  }`}
                                >
                                  {org.status}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {count} agent{count === 1 ? "" : "s"}
                            </div>
                          </button>
                        );
                      })}
                    {!tenantDataLoading && organizations.length === 0 && (
                      <div className="p-6 text-center text-sm text-slate-400">
                        No tenants yet.
                      </div>
                    )}
                  </div>
                </div>
 
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
                  {!selectedOrgId ? (
                    <div className="text-center py-16 text-slate-400">
                      <ShieldCheck size={38} className="mx-auto text-slate-300" />
                      <div className="font-black mt-3 text-slate-500">
                        Select a tenant to see its agents
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const org = organizations.find((o) => o.id === selectedOrgId);
                      const people = tenantPeople.filter((p) => p.org_id === selectedOrgId);
                      return (
                        <div>
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <h3 className="text-2xl font-black">{org?.name}</h3>
                              <div className="text-sm text-slate-500 mt-1">
                                {people.length} agent{people.length === 1 ? "" : "s"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {org?.status !== "Active" && (
                                <button
                                  type="button"
                                  onClick={() => org && void updateOrgStatus(org.id, "Active")}
                                  className="rounded-full bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-700"
                                >
                                  Reactivate
                                </button>
                              )}
                              {org?.status !== "Suspended" && (
                                <button
                                  type="button"
                                  onClick={() => org && void updateOrgStatus(org.id, "Suspended")}
                                  className="rounded-full bg-amber-500 text-white px-3 py-1.5 text-xs font-bold hover:bg-amber-600"
                                >
                                  Suspend
                                </button>
                              )}
                              {org?.status !== "Terminated" && (
                                <button
                                  type="button"
                                  onClick={() => org && void updateOrgStatus(org.id, "Terminated")}
                                  className="rounded-full bg-red-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-red-700"
                                >
                                  Terminate
                                </button>
                              )}
                            </div>
                          </div>
 
                          <div className="mt-4 divide-y divide-slate-100">
                            {people.map((person) => (
                              <div
                                key={person.id}
                                className="py-3 flex items-center justify-between gap-3 flex-wrap"
                              >
                                <div>
                                  <div className="font-bold text-slate-800">
                                    {person.full_name}
                                  </div>
                                  <div className="text-xs text-slate-500">{person.role}</div>
                                </div>
                                <select
                                  value={person.org_id ?? ""}
                                  onChange={(e) =>
                                    void reassignPersonOrg(person.id, e.target.value)
                                  }
                                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold"
                                >
                                  {organizations.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                            {people.length === 0 && (
                              <div className="py-6 text-center text-sm text-slate-400">
                                No one assigned to this tenant yet.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
 
              <div className="text-[11px] text-slate-400">
                Password resets and creating new logins for other people need a secure
                server-side action (a Supabase Edge Function) and aren't available here yet —
                see the note from when this was scoped.
              </div>
            </div>
          )}
 
          {/* IQ COMMAND CENTER */}
          {activeTab === "Command Center" && profile && (
            <IQCommandCenter
              employees={employees}
              schedules={schedules}
              tickets={tickets}
              fieldWorkOrders={fieldWorkOrders}
              hrCases={hrCases}
              now={now}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {/* OTHER SECTIONS */}
          {activeTab !==
            "Dashboard" &&
            activeTab !==
              "Time & Attendance" &&
            activeTab !==
              "Schedules" &&
            activeTab !==
              "EOD Report" &&
            activeTab !==
              "Command Center" &&
            activeTab !==
              "Service Hub" &&
            activeTab !==
              "Field Operations" &&
            activeTab !==
              "HR Support" &&
            activeTab !==
              "Performance" &&
            activeTab !==
              "People" &&
            activeTab !==
              "Tasks" &&
            activeTab !==
              "Inventory" &&
            activeTab !==
              "Asset Management" &&
            activeTab !==
              "Knowledge Base" &&
            activeTab !==
              "Billing" &&
            activeTab !==
              "Tenant Management" && (
              <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm p-8">
                <div
                  className={`absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b ${activeGradient}`}
                />
 
                <div
                  className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${activeGradient} flex items-center justify-center text-white shadow-lg`}
                >
                  {activeNav &&
                    (() => {
                      const Icon =
                        activeNav.icon;
 
                      return (
                        <Icon
                          size={27}
                        />
                      );
                    })()}
                </div>
 
                <h3 className="text-2xl font-black text-slate-900 mt-5">
                  {
                    activeTab
                  }
                </h3>
 
                <p className="text-slate-500 mt-2 max-w-xl">
                  This WorkforceIQ module is
                  Ready for its next feature
                  Set. Your navigation,
                  Permissions and existing
                  Functionality remain in
                  Place.
                </p>
 
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-2 text-sm font-bold text-blue-700">
                  <Sparkles
                    size={16}
                  />
                  WorkforceIQ module
                </div>
              </div>
            )}
        </div>
      </main>
 
 
      {/* SERVICE HUB TICKET MODAL */}
      {ticketModalOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-5 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider font-black text-red-100">
                  Service Hub
                </div>
                <h3 className="text-2xl font-black">Create Ticket</h3>
<div className="text-xs font-black text-orange-100 mt-1">Incident number is assigned automatically when you create the ticket.</div>
              </div>
              <button
                type="button"
                onClick={() => setTicketModalOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>
 
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-black text-slate-700">
                  Request / Issue <span className="text-red-600">*</span>
                </label>
                <input
                  value={ticketForm.title}
                  onChange={(event) =>
                    setTicketForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Customer requires replacement part"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
 
              <div>
                <label className="text-sm font-black text-slate-700">
                  Contact phone
                </label>
                <input
                  value={ticketForm.contactPhone}
                  onChange={(event) =>
                    setTicketForm((current) => ({
                      ...current,
                      contactPhone: event.target.value,
                    }))
                  }
                  placeholder="e.g. +27 82 123 4567"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
                />
                <div className="text-xs text-slate-400 mt-1">
                  Feeds the Dialer's call queue — leave blank if there's no number to call.
                </div>
              </div>
 
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Type
                  </label>
                  <select
                    value={ticketForm.type}
                    onChange={(event) =>
                      setTicketForm((current) => ({
                        ...current,
                        type: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  >
                    <option>Operations</option>
                    <option>Call</option>
                    <option>Incident</option>
                    <option>Request</option>
 
 
                    <option>Shipping</option>
                    <option>Parts</option>
                    <option>IT</option>
                  </select>
                </div>
 
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Priority
                  </label>
                  <select
                    value={ticketForm.priority}
                    onChange={(event) =>
                      setTicketForm((current) => ({
                        ...current,
                        priority:
                          event.target.value as TicketPriority,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
 
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Employee
                  </label>
                  <select
                    value={ticketForm.employeeId}
                    onChange={(event) =>
                      setTicketForm((current) => ({
                        ...current,
                        employeeId: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  >
                    <option value="">Not linked</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>
 
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Assigned To
                  </label>
                  <select
                    value={ticketForm.assignee}
                    onChange={(event) =>
                      setTicketForm((current) => ({
                        ...current,
                        assignee: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  >
                    <option value="">Unassigned</option>
                    {employees
                      .filter((employee) => employee.role !== "Employee")
                      .map((employee) => (
                        <option key={employee.id} value={employee.name}>
                          {employee.name} • {employee.role}
                        </option>
                      ))}
                  </select>
                </div>
 
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Branch / Site
                  </label>
                  <input
                    value={ticketForm.branch}
                    onChange={(event) =>
                      setTicketForm((current) => ({
                        ...current,
                        branch: event.target.value,
                      }))
                    }
                    placeholder="Branch or site"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </div>
 
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Component
                  </label>
                  <input
                    value={ticketForm.component}
                    onChange={(event) =>
                      setTicketForm((current) => ({
                        ...current,
                        component: event.target.value,
                      }))
                    }
                    placeholder="e.g. Router, Printer, Account, Application"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
 
                <div>
                  <label className="text-sm font-black text-slate-700">
                    SLA minutes
                  </label>
                  <input
                    type="number"
                    min="15"
                    value={ticketForm.slaMinutes}
                    onChange={(event) =>
                      setTicketForm((current) => ({
                        ...current,
                        slaMinutes: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </div>
              </div>
 
              <div>
                <label className="text-sm font-black text-slate-700">
<div>
<label className="text-sm font-black text-slate-700">
First Comment <span className="text-red-600">*</span>
</label>
<textarea
rows={4}
value={ticketForm.initialComment}
onChange={(event) =>
setTicketForm((current) => ({
...current,
initialComment: event.target.value,
}))
}
placeholder="Required: record what was reported, requested, or done at ticket creation."
className="mt-1 w-full rounded-xl border border-red-200 bg-red-50/30 px-3 py-3 resize-none outline-none focus:ring-2 focus:ring-red-500"
/>
<p className="mt-1 text-xs font-bold text-slate-500">
This becomes the first entry in the permanent ticket conversation.
</p>
</div>
 
                  Notes
                </label>
                <textarea
                  rows={5}
                  value={ticketForm.notes}
                  onChange={(event) =>
                    setTicketForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Describe the request, customer information, part, model, quantity, shipping details, troubleshooting or other relevant notes."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 resize-none outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
 
            <div className="flex justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setTicketModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createTicket}
                disabled={false}
                className="rounded-xl bg-gradient-to-r from-red-600 to-orange-600 text-white px-5 py-3 font-black disabled:opacity-50"
              >
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* HR CASE MODAL */}
      {hrCaseModalOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-rose-600 to-pink-600 text-white p-5 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider font-black text-rose-100">
                  HR Support
                </div>
                <h3 className="text-2xl font-black">New HR Case</h3>
              </div>
              <button
                type="button"
                onClick={() => setHrCaseModalOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>
 
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-black text-slate-700">
                  Employee
                </label>
                <select
                  value={hrForm.employeeId}
                  onChange={(event) =>
                    setHrForm((current) => ({
                      ...current,
                      employeeId: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
 
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Support Area
                  </label>
                  <select
                    value={hrForm.category}
                    onChange={(event) =>
                      setHrForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  >
                    <option>Employee Support</option>
                    <option>Leave & Absence</option>
                    <option>Employee Relations</option>
                    <option>Onboarding</option>
                    <option>Benefits & Remuneration</option>
                    <option>Wellness</option>
                    <option>Data Protection</option>
                    <option>Employment Equity</option>
                  </select>
                </div>
 
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Priority
                  </label>
                  <select
                    value={hrForm.priority}
                    onChange={(event) =>
                      setHrForm((current) => ({
                        ...current,
                        priority:
                          event.target.value as TicketPriority,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
              </div>
 
              <div>
                <label className="text-sm font-black text-slate-700">
                  Due Date
                </label>
                <input
                  type="date"
                  value={hrForm.dueDate}
                  onChange={(event) =>
                    setHrForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                />
              </div>
 
              <div>
                <label className="text-sm font-black text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={5}
                  value={hrForm.notes}
                  onChange={(event) =>
                    setHrForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Describe the employee support request."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 resize-none"
                />
              </div>
            </div>
 
            <div className="flex justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setHrCaseModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createHrCase}
                disabled={!hrForm.employeeId}
                className="rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white px-5 py-3 font-black disabled:opacity-50"
              >
                Create HR Case
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* FIELD WORK ORDER MODAL */}
      {fieldOrderModalOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-2xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-sky-600 to-cyan-600 text-white p-5 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider font-black text-sky-100">
                  Field Operations
                </div>
                <h3 className="text-2xl font-black">New Work Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setFieldOrderModalOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>
 
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Technician
                  </label>
                  <input
                    value={fieldForm.technician}
                    onChange={(event) =>
                      setFieldForm((current) => ({
                        ...current,
                        technician: event.target.value,
                      }))
                    }
                    placeholder="Technician name"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Customer
                  </label>
                  <input
                    value={fieldForm.customer}
                    onChange={(event) =>
                      setFieldForm((current) => ({
                        ...current,
                        customer: event.target.value,
                      }))
                    }
                    placeholder="Customer / account"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Site
                  </label>
                  <input
                    value={fieldForm.site}
                    onChange={(event) =>
                      setFieldForm((current) => ({
                        ...current,
                        site: event.target.value,
                      }))
                    }
                    placeholder="Site / location"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Priority
                  </label>
                  <select
                    value={fieldForm.priority}
                    onChange={(event) =>
                      setFieldForm((current) => ({
                        ...current,
                        priority:
                          event.target.value as TicketPriority,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Part ID / Description
                  </label>
                  <input
                    value={fieldForm.part}
                    onChange={(event) =>
                      setFieldForm((current) => ({
                        ...current,
                        part: event.target.value,
                      }))
                    }
                    placeholder="Part ID"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={fieldForm.quantity}
                    onChange={(event) =>
                      setFieldForm((current) => ({
                        ...current,
                        quantity: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">
                    ETA / Ship By
                  </label>
                  <input
                    type="datetime-local"
                    value={fieldForm.eta}
                    onChange={(event) =>
                      setFieldForm((current) => ({
                        ...current,
                        eta: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3"
                  />
                </div>
              </div>
 
              <div>
                <label className="text-sm font-black text-slate-700">
                  First Comment <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={4}
                  value={ticketForm.initialComment}
                  onChange={(event) =>
                    setTicketForm((current) => ({
                      ...current,
                      initialComment: event.target.value,
                    }))
                  }
                  placeholder="Required: record what was reported, requested, or done at ticket creation."
                  className="mt-1 w-full rounded-xl border border-red-200 bg-red-50/30 px-3 py-3 resize-none outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="mt-1 text-xs font-bold text-slate-500">
                  This becomes the first entry in the permanent ticket conversation.
                </p>
              </div>
 
              <div>
                <label className="text-sm font-black text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={4}
                  value={fieldForm.notes}
                  onChange={(event) =>
                    setFieldForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Parts, shipping, model, customer contact, troubleshooting or other notes."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 resize-none"
                />
              </div>
            </div>
 
            <div className="flex justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setFieldOrderModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createFieldWorkOrder}
                disabled={
                  !fieldForm.customer.trim() &&
                  !fieldForm.site.trim() &&
                  !fieldForm.technician.trim()
                }
                className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white px-5 py-3 font-black disabled:opacity-50"
              >
                Create Work Order
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* SCHEDULE MODAL */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-orange-50 to-rose-50">
              <div>
                <div className="flex items-center gap-2 text-orange-600 text-xs font-bold uppercase tracking-wider">
                  <CalendarDays
                    size={14}
                  />
                  schedule Manager
                </div>
 
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {editingSchedule
                    ? "Edit Schedule"
                    : "Create Schedule"}
                </h3>
 
                <p className="text-sm text-slate-500 mt-1">
                  {editingSchedule
                    ? "Update the employee's schedule."
                    : "Create a new employee schedule."}
                </p>
              </div>
 
              <button
                type="button"
                onClick={
                  closeScheduleModal
                }
                className="p-2 hover:bg-white rounded-xl"
              >
                <X
                  size={20}
                />
              </button>
            </div>
 
            <div className="p-5 space-y-4">
              {scheduleError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {
                    scheduleError
                  }
                </div>
              )}
 
              <div>
                <label className="block text-sm font-bold mb-1 text-slate-700">
                  employee
                </label>
 
                <select
                  value={
                    scheduleForm.user_id
                  }
                  onChange={(
                    event
                  ) =>
                    setScheduleForm(
                      (
                        current
                      ) => ({
                        ...current,
                        user_id:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  disabled={
                    !canCreateSchedule &&
                    !!editingSchedule
                  }
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">
                    Select employee
                  </option>
 
                  {employees.map(
                    (
                      employee
                    ) => (
                      <option
                        key={
                          employee.id
                        }
                        value={
                          employee.id
                        }
                      >
                        {
                          employee.name
                        }{" "}
                        —{" "}
                        {
                          employee.role
                        }
                      </option>
                    )
                  )}
                </select>
              </div>
 
              {editingSchedule ? (
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700">
                    Date
                  </label>
 
                  <input
                    type="date"
                    value={
                      scheduleForm.start_date
                    }
                    onChange={(
                      event
                    ) =>
                      setScheduleForm(
                        (
                          current
                        ) => ({
                          ...current,
                          start_date:
                            event
                              .target
                              .value,
                          end_date:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1 text-slate-700">
                      start Date
                    </label>
 
                    <input
                      type="date"
                      value={
                        scheduleForm.start_date
                      }
                      onChange={(
                        event
                      ) =>
                        setScheduleForm(
                          (
                            current
                          ) => ({
                            ...current,
                            start_date:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
 
                  <div>
                    <label className="block text-sm font-bold mb-1 text-slate-700">
                      end Date
                    </label>
 
                    <input
                      type="date"
                      min={
                        scheduleForm.start_date ||
                        undefined
                      }
                      value={
                        scheduleForm.end_date
                      }
                      onChange={(
                        event
                      ) =>
                        setScheduleForm(
                          (
                            current
                          ) => ({
                            ...current,
                            end_date:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                </div>
              )}
 
              {!editingSchedule && (
                <>
                  <p className="text-xs text-slate-500 -mt-2">
                    This creates the same
                    Shift for every day from
                    The start date through the
                    end date.
                  </p>
 
                  <label className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        scheduleForm.repeat_two_days_off
                      }
                      onChange={(
                        event
                      ) =>
                        setScheduleForm(
                          (
                            current
                          ) => ({
                            ...current,
                            repeat_two_days_off:
                              event
                                .target
                                .checked,
                          })
                        )
                      }
                      className="h-4 w-4 accent-blue-600"
                    />
 
                    <span>
                      <span className="block font-bold text-blue-900">
                        Repeat shift: 1 work
                        Day + 2 days off
                      </span>
 
                      <span className="block text-xs text-blue-700 mt-1">
                        The shift repeats every
                        3 days until the End
                        Date.
                      </span>
                    </span>
                  </label>
                </>
              )}
 
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700">
                    start Time
                  </label>
 
                  <input
                    type="time"
                    value={
                      scheduleForm.start_time
                    }
                    onChange={(
                      event
                    ) =>
                      setScheduleForm(
                        (
                          current
                        ) => ({
                          ...current,
                          start_time:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
 
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700">
                    end Time
                  </label>
 
                  <input
                    type="time"
                    value={
                      scheduleForm.end_time
                    }
                    onChange={(
                      event
                    ) =>
                      setScheduleForm(
                        (
                          current
                        ) => ({
                          ...current,
                          end_time:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>
 
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700">
                    scheduled Break Minutes
                  </label>
 
                  <input
                    type="number"
                    min="15"
                    value={
                      scheduleForm.break_minutes
                    }
                    onChange={(
                      event
                    ) =>
                      setScheduleForm(
                        (
                          current
                        ) => ({
                          ...current,
                          break_minutes:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
 
                <div>
                  <label className="block text-sm font-bold mb-1 text-slate-700">
                    Shift Type
                  </label>
 
                  <select
                    value={
                      scheduleForm.shift_type
                    }
                    onChange={(
                      event
                    ) =>
                      setScheduleForm(
                        (
                          current
                        ) => ({
                          ...current,
                          shift_type:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option>
                      Regular
                    </option>
                    <option>
                      Early Shift
                    </option>
                    <option>
                      late Shift
                    </option>
                    <option>
                      Night Shift
                    </option>
                    <option>
                      Training
                    </option>
                    <option>
                      Overtime
                    </option>
                    <option>
                      Off
                    </option>
                  </select>
                </div>
              </div>
 
              <div>
                <label className="block text-sm font-bold mb-1 text-slate-700">
                  notes
                </label>
 
                <textarea
                  value={
                    scheduleForm.notes
                  }
                  onChange={(
                    event
                  ) =>
                    setScheduleForm(
                      (
                        current
                      ) => ({
                        ...current,
                        notes:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  rows={3}
                  placeholder="Optional notes..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>
 
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={
                  closeScheduleModal
                }
                disabled={
                  savingSchedule
                }
                className="px-4 py-2.5 border border-slate-200 bg-white rounded-xl hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
 
              <button
                type="button"
                onClick={
                  handleSaveSchedule
                }
                disabled={
                  savingSchedule
                }
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl hover:shadow-lg font-bold disabled:opacity-50"
              >
                {savingSchedule && (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                )}
 
                {editingSchedule
                  ? "Save Changes"
                  : "Create Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
