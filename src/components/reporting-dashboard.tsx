"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import {
  Activity, ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check,
  ClipboardList, Download, FileSpreadsheet, FileText, LayoutDashboard, LogOut,
  Printer, Search, ShieldCheck, SlidersHorizontal, UserRoundCheck, Users,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type ReportType = "events" | "registrations" | "participants" | "attendance";
type ReportRow = Record<string, string | number | null>;
type EventOption = { id: number; name: string };
type DashboardData = {
  totals: { events: number; registrations: number; participants: number; present: number; attendance_records: number; confirmed: number; cancelled: number; attendancePercentage: number };
  eventStatus: { status: string; count: number }[];
  registrationTrend: { date: string; registrations: number }[];
  eventAttendance: { event_name: string; present: number; absent: number; recorded: number }[];
  filters: { events: EventOption[]; categories: string[]; departments: string[] };
};
type ReportResult = { rows: ReportRow[]; total: number; page: number; pageSize: number; summary?: Record<string, number> };

const reports: { id: ReportType; label: string; icon: typeof CalendarDays; title: string; description: string }[] = [
  { id: "events", label: "Events", icon: CalendarDays, title: "Event report", description: "Registration and attendance performance by event." },
  { id: "registrations", label: "Registrations", icon: ClipboardList, title: "Registration report", description: "Confirmed and cancelled student registrations." },
  { id: "participants", label: "Participants", icon: Users, title: "Participant report", description: "Student participant lists by event." },
  { id: "attendance", label: "Attendance", icon: UserRoundCheck, title: "Attendance report", description: "Event attendance records and present or absent status." },
];
const chartColors = ["#397b61", "#d5a546", "#d87558"];
const collegeName = process.env.NEXT_PUBLIC_COLLEGE_NAME || "College Event Office";
const columns: Record<ReportType, { key: string; label: string }[]> = {
  events: [
    { key: "event_name", label: "Event" }, { key: "event_date", label: "Event date" }, { key: "venue", label: "Venue" },
    { key: "category", label: "Category" }, { key: "status", label: "Status" }, { key: "total_registrations", label: "Registrations" }, { key: "attendance_percentage", label: "Attendance" },
  ],
  registrations: [
    { key: "student_name", label: "Student" }, { key: "usn", label: "USN" }, { key: "department", label: "Department" },
    { key: "email", label: "Email" }, { key: "event_name", label: "Event" }, { key: "registration_date", label: "Registered" }, { key: "status", label: "Status" },
  ],
  participants: [
    { key: "student_name", label: "Student" }, { key: "usn", label: "USN" }, { key: "department", label: "Department" },
    { key: "event_name", label: "Event" }, { key: "registration_date", label: "Registered" }, { key: "status", label: "Registration status" },
  ],
  attendance: [
    { key: "student_name", label: "Student" }, { key: "usn", label: "USN" }, { key: "department", label: "Department" },
    { key: "event_name", label: "Event" }, { key: "attendance_status", label: "Attendance" }, { key: "attendance_date", label: "Attendance date" },
  ],
};

function formatDate(value: string | number | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function displayValue(key: string, value: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  if (key.endsWith("date")) return formatDate(value);
  if (key === "attendance_percentage") return `${value}%`;
  return String(value);
}

function summaryText(type: ReportType, summary: Record<string, number> | undefined) {
  if (!summary) return "";
  if (type === "events") return `Events: ${summary.total} · registrations: ${summary.registrations} · attendance: ${summary.attendancePercentage}%`;
  if (type === "attendance") return `Present: ${summary.present} · absent: ${summary.absent} · attendance rate: ${summary.attendancePercentage}%`;
  if (type === "registrations") return `Confirmed: ${summary.confirmed} · cancelled: ${summary.cancelled} · registrations: ${summary.total}`;
  return `Participants: ${summary.total} · confirmed: ${summary.confirmed} · cancelled: ${summary.cancelled}`;
}

function StatusBadge({ value }: { value: string }) {
  const lower = value.toLowerCase();
  const color = ["confirmed", "present", "completed"].includes(lower) ? "green" : ["cancelled", "absent"].includes(lower) ? "red" : lower === "ongoing" ? "blue" : "amber";
  return <span className={`badge badge-${color}`}>{value}</span>;
}

function EmptyState({ title, children }: { title: string; children: string }) {
  return <div className="empty-state"><div><CalendarDays size={25} strokeWidth={1.5} /><strong style={{ display: "block", marginTop: 8, color: "#53645a" }}>{title}</strong><p>{children}</p></div></div>;
}

export function ReportingDashboard() {
  const router = useRouter();
  const importInput = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<ReportType>("events");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [result, setResult] = useState<ReportResult>({ rows: [], total: 0, page: 1, pageSize: 10 });
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [eventId, setEventId] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("date");
  const [direction, setDirection] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [reportError, setReportError] = useState("");
  const [toast, setToast] = useState("");

  async function loadReport(page = 1, overrides: { type?: ReportType; search?: string; eventId?: string; department?: string; status?: string; category?: string; from?: string; to?: string; sort?: string; direction?: string } = {}) {
    setLoading(true);
    setReportError("");
    const type = overrides.type ?? active;
    const params = new URLSearchParams({ type, page: String(page), pageSize: "10", search: overrides.search ?? deferredSearch, sort: overrides.sort ?? sort, direction: overrides.direction ?? direction });
    const selectedEvent = overrides.eventId ?? eventId;
    const selectedDepartment = overrides.department ?? department;
    const selectedStatus = overrides.status ?? status;
    const selectedCategory = overrides.category ?? category;
    const selectedFrom = overrides.from ?? from;
    const selectedTo = overrides.to ?? to;
    if (selectedEvent) params.set("eventId", selectedEvent);
    if (selectedDepartment && type !== "events") params.set("department", selectedDepartment);
    if (selectedStatus) params.set("status", selectedStatus);
    if (selectedCategory && type === "events") params.set("category", selectedCategory);
    if (selectedFrom) params.set("from", selectedFrom);
    if (selectedTo) params.set("to", selectedTo);
    try {
      const response = await fetch(`/api/reports?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not generate report.");
      setResult(data as ReportResult);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Could not generate report.");
      setResult({ rows: [], total: 0, page: 1, pageSize: 10 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load overview.");
        setDashboard(data as DashboardData);
      } catch (error) {
        setDashboardError(error instanceof Error ? error.message : "Could not load overview.");
      }
    }
    void loadDashboard();
    const reportTimer = window.setTimeout(() => void loadReport(1, { type: "events", search: "" }), 0);
    return () => window.clearTimeout(reportTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dashboard) return;
    const timer = window.setTimeout(() => void loadReport(1, { search: deferredSearch }), 180);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function refreshDashboard() {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load overview.");
      setDashboard(data as DashboardData);
      setDashboardError("");
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not load overview.");
    }
  }

  function importCsv(file: File) {
    setImporting(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim().toLowerCase(),
      complete: async ({ data, errors }) => {
        try {
          const firstError = errors[0];
          if (firstError) throw new Error(`CSV row ${(firstError.row ?? 0) + 2}: ${firstError.message}`);
          const rows = data.filter((row) => Object.values(row).some((value) => value.trim()));
          const response = await fetch("/api/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Could not import these records.");
          await refreshDashboard();
          await loadReport(1);
          setToast(`${result.imported.toLocaleString()} CSV rows imported.`);
        } catch (error) {
          setReportError(error instanceof Error ? error.message : "Could not import this CSV.");
        } finally {
          setImporting(false);
        }
      },
      error: (error) => {
        setReportError(error.message);
        setImporting(false);
      },
    });
  }

  function downloadCsvTemplate() {
    const headers = "event_name,event_date,venue,category,student_name,usn,department,email,registration_date,registration_status,attendance_status,attendance_date\r\n";
    const url = URL.createObjectURL(new Blob([headers], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "college-event-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function selectReport(type: ReportType) {
    setActive(type); setStatus(""); setSort("date");
    void loadReport(1, { type });
    document.getElementById("report-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function exportExcel() {
    if (!result.rows.length) return;
    const title = reports.find((item) => item.id === active)?.title ?? "Report";
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title.slice(0, 31));
    sheet.columns = columns[active].map((column) => ({ header: column.label, key: column.key, width: 22 }));
    sheet.insertRow(1, [collegeName]);
    sheet.insertRow(2, [title]);
    sheet.insertRow(3, [`Generated ${new Date().toLocaleString()} · Filtered records: ${result.total}`]);
    sheet.insertRow(4, [summaryText(active, result.summary)]);
    sheet.mergeCells(1, 1, 1, columns[active].length);
    sheet.mergeCells(2, 1, 2, columns[active].length);
    sheet.mergeCells(3, 1, 3, columns[active].length);
    sheet.mergeCells(4, 1, 4, columns[active].length);
    sheet.getRow(1).font = { bold: true, size: 16, color: { argb: "FF184A3B" } };
    sheet.getRow(2).font = { bold: true, size: 12 };
    sheet.getRow(4).font = { italic: true, color: { argb: "FF536A60" } };
    sheet.getRow(5).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF184A3B" } };
    for (const row of result.rows) {
      sheet.addRow(Object.fromEntries(columns[active].map((column) => [column.key, displayValue(column.key, row[column.key] ?? null)])));
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${active}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("Excel report downloaded.");
  }

  function exportPdf() {
    if (!result.rows.length) return;
    const title = reports.find((item) => item.id === active)?.title ?? "Report";
    const pdf = new jsPDF({ orientation: "landscape" });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text(collegeName, 14, 16);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(12); pdf.text(title, 14, 23);
    pdf.setFontSize(9); pdf.text(`Generated ${new Date().toLocaleString()}  |  Filtered records: ${result.total}`, 14, 29);
    pdf.text(summaryText(active, result.summary), 14, 35);
    autoTable(pdf, { startY: 41, head: [columns[active].map((column) => column.label)], body: result.rows.map((row) => columns[active].map((column) => displayValue(column.key, row[column.key] ?? null))), styles: { fontSize: 8, cellPadding: 2.5 }, headStyles: { fillColor: [24, 74, 59] } });
    pdf.save(`${active}-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    setToast("PDF report downloaded.");
  }

  const selectedReport = reports.find((item) => item.id === active)!;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const statusOptions = active === "events" ? ["Upcoming", "Ongoing", "Completed"] : active === "attendance" ? ["Present", "Absent"] : ["Confirmed", "Cancelled"];
  const activity = dashboard?.eventStatus ?? [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><ShieldCheck size={19} /></span><span><span className="brand-name">Campus Ledger</span><span className="brand-subtitle">Event intelligence</span></span></div>
        <div className="side-label">Reporting</div>
        <nav className="side-nav" aria-label="Report sections">
          <button className={active === "events" ? "active" : ""} onClick={() => { setActive("events"); setStatus(""); void loadReport(1, { type: "events" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} title="Overview"><LayoutDashboard size={16} /><span>Overview</span></button>
          {reports.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} onClick={() => selectReport(id)} title={label}><Icon size={16} /><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom"><strong>Administrator access</strong>Reports are current to your college database.</div>
      </aside>

      <div className="workspace">
        <header className="topbar"><div className="crumb">Reports <span aria-hidden="true"> / </span> <strong>{active === "events" ? "Overview" : selectedReport.label}</strong></div><div className="top-actions"><span className="live-label"><span className="live-dot" /> Data connected</span><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={16} /></button></div></header>
        <main className="main-content">
          <section className="page-heading"><div><div className="eyebrow">College event management</div><h1>{active === "events" ? "Reporting overview" : selectedReport.title}</h1><p>Campus activity, participation and attendance at a glance.</p></div><div className="heading-date"><CalendarDays size={15} /> {new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</div></section>
          {dashboardError && <div className="error-message" role="alert">{dashboardError}</div>}
          <section className="stats-grid" aria-label="Event reporting summary">
            <StatCard icon={<CalendarDays size={16} />} label="Total events" value={dashboard?.totals.events ?? 0} note={<><b>{activity.find((item) => item.status === "Upcoming")?.count ?? 0}</b> upcoming on the calendar</>} />
            <StatCard icon={<ClipboardList size={16} />} label="Student registrations" value={dashboard?.totals.registrations ?? 0} note={<><b>{dashboard?.totals.confirmed ?? 0}</b> confirmed · {dashboard?.totals.cancelled ?? 0} cancelled</>} />
            <StatCard icon={<Users size={16} />} label="Participants" value={dashboard?.totals.participants ?? 0} note={<>Unique students with a confirmed place</>} />
            <StatCard icon={<Activity size={16} />} label="Attendance rate" value={`${dashboard?.totals.attendancePercentage ?? 0}%`} note={<><b>{dashboard?.totals.present ?? 0}</b> present of {dashboard?.totals.attendance_records ?? 0} recorded</>} />
          </section>

          <section className="chart-grid" aria-label="Dashboard charts">
            <div className="panel"><div className="panel-head"><div><div className="panel-title">Event calendar</div><div className="panel-caption">Events by current status</div></div><span className="status-legend">{["Completed", "Ongoing", "Upcoming"].map((name, index) => <span className="legend-item" key={name}><i className="legend-dot" style={{ background: chartColors[index] }} />{name}</span>)}</span></div>
              {(dashboard?.totals.events ?? 0) > 0 ? <div className="chart-body"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashboard?.eventStatus} dataKey="count" nameKey="status" innerRadius={53} outerRadius={79} paddingAngle={3} stroke="none">{dashboard?.eventStatus.map((entry, index) => <Cell key={entry.status} fill={chartColors[index]} />)}</Pie><Tooltip formatter={(value) => [`${value} events`, ""]} /></PieChart></ResponsiveContainer></div> : <div className="chart-empty"><div><CalendarDays size={21} /><p>No event records yet. Status totals will appear once events are in the database.</p></div></div>}
            </div>
            <div className="panel"><div className="panel-head"><div><div className="panel-title">Registration activity</div><div className="panel-caption">Daily registrations · last 7 days</div></div><BarChart3 size={16} color="#75827d" /></div>
              {dashboard?.registrationTrend.length ? <div className="chart-body"><ResponsiveContainer width="100%" height="100%"><LineChart data={dashboard.registrationTrend} margin={{ top: 9, right: 10, bottom: 0, left: -20 }}><CartesianGrid stroke="#edf0ed" vertical={false} /><XAxis dataKey="date" tickFormatter={(value: string) => formatDate(value).split(" ").slice(0, 2).join(" ")} tick={{ fill: "#77847e", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#77847e", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={(value) => formatDate(String(value))} /><Line type="monotone" dataKey="registrations" stroke="#397b61" strokeWidth={2.5} dot={{ r: 3, fill: "#397b61", strokeWidth: 0 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <div className="chart-empty"><div><Activity size={21} /><p>No recent registrations to chart. Registration activity will appear here.</p></div></div>}
            </div>
          </section>

          <section className="panel activity-panel"><div className="panel-head"><div><div className="panel-title">Event status</div><div className="panel-caption">Events grouped by date</div></div><button className="button" onClick={() => selectReport("events")}>View event report <ArrowRight size={14} /></button></div><div className="activity-list">{(dashboard?.eventStatus ?? [{ status: "Completed", count: 0 }, { status: "Ongoing", count: 0 }, { status: "Upcoming", count: 0 }]).map((item) => <div className="activity-item" key={item.status}><span className="activity-number">{item.count}</span><div><div className="activity-name">{item.status} events</div><div className="activity-label">{item.status === "Completed" ? "Past event dates" : item.status === "Ongoing" ? "Taking place today" : "Scheduled ahead"}</div></div></div>)}</div></section>

          <section className="report-section" id="report-section">
            <div className="section-head"><div><h2>{selectedReport.title}</h2><p>{selectedReport.description}</p></div><div className="report-actions"><input ref={importInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importCsv(file); event.currentTarget.value = ""; }} /><button className="button" title="Import real college records from CSV" disabled={importing} onClick={() => importInput.current?.click()}><Download size={14} /> {importing ? "Importing" : "Import CSV"}</button><button className="button" title="Download an empty CSV import template" onClick={downloadCsvTemplate}><FileText size={14} /> Template</button><button className="button" title="Export current page to Excel" onClick={() => void exportExcel()} disabled={!result.rows.length}><FileSpreadsheet size={14} /> Excel</button><button className="button" title="Export current page to PDF" onClick={exportPdf} disabled={!result.rows.length}><FileText size={14} /> PDF</button><button className="button" title="Print report" onClick={() => window.print()}><Printer size={14} /> Print</button></div></div>
            <div className="filter-panel"><div className="filters-grid">
              <div className="field field-search"><label htmlFor="report-search">Search reports</label><div className="input-wrap"><Search size={14} /><input id="report-search" className="control" placeholder="Event, student or USN" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
              <div className="field"><label htmlFor="event-filter">Event</label><select id="event-filter" className="control" value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">All events</option>{dashboard?.filters.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></div>
              <div className="field"><label htmlFor="department-filter">Department</label><select id="department-filter" className="control" value={department} disabled={active === "events"} onChange={(event) => setDepartment(event.target.value)}><option value="">All departments</option>{dashboard?.filters.departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
              <div className="field"><label htmlFor="status-filter">Status</label><select id="status-filter" className="control" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></div>
              {active === "events" && <div className="field"><label htmlFor="category-filter">Category</label><select id="category-filter" className="control" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{dashboard?.filters.categories.map((item) => <option key={item}>{item}</option>)}</select></div>}
              <div className="field"><label htmlFor="from-filter">From date</label><input id="from-filter" className="control" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
              <div className="field"><label htmlFor="to-filter">To date</label><input id="to-filter" className="control" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
              <div className="field"><label htmlFor="sort-filter">Sort by</label><select id="sort-filter" className="control" value={sort} onChange={(event) => setSort(event.target.value)}><option value="date">Date</option><option value="eventName">Event name</option>{active === "events" && <option value="attendancePercentage">Attendance %</option>}</select></div>
              <div className="field"><label htmlFor="direction-filter">Order</label><select id="direction-filter" className="control" value={direction} onChange={(event) => setDirection(event.target.value)}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></div>
              <div className="filter-buttons"><button className="button button-primary" onClick={() => { void loadReport(1); setToast("Report generated from current filters."); }}><SlidersHorizontal size={13} /> Generate</button><button className="button" onClick={() => { setSearch(""); setEventId(""); setDepartment(""); setStatus(""); setCategory(""); setFrom(""); setTo(""); setSort("date"); setDirection("desc"); void loadReport(1, { search: "", eventId: "", department: "", status: "", category: "", from: "", to: "", sort: "date", direction: "desc" }); }} title="Reset all report filters">Reset</button></div>
            </div></div>
            <div className="table-meta"><span><strong>{result.total.toLocaleString()}</strong> matching records</span><span className="pagination"><span>Page {result.page} of {totalPages}</span><button aria-label="Previous page" disabled={result.page <= 1 || loading} onClick={() => void loadReport(result.page - 1)}><ArrowLeft size={13} /></button><button aria-label="Next page" disabled={result.page >= totalPages || loading} onClick={() => void loadReport(result.page + 1)}><ArrowRight size={13} /></button></span></div>
            {reportError && <div className="error-message" role="alert">{reportError}</div>}
            <div className="table-scroll">{loading ? <div className="loading-line"><span className="spinner" /> Generating report…</div> : result.rows.length === 0 ? <EmptyState title="No report data found">There are no matching records for this report. Add events and registrations to the college database or adjust your filters.</EmptyState> : <table className="report-table"><thead><tr>{columns[active].map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={String(row.id ?? index)}>{columns[active].map((column) => <td key={column.key} className={column.key === "event_name" || column.key === "student_name" ? "primary-cell" : ""}>{column.key === "status" || column.key === "attendance_status" ? <StatusBadge value={String(row[column.key] ?? "Unknown")} /> : column.key === "attendance_percentage" ? <span className="percent-cell"><span className="percent-track"><span className="percent-fill" style={{ width: `${Math.min(100, Number(row[column.key]) || 0)}%` }} /></span>{displayValue(column.key, row[column.key] ?? null)}</span> : displayValue(column.key, row[column.key] ?? null)}</td>)}</tr>)}</tbody></table>}</div>
          </section>
          {dashboard?.eventAttendance.some((item) => item.recorded > 0) && <section className="report-section"><div className="panel"><div className="panel-head"><div><div className="panel-title">Attendance by event</div><div className="panel-caption">Present participants in recent events</div></div><Activity size={16} color="#75827d" /></div><div className="chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboard.eventAttendance} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 16 }}><CartesianGrid stroke="#edf0ed" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: "#77847e", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="event_name" width={112} tick={{ fill: "#56665d", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="present" name="Present" fill="#397b61" radius={[0, 3, 3, 0]} barSize={13} /></BarChart></ResponsiveContainer></div></div></section>}
          <footer className="no-print" style={{ marginTop: 28, color: "#87938d", fontSize: 11 }}>Reporting data is calculated from the current college event database.</footer>
        </main>
      </div>
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  );
}

function StatCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string | number; note: React.ReactNode }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{typeof value === "number" ? value.toLocaleString() : value}</div><div className="stat-note">{note}</div></article>;
}