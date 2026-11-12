import { test, expect } from '@playwright/test';

test.describe('Palmora AI Interactive Modes & Advanced Features Deep Audit', () => {

  test('Dashboard: Temporal Drift Modes (Heatmap, Slider, Side-by-Side)', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to Temporal Crease Drift
    const driftTab = page.getByRole('button', { name: /Temporal Crease Drift/i });
    await expect(driftTab).toBeVisible();
    await driftTab.click();

    // Verify Drift header & Palmar Stability
    await expect(page.getByRole('heading', { name: /Visual Crease Drift Differencing/i })).toBeVisible();
    await expect(page.getByText(/Palmar Stability/i)).toBeVisible();

    // Test View Mode Toggles: Time Transition Slider, Side-by-Side, Heatmap
    const sliderBtn = page.getByRole('button', { name: /Time Transition Slider/i });
    await expect(sliderBtn).toBeVisible();
    await sliderBtn.click();
    await expect(page.locator('input[type="range"]').first()).toBeVisible();

    const sideBySideBtn = page.getByRole('button', { name: /Side-by-Side View/i });
    await expect(sideBySideBtn).toBeVisible();
    await sideBySideBtn.click();

    const heatmapBtn = page.getByRole('button', { name: /Diff Heatmap/i });
    await expect(heatmapBtn).toBeVisible();
    await heatmapBtn.click();

    // Test Line Filter Tabs: Deepened, Faded, Stabilized
    const deepenedFilter = page.getByRole('button', { name: 'deepened' });
    await expect(deepenedFilter).toBeVisible();
    await deepenedFilter.click();
    await expect(page.getByText(/Head Line \(Intellectual Focus/i)).toBeVisible();
  });

  test('Dashboard: Relational Synastry Computation', async ({ page }) => {
    await page.goto('/dashboard');

    const synastryTab = page.getByRole('button', { name: /Relational Synastry/i });
    await expect(synastryTab).toBeVisible();
    await synastryTab.click();

    // Verify Synastry header
    await expect(page.getByRole('heading', { name: /Synastry & Relational Palm Match/i })).toBeVisible();

    // Switch to Co-Founders category
    const cofoundersBtn = page.getByRole('button', { name: /💼 Co-Founders/i });
    await expect(cofoundersBtn).toBeVisible();
    await cofoundersBtn.click();

    // Click Compute Relational Synastry button
    const computeBtn = page.getByRole('button', { name: /Compute Relational Synastry/i });
    await expect(computeBtn).toBeVisible();
    await computeBtn.click();

    // Verify synastry calculation results appear
    await expect(page.getByText('Synergy Index')).toBeVisible({ timeout: 15000 });
  });

  test('Dashboard: Crease Journal Habit Check-in', async ({ page }) => {
    await page.goto('/dashboard');

    const journalTab = page.getByRole('button', { name: /Crease Journal/i });
    await expect(journalTab).toBeVisible();
    await journalTab.click();

    // Verify Journal header
    await expect(page.getByRole('heading', { name: /New Mindfulness & Crease Check-In/i })).toBeVisible();

    // Meditation is selected by default; select an additional habit: Circadian Sleep Rhythm
    const sleepBtn = page.getByRole('button', { name: /Circadian Sleep Rhythm/i });
    await expect(sleepBtn).toBeVisible();
    await sleepBtn.click();
    await expect(sleepBtn).toHaveClass(/border-gold-500/i);

    // Fill reflection note
    const noteInput = page.getByPlaceholder(/Notice any shifts in nervous tension/i);
    await noteInput.fill('Feeling centered after 20 minutes of morning breathwork.');

    // Click Record Check-In
    const recordBtn = page.getByRole('button', { name: /Record Check-In/i });
    await expect(recordBtn).toBeEnabled({ timeout: 5000 });
    await recordBtn.click();

    // Verify check-in recorded feedback banner
    await expect(page.getByText(/Check-in recorded! Crease drift model updated/i)).toBeVisible({ timeout: 5000 });
  });

  test('Reading: Multilingual Translation, Audio Dossier, and Story Card Sharing', async ({ page }) => {
    // 1. Visit Analysis and create sample reading
    await page.goto('/analysis');
    const loadSampleBtn = page.getByRole('button', { name: /Load Sample Verification Scan/i });
    await expect(loadSampleBtn).toBeVisible({ timeout: 8000 });
    await loadSampleBtn.click();

    const generateBtn = page.getByRole('button', { name: /Generate My Reading Report/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    await page.waitForURL(/\/reading\?id=/i, { timeout: 15000 });

    // 2. Test Audio Dossier Walkthrough toggle
    const audioBtn = page.getByRole('button', { name: /Audio Dossier/i });
    await expect(audioBtn).toBeVisible();
    await audioBtn.click();

    await expect(page.getByRole('heading', { name: /Audio Reading Dossier/i })).toBeVisible();

    // Close audio
    const closeAudioBtn = page.getByRole('button', { name: /Close Audio/i });
    await expect(closeAudioBtn).toBeVisible();
    await closeAudioBtn.click();
    await expect(page.getByRole('heading', { name: /Audio Reading Dossier/i })).not.toBeVisible();

    // 3. Test Share Story Card Modal
    const shareBtn = page.getByRole('button', { name: /Share Story Card/i });
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Verify Story Card modal appears
    await expect(page.getByRole('heading', { name: /Share Your Reading Story/i })).toBeVisible();

    // Close share modal
    const closeShareBtn = page.locator('button:has(svg.lucide-x)').first();
    await closeShareBtn.click();
    await expect(page.getByRole('heading', { name: /Share Your Reading Story/i })).not.toBeVisible();
  });

});
