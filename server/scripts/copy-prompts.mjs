import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const srcRoot = path.join(rootDir, 'src');
const distRoot = path.join(rootDir, 'dist');

async function copyMarkdownFiles(currentDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await copyMarkdownFiles(entryPath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }
    const relativePath = path.relative(srcRoot, entryPath);
    const targetPath = path.join(distRoot, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(entryPath, targetPath);
  }
}

async function main() {
  await fs.mkdir(distRoot, { recursive: true });
  await copyMarkdownFiles(srcRoot);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
