import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { queryReport, type ReportFilters, type ReportType } from "@/lib/reports";

export const dynamic = "force-dynamic";

const reportTypes: ReportType[] = ["events", "registrations", "participants", "attendance"];
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function dateIsValid(value: string) {
  if (!isoDate.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  const search = new URL(request.url).searchParams;
  const type = search.get("type") ?? "events";
  const from = search.get("from") || undefined;
  const to = search.get("to") || undefined;
  const page = Number(search.get("page") ?? 1);
  const pageSize = Number(search.get("pageSize") ?? 10);
  const eventId = search.get("eventId") ? Number(search.get("eventId")) : undefined;
  const requestedSort = search.get("sort");
  const sort: ReportFilters["sort"] = requestedSort === "eventName" || requestedSort === "attendancePercentage" ? requestedSort : "date";

  if (!reportTypes.includes(type as ReportType)) return NextResponse.json({ error: "Choose a valid report type." }, { status: 400 });
  if ((from && !dateIsValid(from)) || (to && !dateIsValid(to)) || (from && to && from > to)) {
    return NextResponse.json({ error: "Enter a valid date range. The start must not be after the end." }, { status: 400 });
  }
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return NextResponse.json({ error: "Page must be positive and page size must be between 1 and 100." }, { status: 400 });
  }
  if (eventId !== undefined && (!Number.isInteger(eventId) || eventId < 1)) {
    return NextResponse.json({ error: "Choose a valid event." }, { status: 400 });
  }

  const filters: ReportFilters = {
    type: type as ReportType,
    search: (search.get("search") ?? "").trim().slice(0, 120),
    eventId,
    department: search.get("department") ?? "",
    status: search.get("status") ?? "",
    category: search.get("category") ?? "",
    from,
    to,
    sort,
    direction: search.get("direction") === "asc" ? "asc" : "desc",
    page,
    pageSize,
  };

  try {
    return NextResponse.json(queryReport(filters));
  } catch {
    return NextResponse.json({ error: "Could not generate this report." }, { status: 500 });
  }
}