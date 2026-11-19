import { decodeJwt, decodeProtectedHeader } from "jose";
import type { createAppBridge } from "@workspace/bridge/partner";

export type ForecastRow = { day: string; orders: number };

type ForecastResponse = {
  store: { name: string };
  actor: { name: string };
  scope: string;
  rows: ForecastRow[];
  authorization: {
    exchangeStatus: number;
    tokenType: string;
    grantedScope: string;
    expiresIn: number;
    salesStatus: number;
  };
};

// These claims are for display. The token endpoint validates the assertion.
function readLaunchClaims(assertion: string) {
  const { sub, aud, iss, jti, iat, exp, installation_id, store_id } = decodeJwt(assertion);
  const { alg } = decodeProtectedHeader(assertion);
  if (typeof sub !== "string" || typeof aud !== "string" || typeof iss !== "string" ||
      typeof jti !== "string" || typeof iat !== "number" || typeof exp !== "number" ||
      typeof installation_id !== "string" || typeof store_id !== "string") {
    throw new Error("The launch assertion is missing its demo identity or validity period.");
  }
  return { sub, aud, iss, jti, iat, exp, installation_id, store_id, alg };
}

export async function readForecast(bridge: ReturnType<typeof createAppBridge>, signal: AbortSignal) {
  // Each read, including a retry, gets its own launch assertion from the host.
  const assertion = await bridge.getAssertion();
  signal.throwIfAborted();
  const response = await fetch("/api/partner/forecast", {
    headers: { Authorization: "Bearer " + assertion },
    cache: "no-store",
    signal,
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("The partner could not verify this session. Request a fresh assertion to retry.");
  }
  if (!response.ok) throw new Error("The forecast service could not complete the request.");
  const forecast: ForecastResponse = await response.json();
  return { ...forecast, claims: readLaunchClaims(assertion) };
}

export type Forecast = Awaited<ReturnType<typeof readForecast>>;
