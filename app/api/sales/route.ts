import { isHostOrigin } from "@/lib/origins";
import { bearer, json, requestOrigin } from "@/lib/mock-auth/http";
import { tokenService } from "@/lib/mock-auth/runtime";
import { SALES_SCOPE } from "@/lib/mock-auth/tokens";

export async function GET(request: Request) {
  if (!isHostOrigin(requestOrigin(request))) return json({ error: "not_found" }, 404);
  const token = bearer(request);
  const tokens = tokenService();
  if (!token) return json({ error: "invalid_token" }, 401, { "WWW-Authenticate": "Bearer" });
  try {
    if (!(await tokens.canReadSales(token))) return json({ error: "insufficient_scope" }, 403);
  } catch {
    return json({ error: "invalid_token" }, 401, { "WWW-Authenticate": "Bearer" });
  }

  return json({
    store: { name: "Berlin Mitte" },
    actor: { name: "Alex Morgan" },
    scope: SALES_SCOPE,
    rows: [
      { day: "Monday", orders: 84 },
      { day: "Tuesday", orders: 91 },
      { day: "Wednesday", orders: 88 },
      { day: "Thursday", orders: 104 },
      { day: "Friday", orders: 126 },
      { day: "Saturday", orders: 142 },
      { day: "Sunday", orders: 110 },
    ],
  });
}
