"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  LogOut,
  Phone,
  RefreshCw,
  ShieldAlert,
  Ticket,
  UserRound,
  Wrench,
} from "lucide-react";
import { supabase } from "../supabase/client";

type Role = "Administrator" | "Supervisor" | "Team Leader" | "Employee";

type AttendanceStatus =
  | "Working"
  | "Break"
  | "Lunch"
  | "Away"
  | "After Call Work"
  | "Off Duty";

type TicketPriority = "Low" | "Medium" | "High" | "Critical";

type TicketStatus =
  | "New"
  | "Assigned"
  | "In Progress"
  | "Waiting"
  | "Resolved"
  | "Closed";

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

type TicketRecord = {
  id: string;
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
};

type FieldWorkOrder = {
  id: string;
  ticketId: string;
  technician: string;
  customer: string;
  site: string;
  status:
    | "Unassigned"
    | "Dispatched"
    | "On Site"
    | "Waiting Parts"
    | "Completed";
  priority: TicketPriority;
  part: string;
  quantity: number;
  eta: string;
  notes: string;
};

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

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
};

type Props = {
  profile: Profile;
  employees: Employee[];
  schedules: Schedule[];
  tickets: TicketRecord[];
  fieldWorkOrders: FieldWorkOrder[];
  hrCases: HRCase[];
  now: number;
  onNavigate: (tab: string) => void;
  onSelectTicket: (ticketId: string) => void;
};

type Issue = {
  id: string;
  severity: "Critical" | "High" | "Attention" | "Info";
  title: string;
  detail: string;
  owner: string;
  action: string;
  tab: string;
  ticketId?: string;
};

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function minutesFromTime(value: string) {
  const [h, m] = value.split(":").map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) {
    return null;
  }

  return h * 60 + m;
}

function isOverLimit(
  status: AttendanceStatus,
  startedAt: string | null,
  now: number
) {
  if (!startedAt) return false;

  const limits: Record<string, number> = {
    Break: 15,
    Lunch: 30,
  };

  const limit = limits[status];

  if (!limit) return false;

  return (
    now - new Date(startedAt).getTime() >
    limit * 60 * 1000
  );
}

function slaBreached(ticket: TicketRecord, now: number) {
  return (
    ticket.status !== "Resolved" &&
    ticket.status !== "Closed" &&
    new Date(ticket.createdAt).getTime() +
      ticket.slaMinutes * 60 * 1000 <
      now
  );
}

export default function OperationsControlPanel({
  profile,
  employees,
  schedules,
  tickets,
  fieldWorkOrders,
  hrCases,
  now,
  onNavigate,
  onSelectTicket,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [forceLogoutLoading, setForceLogoutLoading] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");

  const management = profile.role !== "Employee";
  const today = dateKey(new Date(now));

  const lateEmployees = useMemo(() => {
    const todaySchedules = schedules.filter(
      (s) =>
        s.schedule_date === today &&
        s.shift_type !== "Off"
    );

    return todaySchedules
      .map((schedule) => {
        const employee = employees.find(
          (e) => e.id === schedule.user_id
        );

        if (!employee) return null;

        const startMinutes = minutesFromTime(
          schedule.start_time
        );

        if (startMinutes === null) return null;

        const current = new Date(now);

        const currentMinutes =
          current.getHours() * 60 +
          current.getMinutes();

        const startDate = new Date(current);

        startDate.setHours(
          Math.floor(startMinutes / 60),
          startMinutes % 60,
          0,
          0
        );

        const scheduledStart = startDate.getTime();

        if (now < scheduledStart) return null;

        if (!employee.clockInAt) {
          return {
            employee,
            schedule,
            minutesLate: Math.max(
              0,
              currentMinutes - startMinutes
            ),
          };
        }

        const actual = new Date(
          employee.clockInAt
        ).getTime();

        if (actual <= scheduledStart) return null;

        return {
          employee,
          schedule,
          minutesLate: Math.floor(
            (actual - scheduledStart) / 60000
          ),
        };
      })
      .filter(Boolean) as Array<{
      employee: Employee;
      schedule: Schedule;
      minutesLate: number;
    }>;
  }, [employees, schedules, today, now]);

  const issues = useMemo<Issue[]>(() => {
    const rows: Issue[] = [];

    lateEmployees.forEach(
      ({ employee, minutesLate }) => {
        rows.push({
          id: `late-${employee.id}`,
          severity:
            minutesLate >= 30
              ? "High"
              : "Attention",
          title: `${employee.name} is late`,
          detail: `${minutesLate} minute${
            minutesLate === 1 ? "" : "s"
          } past scheduled start time.`,
          owner: employee.name,
          action: "Attendance follow-up",
          tab: "Time & Attendance",
        });
      }
    );

    employees.forEach((employee) => {
      if (
        isOverLimit(
          employee.status,
          employee.statusStartedAt,
          now
        )
      ) {
        rows.push({
          id: `status-${employee.id}`,
          severity: "High",
          title: `${employee.name} has an extended ${
            employee.status === "Lunch"
              ? "lunch"
              : "break"
          }`,
          detail:
            "Status timer has exceeded the configured limit.",
          owner: employee.name,
          action: "Review attendance",
          tab: "Time & Attendance",
        });
      }
    });

    tickets
      .filter(
        (ticket) =>
          ticket.priority === "Critical" &&
          ticket.status !== "Closed" &&
          ticket.status !== "Resolved"
      )
      .forEach((ticket) => {
        rows.push({
          id: `critical-${ticket.id}`,
          severity: "Critical",
          title: `${ticket.id} is Critical`,
          detail: ticket.title,
          owner: ticket.assignee || "Unassigned",
          action: "Open ticket",
          tab: "Service Hub",
          ticketId: ticket.id,
        });
      });

    tickets
      .filter((ticket) =>
        slaBreached(ticket, now)
      )
      .forEach((ticket) => {
        rows.push({
          id: `sla-${ticket.id}`,
          severity:
            ticket.priority === "Critical"
              ? "Critical"
              : "High",
          title: `${ticket.id} SLA breached`,
          detail: ticket.title,
          owner: ticket.assignee || "Unassigned",
          action: "Open ticket",
          tab: "Service Hub",
          ticketId: ticket.id,
        });
      });

    tickets
      .filter(
        (ticket) =>
          ticket.status !== "Closed" &&
          ticket.status !== "Resolved" &&
          !ticket.component?.trim()
      )
      .forEach((ticket) => {
        rows.push({
          id: `component-${ticket.id}`,
          severity: "Attention",
          title: `${ticket.id} is missing a component`,
          detail:
            "A component must be recorded before the ticket can be resolved or closed.",
          owner: ticket.assignee || "Unassigned",
          action: "Add component",
          tab: "Service Hub",
          ticketId: ticket.id,
        });
      });

    fieldWorkOrders
      .filter(
        (order) => order.status === "Waiting Parts"
      )
      .forEach((order) => {
        rows.push({
          id: `parts-${order.id}`,
          severity: "Attention",
          title: `${order.id} is waiting for parts`,
          detail: `${order.customer || "Customer"} • ${
            order.site || "Site not specified"
          }`,
          owner: order.technician || "Unassigned",
          action: "Open field operations",
          tab: "Field Operations",
        });
      });

    hrCases
      .filter(
        (item) =>
          item.status !== "Resolved" &&
          item.dueDate < today
      )
      .forEach((item) => {
        rows.push({
          id: `hr-${item.id}`,
          severity: "High",
          title: `${item.id} is overdue`,
          detail: `${item.employeeName} • ${item.category}`,
          owner: item.owner || "HR Support",
          action: "Open HR Support",
          tab: "HR Support",
        });
      });

    const rank = {
      Critical: 0,
      High: 1,
      Attention: 2,
      Info: 3,
    };

    return rows
      .sort(
        (a, b) =>
          rank[a.severity] -
          rank[b.severity]
      )
      .slice(0, 50);
  }, [
    employees,
    tickets,
    fieldWorkOrders,
    hrCases,
    lateEmployees,
    now,
    today,
  ]);

  async function forceLogout(employee: Employee) {
    if (
      !management ||
      employee.role !== "Employee"
    ) {
      return;
    }

    const reason = window.prompt(
      `Reason for forcing ${employee.name} to stop/logout:`,
      "Management force stop"
    );

    if (reason === null) return;

    const confirmed = window.confirm(
      `Force logout ${employee.name}? Their active attendance will also be stopped.`
    );

    if (!confirmed) return;

    setForceLogoutLoading(employee.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "force_logout_employee",
        {
          target_user_id: employee.id,
          reason:
            reason.trim() ||
            "Management force stop",
        }
      );

      if (error) throw error;

      setMessage(
        `${employee.name} has been force logged out.`
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Unable to force logout employee."
      );
    } finally {
      setForceLogoutLoading(null);
    }
  }

  async function refresh() {
    setRefreshing(true);

    try {
      window.location.reload();
    } finally {
      setRefreshing(false);
    }
  }

  function openDialer() {
    window.location.href = "/dialer";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-wider">
              <ShieldAlert size={15} />
              Automated Operations Control
            </div>

            <h3 className="mt-4 text-2xl font-black sm:text-3xl">
              Issues, owners and actions
            </h3>

            <p className="mt-2 max-w-2xl text-slate-300">
              WorkforceIQ continuously turns attendance,
              schedules, tickets, field work and HR data
              into an actionable management queue.
            </p>
          </div>

          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-black hover:bg-white/15"
          >
            <RefreshCw
              size={18}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh Control Center
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 font-bold text-blue-800">
          {message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          [
            "Open issues",
            issues.length,
            "text-red-700",
            "bg-red-50",
          ],
          [
            "Late employees",
            lateEmployees.length,
            "text-amber-700",
            "bg-amber-50",
          ],
          [
            "Critical tickets",
            tickets.filter(
              (t) =>
                t.priority === "Critical" &&
                t.status !== "Resolved" &&
                t.status !== "Closed"
            ).length,
            "text-rose-700",
            "bg-rose-50",
          ],
          [
            "Active workforce",
            employees.filter(
              (e) => e.status !== "Off Duty"
            ).length,
            "text-emerald-700",
            "bg-emerald-50",
          ],
        ].map(
          ([label, value, text, bg]) => (
            <div
              key={String(label)}
              className={`rounded-2xl border border-slate-200 p-5 ${bg}`}
            >
              <div className="text-sm font-bold text-slate-500">
                {label}
              </div>

              <div
                className={`mt-1 text-3xl font-black ${text}`}
              >
                {value}
              </div>
            </div>
          )
        )}
      </div>

      {/* Automated Issues */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h3 className="text-lg font-black">
              Automated Issue Checklist
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              The system identifies who needs attention
              and what should happen next.
            </p>
          </div>

          <CircleAlert
            size={22}
            className={
              issues.length
                ? "text-red-500"
                : "text-emerald-500"
            }
          />
        </div>

        <div className="divide-y divide-slate-100">
          {issues.map((issue) => (
            <button
              type="button"
              key={issue.id}
              onClick={() => {
                if (issue.ticketId) {
                  onSelectTicket(
                    issue.ticketId
                  );
                }

                onNavigate(issue.tab);
              }}
              className="w-full p-4 text-left transition hover:bg-slate-50"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                    issue.severity === "Critical"
                      ? "bg-red-600"
                      : issue.severity === "High"
                      ? "bg-orange-500"
                      : issue.severity === "Attention"
                      ? "bg-amber-500"
                      : "bg-slate-400"
                  }`}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-slate-900">
                      {issue.title}
                    </span>

                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">
                      {issue.severity}
                    </span>
                  </div>

                  <div className="mt-1 text-sm text-slate-600">
                    {issue.detail}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <span className="font-bold text-slate-500">
                      Owner:{" "}
                      <span className="text-slate-800">
                        {issue.owner}
                      </span>
                    </span>

                    <span className="font-bold text-indigo-600">
                      Action: {issue.action}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}

          {issues.length === 0 && (
            <div className="p-12 text-center">
              <CheckCircle2
                size={42}
                className="mx-auto text-emerald-500"
              />

              <div className="mt-4 font-black text-slate-800">
                All clear
              </div>

              <div className="mt-1 text-sm text-slate-500">
                No automated operational issues
                require attention right now.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Employee Session Control */}
      {management && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <UserRound
                size={20}
                className="text-indigo-600"
              />

              <div>
                <h3 className="text-lg font-black">
                  Employee Session Control
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Force-stop an employee's active session
                  and close their active attendance record.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {employees
              .filter(
                (employee) =>
                  employee.role === "Employee"
              )
              .map((employee) => (
                <div
                  key={employee.id}
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-black text-indigo-700">
                      {employee.initials}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate font-black text-slate-900">
                        {employee.name}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={13} />
                          {employee.status}
                        </span>

                        <span>•</span>

                        <span>
                          {employee.clockInAt
                            ? "Clocked in"
                            : "Off duty"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={
                      forceLogoutLoading ===
                      employee.id
                    }
                    onClick={() =>
                      forceLogout(employee)
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-black text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {forceLogoutLoading ===
                    employee.id ? (
                      <RefreshCw
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <LogOut size={17} />
                    )}

                    Force Logout
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Control Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() =>
            onNavigate("Time & Attendance")
          }
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left transition hover:bg-emerald-100"
        >
          <Clock3
            size={22}
            className="text-emerald-600"
          />

          <div className="mt-3 font-black">
            Attendance Control
          </div>

          <div className="mt-1 text-sm text-slate-600">
            Review late staff, timers and active shifts.
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            onNavigate("Service Hub")
          }
          className="rounded-2xl border border-red-200 bg-red-50 p-5 text-left transition hover:bg-red-100"
        >
          <Ticket
            size={22}
            className="text-red-600"
          />

          <div className="mt-3 font-black">
            Ticket Control
          </div>

          <div className="mt-1 text-sm text-slate-600">
            Handle critical, breached and incomplete tickets.
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            onNavigate("Field Operations")
          }
          className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-left transition hover:bg-sky-100"
        >
          <Wrench
            size={22}
            className="text-sky-600"
          />

          <div className="mt-3 font-black">
            Field Control
          </div>

          <div className="mt-1 text-sm text-slate-600">
            Review waiting parts and active work orders.
          </div>
        </button>

        {/* NEW DIALER CARD */}
        <button
          type="button"
          onClick={openDialer}
          className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-left transition hover:bg-violet-100"
        >
          <Phone
            size={22}
            className="text-violet-600"
          />

          <div className="mt-3 font-black">
            Dialer
          </div>

          <div className="mt-1 text-sm text-slate-600">
            Make calls, manage call activity and connect
            with customers.
          </div>
        </button>
      </div>
    </div>
  );
}
        {/* DEVICE PULSE - NEW CARD */}
        <button
          type="button"
          onClick={() => window.location.href = "/device-pulse"}
          className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-left transition hover:bg-black text-white"
        >
          <div className="text-2xl">📡</div>
          <div className="mt-3 font-black text-white">Device Pulse</div>
          <div className="mt-1 text-sm text-slate-300">
            LemonTree device monitoring, router remote & store online status.
          </div>
        </button>