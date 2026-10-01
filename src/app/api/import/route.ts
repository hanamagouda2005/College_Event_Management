import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

type ImportRow = Record<string, unknown>;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(row: ImportRow, field: string, line: number, maxLength = 200) {
  const value = row[field];
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`Row ${line}: ${field} is required and must be under ${maxLength} characters.`);
  }
  return value.trim();
}

function date(row: ImportRow, field: string, line: number) {
  const value = text(row, field, line, 10);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!datePattern.test(value) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Row ${line}: ${field} must use YYYY-MM-DD format.`);
  }
  return value;
}

function optionalText(row: ImportRow, field: string, maxLength = 200) {
  const value = row[field];
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeStatus(value: unknown, allowed: string[], field: string, line: number) {
  if (typeof value !== "string") throw new Error(`Row ${line}: ${field} is invalid.`);
  const match = allowed.find((item) => item.toLowerCase() === value.trim().toLowerCase());
  if (!match) throw new Error(`Row ${line}: ${field} must be ${allowed.join(" or ")}.`);
  return match;
}

function validateRow(row: ImportRow, index: number) {
  const line = index + 2;
  const normalized = {
    eventName: text(row, "event_name", line),
    eventDate: date(row, "event_date", line),
    venue: text(row, "venue", line),
    category: text(row, "category", line, 100),
    studentName: text(row, "student_name", line),
    usn: text(row, "usn", line, 40).toUpperCase(),
    department: text(row, "department", line, 100),
    email: text(row, "email", line, 254),
    registrationDate: date(row, "registration_date", line),
    registrationStatus: normalizeStatus(row.registration_status, ["Confirmed", "Cancelled"], "registration_status", line),
    attendanceStatus: optionalText(row, "attendance_status", 20),
    attendanceDate: optionalText(row, "attendance_date", 10),
  };
  if (!emailPattern.test(normalized.email)) throw new Error(`Row ${line}: email must be a valid email address.`);
  if (Boolean(normalized.attendanceStatus) !== Boolean(normalized.attendanceDate)) {
    throw new Error(`Row ${line}: provide both attendance_status and attendance_date, or leave both blank.`);
  }
  if (normalized.attendanceStatus) {
    normalized.attendanceStatus = normalizeStatus(normalized.attendanceStatus, ["Present", "Absent"], "attendance_status", line);
    const parsed = new Date(`${normalized.attendanceDate}T00:00:00Z`);
    if (!datePattern.test(normalized.attendanceDate) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== normalized.attendanceDate) {
      throw new Error(`Row ${line}: attendance_date must use YYYY-MM-DD format.`);
    }
  }
  return normalized;
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 4_000_000) {
    return NextResponse.json({ error: "Import is too large. Upload up to 4 MB per request." }, { status: 413 });
  }

  try {
    const payload = await request.json() as { rows?: unknown };
    if (!Array.isArray(payload.rows) || payload.rows.length === 0 || payload.rows.length > 5000) {
      return NextResponse.json({ error: "Upload between 1 and 5,000 CSV data rows." }, { status: 400 });
    }
    if (payload.rows.some((row) => typeof row !== "object" || row === null || Array.isArray(row))) {
      return NextResponse.json({ error: "Each CSV line must be a row of named fields." }, { status: 400 });
    }
    const rows = payload.rows.map((row, index) => validateRow(row as ImportRow, index));
    const db = getDatabase();
    const insertRows = db.transaction(() => {
      const event = db.prepare(`INSERT INTO events (name, event_date, venue, category) VALUES (?, ?, ?, ?)
        ON CONFLICT(name, event_date) DO UPDATE SET venue = excluded.venue, category = excluded.category`);
      const student = db.prepare(`INSERT INTO students (name, usn, department, email) VALUES (?, ?, ?, ?)
        ON CONFLICT(usn) DO UPDATE SET name = excluded.name, department = excluded.department, email = excluded.email`);
      const registration = db.prepare(`INSERT INTO registrations (student_id, event_id, registration_date, status) VALUES (?, ?, ?, ?)
        ON CONFLICT(student_id, event_id) DO UPDATE SET registration_date = excluded.registration_date, status = excluded.status`);
      const attendance = db.prepare(`INSERT INTO attendance (registration_id, status, attendance_date) VALUES (?, ?, ?)
        ON CONFLICT(registration_id) DO UPDATE SET status = excluded.status, attendance_date = excluded.attendance_date`);
      const findEvent = db.prepare("SELECT id FROM events WHERE name = ? AND event_date = ?");
      const findStudent = db.prepare("SELECT id FROM students WHERE usn = ?");
      const findRegistration = db.prepare("SELECT id FROM registrations WHERE student_id = ? AND event_id = ?");
      for (const row of rows) {
        event.run(row.eventName, row.eventDate, row.venue, row.category);
        student.run(row.studentName, row.usn, row.department, row.email);
        const eventId = (findEvent.get(row.eventName, row.eventDate) as { id: number }).id;
        const studentId = (findStudent.get(row.usn) as { id: number }).id;
        registration.run(studentId, eventId, row.registrationDate, row.registrationStatus);
        const registrationId = (findRegistration.get(studentId, eventId) as { id: number }).id;
        if (row.attendanceStatus && row.attendanceDate) attendance.run(registrationId, row.attendanceStatus, row.attendanceDate);
      }
    });
    insertRows();
    return NextResponse.json({ imported: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import these records.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}