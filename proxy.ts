import { NextResponse, type NextRequest } from "next/server";
import { hostApiOrigin, isHostOrigin, isPartnerOrigin, partnerOrigin, trustedHostOrigins } from "./lib/origins";

export function proxy(request: NextRequest) {
  const { pathname, protocol } = request.nextUrl;
  const origin = protocol + "//" + request.headers.get("host");
  const embedded = pathname === "/embed" || pathname.startsWith("/embed/");
  if (embedded && !isPartnerOrigin(origin)) {
    return new NextResponse("Partner app has a separate origin.", { status: 404 });
  }
  if (!embedded && !isHostOrigin(origin)) {
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

export const config = { matcher: ["/", "/apps/:path*", "/embed/:path*"] };
