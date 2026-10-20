// Runs the end-to-end tests against the live site:  npm run test:prod
import { spawnSync } from 'node:child_process';
import { BASE_PATH, SITE_URL } from '../deploy.config.mjs';

const url = new URL(BASE_PATH, SITE_URL).href;
console.log(`Testing live site: ${url}`);
const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PROD_URL: url },
});
process.exit(result.status ?? 1);
