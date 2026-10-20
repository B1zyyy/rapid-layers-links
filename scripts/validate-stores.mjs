// Quick check of src/data/stores.json without running a full build:  npm run validate
import { readFileSync } from 'node:fs';

const FILE = 'src/data/stores.json';

// Check the JSON syntax first so a typo gets a clear message with its line number.
try {
  JSON.parse(readFileSync(FILE, 'utf8'));
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  const where = detail.match(/line (\d+) column (\d+)/);
  console.error(`✗ ${FILE} มีรูปแบบ JSON ผิด${where ? ` ที่บรรทัด ${where[1]} ตำแหน่งที่ ${where[2]}` : ''}`);
  console.error(`  (${detail})`);
  console.error('  สาเหตุที่พบบ่อย: มี , เกินหลังรายการสุดท้าย, ลืม , ระหว่างรายการ, หรือลืมเครื่องหมายคำพูด "');
  process.exit(1);
}

const { loadStores } = await import('../src/lib/load-stores.ts');
try {
  const { stores, warnings } = loadStores();
  for (const warning of warnings) console.warn(`⚠ ${warning}`);
  console.log(`✓ stores.json ถูกต้อง — จะแสดง ${stores.length} ร้าน:`);
  for (const s of stores) console.log(`  ${s.order}. ${s.name}  →  ${s.url}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
