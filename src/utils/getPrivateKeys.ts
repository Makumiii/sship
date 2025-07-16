import { homedir } from 'node:os';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function getPrivateKeys(): Promise<string[]> {
  const sshDir = join(homedir(), '.ssh');
  try {
    const files = await readdir(sshDir);
    const privateKeys = files.filter(file => 
      !file.endsWith('.pub') && 
      file !== 'known_hosts' && 
      file !== 'known_hosts.old' && 
      file !== 'config'
    );
    return privateKeys;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('~/.ssh directory not found.');
      return [];
    }
    console.error('Error reading ~/.ssh directory:', error);
    return [];
  }
}
