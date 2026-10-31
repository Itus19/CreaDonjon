import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("@/src/server/repos/engineChanges", () => ({ applyEngineChange: vi.fn() }));

const { engineSigningKeyFromEnv, signEngineChange } = await import("./engineSigning");

const CLE = { id: "k1", secret: Buffer.alloc(32, 7) };
const PARAMS = {
  campaignId: "39335772-0a92-4ce8-befd-4a0e7eb42bb0",
  changes: [{ kind: "participant" as const, id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", hp: 3 }],
  now: new Date("2026-10-31T12:00:00.000Z"),
  nonce: "3b241101-e2bb-4255-8caf-4136c566a962",
};

describe("la signature des changements du moteur (V3.1-104)", () => {
  it("signe le texte canonique exact en HMAC-SHA256", () => {
    const { payload, signature } = signEngineChange(PARAMS, CLE);
    expect(payload).toBe(
      '{"campaign_id":"39335772-0a92-4ce8-befd-4a0e7eb42bb0","changes":[{"hp":3,"id":"7c9e6679-7425-40de-944b-e07fc1f90ae7","kind":"participant"}],"issued_at":"2026-10-31T12:00:00.000Z","key_id":"k1","nonce":"3b241101-e2bb-4255-8caf-4136c566a962"}'
    );
    expect(signature).toBe(createHmac("sha256", CLE.secret).update(payload, "utf8").digest("hex"));
  });

  it("refuse de signer un changement hors liste", () => {
    expect(() => signEngineChange({ ...PARAMS, changes: [{ ...PARAMS.changes[0], ac: 30 } as never] }, CLE)).toThrow();
  });

  it("une clé absente ou mal formée : erreur explicite, jamais un repli", () => {
    expect(() => engineSigningKeyFromEnv({} as NodeJS.ProcessEnv)).toThrow(/ENGINE_SIGNING_KEY/);
    expect(() => engineSigningKeyFromEnv({ ENGINE_SIGNING_KEY: "abc", ENGINE_SIGNING_KEY_ID: "k" } as unknown as NodeJS.ProcessEnv)).toThrow(/hexadécimale/);
    expect(engineSigningKeyFromEnv({ ENGINE_SIGNING_KEY: "ab".repeat(32), ENGINE_SIGNING_KEY_ID: "k" } as unknown as NodeJS.ProcessEnv).secret).toHaveLength(32);
  });
});
