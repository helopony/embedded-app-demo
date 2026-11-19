import { NextResponse, type NextRequest } from "next/server";
import { partnerOrigin, requestOrigin, trustedHostOrigins } from "./lib/origins";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const embedded = pathname === "/embed" || pathname.startsWith("/embed/");
  if (requestOrigin(request) !== partnerOrigin()) {
    if (embedded && (request.method === "GET" || request.method === "HEAD")) {
      return NextResponse.redirect(new URL(pathname + search, partnerOrigin()));
    }
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", embedded
    ? "frame-ancestors " + trustedHostOrigins().join(" ")
    : "frame-ancestors 'none'");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = { matcher: ["/embed/:path*", "/api/partner/:path*"] };
