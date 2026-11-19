import { NextResponse, type NextRequest } from "next/server";
import { hostApiOrigin, isHostOrigin, isPartnerOrigin, partnerOrigin, trustedHostOrigins } from "./lib/origins";

export function proxy(request: NextRequest) {
  const { pathname, protocol } = request.nextUrl;
  const origin = protocol + "//" + request.headers.get("host");
  const role = process.env.WORKSPACE_DEPLOYMENT_ROLE ?? (process.env.VERCEL ? undefined : "local");
  if (role !== "host" && role !== "partner" && !(role === "local" && !process.env.VERCEL)) {
    return new NextResponse("Deployment role is missing or invalid.", { status: 503 });
  }
  if (pathname === "/" && (role === "partner" || isPartnerOrigin(origin))) {
    return NextResponse.redirect(new URL("/embed/authentication", partnerOrigin()));
  }
  const embedded = pathname === "/embed" || pathname.startsWith("/embed/");
  if (embedded && role === "partner" && !isPartnerOrigin(origin) && (request.method === "GET" || request.method === "HEAD")) {
    return NextResponse.redirect(new URL(pathname + request.nextUrl.search, partnerOrigin()));
  }
  const api = pathname.startsWith("/api/");
  const partnerRoute = embedded || pathname.startsWith("/api/partner/");
  if (partnerRoute ? role === "host" || !isPartnerOrigin(origin) : role === "partner" || !isHostOrigin(origin)) {
    if (api) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (partnerRoute || role === "partner" || isPartnerOrigin(origin)) {
      return new NextResponse("Page not found.", { status: 404 });
    }
    return NextResponse.redirect(new URL("/", hostApiOrigin()));
  }
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", embedded
    ? "frame-ancestors " + trustedHostOrigins().join(" ")
    : "frame-ancestors 'none'; frame-src " + partnerOrigin());
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = { matcher: ["/", "/apps/:path*", "/embed/:path*", "/api/:path*"] };
