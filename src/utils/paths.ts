import path from 'path';
import fs from 'fs';

export function resolveCwd(input?: string) {
  const p = input ? path.resolve(process.cwd(), input) : process.cwd();
  return p;
}

export function getProjectRoot(start = process.cwd()) {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return start;
}
