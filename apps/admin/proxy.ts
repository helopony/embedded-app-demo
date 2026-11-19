import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "./lib/mock-auth/http";
import { hostApiOrigin, isHostOrigin, partnerOrigin } from "./lib/origins";

export function proxy(request: NextRequest) {
  if (!isHostOrigin(requestOrigin(request))) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.redirect(new URL("/", hostApiOrigin()));
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'; frame-src " + partnerOrigin());
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = { matcher: ["/", "/apps/:path*", "/api/:path*"] };
