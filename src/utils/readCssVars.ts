import * as fs from 'fs/promises';

export async function readCssVars(filePath: string): Promise<{ name: string, value: string }[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  // 匹配 --xxx: #fff; 或 --xxx: #fff;
  const regex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  const vars: { name: string, value: string }[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    vars.push({ name: match[1], value: match[2].trim() });
  }
  return vars;
}