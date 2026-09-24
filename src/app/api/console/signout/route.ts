import { NextRequest, NextResponse } from "next/server";
import { COOKIE, clearCookie } from "@/lib/server/session-cookies";

/** Drops the console's session cookies even when the API cannot be reached. */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-console-request") !== "1") {
    return NextResponse.json({ statusCode: 403, code: "CSRF", message: "Missing console request header" }, { status: 403 });
  }
  const res = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  for (const name of Object.values(COOKIE)) res.headers.append("set-cookie", clearCookie(name));
  return res;
}
