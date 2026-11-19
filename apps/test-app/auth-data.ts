import { decodeJwt, decodeProtectedHeader } from "jose";

export type AuthorizationReceipt = {
  exchangeStatus: number;
  tokenType: string;
  grantedScope: string;
  expiresIn: number;
  salesStatus: number;
};

// For display in the partner iframe. The workspace token endpoint checks the signature and grant.
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

export type LaunchClaims = ReturnType<typeof readLaunchClaims>;
