import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

/**
 * V3.1-84 — le contrôle du logo téléversé, sans base : les repos, le
 * stockage et le rôle sont simulés. Ce qu'on vérifie : un fichier refusé
 * n'écrit RIEN, ni en stockage ni en base.
 */
const isSuperadmin = vi.hoisted(() => vi.fn());
const putBrandLogo = vi.hoisted(() => vi.fn());
const removeBrandLogo = vi.hoisted(() => vi.fn());
const upsertAppIdentityRow = vi.hoisted(() => vi.fn());
vi.mock("@/src/server/services/account", () => ({ isSuperadmin }));
vi.mock("@/src/server/services/storage", () => ({ putBrandLogo, removeBrandLogo }));
vi.mock("@/src/server/repos/appIdentity", () => ({
  getAppIdentityRow: async () => null,
  upsertAppIdentityRow,
  deleteAppIdentityRow: async () => undefined,
}));

const { updateAppIdentity } = await import("./appIdentityWrite");
const { default: sharp } = await import("sharp");

const supabase = {} as SupabaseClient<Database>;
const input = { name: "Antre Nous", tagline: "", logoKey: "d20" as const };
const SVG_RENOMME = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 4, background: "#c8a050" } }).png().toBuffer();

beforeEach(() => {
  vi.clearAllMocks();
  isSuperadmin.mockResolvedValue(true);
  upsertAppIdentityRow.mockImplementation(async (_s: unknown, row: Record<string, unknown>) => ({ ...row, updated_at: "2026-10-13T00:00:00Z" }));
});

describe("updateAppIdentity : le logo téléversé", () => {
  it("un SVG renommé en .png est refusé, sans rien écrire", async () => {
    const out = await updateAppIdentity(supabase, { userId: "u", input, logo: { kind: "upload", bytes: SVG_RENOMME } });
    expect(out).toEqual({ ok: false, reason: "unsupported_type" });
    expect(putBrandLogo).not.toHaveBeenCalled();
    expect(upsertAppIdentityRow).not.toHaveBeenCalled();
  });

  it("un PNG non carré est refusé", async () => {
    const out = await updateAppIdentity(supabase, { userId: "u", input, logo: { kind: "upload", bytes: await png(600, 512) } });
    expect(out).toEqual({ ok: false, reason: "not_square" });
  });

  it("un PNG carré trop petit est refusé", async () => {
    const out = await updateAppIdentity(supabase, { userId: "u", input, logo: { kind: "upload", bytes: await png(256, 256) } });
    expect(out).toEqual({ ok: false, reason: "too_small" });
  });

  it("un PNG carré de 1024 px est réencodé en WebP 512 px, puis enregistré", async () => {
    const out = await updateAppIdentity(supabase, { userId: "u", input, logo: { kind: "upload", bytes: await png(1024, 1024) } });
    expect(out.ok).toBe(true);
    const [, path, webp] = putBrandLogo.mock.calls[0] as [unknown, string, Buffer];
    expect(path).toMatch(/^logo\/[0-9a-f-]+\.webp$/);
    const meta = await sharp(webp).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 512, 512]);
    expect(upsertAppIdentityRow.mock.calls[0][1]).toMatchObject({ logo_storage_path: path, name: "Antre Nous" });
  });

  it("un compte qui n'est pas superadmin est refusé, sans rien écrire", async () => {
    isSuperadmin.mockResolvedValue(false);
    const out = await updateAppIdentity(supabase, { userId: "u", input, logo: { kind: "keep" } });
    expect(out).toEqual({ ok: false, reason: "forbidden" });
    expect(upsertAppIdentityRow).not.toHaveBeenCalled();
  });
});
