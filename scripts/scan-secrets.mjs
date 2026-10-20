// Fails if anything that looks like a secret is found in the source or the production build:  npm run scan:secrets
// This site needs no secrets at all, so any match is a mistake to investigate.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOTS = ['src', 'public', 'scripts', 'dist', '.github', 'astro.config.mjs', 'package.json'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.astro']);
const TEXT_EXT = new Set(['.ts', '.js', '.mjs', '.astro', '.json', '.css', '.html', '.md', '.txt', '.yml', '.yaml', '.svg', '.xml', '']);

const PATTERNS = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['Stripe secret key', /\b(sk|rk)_live_[A-Za-z0-9]{20,}\b/],
  ['OpenAI / Anthropic key', /\bsk-(ant-|proj-)?[A-Za-z0-9_-]{32,}\b/],
  ['LINE channel secret/token assignment', /\b(channel[_-]?(secret|access[_-]?token))\s*[:=]\s*['"][^'"]{16,}['"]/i],
  ['generic secret assignment', /\b(api[_-]?key|secret|password|passwd|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"][^'"\s]{12,}['"]/i],
];

function* walk(path) {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    return;
  }
  if (stats.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (!SKIP_DIRS.has(name)) yield* walk(join(path, name));
    }
  } else if (TEXT_EXT.has(extname(path).toLowerCase()) && stats.size < 5 * 1024 * 1024) {
    yield path;
  }
}

const findings = [];
let scanned = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (file.endsWith('scan-secrets.mjs')) continue;
    scanned++;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const [label, pattern] of PATTERNS) {
        // Report the location and type only — never print the matched value.
        if (pattern.test(line)) findings.push(`${file}:${i + 1}  ${label}`);
      }
    });
  }
}

for (const name of readdirSync('.')) {
  if (/^\.env(\..+)?$/.test(name) && name !== '.env.example') {
    console.warn(`note: ${name} exists locally — it is git-ignored and must never be committed.`);
  }
}

if (findings.length > 0) {
  console.error(`✗ Possible secrets found (${findings.length}):`);
  for (const f of findings) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`✓ No secrets found in ${scanned} files (source + build output).`);
