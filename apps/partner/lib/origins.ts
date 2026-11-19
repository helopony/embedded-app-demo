import definition from "@/app.manifest.json";

function configuredOrigin(value: string) {
  const parsed = new URL(value);
  const isLoopback = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (value !== parsed.origin || !(parsed.protocol === "https:" || (isLoopback && parsed.protocol === "http:"))) {
    throw new Error("Configure an exact HTTPS origin, or a local loopback origin.");
  }
  return parsed.origin;
}

export function hostApiOrigin() {
  return configuredOrigin(process.env.WORKSPACE_HOST_ORIGIN ?? (process.env.VERCEL ? "https://app-workspace.helopony.com" : "http://localhost:3000"));
}

export function partnerOrigin() {
  const origin = configuredOrigin(process.env.WORKSPACE_PARTNER_ORIGIN ?? (process.env.VERCEL ? definition.origin : "http://127.0.0.1:3001"));
  if (origin === hostApiOrigin()) throw new Error("The host and partner must use different origins.");
  return origin;
}

export function trustedHostOrigins() {
  const extra = (process.env.WORKSPACE_EXTRA_HOST_ORIGINS ?? "").split(",").map(item => item.trim()).filter(Boolean);
  const all = [...new Set([hostApiOrigin(), ...extra.map(configuredOrigin)])];
  if (all.includes(partnerOrigin())) throw new Error("Partner origin cannot be a trusted host origin.");
  return all;
}

export function isHostOrigin(origin: string) {
  return trustedHostOrigins().includes(origin);
}

export function requestOrigin(request: Request) {
  // Next's local adapter can normalize the URL hostname to localhost even for
  // requests made to 127.0.0.1. Host carries the browser's actual destination.
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return "";
  return `${url.protocol}//${host.toLowerCase()}`;
}
