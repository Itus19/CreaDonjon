import { describe, expect, it } from "vitest";
import { APP_LOGO_KEYS, DEFAULT_APP_IDENTITY, detectRasterImageType, zAppIdentityInput } from "./identity";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe("identité de l'application (V3.1-84)", () => {
  it("douze logos au trait, le d20 par défaut", () => {
    expect(APP_LOGO_KEYS).toHaveLength(12);
    expect(DEFAULT_APP_IDENTITY).toEqual({ name: "Antre Nous", tagline: "Le repaire de ta table.", logoKey: "d20" });
  });

  it("le nom tient en 32 caractères, la phrase en 80", () => {
    expect(zAppIdentityInput.safeParse({ name: "a".repeat(32), tagline: "b".repeat(80), logoKey: "map" }).success).toBe(true);
    expect(zAppIdentityInput.safeParse({ name: "a".repeat(33), tagline: "b", logoKey: "map" }).success).toBe(false);
    expect(zAppIdentityInput.safeParse({ name: "a", tagline: "b".repeat(81), logoKey: "map" }).success).toBe(false);
  });

  it("un nom vide ou fait d'espaces est refusé ; les espaces autour sont retirés", () => {
    expect(zAppIdentityInput.safeParse({ name: "   ", tagline: "", logoKey: "d20" }).success).toBe(false);
    expect(zAppIdentityInput.parse({ name: "  Antre  ", tagline: " x ", logoKey: "d20" })).toEqual({ name: "Antre", tagline: "x", logoKey: "d20" });
  });

  it("une clé de logo hors des douze est refusée", () => {
    expect(zAppIdentityInput.safeParse({ name: "a", tagline: "", logoKey: "skull" }).success).toBe(false);
  });

  it("reconnaît un PNG et un WebP par leur signature", () => {
    expect(detectRasterImageType(PNG)).toBe("image/png");
    expect(detectRasterImageType(WEBP)).toBe("image/webp");
  });

  it("refuse un SVG, même renommé en .png : la signature fait foi, jamais l'extension", () => {
    expect(detectRasterImageType(SVG)).toBeNull();
  });

  it("refuse un fichier trop court ou vide", () => {
    expect(detectRasterImageType(Buffer.alloc(0))).toBeNull();
    expect(detectRasterImageType(PNG.subarray(0, 4))).toBeNull();
  });
});
