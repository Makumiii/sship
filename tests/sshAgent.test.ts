import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";

type SpawnPlan = {
  code: number;
  stdout?: string;
  stderr?: string;
};

const spawnPlans: SpawnPlan[] = [];
const mockSpawn = mock((_cmd: string, _args: string[], options?: { stdio?: unknown }) => {
  const plan = spawnPlans.shift() ?? { code: 1 };
  const child = new EventEmitter() as unknown as {
    stdout?: EventEmitter;
    stderr?: EventEmitter;
    on: (event: string, cb: (...args: unknown[]) => void) => void;
    emit: (event: string, ...args: unknown[]) => void;
  };

  const stdio = options?.stdio;
  if (Array.isArray(stdio)) {
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setTimeout(() => {
      if (plan.stdout) child.stdout?.emit("data", Buffer.from(plan.stdout));
      if (plan.stderr) child.stderr?.emit("data", Buffer.from(plan.stderr));
      child.emit("close", plan.code);
    }, 0);
  } else {
    setTimeout(() => {
      child.emit("close", plan.code);
    }, 0);
  }

  return child;
});

let publicKeyExists = false;
const mockExistsSync = mock(() => publicKeyExists);

mock.module("node:child_process", () => ({ spawn: mockSpawn }));
mock.module("node:fs", () => ({ existsSync: mockExistsSync }));

describe("sshAgent helper", () => {
  const originalSock = process.env.SSH_AUTH_SOCK;
  const originalTtyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

  beforeEach(() => {
    spawnPlans.length = 0;
    publicKeyExists = false;
    mockSpawn.mockClear();
    mockExistsSync.mockClear();
    process.env.SSH_AUTH_SOCK = "/tmp/mock-agent.sock";
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    if (originalSock === undefined) {
      delete process.env.SSH_AUTH_SOCK;
    } else {
      process.env.SSH_AUTH_SOCK = originalSock;
    }

    if (originalTtyDescriptor) {
      Object.defineProperty(process.stdin, "isTTY", originalTtyDescriptor);
    }
  });

  test("returns skipped_no_agent when SSH_AUTH_SOCK is missing", async () => {
    const { ensureIdentityInAgent } = await import(`../src/utils/sshAgent.ts?test=${Date.now()}`);
    delete process.env.SSH_AUTH_SOCK;
    const status = await ensureIdentityInAgent("/tmp/key");
    expect(status).toBe("skipped_no_agent");
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  test("returns already_loaded when ssh-add -T confirms key loaded", async () => {
    const { ensureIdentityInAgent } = await import(`../src/utils/sshAgent.ts?test=${Date.now()}`);
    publicKeyExists = true;
    spawnPlans.push({ code: 0 });

    const status = await ensureIdentityInAgent("/tmp/key");

    expect(status).toBe("already_loaded");
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  test("returns skipped_non_interactive when tty is unavailable", async () => {
    const { ensureIdentityInAgent } = await import(`../src/utils/sshAgent.ts?test=${Date.now()}`);
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: false,
    });

    const status = await ensureIdentityInAgent("/tmp/key", { interactive: false });
    expect(status).toBe("skipped_non_interactive");
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  test("returns added when ssh-add succeeds", async () => {
    const { ensureIdentityInAgent } = await import(`../src/utils/sshAgent.ts?test=${Date.now()}`);
    spawnPlans.push({ code: 0 });
    const status = await ensureIdentityInAgent("/tmp/key", { interactive: true });
    expect(status).toBe("added");
  });

  test("returns failed when ssh-add exits non-zero", async () => {
    const { ensureIdentityInAgent } = await import(`../src/utils/sshAgent.ts?test=${Date.now()}`);
    spawnPlans.push({ code: 1 });
    const status = await ensureIdentityInAgent("/tmp/key", { interactive: true });
    expect(status).toBe("failed");
  });
});

afterAll(() => {
  mock.restore();
});
