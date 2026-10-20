import { describe, expect, it } from 'vitest';
import rawStores from '../../src/data/stores.json' with { type: 'json' };
import { loadStores } from '../../src/lib/load-stores.ts';
import {
  MAX_VISIBLE_STORES,
  StoreConfigError,
  checkStoreUrl,
  storeHref,
  storeShareUrl,
  validateStores,
  type FileInfo,
} from '../../src/lib/stores.ts';

type Entry = Record<string, unknown>;

const entry = (n: number, overrides: Entry = {}): Entry => ({
  id: `store-${n}`,
  enabled: true,
  order: n,
  name: `Store ${n}`,
  description: '',
  url: `https://shop${n}.example.com/rapid-layers`,
  icon: 'link',
  ...overrides,
});

const noFiles = { getFileInfo: (): FileInfo => ({ exists: false, sizeBytes: 0 }) };

function problemsOf(raw: unknown, options = noFiles): string[] {
  try {
    validateStores(raw, options);
  } catch (error) {
    if (error instanceof StoreConfigError) return error.problems;
    throw error;
  }
  return [];
}

describe('the real stores.json', () => {
  it('passes validation and shows exactly the three confirmed stores, in order', () => {
    const { stores, warnings } = loadStores();
    expect(warnings).toEqual([]);
    expect(stores.map((s) => [s.id, s.url])).toEqual([
      ['website', 'https://rapid-layers.com/th/contact'],
      ['line', 'https://lin.ee/PcYmKD6'],
      ['facebook', 'https://www.facebook.com/profile.php?id=61589890161692'],
    ]);
  });

  it('keeps the unfinished fourth entry hidden', () => {
    const draft = (rawStores as Entry[]).find((s) => s.id === 'store-4');
    expect(draft?.enabled).toBe(false);
    expect(loadStores().stores.some((s) => s.id === 'store-4')).toBe(false);
  });
});

describe('checkStoreUrl', () => {
  it.each([
    'https://shopee.co.th/rapidlayers',
    'https://lin.ee/PcYmKD6',
    'https://www.facebook.com/profile.php?id=1',
  ])('accepts https link %s', (url) => {
    expect(checkStoreUrl(url)).toEqual({ ok: true, kind: 'external' });
  });

  it.each(['/files/order-guide.pdf', '/files/Price_List-2026.pdf', '/files/menu.png'])('accepts local file %s', (url) => {
    expect(checkStoreUrl(url)).toEqual({ ok: true, kind: 'file' });
  });

  it.each([
    ['empty', ''],
    ['http', 'http://shop.example.com'],
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['protocol-relative', '//evil.example.com'],
    ['no scheme', 'shopee.co.th/rapidlayers'],
    ['embedded credentials', 'https://user:pass@shop.example.com'],
    ['localhost', 'https://localhost/shop'],
    ['spaces', 'https://shop.example.com/my shop'],
    ['path outside /files', '/admin/secret.pdf'],
    ['path traversal', '/files/../package.json'],
    ['nested folder', '/files/sub/guide.pdf'],
    ['unsupported file type', '/files/guide.exe'],
    ['Thai file name', '/files/คู่มือ.pdf'],
  ])('rejects %s', (_label, url) => {
    expect(checkStoreUrl(url).ok).toBe(false);
  });
});

describe('validateStores', () => {
  it('sorts visible stores by order, not by position in the file', () => {
    const { stores } = validateStores([entry(1, { order: 3 }), entry(2, { order: 1 }), entry(3, { order: 2 })], noFiles);
    expect(stores.map((s) => s.id)).toEqual(['store-2', 'store-3', 'store-1']);
  });

  it('hides disabled entries and allows them to be incomplete drafts', () => {
    const draft = { id: 'next-shop', enabled: false, order: 9, name: '', description: '', url: '', icon: '' };
    const { stores } = validateStores([entry(1), draft], noFiles);
    expect(stores.map((s) => s.id)).toEqual(['store-1']);
  });

  it(`accepts the maximum of ${MAX_VISIBLE_STORES} visible stores`, () => {
    const ten = Array.from({ length: MAX_VISIBLE_STORES }, (_, i) => entry(i + 1));
    expect(validateStores(ten, noFiles).stores).toHaveLength(MAX_VISIBLE_STORES);
  });

  it(`rejects more than ${MAX_VISIBLE_STORES} visible stores`, () => {
    const eleven = Array.from({ length: MAX_VISIBLE_STORES + 1 }, (_, i) => entry(i + 1));
    expect(problemsOf(eleven).join('\n')).toMatch(/11 รายการ เกินขีดจำกัด 10/);
  });

  it('does not count disabled entries toward the limit', () => {
    const list = [
      ...Array.from({ length: MAX_VISIBLE_STORES }, (_, i) => entry(i + 1)),
      entry(11, { enabled: false }),
      entry(12, { enabled: false }),
    ];
    expect(validateStores(list, noFiles).stores).toHaveLength(MAX_VISIBLE_STORES);
  });

  it('rejects duplicate ids, urls and orders', () => {
    const problems = problemsOf([
      entry(1),
      entry(2, { id: 'store-1' }),
      entry(3, { url: 'https://shop1.example.com/rapid-layers' }),
      entry(4, { order: 1 }),
    ]);
    expect(problems.some((p) => p.includes('id "store-1" ซ้ำ'))).toBe(true);
    expect(problems.some((p) => p.includes('url ซ้ำ'))).toBe(true);
    expect(problems.some((p) => p.includes('order 1 ซ้ำ'))).toBe(true);
  });

  it('requires name, a known icon and a valid url on enabled stores', () => {
    const problems = problemsOf([entry(1, { name: '', icon: 'tiktok', url: 'http://shop.example.com' })]);
    expect(problems).toHaveLength(3);
  });

  it('reports misspelled or missing fields', () => {
    const { enabled: _omit, ...withoutEnabled } = entry(1);
    expect(problemsOf([{ ...entry(1), enable: true }]).join()).toMatch(/ไม่รู้จัก: "enable"/);
    expect(problemsOf([withoutEnabled]).join()).toMatch(/ขาดฟิลด์ "enabled"/);
    expect(problemsOf([entry(1, { enabled: 'true' })]).join()).toMatch(/enabled/);
  });

  it('rejects a file that is not a list, and a list with nothing visible', () => {
    expect(problemsOf({ stores: [] })).toHaveLength(1);
    expect(problemsOf([entry(1, { enabled: false })]).join()).toMatch(/อย่างน้อย 1 รายการ/);
  });

  it('checks that a linked local file really exists', () => {
    const pdf = entry(1, { url: '/files/order-guide.pdf', icon: 'pdf' });
    expect(problemsOf([pdf]).join()).toMatch(/ไม่พบไฟล์ public\/files\/order-guide.pdf/);

    const present = { getFileInfo: (): FileInfo => ({ exists: true, sizeBytes: 2_000_000 }) };
    const { stores, warnings } = validateStores([pdf], present);
    expect(stores[0]?.kind).toBe('file');
    expect(warnings).toEqual([]);
  });

  it('warns (without failing) about very large local files', () => {
    const big = { getFileInfo: (): FileInfo => ({ exists: true, sizeBytes: 25 * 1024 * 1024 }) };
    const { warnings } = validateStores([entry(1, { url: '/files/catalog.pdf', icon: 'pdf' })], big);
    expect(warnings.join()).toMatch(/25.0 MB/);
  });

  it('collects every problem at once instead of stopping at the first', () => {
    expect(problemsOf([entry(1, { url: '' }), entry(2, { icon: 'x' })])).toHaveLength(2);
  });
});

describe('links for local files', () => {
  const pdf = { url: '/files/order-guide.pdf', kind: 'file' as const };
  const external = { url: 'https://lin.ee/PcYmKD6', kind: 'external' as const };

  it('prefixes the site base path on the page', () => {
    expect(storeHref(pdf, '/rapid-layers-links/')).toBe('/rapid-layers-links/files/order-guide.pdf');
    expect(storeHref(pdf, '/')).toBe('/files/order-guide.pdf');
    expect(storeHref(external, '/rapid-layers-links/')).toBe('https://lin.ee/PcYmKD6');
  });

  it('shares a full URL, never a bare path', () => {
    expect(storeShareUrl(pdf, 'https://b1zyyy.github.io', '/rapid-layers-links/')).toBe(
      'https://b1zyyy.github.io/rapid-layers-links/files/order-guide.pdf',
    );
    expect(storeShareUrl(external, 'https://b1zyyy.github.io', '/rapid-layers-links/')).toBe('https://lin.ee/PcYmKD6');
  });
});
