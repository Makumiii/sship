import { platform } from 'node:os';

export function isWindows(): boolean {
  return platform() === 'win32';
}

export function isUnix(): boolean {
  return platform() === 'linux' || platform() === 'darwin';
}
