const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');

const ARTIFACT_DIR = 'C:/Users/ABHINAV TRIPATHI/.gemini/antigravity/brain/83b7a825-a2e3-492f-ad7f-39d0e20afc25';
const IMAGE_PATH = path.join(ARTIFACT_DIR, '.user_uploaded/media_1793377424689_f06ffb90.jpg');

async function runLiveAudit() {
  console.log('--- STARTING PALMORA LIVE BROWSER AUDIT ---');
  console.log('Testing with real image:', IMAGE_PATH);

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
  });

  const page = await context.newPage();

  const consoleLogs = [];
  const networkErrors = [];
  const apiCalls = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${text}`);
    }
  });

  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      apiCalls.push({ url: req.url(), method: req.method() });
      console.log(`[API Request] ${req.method()} ${req.url()}`);
    }
  });

  page.on('response', async (res) => {
    if (res.url().includes('/api/')) {
      console.log(`[API Response] ${res.status()} ${res.url()}`);
      if (!res.ok()) {
        try {
          const body = await res.text();
          networkErrors.push({ url: res.url(), status: res.status(), body });
          console.log(`[API Error Body] ${body}`);
        } catch (e) {}
      }
    }
  });

  page.on('pageerror', (err) => {
    console.log(`[Page Error] ${err.message}`);
    consoleLogs.push({ type: 'pageerror', text: err.message });
  });

  try {
    // 1. Visit /scan
    console.log('\nStep 1: Navigating to http://localhost:3000/scan ...');
    await page.goto('http://localhost:3000/scan', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_scan_initial.png') });
    console.log('Screenshot saved: 01_scan_initial.png');

    // 2. Upload palm image
    console.log('\nStep 2: Uploading demo palm image ...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(IMAGE_PATH);

    // Wait for image load, canvas resize, and validation
    console.log('Waiting for image validation response ...');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_scan_uploaded_preview.png') });
    console.log('Screenshot saved: 02_scan_uploaded_preview.png');

    // 3. Check for any notice banner
    const noticeLocator = page.locator('text=Notice');
    if (await noticeLocator.isVisible()) {
      const noticeText = await page.locator('.bg-amber-950\\/40, .border-amber-600\\/40').innerText().catch(() => '');
      console.log('[Notice Banner Detected]:', noticeText);
    }

    // 4. Click ANALYZE PALM FEATURES
    console.log('\nStep 3: Looking for "ANALYZE PALM FEATURES" button ...');
    const analyzeBtn = page.getByRole('button', { name: /ANALYZE PALM FEATURES/i });
    if (await analyzeBtn.isVisible()) {
      console.log('Analyze button visible! Clicking now ...');
      await analyzeBtn.click();
      
      // Wait for CV analysis API and navigation
      console.log('Waiting for URL to change to /analysis ...');
      await page.waitForURL('**/analysis', { timeout: 45000 }).catch((e) => {
        console.log('Navigation to /analysis timed out or stayed on page:', e.message);
      });
      await page.waitForTimeout(3000);
    } else {
      console.log('Could not find Analyze button. Current page elements:', await page.content());
    }

    console.log('Current URL after analysis step:', page.url());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_analysis_creases.png') });
    console.log('Screenshot saved: 03_analysis_creases.png');

    // 5. Inspect /analysis page features
    if (page.url().includes('/analysis')) {
      console.log('\nStep 4: Inspecting /analysis page components ...');
      const hasCanvas = await page.locator('canvas').count();
      console.log(`Canvases detected: ${hasCanvas}`);

      const heartLineVisible = await page.getByText(/Heart Line/i).first().isVisible().catch(() => false);
      const headLineVisible = await page.getByText(/Head Line/i).first().isVisible().catch(() => false);
      const lifeLineVisible = await page.getByText(/Life Line/i).first().isVisible().catch(() => false);
      console.log('Crease labels status:', { heartLineVisible, headLineVisible, lifeLineVisible });

      // Click "Generate My Reading Report"
      const generateReportBtn = page.getByRole('button', { name: /Generate.*Reading/i }).first();
      if (await generateReportBtn.isVisible()) {
        console.log('\nStep 5: Clicking "Generate Reading Report" ...');
        await generateReportBtn.click();
        await page.waitForURL('**/reading', { timeout: 35000 }).catch(() => {});
        await page.waitForTimeout(4000);
      }
    }

    console.log('Current URL after reading trigger:', page.url());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_reading_report.png') });
    console.log('Screenshot saved: 04_reading_report.png');

    // 6. Test navigation to /pricing and /dashboard
    console.log('\nStep 6: Testing /pricing ...');
    await page.goto('http://localhost:3000/pricing', { waitUntil: 'networkidle', timeout: 15000 });
    const pricingHeader = await page.getByText(/Pricing/i).first().isVisible().catch(() => false);
    console.log('/pricing loaded:', pricingHeader);

    console.log('\nStep 7: Testing /dashboard ...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
    const dashboardHeader = await page.getByText(/Dashboard|Journal|History/i).first().isVisible().catch(() => false);
    console.log('/dashboard loaded:', dashboardHeader);

  } catch (err) {
    console.error('Audit encountered error:', err);
  } finally {
    await browser.close();
    console.log('\n--- AUDIT COMPLETE ---');
    console.log(`Total API calls: ${apiCalls.length}`);
    console.log(`API errors: ${networkErrors.length}`);
    if (networkErrors.length > 0) {
      console.log('Network error details:', JSON.stringify(networkErrors, null, 2));
    }
  }
}

runLiveAudit();

