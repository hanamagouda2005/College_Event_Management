import { NextResponse } from "next/server";
import { createAdminSession, verifyAdminPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { password?: unknown };
    if (typeof body.password !== "string" || body.password.length > 256) {
      return NextResponse.json({ error: "Enter a valid administrator password." }, { status: 400 });
    }
    if (!verifyAdminPassword(body.password)) {
      return NextResponse.json({ error: "The administrator password is incorrect." }, { status: 401 });
    }
    await createAdminSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign in.";
    return NextResponse.json({ error: message }, { status: message.includes("not configured") ? 503 : 400 });
  }
}