import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { mkdir } from "node:fs/promises";
test("owner dashboard, customer feedback and one-tap review demo", async ({
  page,
}) => {
  await mkdir("audit-evidence", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Your reputation, in focus." }),
  ).toBeVisible();
  await expect(page.getByText("Delivery rate", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "audit-evidence/dashboard-desktop.png",
    fullPage: true,
  });
  await page.goto("/r/demo-visit");
  const google = page.getByRole("link", { name: "Leave us a Google Review" });
  await expect(google).toBeVisible();
  await page.getByText("Have private feedback for the owner?").click();
  await expect(google).toBeVisible();
  await page
    .getByLabel("Your feedback", { exact: true })
    .fill("The appointment started late.");
  await page.getByRole("button", { name: "Send privately" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Demo feedback received",
  );
  await expect(google).toBeEnabled();
  await page.screenshot({
    path: "audit-evidence/customer-review.png",
    fullPage: true,
  });
  await google.click();
  await expect(
    page.getByRole("heading", { name: "One tap to Google." }),
  ).toBeVisible();
  await page.goto("/unsubscribe?t=demo-visit");
  await page.getByRole("button", { name: "Unsubscribe", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "You’re unsubscribed" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("dashboard routes and live template preview", async ({ page }) => {
  for (const path of [
    "send",
    "customers",
    "templates",
    "qr",
    "reviews",
    "widget",
    "reports",
    "settings",
    "operator",
  ]) {
    const response = await page.goto("/dashboard/" + path);
    expect(response?.status(), path).toBe(200);
  }
  await page.goto("/dashboard/templates");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Tell us about your visit: {{review_link}}");
  await expect(page.locator(".message-preview")).toContainText(
    "Brooklyn Corner Barbers:",
  );
  await expect(page.locator(".message-preview")).toContainText(
    "Reply STOP to opt out.",
  );
  await page.getByRole("button", { name: "Save template" }).click();
  await expect(page.getByRole("status").last()).toContainText("Template saved");
  await page.goto("/dashboard/send");
  await page.getByLabel("Name", { exact: true }).fill("Demo Customer");
  await page.getByLabel("Phone", { exact: true }).fill("(212) 555-0123");
  await page.getByLabel("Original consent date/time").fill("2026-10-01T12:00");
  await page.getByLabel("Customer explicitly consented").check();
  await page
    .getByRole("button", { name: "Send review request", exact: true })
    .click();
  await expect(
    page.getByText("Demo request preview complete. No message sent."),
  ).toBeVisible();
});
test("public QR, widget script and real downloadable assets", async ({
  page,
  request,
}) => {
  const qr = await request.get("/b/brooklyn-corner-demo");
  expect(qr.status()).toBe(200);
  await page.goto("/widget/brooklyn-corner-demo");
  await expect(page.getByText("128 Google reviews")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review us on Google" }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(3);
  const svg = await request.get("/api/assets?format=svg");
  expect(svg.headers()["content-type"]).toContain("image/svg+xml");
  expect(await svg.text()).toContain("<svg");
  const png = await request.get("/api/assets?format=png");
  expect((await png.body()).subarray(1, 4).toString()).toBe("PNG");
  const pdf = await request.get("/api/assets?format=pdf");
  expect(pdf.status()).toBe(200);
  expect((await PDFDocument.load(await pdf.body())).getPageCount()).toBe(2);
  const script = await request.get("/widget.js");
  expect(script.headers()["content-type"]).toContain("javascript");
  await page.goto("/demo/google-review");
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.src = "/widget.js";
    script.dataset.organization = "brooklyn-corner-demo";
    document.body.append(script);
  });
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    /\/widget\/brooklyn-corner-demo$/,
  );
});
test("mobile layout and provider/cron access guards", async ({
  page,
  request,
}) => {
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `dashboard ${width}`,
    ).toBe(true);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("button", { name: "Close navigation", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/r/demo-visit");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `review ${width}`,
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "Leave us a Google Review" }),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/dashboard");
  await page.screenshot({
    path: "audit-evidence/dashboard-mobile.png",
    fullPage: true,
  });
  for (const p of [
    "/api/cron",
    "/api/cron/sequence-runner",
    "/api/cron/sync-google-reviews",
  ])
    expect((await request.post(p)).status()).toBe(401);
  for (const p of [
    "/api/webhooks/twilio/status",
    "/api/webhooks/twilio/inbound",
  ])
    expect(
      (
        await request.post(p, { form: { Body: "STOP", From: "+12125550123" } })
      ).status(),
    ).toBe(403);
});
