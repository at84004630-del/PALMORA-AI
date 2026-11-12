const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcNext = path.join(rootDir, 'apps', 'web', '.next');
const destNext = path.join(rootDir, '.next');
const srcPublic = path.join(rootDir, 'apps', 'web', 'public');
const destPublic = path.join(rootDir, 'public');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`Source directory does not exist: ${src}`);
    return;
  }
  try {
    fs.cpSync(src, dest, { recursive: true, force: true });
    console.log(`Copied ${src} -> ${dest}`);
  } catch (err) {
    console.warn(`Could not copy ${src} -> ${dest}:`, err.message);
  }
}

copyDir(srcNext, destNext);
copyDir(srcPublic, destPublic);
