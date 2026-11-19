import type { NextRequest } from "next/server";
import { hostSessionResponse } from "@/lib/mock-auth/host-session";

export async function POST(request: NextRequest) {
  return hostSessionResponse(request, "launch");
}
