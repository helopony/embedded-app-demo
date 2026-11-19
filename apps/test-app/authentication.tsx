import { useEffect, useState } from "react";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { Badge } from "@/components/ui/badge";
import manifest from "./sides.app.json";

export type AuthorizationReceipt = {
  exchangeStatus: number;
  tokenType: string;
  grantedScope: string;
  expiresIn: number;
  salesStatus: number;
};

// For display in the partner iframe. The SIDES token endpoint checks the signature and grant.
export function readLaunchClaims(assertion: string) {
  const { sub, aud, iss, jti, iat, exp, installation_id, store_id } = decodeJwt(assertion);
  const { alg, typ } = decodeProtectedHeader(assertion);
  if (typeof sub !== "string" || typeof aud !== "string" || typeof iss !== "string" ||
      typeof jti !== "string" || typeof iat !== "number" || typeof exp !== "number" ||
      typeof installation_id !== "string" || typeof store_id !== "string") {
    throw new Error("The launch assertion is missing its demo identity or validity period.");
  }
  return { sub, aud, iss, jti, iat, exp, installation_id, store_id, alg, typ };
}

type AuthenticationProps = {
  claims: ReturnType<typeof readLaunchClaims>;
  authorization: AuthorizationReceipt;
  actor: string;
  store: string;
  days: number;
};

function TokenTime({ seconds }: { seconds: number }) {
  const iso = new Date(seconds * 1000).toISOString();
  return <time dateTime={iso}>{iso.slice(0, 10)} {iso.slice(11, 19)} UTC</time>;
}

export function Authentication({ claims, authorization, actor, store, days }: AuthenticationProps) {
  const fields = [
    { label: "Staff member", claim: "sub", value: claims.sub },
    { label: "Store", claim: "store_id", value: claims.store_id },
    { label: "Partner client", claim: "aud", value: claims.aud },
    { label: "Installation", claim: "installation_id", value: claims.installation_id },
    { label: "Issuer", claim: "iss", value: claims.iss },
    { label: "Assertion ID", claim: "jti", value: claims.jti },
    { label: "Issued", claim: "iat", value: <TokenTime seconds={claims.iat} /> },
    { label: "Expires", claim: "exp", value: <TokenTime seconds={claims.exp} /> },
  ];
  return <div className="space-y-4">
    <section aria-labelledby="authorized-read" className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
      <h2 id="authorized-read" className="font-semibold">Server authorization</h2>
      <p className="mt-1 text-sm text-slate-700">The partner backend completed these two requests for {actor} at {store}.</p>
      <ol className="mt-3 space-y-3 text-xs leading-relaxed">
        <li>
          <div className="flex flex-wrap items-center gap-2"><code>POST /api/oauth/token</code><Badge variant="outline">HTTP {authorization.exchangeStatus}</Badge></div>
          <p className="mt-1 text-slate-700">The backend supplied the assertion and authenticated with its client ID and secret. SIDES issued a {authorization.tokenType} access token for <code>{authorization.grantedScope}</code>, valid for <span>{authorization.expiresIn} seconds</span>.</p>
        </li>
        <li>
          <div className="flex flex-wrap items-center gap-2"><code>GET /api/sales</code><Badge variant="outline">HTTP {authorization.salesStatus}</Badge></div>
          <p className="mt-1 text-slate-700">SIDES checked the access token and returned {days} days of synthetic order data. The access token and client secret stay on the servers.</p>
        </li>
      </ol>
    </section>
    <section aria-labelledby="launch-assertion" className="rounded-lg border border-slate-200 p-4">
      <h2 id="launch-assertion" className="font-semibold">Launch assertion</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">The iframe received this {claims.alg} signed JWT from the SIDES parent through the bridge. The iframe decoded these fields for display. SIDES verified the signature, audience and expiry during token exchange.</p>
      <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {fields.map(field => <div key={field.claim} className="min-w-0 border-t border-slate-100 pt-2">
          <dt className="flex flex-wrap items-baseline gap-x-1.5 text-xs font-medium text-slate-700">{field.label}<code className="text-[10px] font-normal text-slate-500">{field.claim}</code></dt>
          <dd data-testid={field.claim === "jti" ? "assertion-id" : undefined} className="mt-1 break-all font-mono text-xs">{field.value}</dd>
        </div>)}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">The token also contains a session identifier (<code>sid</code>). Its value is omitted here. Run authentication again to receive a fresh assertion ID.</p>
    </section>
  </div>;
}

type DirectCheck = { status: number; error?: string };

export function StandaloneCheck({ hostOrigin }: { hostOrigin: string }) {
  const [result, setResult] = useState<DirectCheck | null>(null);
  const [networkError, setNetworkError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      const response = await fetch("/api/partner/forecast", {
        credentials: "omit", cache: "no-store", signal: controller.signal,
      });
      // Display an error code only. An unexpected success body could contain forecast data.
      const body = response.ok ? null : await response.json().catch(() => null);
      if (!controller.signal.aborted) setResult({
        status: response.status, error: typeof body?.error === "string" ? body.error : undefined,
      });
    }
    check().catch(() => { if (!controller.signal.aborted) setNetworkError(true); });
    return () => controller.abort();
  }, []);

  const denied = result?.status === 401 && result.error === "launch_assertion_required";
  return <section className="max-w-2xl rounded-lg border border-slate-200 p-5">
    <h2 className="font-semibold">SIDES session required</h2>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">This tab has no SIDES parent window. The bridge needs that parent to issue a fresh launch assertion for this app.</p>
    <div className="my-4 rounded-md bg-slate-50 p-3 text-sm" role="status">
      <p className="font-medium">Request without an assertion</p>
      <code className="mt-1 block text-xs">GET /api/partner/forecast</code>
      {result ? <>
        <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline">HTTP {result.status}</Badge>{result.error && <code className="break-all text-xs">{result.error}</code>}</div>
        <p className="mt-2 text-xs text-slate-600">{denied ? "The partner backend rejected the request before token exchange." : "The endpoint returned an unexpected response to the anonymous request."}</p>
      </> : <p className="mt-2 text-xs text-slate-600">{networkError ? "The endpoint could not be reached. Reload to try again." : "Waiting for the partner backend…"}</p>}
    </div>
    <a className="text-sm font-medium text-emerald-700 underline" href={hostOrigin + "/apps/" + manifest.id + "/authentication"}>Open SIDES workspace</a>
  </section>;
}
