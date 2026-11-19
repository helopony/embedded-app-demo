import "server-only";
import manifest from "@/app.manifest.json";
import { hostApiOrigin } from "./origins";

export const requestedScope = manifest.scopes.join(" ");

function clientSecret() {
  const secret = process.env.DEMO_CLIENT_SECRET;
  if (secret && Buffer.byteLength(secret) >= 32) return secret;
  if (!secret && process.env.NODE_ENV !== "production") {
    return "local-development-only-workspace-demo-DEMO_CLIENT_SECRET";
  }
  throw new Error("DEMO_CLIENT_SECRET requires at least 32 bytes in the server environment.");
}

// The admin token endpoint verifies the launch assertion and issues the access token.
export function exchangeAssertion(assertion: string) {
  const credentials = Buffer.from(`${manifest.id}:${clientSecret()}`).toString("base64");
  return fetch(new URL("/api/oauth/token", hostApiOrigin()), {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Basic ${credentials}` },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      subject_token: assertion,
      scope: requestedScope,
    }),
  });
}

export function fetchSales(accessToken: string) {
  return fetch(new URL("/api/sales", hostApiOrigin()), {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
