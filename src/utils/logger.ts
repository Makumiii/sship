import ora from 'ora';
import { homedir } from 'node:os';
import { appendFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const logDir = `${homedir()}/.sship/logs`;
const logFilePath = `${logDir}/sship.log`;

let spinner: ora.Ora | null = null;

async function ensureLogDirectoryExists() {
  try {
    await access(logDir, constants.F_OK);
  } catch (e) {
    await mkdir(logDir, { recursive: true });
  }
}

async function writeToFile(message: string) {
  await ensureLogDirectoryExists();
  await appendFile(logFilePath, `${new Date().toISOString()} - ${message}\n`);
}

export const logger = {
  start: (text: string) => {
    if (spinner) {
      spinner.stop();
    }
    spinner = ora(text).start();
    writeToFile(`START: ${text}`);
  },
  succeed: (text: string) => {
    if (spinner) {
      spinner.succeed(text);
      spinner = null; // Clear spinner after it succeeds
    }
    writeToFile(`SUCCESS: ${text}`);
  },
  fail: (text: string) => {
    if (spinner) {
      spinner.fail(text);
      spinner = null; // Clear spinner after it fails
    }
    writeToFile(`FAIL: ${text}`);
  },
  info: (text: string) => {
    if (spinner) {
      spinner.info(text);
    } else {
      ora(text).info();
    }
    writeToFile(`INFO: ${text}`);
  },
  warn: (text: string) => {
    if (spinner) {
      spinner.warn(text);
    } else {
      ora(text).warn();
    }
    writeToFile(`WARN: ${text}`);
  },
  log: (text: string) => {
    if (spinner) {
      spinner.stopAndPersist({ text });
    }
    else {
      console.log(text);
    }
    writeToFile(`LOG: ${text}`);
  },
  stop: () => {
    if (spinner) {
      spinner.stop();
      spinner = null;
    }
  },
};