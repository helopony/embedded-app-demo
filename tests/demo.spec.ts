import { expect, test } from "@playwright/test";
import { decodeJwt } from "jose";

test("the workspace identifies the signed-in user independently of its partner", async ({ page, request }) => {
  await page.clock.install();
  await page.route("**/embed/**", route => route.abort());
  const [session] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === "/api/host/session"),
    page.goto("/"),
  ]);
  expect(session.ok()).toBe(true);
  const { actor, store } = await session.json();
  const header = page.getByRole("group", { name: "Workspace session" });
  await expect(header).toContainText("Signed in as");
  await expect(header).toContainText(actor.name);
  await expect(header).toContainText(store.name);
  const partner = new URL((await page.getByTitle("Demand Forecast partner app").getAttribute("src"))!);
  const host = new URL(page.url());
  expect(partner.origin).not.toBe(host.origin);
  expect((await request.post(new URL("/api/host/session", partner).href)).status()).toBe(404);
  expect((await request.post(new URL("/api/oauth/token", partner).href)).status()).toBe(404);
  expect((await request.get(new URL("/apps/demand-forecast/overview", partner).href)).status()).toBe(404);
  expect((await request.get(new URL("/api/sales", partner).href)).status()).toBe(404);
  expect((await request.get(new URL("/api/partner/forecast", host).href)).status()).toBe(404);
  expect((await request.get(new URL("/embed/overview", host).href)).status()).toBe(404);

  await page.clock.fastForward(12_000);
  await page.unroute("**/embed/**");
  const [read] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === "/api/partner/forecast" && r.ok()),
    page.getByRole("button", { name: "Reconnect" }).click(),
  ]);
  const forecast = await read.json();
  expect(forecast.actor.name).toBe(actor.name);
  expect(forecast.store.name).toBe(store.name);
  const bearer = await read.request().headerValue("authorization");
  if (!bearer?.startsWith("Bearer ")) throw new Error("The iframe did not receive its launch assertion.");
  const claims = decodeJwt(bearer.slice("Bearer ".length));
  expect(claims.sub).toBe(actor.id);
  expect(claims.store_id).toBe(store.id);
});

test("the iframe authenticates and contributes a live menu to the workspace", async ({ page }) => {
  await page.goto("/");
  const iframe = page.frameLocator('iframe[title="Demand Forecast partner app"]');
  const nav = page.getByRole("navigation", { name: "Installed app navigation" });
  const forecast = nav.getByRole("link", { name: "Forecast", exact: true });

  await expect(page.getByText("Bridge connected", { exact: true })).toBeVisible();
  await expect(iframe.getByText("Berlin Mitte", { exact: true })).toBeVisible();
  await expect(iframe.getByText("Alex Morgan", { exact: true })).toBeVisible();
  const partnerUrl = await page.locator("iframe").getAttribute("src");
  expect(new URL(partnerUrl!).origin).not.toBe(new URL(page.url()).origin);

  await expect(forecast).toBeVisible();
  const publish = iframe.getByRole("checkbox", { name: "Show Forecast in workspace menu" });
  await publish.uncheck();
  await expect(forecast).toHaveCount(0);
  await publish.check();
  await forecast.click();
  await expect(iframe.getByRole("heading", { name: "Order forecast" })).toBeVisible();
  await expect(page).toHaveURL(/\/apps\/demand-forecast\/forecast$/);
  await iframe.getByRole("button", { name: "Back to overview" }).click();
  await expect(page).toHaveURL(/\/apps\/demand-forecast\/overview$/);
  await page.goBack();
  await expect(iframe.getByRole("heading", { name: "Order forecast" })).toBeVisible();

  await page.reload();
  await expect(iframe.getByRole("table")).toBeVisible();
  const refresh = page.waitForResponse(r => new URL(r.url()).pathname === "/api/partner/forecast" && r.status() === 200);
  await iframe.getByRole("button", { name: "Refresh forecast data" }).click();
  await refresh;
  await page.getByRole("button", { name: "Manifest" }).click();
  await expect(page.getByLabel("App manifest")).toContainText("sales.summary.read");
});

test("opening the partner directly in the same browser demonstrates a denied read", async ({ page, request, baseURL }) => {
  await page.goto("/");
  const iframe = page.frameLocator('iframe[title="Demand Forecast partner app"]');
  await expect(iframe.getByText("Alex Morgan", { exact: true })).toBeVisible();
  const [standalone, denied] = await Promise.all([
    page.waitForEvent("popup"),
    page.context().waitForEvent("response", r => new URL(r.url()).pathname === "/api/partner/forecast"),
    page.getByRole("link", { name: "Open partner app directly" }).click(),
  ]);
  expect(new URL(standalone.url()).origin).not.toBe(new URL(page.url()).origin);
  expect(await denied.request().headerValue("authorization") === null).toBe(true);
  expect(denied.status()).toBe(401);
  expect((await denied.json()).error).toBe("launch_assertion_required");
  await expect(standalone.getByRole("heading", { name: "Workspace session required" })).toBeVisible();
  await expect(standalone.getByText("HTTP 401", { exact: true })).toBeVisible();
  await expect(standalone.getByText("launch_assertion_required", { exact: true })).toBeVisible();
  await expect(standalone.getByText("Alex Morgan", { exact: true })).toHaveCount(0);
  await expect(standalone.getByRole("figure", { name: "Expected orders by day" })).toHaveCount(0);
  expect((await request.get(new URL("/api/sales", baseURL).href)).status()).toBe(401);
  const partnerOrigin = new URL(standalone.url()).origin;
  await standalone.goto(partnerOrigin);
  expect(new URL(standalone.url()).origin).toBe(partnerOrigin);
  await expect(standalone.getByText("launch_assertion_required", { exact: true })).toBeVisible();
});

test("Authentication shows the current assertion and the server's authorization result", async ({ page }) => {
  const iframe = page.frameLocator('iframe[title="Demand Forecast partner app"]');
  const launch = iframe.getByRole("region", { name: "Launch assertion" });
  const receipt = iframe.getByRole("region", { name: "Server authorization" });

  async function checkAuthenticatedRead(action: () => Promise<unknown>) {
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === "/api/partner/forecast" && r.status() === 200),
      action(),
    ]);
    const header = await response.request().headerValue("authorization");
    if (!header?.startsWith("Bearer ")) throw new Error("The iframe did not send its launch assertion.");
    const assertion = header.slice("Bearer ".length);
    const claims = decodeJwt(assertion);
    if (typeof claims.jti !== "string" || typeof claims.exp !== "number" || typeof claims.iat !== "number") {
      throw new Error("The assertion is missing its ID or timestamps.");
    }
    await expect(launch.getByTestId("assertion-id")).toHaveText(claims.jti);
    for (const field of ["sub", "aud", "iss", "store_id", "installation_id"] as const) {
      await expect(launch).toContainText(String(claims[field]));
    }
    for (const timestamp of [claims.iat, claims.exp]) {
      const iso = new Date(timestamp * 1000).toISOString();
      await expect(launch.locator('time[datetime="' + iso + '"]')).toBeVisible();
    }
    const { authorization } = await response.json();
    expect(authorization).toEqual({
      exchangeStatus: 200, salesStatus: 200, grantedScope: "sales.summary.read", tokenType: "Bearer", expiresIn: 120,
    });
    await expect(receipt.getByText("HTTP 200", { exact: true })).toHaveCount(2);
    await expect(receipt).toContainText(authorization.grantedScope);
    await expect(receipt).toContainText(authorization.tokenType);
    await expect(receipt).toContainText(authorization.expiresIn + " seconds");
    // Fail with a boolean so a leaked credential never becomes assertion output.
    expect((await iframe.locator("main").innerText()).includes(assertion)).toBe(false);
    return claims.jti;
  }

  const originalId = await checkAuthenticatedRead(() => page.goto("/apps/demand-forecast/authentication"));
  await expect(page.getByRole("link", { name: "Authentication", exact: true })).toHaveAttribute("aria-current", "page");

  // Drop one credential in this browser so the real partner endpoint denies the read.
  await page.route("**/api/partner/forecast", async route => {
    const headers = await route.request().allHeaders();
    delete headers.authorization;
    await route.continue({ headers });
  }, { times: 1 });
  const [denied] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === "/api/partner/forecast"),
    iframe.getByRole("button", { name: "Run authentication again" }).click(),
  ]);
  expect(denied.status()).toBe(401);
  await expect(iframe.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(receipt).toBeHidden();
  await expect(iframe.getByText(originalId, { exact: true })).toBeHidden();

  const freshId = await checkAuthenticatedRead(() => iframe.getByRole("button", { name: "Retry authentication" }).click());
  expect(freshId).not.toBe(originalId);
});
