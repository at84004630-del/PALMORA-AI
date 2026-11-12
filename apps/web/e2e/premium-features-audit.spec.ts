import { test, expect } from '@playwright/test';

test.describe('Palmora AI Premium Features & Modes Comprehensive Audit', () => {

  test('Pricing Page: Tiers, Currency Toggles, and Plan Previews', async ({ page }) => {
    await page.goto('/pricing');

    // 1. Verify all tiers exist
    await expect(page.getByRole('heading', { name: /Deep-Dive Report/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Dual-Hand Evolution/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Seeker Club/i })).toBeVisible();

    // 2. Check Currency toggle: INR vs USD
    const usdToggle = page.getByRole('button', { name: /PayPal & Global \(\$ USD\)/i });
    await expect(usdToggle).toBeVisible();
    await usdToggle.click();
    await expect(page.getByText(/\$4\.99/i).first()).toBeVisible();

    const inrToggle = page.getByRole('button', { name: /UPI & Cards \(₹ INR\)/i });
    await expect(inrToggle).toBeVisible();
    await inrToggle.click();
    await expect(page.getByText(/₹399/i).first()).toBeVisible();

    // 3. Test Sample Dossier Preview Modal
    const previewBtn = page.getByRole('button', { name: /Preview Sample Dossier/i }).first();
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    // Verify Sample Dossier modal opens
    await expect(page.getByText(/Authentic Sample Dossier/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Sample Deep-Dive Palm Analysis/i })).toBeVisible();

    // Close preview modal via Close button
    const closeBtn = page.locator('button:has(svg.lucide-x)');
    await closeBtn.first().click();
    await expect(page.getByRole('heading', { name: /Sample Deep-Dive Palm Analysis/i })).not.toBeVisible();
  });

  test('Scan Page: Dual-Hand Evolution Mode & Guidance Modal', async ({ page }) => {
    await page.goto('/scan');

    // 1. Switch to Dual-Hand Evolution mode
    const dualHandTab = page.getByRole('button', { name: /Dual-Hand Evolution/i });
    await expect(dualHandTab).toBeVisible();
    await dualHandTab.click();

    // Verify Dual-Hand step indicator
    await expect(page.getByRole('heading', { name: /Step 1: Scan Left Palm \(Innate Potential\)/i })).toBeVisible();
    await expect(page.getByText(/Dominant Writing Hand:/i)).toBeVisible();

    // Toggle Dominant hand between Right and Left
    const leftHandBtn = page.getByRole('button', { name: /Left Hand/i });
    await leftHandBtn.click();
    await expect(page.getByRole('heading', { name: /Step 1: Scan Right Palm \(Innate Potential\)/i })).toBeVisible();

    const rightHandBtn = page.getByRole('button', { name: /Right Hand/i });
    await rightHandBtn.click();
    await expect(page.getByRole('heading', { name: /Step 1: Scan Left Palm \(Innate Potential\)/i })).toBeVisible();

    // 2. Open Framing Guide Modal
    const viewGuideBtn = page.getByRole('button', { name: /View Guide/i }).first();
    await expect(viewGuideBtn).toBeVisible();
    await viewGuideBtn.click();

    // Verify modal content
    await expect(page.getByText(/Optimal Biometric Scanning Guide/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /How to Frame Your/i })).toBeVisible();

    // Close guide modal via "Got it, Let's Scan" button
    const closeGuideBtn = page.getByRole('button', { name: /Got it, Let's Scan/i });
    await closeGuideBtn.click();
    await expect(page.getByText(/Optimal Biometric Scanning Guide/i)).not.toBeVisible();
  });

  test('Full Reading Flow: Analysis -> Reading -> Gating -> Checkout Unlock -> Consultation Chat', async ({ page }) => {
    // 1. Visit Analysis page and load sample scan
    await page.goto('/analysis');
    const loadSampleBtn = page.getByRole('button', { name: /Load Sample Verification Scan/i });
    await expect(loadSampleBtn).toBeVisible({ timeout: 8000 });
    await loadSampleBtn.click();

    // 2. Select focus intention
    const careerFocusBtn = page.getByRole('button', { name: /Career & Ambition/i });
    await expect(careerFocusBtn).toBeVisible();
    await careerFocusBtn.click();

    // 3. Generate reading report
    const generateBtn = page.getByRole('button', { name: /Generate My Reading Report/i });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Wait for transition to /reading page
    await page.waitForURL(/\/reading\?id=/i, { timeout: 15000 });
    await expect(page.getByText(/Analyzed across your palm's primary geometric plane/i)).toBeVisible();

    // 4. Verify Free Gating State:
    // Curiosity Cliffhanger Card should be visible
    const cliffhanger = page.getByRole('heading', { name: /Life-Phase Transition Windows Detected/i });
    await expect(cliffhanger).toBeVisible();

    // Biometric Curvature Card should display locked / blurred overlay
    const unlockCurvatureBtn = page.getByRole('button', { name: /Unlock Deep-Dive Report/i }).first();
    await expect(unlockCurvatureBtn).toBeVisible();

    // 5. Test In-Situ Checkout Unlock Simulation:
    await unlockCurvatureBtn.click();

    // Checkout modal appears
    await expect(page.getByText(/Deep-Dive Reading Folio/i).first()).toBeVisible();

    // Click Unlock Now
    const activateBtn = page.getByRole('button', { name: /Unlock Now/i }).first();
    await expect(activateBtn).toBeVisible();
    await activateBtn.click();

    // Await simulation success and modal auto-dismiss
    await expect(page.getByText(/Deep-Dive Entitlements Activated!/i)).toBeVisible({ timeout: 10000 });

    // Cliffhanger should now be gone
    await expect(page.getByRole('heading', { name: /Life-Phase Transition Windows Detected/i })).not.toBeVisible();

    // Biometric Curvature Card should now be UNLOCKED (showing unmasked degree descent)
    await expect(page.getByText(/° Descent/i).first()).toBeVisible();

    // 6. Test Interactive Palm Consultation Section (AI Chatbot):
    const consultTabBtn = page.getByRole('button', { name: /Ask Questions \(Money, Health, Career\)/i });
    await expect(consultTabBtn).toBeVisible();
    await consultTabBtn.click();

    const consultSection = page.getByRole('heading', { name: /Ask Questions on Money, Health & Career Scope/i });
    await expect(consultSection).toBeVisible();

    // Select category "Money & Wealth"
    const moneyCatBtn = page.getByRole('button', { name: /Money & Wealth/i }).first();
    await expect(moneyCatBtn).toBeVisible();
    await moneyCatBtn.click();

    // Click a prompt suggestion
    const promptSuggestion = page.getByRole('button', { name: /What does my palm indicate about wealth creation/i }).first();
    await expect(promptSuggestion).toBeVisible();
    await promptSuggestion.click();

    // Await AI response
    await expect(page.getByText(/Grounded in Observable Creases/i).first()).toBeVisible({ timeout: 25000 });

    // 7. Test PDF Export Modal
    const exportPdfBtn = page.getByRole('button', { name: /Generate PDF/i }).first();
    await expect(exportPdfBtn).toBeVisible();
    await exportPdfBtn.click();

    // Verify PDF modal opens with tier benefits
    await expect(page.getByRole('heading', { name: /Generate PDF Reading Report/i })).toBeVisible();
    await expect(page.getByText(/Mystic Midnight/i)).toBeVisible();

    // Toggle theme between Midnight and Parchment
    const parchmentTheme = page.getByRole('button', { name: /Parchment/i });
    await parchmentTheme.click();
    const midnightTheme = page.getByRole('button', { name: /Midnight/i });
    await midnightTheme.click();

    // Close PDF modal
    const closePdfBtn = page.getByRole('button', { name: /Close PDF export modal/i });
    await closePdfBtn.click();
    await expect(page.getByRole('heading', { name: /Generate PDF Reading Report/i })).not.toBeVisible();
  });

  test('Dashboard Page: Tabs, Archives, Crease Drift, and Preferences', async ({ page }) => {
    await page.goto('/dashboard');

    // 1. Verify Dashboard header and entitlement status
    await expect(page.getByRole('heading', { name: /Palmora User Workspace/i })).toBeVisible();
    await expect(page.getByText(/Current Entitlement/i)).toBeVisible();

    // 2. Test Tab Navigation
    // Temporal Crease Drift Tab
    const driftTab = page.getByRole('button', { name: /Temporal Crease Drift/i });
    await expect(driftTab).toBeVisible();
    await driftTab.click();
    await expect(page.getByRole('heading', { name: /Visual Crease Drift Differencing|No Temporal Drift Scans Available/i })).toBeVisible();

    // Synastry Tab
    const synastryTab = page.getByRole('button', { name: /Relational Synastry/i });
    await expect(synastryTab).toBeVisible();
    await synastryTab.click();
    await expect(page.getByRole('heading', { name: /Synastry & Relational Palm Match/i })).toBeVisible();

    // Journal Tab
    const journalTab = page.getByRole('button', { name: /Crease Journal/i });
    await expect(journalTab).toBeVisible();
    await journalTab.click();
    await expect(page.getByRole('heading', { name: /New Mindfulness & Crease Check-In/i })).toBeVisible();

    // Preferences Tab
    const prefTab = page.getByRole('button', { name: /Style & Reflection Preferences/i });
    await expect(prefTab).toBeVisible();
    await prefTab.click();
    await expect(page.getByRole('heading', { name: /Reading Style & Contemplation Settings/i })).toBeVisible();

    // Return to Archive tab
    const archiveTab = page.getByRole('button', { name: /Saved Readings/i });
    await expect(archiveTab).toBeVisible();
    await archiveTab.click();
    await expect(page.getByPlaceholder(/Search readings by title/i)).toBeVisible();
  });

});
