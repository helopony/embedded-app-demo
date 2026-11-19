import { exchangeAssertion, fetchSales, requestedScope } from "@/lib/forecast-client";
import { partnerOrigin, requestOrigin } from "@/lib/origins";

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", ...headers } });
}

export async function GET(request: Request) {
  if (requestOrigin(request) !== partnerOrigin()) return json({ error: "not_found" }, 404);
  const assertion = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!assertion) {
    return json({ error: "launch_assertion_required" }, 401, { "WWW-Authenticate": 'Bearer realm="partner-forecast"' });
  }
  try {
    const exchange = await exchangeAssertion(assertion);
    if (!exchange.ok) {
      if (exchange.status === 400 && (await exchange.json()).error === "invalid_grant") {
        return json({ error: "invalid_launch_assertion" }, 401);
      }
      return json({ error: "token_exchange_unavailable" }, 502);
    }
    const { access_token, token_type, scope, expires_in } = await exchange.json();
    if (
      typeof access_token !== "string" || !access_token || token_type !== "Bearer" ||
      scope !== requestedScope || !Number.isSafeInteger(expires_in) || expires_in <= 0
    ) return json({ error: "token_exchange_unavailable" }, 502);
    const sales = await fetchSales(access_token);
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
