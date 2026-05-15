import { describe, expect, test } from "bun:test";
import type { ServerConfig } from "../src/types/serverTypes.ts";
import { isLikelyTestOrMockServer } from "../src/utils/serverStorage.ts";

describe("MRU helper heuristics (exclude test/mock/local)", () => {
  test("flags loopback and mock/test names as test/mock servers", () => {
    const a: ServerConfig = {
      name: "mock-1",
      host: "127.0.0.1",
      port: 22,
      user: "root",
      authMode: "identity_file",
      identityFile: "/tmp/key",
      createdAt: new Date().toISOString(),
    };
    const b: ServerConfig = {
      name: "test-alpha",
      host: "10.0.0.5",
      port: 22,
      user: "ubuntu",
      authMode: "ssh_agent",
      createdAt: new Date().toISOString(),
    };
    const c: ServerConfig = {
      name: "prod",
      host: "10.0.0.10",
      port: 22,
      user: "ubuntu",
      authMode: "ssh_agent",
      createdAt: new Date().toISOString(),
    };

    expect(isLikelyTestOrMockServer(a)).toBe(true);
    expect(isLikelyTestOrMockServer(b)).toBe(true);
    expect(isLikelyTestOrMockServer(c)).toBe(false);
  });
});
