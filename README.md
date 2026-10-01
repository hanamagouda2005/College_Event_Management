## Campus Ledger Reporting

An administrator-only event reporting dashboard built with Next.js, SQLite, and React. This workspace was empty, so the app creates its own SQLite database at `data/reports.sqlite`; no sample records are inserted. Import your college's real registration data from the CSV template in the report toolbar.

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000 and sign in with the local development password `campus-admin`. Change `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `NEXT_PUBLIC_COLLEGE_NAME` in `.env.local` before using this outside local development. `.env.local` is ignored by Git.

Copy `.env.example` to `.env.local` to configure another environment. Set a long, random session secret and a unique administrator password. Sessions are signed, HTTP-only, SameSite cookies that expire after eight hours.

## Import records

Use **Template** in the report toolbar to download a CSV header template. Import one row per student-event registration. Required columns are:

`event_name,event_date,venue,category,student_name,usn,department,email,registration_date,registration_status`

Optional attendance columns are `attendance_status,attendance_date`; provide both or leave both blank. Dates must use `YYYY-MM-DD`. Registration status accepts `Confirmed` or `Cancelled`; attendance status accepts `Present` or `Absent`. Imports validate all rows before writing and then apply the batch in one transaction. Re-importing a matching event/date, USN, or student/event pair updates the existing record.

## Data and reports

The SQLite schema is initialized automatically and contains `events`, `students`, `registrations`, and `attendance`. Dashboard aggregates and all four report types query that database. Report APIs require an authenticated administrator session and support event, department, status, category, search, date-range, sorting, and pagination filters.

Excel, PDF, and print output include the configured college name, report title, generation time, and filtered summary statistics. Exports include the currently displayed page of the filtered report.

## Checks

```powershell
npm run lint
npm run build
```
