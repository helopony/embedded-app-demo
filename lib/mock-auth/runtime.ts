import "server-only";
import { createTokenService } from "./tokens";

function demoSecret(name: "DEMO_SIGNING_SECRET" | "DEMO_CLIENT_SECRET") {
  const value = process.env[name];
  if (value && Buffer.byteLength(value) >= 32) return value;
  if (!value && process.env.NODE_ENV !== "production") {
    return `local-development-only-sides-prototype-${name}`;
  }
  throw new Error(`${name} requires at least 32 bytes in the server environment.`);
}

export const tokenService = () => createTokenService(demoSecret("DEMO_SIGNING_SECRET"));
export const clientSecret = () => demoSecret("DEMO_CLIENT_SECRET");
