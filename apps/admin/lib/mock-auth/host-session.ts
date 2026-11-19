import type { NextRequest } from "next/server";
import { isHostOrigin } from "@/lib/origins";
import { json, requestOrigin } from "@/lib/mock-auth/http";
import { tokenService } from "@/lib/mock-auth/runtime";
import { LAUNCH_LIFETIME, SESSION_LIFETIME } from "@/lib/mock-auth/tokens";

export async function hostSessionResponse(request: NextRequest, purpose: "identity" | "launch") {
  const origin = requestOrigin(request);
  if (!isHostOrigin(origin)) return json({ error: "not_found" }, 404);
  if (request.headers.get("origin") !== origin) return json({ error: "origin_denied" }, 403);

  const tokens = tokenService();
  const secure = origin.startsWith("https://");
  const cookieName = secure ? "__Host-workspace-demo" : "workspace-demo-local";
  async function responseFor(session: string) {
    if (purpose === "identity") return json(await tokens.identity(session));
    return json({ assertion: await tokens.launch(session), expiresIn: LAUNCH_LIFETIME });
  }

  const current = request.cookies.get(cookieName)?.value;
  if (current) {
    try {
      return await responseFor(current);
    } catch {
      // An expired or invalid cookie starts a new session for the public demo.
    }
  }

  const session = await tokens.newSession();
  const response = await responseFor(session);
  response.cookies.set(cookieName, session, {
    httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: SESSION_LIFETIME,
  });
  return response;
}
