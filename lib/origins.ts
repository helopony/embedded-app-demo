import { manifest } from "./manifest";

function configuredOrigin(value: string) {
  const parsed = new URL(value);
  const isLoopback = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (value !== parsed.origin || !(parsed.protocol === "https:" || (isLoopback && parsed.protocol === "http:"))) {
    throw new Error("Configure an exact HTTPS origin, or a local loopback origin.");
  }
  return parsed.origin;
}

export function hostApiOrigin() {
  return configuredOrigin(process.env.SIDES_HOST_ORIGIN ?? (process.env.VERCEL ? "https://sides-app-chi.vercel.app" : "http://localhost:3000"));
}

export function partnerOrigin() {
  const origin = configuredOrigin(process.env.SIDES_PARTNER_ORIGIN ?? (process.env.VERCEL ? manifest.origin : "http://127.0.0.1:3000"));
  if (origin === hostApiOrigin()) throw new Error("The host and partner must use different origins.");
  return origin;
}

export function trustedHostOrigins() {
  const extra = (process.env.SIDES_EXTRA_HOST_ORIGINS ?? "").split(",").map(item => item.trim()).filter(Boolean);
  const all = [...new Set([hostApiOrigin(), ...extra.map(configuredOrigin)])];
  if (all.includes(partnerOrigin())) throw new Error("Partner origin cannot be a trusted host origin.");
  return all;
}

export function isHostOrigin(origin: string) {
  return trustedHostOrigins().includes(origin);
}

export function isPartnerOrigin(origin: string) {
  return origin === partnerOrigin();
}
