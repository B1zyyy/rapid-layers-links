import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { BASE_PATH as BASE_WITH_SLASH, SITE_URL } from '../../deploy.config.mjs';

// Expected cards come straight from the config, so these tests stay valid when stores are added or removed.
interface RawStore {
  id: string;
  enabled: boolean;
  order: number;
  name: string;
  url: string;
}
const BASE_PATH = BASE_WITH_SLASH.replace(/\/+$/, '');
const SITE_ORIGIN = SITE_URL;
const visible = (JSON.parse(readFileSync('src/data/stores.json', 'utf8')) as RawStore[])
  .filter((s) => s.enabled)
  .sort((a, b) => a.order - b.order)
  .map((s) => ({
    ...s,
    href: s.url.startsWith('/') ? `${BASE_PATH}${s.url}` : s.url,
    shareUrl: s.url.startsWith('/') ? `${SITE_ORIGIN}${BASE_PATH}${s.url}` : s.url,
  }));

const cards = (page: Page) => page.locator('[data-store-id]');
const sheet = (page: Page) => page.locator('#share-sheet');

/** Collects console errors, CSP violations and failed requests while the page is used. */
function watchForErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    if (req.url().startsWith('http://localhost')) errors.push(`failed: ${req.url()}`);
  });
  page.on('response', (res) => {
    if (res.url().startsWith('http://localhost') && res.status() >= 400) errors.push(`${res.status()}: ${res.url()}`);
  });
  return errors;
}

test.describe('store cards', () => {
  test('shows exactly the enabled stores, in order, with name, icon and the configured link', async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto('./');

    await expect(page).toHaveTitle('Rapid Layers | Official Store Links');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rapid Layers');
    await expect(cards(page)).toHaveCount(visible.length);

    for (const [i, store] of visible.entries()) {
      const card = cards(page).nth(i);
      await expect(card).toHaveAttribute('data-store-id', store.id);
      await expect(card.locator('.card__name')).toHaveText(store.name);
      await expect(card.locator('.tile svg')).toBeVisible();
      await expect(card.locator('a')).toHaveAttribute('href', store.href);
    }

    const hrefs = await cards(page).locator('a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(errors).toEqual([]);
  });

  test('never shows placeholder or disabled entries', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('body')).not.toContainText(/PLATFORM_\d|\[PLATFORM|store-4|TODO|placeholder/i);
  });

  for (const store of visible) {
    test(`tapping the "${store.id}" card opens its configured link`, async ({ page }) => {
      // Stub the destination so the test checks where the card goes without depending on the real site.
      await page.route(/^https:\/\//, (route) => route.fulfill({ contentType: 'text/html', body: '<title>stub</title>' }));
      await page.goto('./');
      const card = page.locator(`[data-store-id="${store.id}"]`);
      // Tap near the left edge of the card (on the icon), not on the text, to prove the whole card is clickable.
      const tap = () => card.click({ position: { x: 20, y: 30 } });

      if (store.url.startsWith('/')) {
        // Local file: headless Chromium has no PDF viewer and turns it into a download, so check the
        // request instead — the right file is requested and the site serves it.
        const [response] = await Promise.all([page.waitForResponse((r) => r.url().endsWith(store.href)), tap()]);
        expect(response.status()).toBe(200);
        if (store.url.endsWith('.pdf')) expect(response.headers()['content-type']).toContain('application/pdf');
        return;
      }

      await Promise.all([page.waitForURL(store.url), tap()]);
      expect(page.url()).toBe(store.url);
    });
  }

  test('the logo loads, and falls back to initials if it cannot', async ({ page }) => {
    await page.goto('./');
    const loaded = await page.locator('.avatar__img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);

    await page.route(/mark-288.*\.webp$/, (route) => route.abort());
    await page.reload();
    await expect(page.locator('[data-avatar]')).toHaveClass(/avatar--failed/);
    await expect(page.locator('.avatar__fallback')).toBeVisible();
    await expect(page.locator('.avatar__fallback')).toHaveText('RL');
  });
});

test.describe('action menu', () => {
  test('opening the menu does not navigate and shows that store\'s link', async ({ page }) => {
    await page.goto('./');
    const startUrl = page.url();
    for (const [i, store] of visible.entries()) {
      await cards(page).nth(i).getByRole('button', { name: `More options for ${store.name}` }).click();
      await expect(sheet(page)).toBeVisible();
      await expect(sheet(page).getByRole('heading')).toHaveText(store.name);
      await expect(sheet(page).getByLabel('Store link')).toHaveValue(store.shareUrl);
      expect(page.url()).toBe(startUrl);
      await page.keyboard.press('Escape');
      await expect(sheet(page)).toBeHidden();
    }
  });

  test('clicks inside the menu never trigger the card link', async ({ page }) => {
    await page.goto('./');
    const startUrl = page.url();
    await cards(page).first().getByRole('button').click();
    await sheet(page).getByLabel('Store link').click();
    await sheet(page).getByRole('heading').click();
    await expect(sheet(page)).toBeVisible();
    expect(page.url()).toBe(startUrl);
  });

  test('closes with Escape, the close button and a tap outside; focus returns to the menu button', async ({ page }) => {
    await page.goto('./');
    const more = cards(page).first().getByRole('button');

    await more.click();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await expect(more).toBeFocused();

    await more.click();
    await sheet(page).getByRole('button', { name: 'Close' }).click();
    await expect(sheet(page)).toBeHidden();

    await more.click();
    await page.mouse.click(5, 5); // backdrop, top-left corner
    await expect(sheet(page)).toBeHidden();
    await expect(more).toBeFocused();
  });

  test('Copy store link copies the exact URL and only then reports success', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('./');
    const store = visible[0]!;
    await cards(page).first().getByRole('button').click();
    await sheet(page).getByRole('button', { name: 'Copy store link' }).click();
    await expect(sheet(page).getByRole('status')).toHaveText('Link copied to clipboard.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(store.shareUrl);
  });

  test('when copying fails, it says so and selects the link for manual copy', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
      document.execCommand = () => false;
    });
    await page.goto('./');
    await cards(page).first().getByRole('button').click();
    await sheet(page).getByRole('button', { name: 'Copy store link' }).click();
    const status = sheet(page).getByRole('status');
    await expect(status).toContainText("Couldn't copy automatically");
    await expect(status).not.toContainText('copied to clipboard');
    const field = sheet(page).getByLabel('Store link');
    await expect(field).toBeFocused();
    const selected = await field.evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0));
    expect(selected).toBe(visible[0]!.shareUrl);
  });

  test('Share store link uses the Web Share API when the browser supports it', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __shared: ShareData[] }).__shared = [];
      Object.defineProperty(navigator, 'share', {
        value: (data: ShareData) => {
          (window as unknown as { __shared: ShareData[] }).__shared.push(data);
          return Promise.resolve();
        },
      });
    });
    await page.goto('./');
    const store = visible[1] ?? visible[0]!;
    await page.locator(`[data-store-id="${store.id}"]`).getByRole('button').click();
    await sheet(page).getByRole('button', { name: 'Share store link' }).click();
    await expect(sheet(page)).toBeHidden();
    const shared = await page.evaluate(() => (window as unknown as { __shared: ShareData[] }).__shared);
    expect(shared).toEqual([{ title: store.name, url: store.shareUrl }]);
  });

  test('cancelling the native share sheet shows no message', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        value: () => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' })),
      });
    });
    await page.goto('./');
    await cards(page).first().getByRole('button').click();
    await sheet(page).getByRole('button', { name: 'Share store link' }).click();
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByRole('status')).toHaveText('');
  });

  test('without Web Share support, Share copies the link instead and says so', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await page.goto('./');
    await cards(page).first().getByRole('button').click();
    await sheet(page).getByRole('button', { name: 'Share store link' }).click();
    await expect(sheet(page).getByRole('status')).toContainText('link was copied instead');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(visible[0]!.shareUrl);
  });
});

test.describe('keyboard and accessibility', () => {
  test('every card and menu can be reached and used with the keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is checked on tablet and desktop');
    await page.goto('./');
    for (const store of visible) {
      await page.keyboard.press('Tab');
      await expect(page.locator(`[data-store-id="${store.id}"] a`)).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator(`[data-store-id="${store.id}"] button`)).toBeFocused();
    }

    // Focus is now on the last card's menu button.
    await page.keyboard.press('Enter');
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByRole('button', { name: 'Share store link' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
  });

  test('focus is clearly visible on cards', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard focus is checked on tablet and desktop');
    await page.goto('./');
    await page.keyboard.press('Tab');
    const outline = await page
      .locator('[data-store-id] a')
      .first()
      .evaluate((a) => getComputedStyle(a, '::after').outlineStyle + ' ' + getComputedStyle(a, '::after').outlineWidth);
    expect(outline).toBe('solid 3px');
  });

  test('icon-only buttons have accessible names and the page has one main landmark', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('navigation')).toHaveCount(1);
    for (const button of await page.getByRole('button').all()) {
      if (!(await button.isVisible())) continue;
      expect((await button.getAttribute('aria-label')) ?? (await button.textContent())?.trim()).toBeTruthy();
    }
  });
});

test.describe('layout', () => {
  test('no horizontal overflow and comfortably large tap targets', async ({ page }) => {
    await page.goto('./');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Round to 0.1px: layout can report sub-pixel values such as 43.99997.
    const px = (n: number) => Math.round(n * 10) / 10;
    for (const card of await cards(page).all()) {
      const cardBox = (await card.boundingBox())!;
      const buttonBox = (await card.getByRole('button').boundingBox())!;
      expect(px(cardBox.height)).toBeGreaterThanOrEqual(44);
      expect(px(buttonBox.width)).toBeGreaterThanOrEqual(44);
      expect(px(buttonBox.height)).toBeGreaterThanOrEqual(44);
    }

    await cards(page).first().getByRole('button').click();
    await page.waitForTimeout(250); // let the opening animation finish before measuring
    for (const button of await sheet(page).getByRole('button').all()) {
      const box = (await button.boundingBox())!;
      expect(px(box.height)).toBeGreaterThanOrEqual(44);
      expect(px(box.width)).toBeGreaterThanOrEqual(44);
    }
    const sheetOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sheetOverflow).toBeLessThanOrEqual(0);
  });

  test('base font size is readable', async ({ page }) => {
    await page.goto('./');
    const sizes = await page.locator('.card__name, .card__desc').evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(14);
  });
});
