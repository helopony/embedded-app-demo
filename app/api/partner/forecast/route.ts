import { hostApiOrigin, isPartnerOrigin } from "@/lib/origins";
import { bearer, json, requestOrigin } from "@/lib/mock-auth/http";
import { clientSecret } from "@/lib/mock-auth/runtime";
import { CLIENT_ID, EXCHANGE_GRANT, JWT_TYPE, SALES_SCOPE } from "@/lib/mock-auth/tokens";

export async function GET(request: Request) {
  if (!isPartnerOrigin(requestOrigin(request))) return json({ error: "not_found" }, 404);
  const assertion = bearer(request);
  if (!assertion) {
    return json({ error: "launch_assertion_required" }, 401, { "WWW-Authenticate": 'Bearer realm="partner-forecast"' });
  }
  const origin = hostApiOrigin();
  const auth = Buffer.from(`${CLIENT_ID}:${clientSecret()}`).toString("base64");

  try {
    const exchange = await fetch(new URL("/api/oauth/token", origin), {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Basic ${auth}` },
      body: new URLSearchParams({
        grant_type: EXCHANGE_GRANT, subject_token_type: JWT_TYPE,
        subject_token: assertion, scope: SALES_SCOPE,
      }),
    });
    if (!exchange.ok) {
      if (exchange.status === 400 && (await exchange.json()).error === "invalid_grant") {
        return json({ error: "invalid_launch_assertion" }, 401);
      }
      return json({ error: "token_exchange_unavailable" }, 502);
    }
    const { access_token, token_type, scope, expires_in } = await exchange.json();
    if (
      typeof access_token !== "string" || !access_token || token_type !== "Bearer" ||
      scope !== SALES_SCOPE || !Number.isSafeInteger(expires_in) || expires_in <= 0
    ) return json({ error: "token_exchange_unavailable" }, 502);
    const sales = await fetch(new URL("/api/sales", origin), {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!sales.ok) return json({ error: "sales_unavailable" }, sales.status === 403 ? 403 : 502);
    const { store, actor, rows, scope: salesScope } = await sales.json();
    return json({
      store, actor, rows, scope: salesScope,
      authorization: {
        exchangeStatus: exchange.status,
        tokenType: token_type,
        grantedScope: scope,
        expiresIn: expires_in,
        salesStatus: sales.status,
      },
    });
  } catch {
    return json({ error: "host_unavailable" }, 502);
  }
}
