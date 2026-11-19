import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeJwt, SignJWT } from "jose";
import { CLIENT_ID, createTokenService, validClientAuthorization } from "./tokens";

const testKey = "private-signing-fixture-for-token-unit-tests";

test("a first-party session issues a partner launch assertion and scoped API token", async () => {
  const tokens = createTokenService(testKey);
  const session = await tokens.newSession();
  const assertion = await tokens.launch(session);
  const access = await tokens.exchange(assertion);
  assert.equal(await tokens.canReadSales(access), true);
  assert.equal(decodeJwt(assertion).aud, CLIENT_ID);
  assert.equal(decodeJwt(assertion).sid, decodeJwt(access).sid);
  assert.notEqual(decodeJwt(assertion).jti, decodeJwt(access).jti);
  assert.equal(decodeJwt(assertion).scope, undefined);
  await assert.rejects(tokens.canReadSales(assertion));
  await assert.rejects(tokens.exchange(access));
  await assert.rejects(tokens.exchange(session));
  await assert.rejects(tokens.launch(assertion));
});

test("launch and API proofs expire independently, while the staff can obtain fresh ones", async () => {
  let instant = Date.UTC(2026, 10, 19);
  const tokens = createTokenService(testKey, () => new Date(instant));
  const session = await tokens.newSession();
  const assertion = await tokens.launch(session);
  const access = await tokens.exchange(assertion);
  instant += 60_000;
  await assert.rejects(tokens.exchange(assertion));
  assert.equal(await tokens.canReadSales(access), true);
  instant += 60_000;
  await assert.rejects(tokens.canReadSales(access));
  assert.ok(await tokens.exchange(await tokens.launch(session)));
});

test("only the trusted issuer key and the provisioned store and installation are accepted", async () => {
  const tokens = createTokenService(testKey);
  const untrusted = createTokenService("different-key-used-for-token-unit-tests");
  const foreign = await untrusted.launch(await untrusted.newSession());
  await assert.rejects(tokens.exchange(foreign));
  const assertion = await tokens.launch(await tokens.newSession());
  const access = await tokens.exchange(assertion);
  const claims = decodeJwt(access);
  const sign = (overrides: Record<string, string>) => new SignJWT({ ...claims, ...overrides })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .sign(new TextEncoder().encode(testKey));
  await assert.rejects(tokens.canReadSales(await sign({ installation_id: "other" })));
  await assert.rejects(tokens.canReadSales(await sign({ store_id: "other" })));
  assert.equal(await tokens.canReadSales(await sign({ scope: "other" })), false);
  assert.equal(await tokens.canReadSales(await sign({ client_id: "other" })), false);
});

test("a registered client ID and secret are both required for confidential exchange", () => {
  const basic = (id: string, secret: string) =>
    `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
  assert.equal(validClientAuthorization(basic(CLIENT_ID, "test-secret"), "test-secret"), true);
  assert.equal(validClientAuthorization(null, "test-secret"), false);
  assert.equal(validClientAuthorization("Bearer bad", "test-secret"), false);
  assert.equal(validClientAuthorization(basic("other-app", "test-secret"), "test-secret"), false);
  assert.equal(validClientAuthorization(basic(CLIENT_ID, "wrong-secret"), "test-secret"), false);
});
