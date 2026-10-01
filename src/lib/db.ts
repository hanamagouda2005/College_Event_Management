import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "reports.sqlite");
mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    event_date TEXT NOT NULL,
    venue TEXT NOT NULL,
    category TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    usn TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    email TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    registration_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Confirmed', 'Cancelled')),
    UNIQUE(student_id, event_id)
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY,
    registration_id INTEGER NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
    attendance_date TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date);
  CREATE UNIQUE INDEX IF NOT EXISTS events_name_date_idx ON events(name, event_date);
  CREATE INDEX IF NOT EXISTS registrations_event_idx ON registrations(event_id, status);
  CREATE INDEX IF NOT EXISTS students_department_idx ON students(department);
  CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance(attendance_date);
`);

export function getDatabase() {
  return database;
}
