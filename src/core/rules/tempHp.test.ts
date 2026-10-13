import { describe, expect, it } from "vitest";
import { applyDamageToHp, grantTempHp } from "./tempHp";

describe("applyDamageToHp", () => {
  it("-7 PV sur 15/15 avec 5 temporaires laisse 13/15 et 0 temporaire", () => {
    const out = applyDamageToHp({ current: 15, max: 15, temp: 5 }, 7);
    expect(out.hp).toEqual({ current: 13, max: 15, temp: 0 });
    expect(out.excess).toBe(0);
  });

  it("des degats absorbes en entier par les temporaires ne touchent pas aux PV", () => {
    const out = applyDamageToHp({ current: 15, max: 15, temp: 5 }, 3);
    expect(out.hp).toEqual({ current: 15, max: 15, temp: 2 });
  });

  it("ne descend jamais sous zero et rend l'exces de degats", () => {
    // 3 PV, 11 de degats : 8 de trop.
    const out = applyDamageToHp({ current: 3, max: 12, temp: 0 }, 11);
    expect(out.hp.current).toBe(0);
    expect(out.excess).toBe(8);
  });

  it("l'exces se compte apres les temporaires", () => {
    // 2 temporaires + 3 PV absorbent 5 des 9 : 4 de trop.
    const out = applyDamageToHp({ current: 3, max: 12, temp: 2 }, 9);
    expect(out.hp).toEqual({ current: 0, max: 12, temp: 0 });
    expect(out.excess).toBe(4);
  });

  it("des degats nuls ou negatifs ne changent rien", () => {
    const hp = { current: 5, max: 12, temp: 2 };
    expect(applyDamageToHp(hp, 0).hp).toEqual(hp);
    expect(applyDamageToHp(hp, -4).hp).toEqual(hp);
  });
});

describe("grantTempHp", () => {
  it("ne se cumulent pas : par defaut on garde le plus grand", () => {
    expect(grantTempHp(5, 8)).toBe(8);
    expect(grantTempHp(8, 5)).toBe(8);
  });

  it("garder les anciens", () => {
    expect(grantTempHp(5, 8, "keep")).toBe(5);
  });

  it("prendre les nouveaux, meme plus petits", () => {
    expect(grantTempHp(8, 5, "replace")).toBe(5);
  });

  it("jamais negatif", () => {
    expect(grantTempHp(0, -3, "replace")).toBe(0);
  });
});
