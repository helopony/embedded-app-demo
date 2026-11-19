import { expect, test } from "@playwright/test";

test("the iframe authenticates and contributes a live menu to SIDES", async ({ page }) => {
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
  const publish = iframe.getByRole("checkbox", { name: "Show Forecast in SIDES menu" });
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

test("direct partner visits require the host and the protected API requires a token", async ({ page, request, baseURL }) => {
  await page.goto("/");
  const frame = page.locator('iframe[title="Demand Forecast partner app"]');
  await expect(frame).toBeAttached();
  const partner = new URL((await frame.getAttribute("src"))!);
  await page.goto(partner.href);
  await expect(page.getByRole("heading", { name: "SIDES session required" })).toBeVisible();
  expect((await request.get(new URL("/api/partner/forecast", partner).href)).status()).toBe(401);
  expect((await request.get(new URL("/api/sales", baseURL).href)).status()).toBe(401);
});
