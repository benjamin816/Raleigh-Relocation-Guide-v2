#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const sitemapPath = path.join(repoRoot, "sitemap.xml");
const baseUrl = process.env.MOBILE_AUDIT_BASE_URL || "http://127.0.0.1:8765";
const outDir = path.join(repoRoot, "scripts", "mobile-audit-output");
const reportPath = path.join(outDir, "report.json");

function parseSitemapRoutes(xmlText) {
  const routeSet = new Set();
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let match;
  while ((match = locRegex.exec(xmlText)) !== null) {
    const raw = String(match[1] || "").trim();
    if (!raw) continue;
    try {
      const u = new URL(raw);
      routeSet.add(u.pathname || "/");
    } catch (_) {
      // Ignore malformed URL rows in sitemap.
    }
  }
  routeSet.add("/");
  return Array.from(routeSet).sort();
}

async function run() {
  if (!fs.existsSync(sitemapPath)) {
    throw new Error(`Missing sitemap: ${sitemapPath}`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const sitemapXml = fs.readFileSync(sitemapPath, "utf8");
  const routes = parseSitemapRoutes(sitemapXml);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();

  const report = {
    base_url: baseUrl,
    scanned_at: new Date().toISOString(),
    viewport: { width: 390, height: 844 },
    route_count: routes.length,
    routes: [],
  };

  for (const route of routes) {
    const targetUrl = new URL(route, baseUrl).toString();
    const entry = {
      route,
      url: targetUrl,
      status: "ok",
      issues: [],
    };

    try {
      const response = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      if (response && response.status() >= 400) {
        entry.status = "http_error";
        entry.issues.push(`HTTP ${response.status()}`);
      }

      await page.waitForTimeout(1500);

      const analysis = await page.evaluate(() => {
        const viewportWidth = window.innerWidth || 0;
        const htmlWidth = document.documentElement ? document.documentElement.scrollWidth : 0;
        const bodyWidth = document.body ? document.body.scrollWidth : 0;
        const maxWidth = Math.max(viewportWidth, htmlWidth, bodyWidth);
        const overflowPx = Math.max(0, maxWidth - viewportWidth);
        const hasHorizontalOverflow = overflowPx > 1;

        const offenders = [];
        const all = Array.from(document.querySelectorAll("*"));
        for (const el of all) {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") {
            continue;
          }
          const rect = el.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) {
            continue;
          }

          const rightOverflow = rect.right - viewportWidth;
          const leftOverflow = -rect.left;
          const isOverflowing =
            rightOverflow > 8 ||
            leftOverflow > 8 ||
            rect.width - viewportWidth > 8;

          if (!isOverflowing) {
            continue;
          }

          let selector = el.tagName.toLowerCase();
          if (el.id) selector += `#${el.id}`;
          if (el.classList && el.classList.length) {
            selector += "." + Array.from(el.classList).slice(0, 3).join(".");
          }
          const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
          offenders.push({
            selector,
            width: Math.round(rect.width),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            text,
          });
          if (offenders.length >= 12) {
            break;
          }
        }

        return {
          viewportWidth,
          htmlWidth,
          bodyWidth,
          maxWidth,
          overflowPx,
          hasHorizontalOverflow,
          offenders,
        };
      });

      entry.analysis = analysis;
      if (analysis.hasHorizontalOverflow) {
        entry.status = "overflow";
        entry.issues.push(`Horizontal overflow by ${analysis.overflowPx}px`);
      }
    } catch (error) {
      entry.status = "error";
      entry.issues.push(String(error && error.message ? error.message : error));
    }

    report.routes.push(entry);
    process.stdout.write(`${entry.status.toUpperCase().padEnd(10)} ${route}\n`);
  }

  await context.close();
  await browser.close();

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  const totals = report.routes.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    {}
  );
  process.stdout.write(`\nReport written: ${reportPath}\n`);
  process.stdout.write(`Summary: ${JSON.stringify(totals)}\n`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
