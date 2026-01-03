import { execSync } from 'node:child_process';

const flag = String(process.env.PLAYWRIGHT_INSTALL_WITH_DEPS || '').toLowerCase();
const shouldInstall = flag === '1' || flag === 'true' || flag === 'yes';

if (!shouldInstall) {
  console.log('Skipping Playwright install (set PLAYWRIGHT_INSTALL_WITH_DEPS=1 to enable).');
  process.exit(0);
}

try {
  execSync('npx playwright install --with-deps chromium', { stdio: 'inherit' });
} catch (error) {
  console.error('Playwright install failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
