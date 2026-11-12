import { test, expect } from '@playwright/test';

test.describe('Palmora AI Core User Navigation Flow', () => {
  test('landing page loads with navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Palmora/i);
    const scanCta = page.getByRole('link', { name: /start palm scan|scan your palm|get started/i }).first();
    await expect(scanCta).toBeVisible();
  });

  test('/scan page renders camera and upload options', async ({ page }) => {
    await page.goto('/scan');
    // Verify page header
    await expect(page.getByText(/Capture Your Palm/i)).toBeVisible();
    // Verify upload file selector and camera triggers
    await expect(page.getByText(/Upload Photograph/i)).toBeVisible();
    await expect(page.getByText(/Use Camera/i)).toBeVisible();

    // Click Use Camera and verify hardened camera controls
    await page.getByText(/Use Camera/i).click();
    await expect(page.getByRole('button', { name: /Snap Photo Now/i })).toBeVisible();
    await expect(page.getByText(/Laptop angle awkward\? Upload photo/i)).toBeVisible();

    // Return to select mode
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByText(/Use Camera/i)).toBeVisible();
  });

  test('/analysis page loads sample preview and enables report generation', async ({ page }) => {
    await page.goto('/analysis');
    // Await hydration and click sample verification button
    const loadSampleBtn = page.getByRole('button', { name: /Load Sample Verification Scan/i });
    await expect(loadSampleBtn).toBeVisible({ timeout: 8000 });
    await loadSampleBtn.click();

    // Verify Vision Analysis title
    await expect(page.getByText(/Observable Crease Overlay/i)).toBeVisible();
    // Verify 3 core crease lines status
    await expect(page.getByText(/Heart Line/i).first()).toBeVisible();
    await expect(page.getByText(/Head Line/i).first()).toBeVisible();
    await expect(page.getByText(/Life Line/i).first()).toBeVisible();

    // Verify generate report CTA button
    const generateBtn = page.getByRole('button', { name: /Generate My Reading Report/i });
    await expect(generateBtn).toBeVisible();
  });

  test('/reading page renders report synthesis or empty state with scan prompt', async ({ page }) => {
    await page.goto('/reading');
    // Verify Reading report headers or fallback state
    await expect(page.getByText(/No Reading Report Loaded|Your Palm Archetype|Palmora Contemplative Reading/i)).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: /Scan My Palm/i })).toBeVisible();
  });

  test('/pricing page renders dynamic Razorpay script and plan tiers', async ({ page }) => {
    await page.goto('/pricing');
    // Verify Trust-First pricing tiers
    await expect(page.getByText(/Deep-Dive Report/i).first()).toBeVisible();
    await expect(page.getByText(/Transparent, Honest Pricing/i)).toBeVisible();
    // Verify Razorpay checkout script element injected
    const scriptElement = page.locator('#razorpay-checkout-js');
    await expect(scriptElement).toHaveAttribute('src', 'https://checkout.razorpay.com/v1/checkout.js');
  });
});
