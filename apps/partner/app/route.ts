import { NextResponse } from "next/server";
import { partnerOrigin } from "@/lib/origins";

export function GET(request: Request) {
  const target = new URL("/embed/authentication", partnerOrigin());
  target.search = new URL(request.url).search;
  return NextResponse.redirect(target);
}
