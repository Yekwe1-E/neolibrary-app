const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = 'c:/Users/hp/OneDrive/Desktop/Emmerson';
const tempDir = path.join(rootDir, 'temp_deploy_package');
const zipPath = path.join(rootDir, 'Emmerson_GitHub_Upload.zip');

// Remove existing temp or zip
if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

fs.mkdirSync(tempDir, { recursive: true });

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    const baseName = path.basename(src);
    if (baseName === 'node_modules' || baseName === '.git' || baseName === 'temp_deploy_package') return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    const baseName = path.basename(src);
    if (baseName === '.env' || baseName.endsWith('.log') || baseName.endsWith('.zip')) return;
    fs.copyFileSync(src, dest);
  }
}

copyRecursive(rootDir, tempDir);

console.log('Copied clean files. Compressing now...');

// Use PowerShell Compress-Archive on tempDir contents
const psCommand = `powershell -Command "Compress-Archive -Path '${tempDir}/*' -DestinationPath '${zipPath}' -Force"`;
execSync(psCommand);

// Copy to artifacts
const artifactZip = 'C:/Users/hp/.gemini/antigravity-ide/brain/2f8c9702-9c36-428c-8185-2441d675d3d5/Emmerson_GitHub_Upload.zip';
fs.copyFileSync(zipPath, artifactZip);

// Cleanup tempDir
fs.rmSync(tempDir, { recursive: true, force: true });

const zipStats = fs.statSync(zipPath);
console.log(`ZIP generated successfully! File size: ${(zipStats.size / 1024).toFixed(2)} KB`);
