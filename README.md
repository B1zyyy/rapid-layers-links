# Rapid Layers — Official Store Links

หน้าเว็บศูนย์รวมช่องทางหน้าร้านออนไลน์ของ **Rapid Layers** (static site)

- **แก้ข้อมูลร้านค้า:** `src/data/stores.json` — ดูคู่มือฉบับเต็มที่ [STORE_MANAGEMENT.md](STORE_MANAGEMENT.md)
- **แก้ข้อความแบรนด์/หน้าเว็บ:** `src/data/site.json`

## Tech stack

| ส่วน | เครื่องมือ |
|---|---|
| Framework | [Astro](https://astro.build) 7 (static output, JavaScript ฝั่งลูกค้าเฉพาะเมนู Share/Copy) |
| ภาษา | TypeScript |
| ตรวจข้อมูล | Zod (ข้อมูลผิด → build ไม่ผ่าน) |
| ฟอนต์ | Inter + Noto Sans Thai (self-hosted ผ่าน Fontsource) |
| ทดสอบ | Vitest (unit) + Playwright (end-to-end, Chromium) |
| Hosting | GitHub Pages ผ่าน GitHub Actions |

ต้องใช้ Node.js 22.22 ขึ้นไป (พัฒนาด้วย Node 24)

## คำสั่ง

```bash
npm ci                    # ติดตั้งตาม lockfile
npm run dev               # เปิดเซิร์ฟเวอร์สำหรับพัฒนา http://localhost:4321/rapid-layers-links/
npm run validate          # ตรวจ src/data/stores.json
npm run check             # type check
npm test                  # unit tests
npm run build             # production build → dist/
npm run scan:secrets      # สแกนหา secret ใน source และ dist/
npx playwright install chromium   # ครั้งแรกครั้งเดียว
npm run test:e2e          # end-to-end tests (ต้อง build ก่อน)
npm run verify            # check + test + build + scan + e2e
npm run brand:assets      # สร้างรูปโลโก้/favicon/OG ใหม่จาก brand/rapid-layers-logo-original.jpg
```

## โครงสร้างไฟล์สำคัญ

```
src/data/stores.json          ← ข้อมูลร้านค้า (แหล่งข้อมูลกลางจุดเดียว)
deploy.config.mjs             ← URL เว็บและ base path (จุดเดียวเมื่อย้าย hosting/โดเมน)
src/data/site.json            ← ชื่อแบรนด์, title, meta description, ข้อความบนเมนู
src/lib/stores.ts             ← กฎตรวจข้อมูล, ขีดจำกัด 10 ร้าน, การเรียงลำดับ
src/lib/load-stores.ts        ← อ่าน stores.json + ตรวจว่าไฟล์ใน public/files มีจริง
src/lib/icons.ts              ← รายชื่อไอคอนที่ใช้ได้
src/components/StoreCard.astro    ← การ์ดร้าน (ใช้ซ้ำทุกร้าน)
src/components/ShareSheet.astro   ← เมนู Share / Copy (dialog เดียวใช้ร่วมกัน)
src/components/PlatformIcon.astro ← ไอคอนแพลตฟอร์ม
src/components/BrandHeader.astro  ← โลโก้ + ชื่อแบรนด์
src/scripts/share.ts          ← logic การแชร์/คัดลอก
src/styles/tokens.css         ← color tokens และค่าการออกแบบ
public/files/                 ← ไฟล์ที่ลิงก์จากการ์ด (เช่น PDF)
brand/                        ← ไฟล์โลโก้ต้นฉบับ
tests/unit/, tests/e2e/       ← ชุดทดสอบ
.github/workflows/deploy.yml  ← ทดสอบ + build + deploy อัตโนมัติ
```

## Secrets และ environment variables

เว็บนี้ **ไม่ใช้ secret ใด ๆ** — ชื่อร้าน, URL และโลโก้เป็นข้อมูลสาธารณะ จึงเก็บใน `src/data/` ไม่ใช่ใน `.env`

- `.env`, `.env.*` ถูก ignore ใน `.gitignore` (ยกเว้น `.env.example` ที่มีแต่คำอธิบาย)
- `npm run scan:secrets` ตรวจ source และ `dist/` ทุกครั้งใน CI — ถ้าพบรูปแบบที่คล้าย key/token การ deploy จะหยุด
- ถ้าอนาคตต้องใช้ secret จริง (เช่น API ของแพลตฟอร์ม) ต้องใช้ server-side function — **ห้ามใส่ในโค้ดหน้าเว็บ** เพราะทุกอย่างในเว็บ static ถูกส่งไปยังเบราว์เซอร์ของลูกค้า

## Deploy

ทุกครั้งที่ push ไปที่ `main`, GitHub Actions จะรัน validate → type check → unit tests → build → secret scan → e2e
ถ้าผ่านทั้งหมดจึง deploy ไป GitHub Pages; ถ้าไม่ผ่าน เว็บจริงจะยังเป็นเวอร์ชันเดิม

**ย้ายไปใช้โดเมนของตัวเอง** (เช่น `links.rapid-layers.com`):
1. แก้ `SITE_URL` และ `BASE_PATH` ในไฟล์ `deploy.config.mjs` (จุดเดียว) เป็น `'https://links.rapid-layers.com'` และ `'/'`
2. ใน GitHub → Settings → Pages → Custom domain ใส่โดเมน
3. ใน Cloudflare DNS เพิ่ม `CNAME links → b1zyyy.github.io` (ตั้ง Proxy เป็น DNS only จนกว่า GitHub จะออกใบรับรอง HTTPS)

## เครดิตไอคอน

- ไอคอน LINE และ Facebook: ข้อมูล SVG จาก [Simple Icons](https://simpleicons.org) (CC0) — เครื่องหมายการค้าเป็นของเจ้าของแพลตฟอร์ม ใช้เพื่อระบุช่องทางเท่านั้น สีตาม brand guidelines ของแต่ละแพลตฟอร์ม
- ไอคอนทั่วไป (ลูกโลก, เอกสาร, ลิงก์, แชร์, คัดลอก): รูปแบบ [Lucide](https://lucide.dev) (ISC)
