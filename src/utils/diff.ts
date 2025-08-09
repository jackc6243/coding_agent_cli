import { createTwoFilesPatch } from 'diff';

export function createUnifiedDiff(path: string, before: string, after: string, label = 'patch') {
  return createTwoFilesPatch(path, path, before, after, 'before', 'after', { context: 3 });
}
