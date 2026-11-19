import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { AuthorizationReceipt, LaunchClaims } from "./auth-data";

type AuthenticationProps = {
  claims: LaunchClaims;
  authorization: AuthorizationReceipt;
  actor: string;
  store: string;
  days: number;
};

export function Authentication({ claims, authorization, actor, store, days }: AuthenticationProps) {
  return (
    <div className="space-y-4">
      <section aria-labelledby="authorized-read" className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
        <h2 id="authorized-read" className="font-semibold">Server authorization</h2>
        <p className="mt-1 text-sm text-slate-700">The partner backend completed these two requests for {actor} at {store}.</p>
        <ol className="mt-3 space-y-3 text-xs leading-relaxed">
          <RequestStep endpoint="POST /api/oauth/token" status={authorization.exchangeStatus}>
            The backend supplied the assertion and authenticated with its client ID and secret. The workspace issued a {authorization.tokenType} access token for <code>{authorization.grantedScope}</code>, valid for <span>{authorization.expiresIn} seconds</span>.
          </RequestStep>
          <RequestStep endpoint="GET /api/sales" status={authorization.salesStatus}>
            The sales API checked the access token and returned {days} days of synthetic order data. The access token and client secret stay on the servers.
          </RequestStep>
        </ol>
      </section>
      <LaunchAssertion claims={claims} />
    </div>
  );
}

function RequestStep({ endpoint, status, children }: { endpoint: string; status: number; children: ReactNode }) {
  return (
    <li>
      <div className="flex flex-wrap items-center gap-2">
        <code>{endpoint}</code>
        <Badge variant="outline">HTTP {status}</Badge>
      </div>
      <p className="mt-1 text-slate-700">{children}</p>
    </li>
  );
}

function LaunchAssertion({ claims }: { claims: LaunchClaims }) {
  return (
    <section aria-labelledby="launch-assertion" className="rounded-lg border border-slate-200 p-4">
      <h2 id="launch-assertion" className="font-semibold">Launch assertion</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        The iframe received this {claims.alg} signed JWT from the workspace parent through the bridge. The iframe decoded these fields for display. The token endpoint verified the signature, audience and expiry during token exchange.
      </p>
      <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
        <Claim label="Staff member" name="sub">{claims.sub}</Claim>
        <Claim label="Store" name="store_id">{claims.store_id}</Claim>
        <Claim label="Partner client" name="aud">{claims.aud}</Claim>
        <Claim label="Installation" name="installation_id">{claims.installation_id}</Claim>
        <Claim label="Issuer" name="iss">{claims.iss}</Claim>
        <Claim label="Assertion ID" name="jti">{claims.jti}</Claim>
        <Claim label="Issued" name="iat"><TokenTime seconds={claims.iat} /></Claim>
        <Claim label="Expires" name="exp"><TokenTime seconds={claims.exp} /></Claim>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        The token also contains a session identifier (<code>sid</code>). Its value is omitted here. Run authentication again to receive a fresh assertion ID.
      </p>
    </section>
  );
}

function Claim({ label, name, children }: { label: string; name: keyof LaunchClaims; children: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-slate-100 pt-2">
      <dt className="flex flex-wrap items-baseline gap-x-1.5 text-xs font-medium text-slate-700">
        {label}<code className="text-[10px] font-normal text-slate-500">{name}</code>
      </dt>
      <dd data-testid={name === "jti" ? "assertion-id" : undefined} className="mt-1 break-all font-mono text-xs">
        {children}
      </dd>
    </div>
  );
}

function TokenTime({ seconds }: { seconds: number }) {
  const iso = new Date(seconds * 1000).toISOString();
  return <time dateTime={iso}>{iso.slice(0, 10)} {iso.slice(11, 19)} UTC</time>;
}
