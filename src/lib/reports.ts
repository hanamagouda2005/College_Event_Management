import "server-only";

import { getDatabase } from "@/lib/db";

export type ReportType = "events" | "registrations" | "participants" | "attendance";

const eventStatusSql = "CASE WHEN date(e.event_date) < date('now','localtime') THEN 'Completed' WHEN date(e.event_date) = date('now','localtime') THEN 'Ongoing' ELSE 'Upcoming' END";

const reportSelects: Record<ReportType, string> = {
  events: `
    SELECT e.id, e.name AS event_name, e.event_date, e.venue, e.category,
      ${eventStatusSql} AS status,
      COUNT(DISTINCT r.id) AS total_registrations,
      COUNT(DISTINCT CASE WHEN r.status = 'Confirmed' THEN r.id END) AS confirmed_registrations,
      COUNT(DISTINCT CASE WHEN a.status = 'Present' THEN a.id END) AS present,
      COUNT(DISTINCT a.id) AS attendance_recorded,
      CASE WHEN COUNT(DISTINCT a.id) = 0 THEN 0
        ELSE ROUND(100.0 * COUNT(DISTINCT CASE WHEN a.status = 'Present' THEN a.id END) / COUNT(DISTINCT a.id), 1)
      END AS attendance_percentage
    FROM events e
    LEFT JOIN registrations r ON r.event_id = e.id
    LEFT JOIN attendance a ON a.registration_id = r.id
  `,
  registrations: `
    SELECT r.id, s.name AS student_name, s.usn, s.department, s.email,
      e.name AS event_name, e.event_date, r.registration_date, r.status
    FROM registrations r
    JOIN students s ON s.id = r.student_id
    JOIN events e ON e.id = r.event_id
  `,
  participants: `
    SELECT r.id, s.name AS student_name, s.usn, s.department,
      e.name AS event_name, e.event_date, r.registration_date, r.status
    FROM registrations r
    JOIN students s ON s.id = r.student_id
    JOIN events e ON e.id = r.event_id
  `,
  attendance: `
    SELECT a.id, s.name AS student_name, s.usn, s.department,
      e.name AS event_name, e.event_date, a.status AS attendance_status, a.attendance_date
    FROM attendance a
    JOIN registrations r ON r.id = a.registration_id
    JOIN students s ON s.id = r.student_id
    JOIN events e ON e.id = r.event_id
  `,
};

export interface ReportFilters {
  type: ReportType;
  search: string;
  eventId?: number;
  department: string;
  status: string;
  category: string;
  from?: string;
  to?: string;
  sort: "eventName" | "date" | "attendancePercentage";
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
}

function buildWhere(filters: ReportFilters) {
  const clauses: string[] = [];
  const params: Record<string, string | number> = {};
  const eventDateColumn = filters.type === "attendance" ? "a.attendance_date" : filters.type === "events" ? "e.event_date" : "r.registration_date";

  if (filters.search) {
    if (filters.type === "events") {
      clauses.push("e.name LIKE @search");
    } else {
      clauses.push("(e.name LIKE @search OR s.name LIKE @search OR s.usn LIKE @search)");
    }
    params.search = `%${filters.search}%`;
  }
  if (filters.eventId) {
    clauses.push("e.id = @eventId");
    params.eventId = filters.eventId;
  }
  if (filters.department && filters.type !== "events") {
    clauses.push("s.department = @department");
    params.department = filters.department;
  }
  if (filters.category && filters.type === "events") {
    clauses.push("e.category = @category");
    params.category = filters.category;
  }
  if (filters.status) {
    if (filters.type === "events") clauses.push(`${eventStatusSql} = @status`);
    else if (filters.type === "attendance") clauses.push("a.status = @status");
    else clauses.push("r.status = @status");
    params.status = filters.status;
  }
  if (filters.from) {
    clauses.push(`date(${eventDateColumn}) >= date(@from)`);
    params.from = filters.from;
  }
  if (filters.to) {
    clauses.push(`date(${eventDateColumn}) <= date(@to)`);
    params.to = filters.to;
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export function queryReport(filters: ReportFilters) {
  const db = getDatabase();
  const { sql: where, params } = buildWhere(filters);
  const groupBy = filters.type === "events" ? "GROUP BY e.id" : "";
  const orderBy = filters.sort === "eventName"
    ? `event_name ${filters.direction}, ${filters.type === "events" ? "event_date" : "registration_date"} DESC`
    : filters.sort === "attendancePercentage" && filters.type === "events"
      ? `attendance_percentage ${filters.direction}, event_date DESC`
      : `${filters.type === "events" ? "event_date" : filters.type === "attendance" ? "attendance_date" : "registration_date"} ${filters.direction}`;
  const query = `${reportSelects[filters.type]} ${where} ${groupBy}`;
  const countRow = db.prepare(`SELECT COUNT(*) AS total FROM (${query}) AS report_rows`).get(params) as { total: number };
  const summaryColumns: Record<ReportType, string> = {
    events: `COUNT(*) AS total, COALESCE(SUM(total_registrations), 0) AS registrations,
      COALESCE(SUM(present), 0) AS present, COALESCE(SUM(attendance_recorded), 0) AS attendanceRecords`,
    registrations: `COUNT(*) AS total, COALESCE(SUM(status = 'Confirmed'), 0) AS confirmed,
      COALESCE(SUM(status = 'Cancelled'), 0) AS cancelled`,
    participants: `COUNT(*) AS total, COALESCE(SUM(status = 'Confirmed'), 0) AS confirmed,
      COALESCE(SUM(status = 'Cancelled'), 0) AS cancelled`,
    attendance: `COUNT(*) AS total, COALESCE(SUM(attendance_status = 'Present'), 0) AS present,
      COALESCE(SUM(attendance_status = 'Absent'), 0) AS absent`,
  };
  const summary = db.prepare(`SELECT ${summaryColumns[filters.type]} FROM (${query}) AS report_rows`).get(params) as Record<string, number>;
  if (filters.type === "events") {
    summary.attendancePercentage = summary.attendanceRecords ? Math.round((summary.present / summary.attendanceRecords) * 1000) / 10 : 0;
  }
  if (filters.type === "attendance") {
    summary.attendancePercentage = summary.total ? Math.round((summary.present / summary.total) * 1000) / 10 : 0;
  }
  const rows = db.prepare(`${query} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`).all({
    ...params,
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize,
  });
  return { rows, total: countRow.total, page: filters.page, pageSize: filters.pageSize, summary };
}

export function getDashboardData() {
  const db = getDatabase();
  const eventStatus = db.prepare(`
    SELECT ${eventStatusSql} AS status, COUNT(*) AS count
    FROM events e GROUP BY status
  `).all() as { status: string; count: number }[];
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM events) AS events,
      (SELECT COUNT(*) FROM registrations) AS registrations,
      (SELECT COUNT(DISTINCT student_id) FROM registrations WHERE status = 'Confirmed') AS participants,
      (SELECT COUNT(*) FROM attendance WHERE status = 'Present') AS present,
      (SELECT COUNT(*) FROM attendance) AS attendance_records,
      (SELECT COUNT(*) FROM registrations WHERE status = 'Confirmed') AS confirmed,
      (SELECT COUNT(*) FROM registrations WHERE status = 'Cancelled') AS cancelled
  `).get() as Record<string, number>;
  const registrationTrend = db.prepare(`
    SELECT date(registration_date) AS date, COUNT(*) AS registrations
    FROM registrations
    WHERE date(registration_date) >= date('now','localtime','-6 days')
    GROUP BY date(registration_date) ORDER BY date(registration_date)
  `).all();
  const eventAttendance = db.prepare(`
    SELECT e.name AS event_name,
      COUNT(CASE WHEN a.status = 'Present' THEN 1 END) AS present,
      COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) AS absent,
      COUNT(a.id) AS recorded
    FROM events e LEFT JOIN registrations r ON r.event_id = e.id
    LEFT JOIN attendance a ON a.registration_id = r.id
    GROUP BY e.id ORDER BY e.event_date DESC LIMIT 6
  `).all();
  const filters = db.prepare(`
    SELECT (SELECT json_group_array(json_object('id', id, 'name', name)) FROM events) AS events,
      (SELECT json_group_array(category) FROM (SELECT DISTINCT category FROM events ORDER BY category)) AS categories,
      (SELECT json_group_array(department) FROM (SELECT DISTINCT department FROM students ORDER BY department)) AS departments
  `).get() as { events: string; categories: string; departments: string };

  return {
    totals: {
      ...totals,
      attendancePercentage: totals.attendance_records ? Math.round((totals.present / totals.attendance_records) * 1000) / 10 : 0,
    },
    eventStatus: ["Completed", "Ongoing", "Upcoming"].map((status) => ({
      status,
      count: eventStatus.find((item) => item.status === status)?.count ?? 0,
    })),
    registrationTrend,
    eventAttendance,
    filters: {
      events: JSON.parse(filters.events) as { id: number; name: string }[],
      categories: JSON.parse(filters.categories) as string[],
      departments: JSON.parse(filters.departments) as string[],
    },
  };
}
