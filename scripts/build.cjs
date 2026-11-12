const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== PALMORA AI MONOREPO BUILD STARTING ===');

// 1. Build @palmora/shared-types
try {
  console.log('-> Ensuring shared contracts are fresh...');
  execSync('npm --workspace=@palmora/shared-types run build', { stdio: 'inherit' });
} catch (e) {
  try {
    execSync('pnpm --filter @palmora/shared-types run build', { stdio: 'inherit' });
  } catch (err) {
    console.log('Using pre-compiled packages/shared-types/dist contracts.');
  }
}

// 2. Build Next.js Web App
console.log('-> Compiling Next.js Web App...');
let built = false;
const buildCommands = [
  'pnpm --filter @palmora/web run build',
  'npm --workspace=@palmora/web run build',
  'npm --prefix apps/web run build',
];

for (const cmd of buildCommands) {
  try {
    console.log(`Attempting build via: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    built = true;
    break;
  } catch (err) {
    console.warn(`Command '${cmd}' failed. Checking next method...`);
  }
}

if (!built) {
  console.error('FATAL: Could not build Next.js web application through any workspace manager.');
  process.exit(1);
}

// 3. Sync to root for Vercel root-directory deployments
try {
  const rootDir = path.resolve(__dirname, '..');
  const srcNext = path.join(rootDir, 'apps', 'web', '.next');
  const destNext = path.join(rootDir, '.next');
  const srcPublic = path.join(rootDir, 'apps', 'web', 'public');
  const destPublic = path.join(rootDir, 'public');

  if (fs.existsSync(srcNext)) {
    fs.cpSync(srcNext, destNext, { recursive: true, force: true });
    console.log('Synchronized apps/web/.next -> .next');
  }
  if (fs.existsSync(srcPublic)) {
    fs.cpSync(srcPublic, destPublic, { recursive: true, force: true });
    console.log('Synchronized apps/web/public -> public');
  }
} catch (err) {
  console.warn('Sync notice:', err.message);
}

console.log('=== PALMORA AI BUILD COMPLETED SUCCESSFULLY ===');
