import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import installedApp from "../installed-app.json";

export const CLIENT_ID = installedApp.id;
export const SALES_SCOPE = "sales.summary.read";
export const EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
export const JWT_TYPE = "urn:ietf:params:oauth:token-type:jwt";
export const ACCESS_TYPE = "urn:ietf:params:oauth:token-type:access_token";

const ISSUER = "urn:workspace:demo:identity";
// This stateless demo has one public, synthetic staff/store grant. Proofs can be
// replayed until their short expiry; a production grant and one-use launch
// assertion would require an authoritative store shared across instances.
export const demoIdentity = {
  actor: { id: "staff_alex", name: "Alex Morgan" },
  store: { id: "store_berlin_mitte", name: "Berlin Mitte" },
};

export type WorkspaceIdentity = typeof demoIdentity;

const INSTALLATION_ID = "installation_berlin_demo";

const profiles = {
  session: { type: "workspace-session+jwt", audience: "urn:workspace:admin", seconds: 8 * 3600 },
  launch: { type: "workspace-launch+jwt", audience: CLIENT_ID, seconds: 60 },
  access: { type: "at+jwt", audience: "urn:workspace:partner-api", seconds: 120 },
} as const;

type TokenKind = keyof typeof profiles;

export const LAUNCH_LIFETIME = profiles.launch.seconds;
export const ACCESS_LIFETIME = profiles.access.seconds;
export const SESSION_LIFETIME = profiles.session.seconds;

/** The client secret authenticates the partner server. No browser receives it. */
export function validClientAuthorization(header: string | null, secret: string) {
  const match = header?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return false;
  const supplied = Buffer.from(match[1], "base64");
  const hash = (value: string | Buffer) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(supplied), hash(`${CLIENT_ID}:${secret}`));
}

export function createTokenService(signingSecret: string, now = () => new Date()) {
  const key = new TextEncoder().encode(signingSecret);
  if (key.length < 32) throw new Error("Demo signing key requires at least 32 bytes.");

  async function sign(kind: TokenKind, sessionId: string) {
    const { type, audience, seconds } = profiles[kind];
    const issuedAt = Math.floor(now().getTime() / 1000);
    return new SignJWT({
      sid: sessionId,
      installation_id: INSTALLATION_ID,
      store_id: demoIdentity.store.id,
      ...(kind === "access" && { scope: SALES_SCOPE, client_id: CLIENT_ID }),
    })
      .setProtectedHeader({ alg: "HS256", typ: type })
      .setIssuer(ISSUER)
      .setSubject(demoIdentity.actor.id)
      .setAudience(audience)
      .setJti(randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + seconds)
      .sign(key);
  }

  async function verify(value: string, kind: TokenKind) {
    const { type, audience } = profiles[kind];
    const { payload } = await jwtVerify(value, key, {
      algorithms: ["HS256"],
      typ: type,
      issuer: ISSUER,
      audience,
      subject: demoIdentity.actor.id,
      currentDate: now(),
      requiredClaims: ["exp", "iat", "jti", "sid", "installation_id", "store_id"],
    });
    if (
      payload.aud !== audience ||
      payload.installation_id !== INSTALLATION_ID ||
      payload.store_id !== demoIdentity.store.id ||
      typeof payload.sid !== "string" ||
      !payload.sid
    ) throw new Error("Unknown demo grant.");
    return { sessionId: payload.sid, clientId: payload.client_id, scope: payload.scope };
  }

  return {
    newSession: () => sign("session", randomUUID()),
    async identity(session: string) {
      await verify(session, "session");
      return demoIdentity;
    },
    async launch(session: string) {
      const claims = await verify(session, "session");
      return sign("launch", claims.sessionId);
    },
    async exchange(assertion: string) {
      const claims = await verify(assertion, "launch");
      return sign("access", claims.sessionId);
    },
    async canReadSales(token: string) {
      const claims = await verify(token, "access");
      return claims.clientId === CLIENT_ID && claims.scope === SALES_SCOPE;
    },
  };
}
