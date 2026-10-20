// Loads, validates and orders the store list from src/data/stores.json.
// Any problem found here stops the build, so a broken link can never be published.
import { z } from 'zod';
import { ICON_KEYS, isIconKey, type IconKey } from './icons.ts';

/** Maximum number of stores that may be shown on the page at once. */
export const MAX_VISIBLE_STORES = 10;

/** Local files larger than this produce a warning (customers mostly open the page on phones). */
export const LARGE_FILE_WARNING_BYTES = 10 * 1024 * 1024;

/** Local files must live in public/files/ and use a simple, URL-safe file name. */
const LOCAL_FILE_PATTERN = /^\/files\/[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)*\.(pdf|png|jpe?g|webp)$/i;

const storeEntrySchema = z.strictObject({
  id: z
    .string({ error: 'ต้องเป็นข้อความ' })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: 'ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษพิมพ์เล็ก ตัวเลข และขีด (-) เช่น "shopee" หรือ "order-guide"' }),
  enabled: z.boolean({ error: 'ต้องเป็น true หรือ false (ไม่มีเครื่องหมายคำพูด)' }),
  order: z.number({ error: 'ต้องเป็นตัวเลข' }).int({ error: 'ต้องเป็นจำนวนเต็ม' }).min(1, { error: 'ต้องมีค่าตั้งแต่ 1 ขึ้นไป' }),
  name: z.string({ error: 'ต้องเป็นข้อความ' }).trim().max(60, { error: 'ยาวได้ไม่เกิน 60 ตัวอักษร' }),
  description: z.string({ error: 'ต้องเป็นข้อความ' }).trim().max(120, { error: 'ยาวได้ไม่เกิน 120 ตัวอักษร' }).default(''),
  url: z.string({ error: 'ต้องเป็นข้อความ' }).trim(),
  icon: z.string({ error: 'ต้องเป็นข้อความ' }).trim(),
});

export type StoreLinkKind = 'external' | 'file';

export interface Store {
  id: string;
  order: number;
  name: string;
  description: string;
  /** Exactly as configured: an https:// URL, or a /files/... path for a file hosted on this site. */
  url: string;
  kind: StoreLinkKind;
  icon: IconKey;
}

export interface FileInfo {
  exists: boolean;
  sizeBytes: number;
}

export interface ValidateOptions {
  /** Looks up a local file by its /files/... path. Required when any store links to a local file. */
  getFileInfo?: (path: string) => FileInfo;
}

export interface ValidationResult {
  stores: Store[];
  warnings: string[];
}

export class StoreConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(
      `พบปัญหาในไฟล์ src/data/stores.json (${problems.length} จุด):\n` +
        problems.map((p) => `  • ${p}`).join('\n') +
        '\nดูวิธีแก้ไขได้ที่ STORE_MANAGEMENT.md',
    );
    this.name = 'StoreConfigError';
    this.problems = problems;
  }
}

type UrlCheck = { ok: true; kind: StoreLinkKind } | { ok: false; reason: string };

/** Checks a single configured link. Only https:// URLs and /files/... paths are accepted. */
export function checkStoreUrl(url: string): UrlCheck {
  if (url === '') return { ok: false, reason: 'ยังไม่ได้ใส่ url' };
  if (/\s/.test(url)) return { ok: false, reason: 'url ต้องไม่มีช่องว่าง' };

  if (url.startsWith('/')) {
    if (url.includes('..') || !LOCAL_FILE_PATTERN.test(url)) {
      return {
        ok: false,
        reason: `ไฟล์ในเว็บต้องอยู่ในรูปแบบ /files/ชื่อไฟล์.pdf (รองรับ .pdf .png .jpg .webp และชื่อไฟล์ใช้ได้เฉพาะ A-Z a-z 0-9 - _) แต่ได้ "${url}"`,
      };
    }
    return { ok: true, kind: 'file' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: `url "${url}" ไม่ใช่ลิงก์ที่ถูกต้อง (ต้องขึ้นต้นด้วย https://)` };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: `url ต้องขึ้นต้นด้วย https:// เท่านั้น แต่ได้ "${parsed.protocol}"` };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'url ต้องไม่มีชื่อผู้ใช้หรือรหัสผ่านฝังอยู่' };
  }
  if (parsed.hostname === 'localhost' || !parsed.hostname.includes('.')) {
    return { ok: false, reason: `url "${url}" ไม่ใช่ที่อยู่เว็บสาธารณะ` };
  }
  return { ok: true, kind: 'external' };
}

function describeIssue(issue: z.core.$ZodIssue): string {
  const field = issue.path.join('.');
  if (issue.code === 'unrecognized_keys') {
    return `มีฟิลด์ที่ระบบไม่รู้จัก: ${issue.keys.map((k) => `"${k}"`).join(', ')} (สะกดผิดหรือไม่?)`;
  }
  if (issue.code === 'invalid_type' && issue.input === undefined) {
    return `ขาดฟิลด์ "${field}"`;
  }
  return `ฟิลด์ "${field}" ${issue.message}`;
}

function entryLabel(index: number, raw: unknown): string {
  const id = raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string' ? raw.id : '?';
  return `รายการที่ ${index + 1} (id: "${id}")`;
}

/**
 * Validates the raw store list and returns the stores to display, sorted by `order`.
 * Disabled entries are skipped (they may be incomplete drafts). Throws StoreConfigError
 * listing every problem found, so they can all be fixed in one go.
 */
export function validateStores(raw: unknown, options: ValidateOptions = {}): ValidationResult {
  const problems: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(raw)) {
    throw new StoreConfigError(['ไฟล์ต้องเป็นรายการ (เริ่มด้วย [ และจบด้วย ])']);
  }

  const seenIds = new Map<string, number>();
  const seenUrls = new Map<string, number>();
  const seenOrders = new Map<number, number>();
  const stores: Store[] = [];

  raw.forEach((entry, index) => {
    const label = entryLabel(index, entry);
    const parsed = storeEntrySchema.safeParse(entry);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) problems.push(`${label}: ${describeIssue(issue)}`);
      return;
    }
    const data = parsed.data;

    const firstWithId = seenIds.get(data.id);
    if (firstWithId !== undefined) {
      problems.push(`${label}: id "${data.id}" ซ้ำกับรายการที่ ${firstWithId + 1} (id ต้องไม่ซ้ำกัน)`);
    } else {
      seenIds.set(data.id, index);
    }

    if (!data.enabled) return;

    const before = problems.length;
    if (data.name === '') problems.push(`${label}: ยังไม่ได้ใส่ name (ชื่อที่แสดงบนการ์ด)`);

    if (!isIconKey(data.icon)) {
      problems.push(
        `${label}: icon "${data.icon}" ไม่มีในระบบ — ใช้ได้: ${ICON_KEYS.map((k) => `"${k}"`).join(', ')}`,
      );
    }

    const urlCheck = checkStoreUrl(data.url);
    if (!urlCheck.ok) {
      problems.push(`${label}: ${urlCheck.reason}`);
    } else {
      const firstWithUrl = seenUrls.get(data.url);
      if (firstWithUrl !== undefined) {
        problems.push(`${label}: url ซ้ำกับรายการที่ ${firstWithUrl + 1} — ตรวจสอบว่าไม่ได้คัดลอกลิงก์ผิดร้าน`);
      } else {
        seenUrls.set(data.url, index);
      }

      if (urlCheck.kind === 'file') {
        if (!options.getFileInfo) {
          problems.push(`${label}: ไม่สามารถตรวจสอบไฟล์ ${data.url} ได้`);
        } else {
          const info = options.getFileInfo(data.url);
          if (!info.exists) {
            problems.push(`${label}: ไม่พบไฟล์ public${data.url} — วางไฟล์ไว้ในโฟลเดอร์ public/files/ และตรวจชื่อไฟล์ให้ตรงกัน (ตัวพิมพ์เล็ก/ใหญ่มีผล)`);
          } else if (info.sizeBytes > LARGE_FILE_WARNING_BYTES) {
            const mb = (info.sizeBytes / 1024 / 1024).toFixed(1);
            warnings.push(`${label}: ไฟล์ ${data.url} มีขนาด ${mb} MB — ลูกค้าบนมือถืออาจโหลดช้า แนะนำให้บีบอัดให้เล็กกว่า 10 MB`);
          }
        }
      }
    }

    const firstWithOrder = seenOrders.get(data.order);
    if (firstWithOrder !== undefined) {
      problems.push(`${label}: order ${data.order} ซ้ำกับรายการที่ ${firstWithOrder + 1} (ลำดับของร้านที่เปิดใช้งานต้องไม่ซ้ำกัน)`);
    } else {
      seenOrders.set(data.order, index);
    }

    if (problems.length === before && urlCheck.ok && isIconKey(data.icon)) {
      stores.push({
        id: data.id,
        order: data.order,
        name: data.name,
        description: data.description,
        url: data.url,
        kind: urlCheck.kind,
        icon: data.icon,
      });
    }
  });

  const enabledCount = raw.filter((e) => e && typeof e === 'object' && (e as { enabled?: unknown }).enabled === true).length;
  if (enabledCount > MAX_VISIBLE_STORES) {
    problems.push(
      `เปิดใช้งาน (enabled: true) อยู่ ${enabledCount} รายการ เกินขีดจำกัด ${MAX_VISIBLE_STORES} รายการ — ปิดหรือลบบางรายการ`,
    );
  }
  if (enabledCount === 0) {
    problems.push('ต้องมีร้านที่เปิดใช้งาน (enabled: true) อย่างน้อย 1 รายการ');
  }

  if (problems.length > 0) throw new StoreConfigError(problems);

  stores.sort((a, b) => a.order - b.order);
  return { stores, warnings };
}

/** The href used on the page: external URLs as-is, local files prefixed with the site's base path. */
export function storeHref(store: Pick<Store, 'url' | 'kind'>, basePath: string): string {
  if (store.kind === 'external') return store.url;
  return basePath.replace(/\/+$/, '') + store.url;
}

/** The full URL used when sharing or copying a store link. */
export function storeShareUrl(store: Pick<Store, 'url' | 'kind'>, siteOrigin: string, basePath: string): string {
  if (store.kind === 'external') return store.url;
  return new URL(storeHref(store, basePath), siteOrigin).href;
}
