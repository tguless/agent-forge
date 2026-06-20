#!/usr/bin/env node
/**
 * Capture README product screenshots at a stable viewport (centered, not clipped).
 * Requires dev server on http://localhost:3030
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
const BASE = process.env.FORGE_SCREENSHOT_BASE ?? 'http://localhost:3030';

/** Match existing agent-roster.png framing: 1524×750 CSS px @2x → 3048×1500 PNG */
const VIEWPORT = { width: 1524, height: 900 };
const DEVICE_SCALE = 2;

async function waitForStable(page, ms = 1200) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(ms);
}

async function captureViewport(page, filename) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(OUT_DIR, filename),
    fullPage: false,
    animations: 'disabled',
  });
}

async function captureSectionInViewport(page, filename, sectionButtonName, clipHeight = 960) {
  await page.setViewportSize({ width: VIEWPORT.width, height: Math.max(clipHeight, VIEWPORT.height) });
  await page.evaluate(() => window.scrollTo(0, 0));
  const shell = page.locator('.ops-detail-shell').first();
  const section = page
    .locator('.forge-blueprint-section')
    .filter({ has: page.getByRole('button', { name: sectionButtonName }).first() })
    .first();
  await shell.waitFor({ state: 'visible', timeout: 15_000 });
  await section.waitFor({ state: 'visible', timeout: 15_000 });

  const scrollY = await section.evaluate((el) => {
    const shellEl = document.querySelector('.ops-detail-shell');
    const shellRect = shellEl?.getBoundingClientRect();
    const sectionRect = el.getBoundingClientRect();
    const anchorTop = shellRect ? shellRect.top + 12 : 72;
    return Math.max(0, window.scrollY + sectionRect.top - anchorTop);
  });
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(400);

  const shellBox = await shell.boundingBox();
  const sectionBox = await section.boundingBox();
  if (!shellBox || !sectionBox) {
    throw new Error(`Could not measure layout for ${filename}`);
  }

  await page.screenshot({
    path: path.join(OUT_DIR, filename),
    fullPage: false,
    animations: 'disabled',
    clip: {
      x: shellBox.x,
      y: sectionBox.y,
      width: shellBox.width,
      height: Math.min(clipHeight, Math.max(sectionBox.height, 420)),
    },
  });
  await page.setViewportSize(VIEWPORT);
}

async function ensureSectionOpen(page, buttonName, contentSelector) {
  const btn = page.getByRole('button', { name: buttonName }).first();
  const content = page.locator(contentSelector).first();
  if (!(await content.isVisible())) {
    await btn.click();
  }
  await content.waitFor({ state: 'visible', timeout: 15_000 });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  // Business roster
  await page.goto(`${BASE}/business`, { waitUntil: 'domcontentloaded' });
  await page.locator('a[href*="/business/"]').first().waitFor({ timeout: 15_000 });
  await waitForStable(page, 2200);
  await captureViewport(page, 'business-roster.png');

  // New business form
  await page.goto(`${BASE}/business/new`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Run consultant/i }).waitFor();
  await waitForStable(page, 1200);
  await captureViewport(page, 'business-new.png');

  // Blueprint overview (pitch + profile)
  await page.goto(`${BASE}/business/patent-researcher`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Patent Researcher' }).waitFor();
  await waitForStable(page, 1800);
  await captureViewport(page, 'business-blueprint.png');

  // Business plan expanded
  await ensureSectionOpen(page, /^Business plan$/i, '[aria-label="Business plan sections"]');
  const execBody = page.locator('#plan-executive-summary-body');
  if (!(await execBody.isVisible())) {
    await page.getByRole('button', { name: 'Executive summary' }).nth(1).click();
  }
  await waitForStable(page, 800);
  await captureSectionInViewport(page, 'business-blueprint-plan.png', /^Business plan$/i, 920);

  // Software stack
  await ensureSectionOpen(page, /Software stack/i, 'text=One default per category');
  await waitForStable(page, 500);
  await captureSectionInViewport(page, 'business-software-stack.png', /Software stack/i, 960);

  // Agent roles
  await ensureSectionOpen(page, /Agent roles/i, '.forge-role-item');
  await waitForStable(page, 800);
  await captureSectionInViewport(page, 'business-agent-roles.png', /Agent roles/i, 960);

  await browser.close();
  console.log(`Saved business README screenshots to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
