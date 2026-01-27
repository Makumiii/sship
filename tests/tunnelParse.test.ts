import { describe, expect, test } from "bun:test";
import { parseListeningPorts } from "../src/commands/tunnel.ts";

describe("parseListeningPorts", () => {
    test("parses ss output with process names", () => {
        const output =
            "LISTEN 0 128 127.0.0.1:5432 0.0.0.0:* users:((\"postgres\",pid=123,fd=5))\n";
        const ports = parseListeningPorts(output);
        expect(ports).toHaveLength(1);
        expect(ports[0]).toEqual({ host: "127.0.0.1", port: 5432, process: "postgres" });
    });

    test("parses netstat output", () => {
        const output =
            "tcp 0 0 0.0.0.0:22 0.0.0.0:* LISTEN 123/sshd\n";
        const ports = parseListeningPorts(output);
        expect(ports).toHaveLength(1);
        expect(ports[0]).toEqual({ host: "0.0.0.0", port: 22, process: "sshd" });
    });

    test("parses lsof output", () => {
        const output =
            "node 987 user 20u IPv4 0x123 TCP 127.0.0.1:3000 (LISTEN)\n";
        const ports = parseListeningPorts(output);
        expect(ports).toHaveLength(1);
        expect(ports[0]).toEqual({ host: "127.0.0.1", port: 3000, process: "node" });
    });
});
