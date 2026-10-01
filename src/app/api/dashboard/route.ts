import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getDashboardData } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Administrator access required." }, { status: 401 });
  try {
    return NextResponse.json(getDashboardData());
  } catch {
    return NextResponse.json({ error: "Could not load dashboard data." }, { status: 500 });
  }
}