import manifest from "./installed-app.json";

function configuredOrigin(value: string) {
  const parsed = new URL(value);
  const isLoopback = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (value !== parsed.origin || !(parsed.protocol === "https:" || (isLoopback && parsed.protocol === "http:"))) {
    throw new Error("Configure an exact HTTPS origin, or a local loopback origin.");
  }
  return parsed.origin;
}

export function hostApiOrigin() {
  const fallback = process.env.VERCEL ? "https://app-workspace.helopony.com" : "http://localhost:3000";
  return configuredOrigin(process.env.WORKSPACE_HOST_ORIGIN ?? fallback);
}

export function partnerOrigin() {
  const fallback = process.env.VERCEL ? manifest.origin : "http://127.0.0.1:3001";
  const origin = configuredOrigin(process.env.WORKSPACE_PARTNER_ORIGIN ?? fallback);
  if (origin === hostApiOrigin()) throw new Error("The host and partner must use different origins.");
  return origin;
}

export function isHostOrigin(origin: string) {
  const extra = (process.env.WORKSPACE_EXTRA_HOST_ORIGINS ?? "").split(",").map(item => item.trim()).filter(Boolean);
  const allowed = [hostApiOrigin(), ...extra.map(configuredOrigin)];
  if (allowed.includes(partnerOrigin())) throw new Error("Partner origin cannot be a trusted host origin.");
  return allowed.includes(origin);
}
