import { isHostOrigin } from "@/lib/origins";
import { json, requestOrigin } from "@/lib/mock-auth/http";
import { clientSecret, tokenService } from "@/lib/mock-auth/runtime";
import {
  ACCESS_LIFETIME, ACCESS_TYPE, EXCHANGE_GRANT, JWT_TYPE, SALES_SCOPE, validClientAuthorization,
} from "@/lib/mock-auth/tokens";

export async function POST(request: Request) {
  if (!isHostOrigin(requestOrigin(request))) return json({ error: "not_found" }, 404);
  if (!validClientAuthorization(request.headers.get("authorization"), clientSecret())) {
    return json({ error: "invalid_client" }, 401, { "WWW-Authenticate": 'Basic realm="sides-demo"' });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded") {
    return json({ error: "invalid_request" }, 400);
  }
  const form = new URLSearchParams(await request.text());
  if (form.get("grant_type") !== EXCHANGE_GRANT) {
    return json({ error: "unsupported_grant_type" }, 400);
  }
  if (form.get("scope") !== SALES_SCOPE) return json({ error: "invalid_scope" }, 400);
  const assertion = form.get("subject_token");
  if (form.get("subject_token_type") !== JWT_TYPE || !assertion) {
    return json({ error: "invalid_request" }, 400);
  }
  const tokens = tokenService();
  try {
    return json({
      access_token: await tokens.exchange(assertion),
      issued_token_type: ACCESS_TYPE,
      token_type: "Bearer",
      expires_in: ACCESS_LIFETIME,
      scope: SALES_SCOPE,
    });
  } catch {
    return json({ error: "invalid_grant" }, 400);
  }
}
