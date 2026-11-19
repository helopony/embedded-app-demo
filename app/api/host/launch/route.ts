import type { NextRequest } from "next/server";
import { isHostOrigin } from "@/lib/origins";
import { json, requestOrigin } from "@/lib/mock-auth/http";
import { tokenService } from "@/lib/mock-auth/runtime";
import { LAUNCH_LIFETIME, SESSION_LIFETIME } from "@/lib/mock-auth/tokens";

export async function POST(request: NextRequest) {
  const origin = requestOrigin(request);
  if (!isHostOrigin(origin)) return json({ error: "not_found" }, 404);
  if (request.headers.get("origin") !== origin) return json({ error: "origin_denied" }, 403);

  const tokens = tokenService();
  const secure = origin.startsWith("https://");
  const cookieName = secure ? "__Host-sides-demo" : "sides-demo-local";
  const current = request.cookies.get(cookieName)?.value;
  if (current) {
    try {
      return json({ assertion: await tokens.launch(current), expiresIn: LAUNCH_LIFETIME });
    } catch {
      // This is a public synthetic shop. An expired cookie starts a fresh demo.
    }
  }

  const session = await tokens.newSession();
  const response = json({ assertion: await tokens.launch(session), expiresIn: LAUNCH_LIFETIME });
  response.cookies.set(cookieName, session, {
    httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: SESSION_LIFETIME,
  });
  return response;
}
