import { NextResponse } from "next/server";

export function requestOrigin(request: Request) {
  // Next's local adapter can normalize the URL hostname to localhost even for
  // requests made to 127.0.0.1. Host carries the browser's actual destination.
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return "";
  return `${url.protocol}//${host.toLowerCase()}`;
}

export function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", ...headers },
  });
}

export function bearer(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
}
