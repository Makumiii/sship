import { describe, expect, test } from "bun:test";
import { getKeys } from "../src/utils/getKeys";

describe("Key Discovery", () => {
    test("getKeys filters valid key files", () => {
        const files = [
            "id_rsa",           // Private key (standard) - excluded by this logic as it checks extensions?
            "id_rsa.pub",       // Public key
            "key.pem",          // PEM format
            "my_key.pkcs8",     // PKCS8 format
            "config",           // Random file
            ".DS_Store"         // Hidden file
        ];

        // Based on implementation of getKeys:
        // return (file.endsWith(".pub") || file.endsWith(".pem") || file.endsWith(".pkcs8"));

        const keys = getKeys(files);
        expect(keys).toContain("id_rsa"); // derived from id_rsa.pub
        expect(keys).toContain("key");    // derived from key.pem
        expect(keys).toContain("my_key"); // derived from my_key.pkcs8
        expect(keys).not.toContain("config");
    });

    test("getKeys handles empty list", () => {
        expect(getKeys([])).toEqual([]);
    });
});
