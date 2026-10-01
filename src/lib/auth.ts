import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "campus_report_session";
const sessionDurationSeconds = 60 * 60 * 8;

function signature(payload: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not configured");
  const submitted = Buffer.from(password);
  const configured = Buffer.from(expected);
  return submitted.length === configured.length && timingSafeEqual(submitted, configured);
}

export async function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationSeconds;
  const payload = `admin:${expiresAt}`;
  const jar = await cookies();
  jar.set(cookieName, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionDurationSeconds,
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(cookieName);
}

export async function isAdminAuthenticated() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 0) return false;
  const payload = token.slice(0, separator);
  const suppliedSignature = Buffer.from(token.slice(separator + 1));
  let expectedSignature: Buffer;
  try {
    expectedSignature = Buffer.from(signature(payload));
  } catch {
    return false;
  }
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) return false;
  const [role, expiresAt] = payload.split(":");
  return role === "admin" && Number(expiresAt) > Math.floor(Date.now() / 1000);
}
