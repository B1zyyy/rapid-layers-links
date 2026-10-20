// Reads src/data/stores.json and validates it against the files in public/.
// Used by the page at build time and by `npm run validate`.
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import rawStores from '../data/stores.json' with { type: 'json' };
import { validateStores, type FileInfo, type ValidationResult } from './stores.ts';

const PUBLIC_DIR = join(process.cwd(), 'public');

function getFileInfo(path: string): FileInfo {
  const fullPath = join(PUBLIC_DIR, ...path.split('/'));
  try {
    // Compare names exactly: Windows and macOS ignore letter case, but the web server does not,
    // so "Order-Guide.pdf" must not pass for "order-guide.pdf".
    const name = path.split('/').pop() ?? '';
    if (!readdirSync(dirname(fullPath)).includes(name)) return { exists: false, sizeBytes: 0 };
    const stats = statSync(fullPath);
    return { exists: stats.isFile(), sizeBytes: stats.size };
  } catch {
    return { exists: false, sizeBytes: 0 };
  }
}

export function loadStores(): ValidationResult {
  return validateStores(rawStores, { getFileInfo });
}
