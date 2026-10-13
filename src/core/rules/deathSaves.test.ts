import { describe, expect, it } from "vitest";
import {
  applyDamageWithDeath,
  applyHealing,
  isDead,
  isStabilized,
  rollDeathSave,
  UNCONSCIOUS,
  type DeathState,
} from "./deathSaves";

function alive(current: number, max = 12, temp = 0): DeathState {
  return { hp: { current, max, temp }, conditions: [], deathSaves: { success: 0, fail: 0 } };
}
function down(saves: { success: number; fail: number } = { success: 0, fail: 0 }, max = 12): DeathState {
  return { hp: { current: 0, max, temp: 0 }, conditions: [UNCONSCIOUS], deathSaves: saves };
}

describe("degats qui laissent a 0 PV", () => {
  it("passent Inconscient, sans mort si les degats restants sont sous les PV max", () => {
    const out = applyDamageWithDeath(alive(5), 9);
    expect(out.hp.current).toBe(0);
    expect(out.conditions).toContain(UNCONSCIOUS);
    expect(isDead(out)).toBe(false);
  });

  it("ne pas dupliquer Inconscient s'il est deja la", () => {
    const out = applyDamageWithDeath({ ...alive(5), conditions: [UNCONSCIOUS] }, 9);
    expect(out.conditions.filter((c) => c === UNCONSCIOUS)).toHaveLength(1);
  });

  it("des degats qui laissent des PV ne changent aucun etat", () => {
    const out = applyDamageWithDeath(alive(10), 4);
    expect(out.hp.current).toBe(6);
    expect(out.conditions).toEqual([]);
  });
});

describe("mort directe", () => {
  it("degats restants egaux aux PV max : mort", () => {
    // 5 PV, 17 de degats : 12 de trop pour 12 PV max.
    const out = applyDamageWithDeath(alive(5, 12), 17);
    expect(isDead(out)).toBe(true);
    expect(out.deathSaves.fail).toBe(3);
  });

  it("degats restants sous les PV max : pas de mort directe", () => {
    expect(isDead(applyDamageWithDeath(alive(5, 12), 16))).toBe(false);
  });

  it("les PV temporaires absorbent avant de compter l'exces", () => {
    // 4 temporaires + 5 PV absorbent 9 des 20 : 11 de trop, sous 12.
    expect(isDead(applyDamageWithDeath(alive(5, 12, 4), 20))).toBe(false);
  });

  it("un coup a 0 PV d'au moins les PV max tue aussi", () => {
    expect(isDead(applyDamageWithDeath(down(), 12))).toBe(true);
  });
});

describe("degats a 0 PV", () => {
  it("coutent un echec", () => {
    const out = applyDamageWithDeath(down(), 3);
    expect(out.deathSaves).toEqual({ success: 0, fail: 1 });
  });

  it("coutent deux echecs sur un critique", () => {
    const out = applyDamageWithDeath(down(), 3, { critical: true });
    expect(out.deathSaves.fail).toBe(2);
  });

  it("le troisieme echec est la mort", () => {
    const out = applyDamageWithDeath(down({ success: 1, fail: 2 }), 3);
    expect(isDead(out)).toBe(true);
  });

  it("les echecs ne depassent jamais 3", () => {
    const out = applyDamageWithDeath(down({ success: 0, fail: 2 }), 3, { critical: true });
    expect(out.deathSaves.fail).toBe(3);
  });

  it("des degats entierement absorbes par des PV temporaires ne coutent rien", () => {
    const out = applyDamageWithDeath({ ...down(), hp: { current: 0, max: 12, temp: 5 } }, 3);
    expect(out.deathSaves.fail).toBe(0);
    expect(out.hp.temp).toBe(2);
  });
});

describe("jet contre la mort", () => {
  it("10 ou plus reussit", () => {
    expect(rollDeathSave(down(), 10).deathSaves).toEqual({ success: 1, fail: 0 });
    expect(rollDeathSave(down(), 19).deathSaves).toEqual({ success: 1, fail: 0 });
  });

  it("9 ou moins echoue", () => {
    expect(rollDeathSave(down(), 9).deathSaves).toEqual({ success: 0, fail: 1 });
    expect(rollDeathSave(down(), 2).deathSaves).toEqual({ success: 0, fail: 1 });
  });

  it("un 1 compte deux echecs", () => {
    expect(rollDeathSave(down(), 1).deathSaves.fail).toBe(2);
  });

  it("un 20 rend 1 PV, remet les jets a zero et retire Inconscient", () => {
    const out = rollDeathSave(down({ success: 1, fail: 2 }), 20);
    expect(out.hp.current).toBe(1);
    expect(out.deathSaves).toEqual({ success: 0, fail: 0 });
    expect(out.conditions).not.toContain(UNCONSCIOUS);
  });

  it("trois reussites : stabilise, toujours a 0 PV", () => {
    const out = rollDeathSave(down({ success: 2, fail: 1 }), 12);
    expect(isStabilized(out)).toBe(true);
    expect(isDead(out)).toBe(false);
    expect(out.hp.current).toBe(0);
  });

  it("trois echecs : mort", () => {
    const out = rollDeathSave(down({ success: 0, fail: 2 }), 5);
    expect(isDead(out)).toBe(true);
    expect(isStabilized(out)).toBe(false);
  });

  it("un 1 sur deux echecs plafonne a trois", () => {
    expect(rollDeathSave(down({ success: 0, fail: 2 }), 1).deathSaves.fail).toBe(3);
  });

  it("ne change rien pour qui n'est pas a 0 PV", () => {
    const state = alive(5);
    expect(rollDeathSave(state, 3)).toEqual(state);
  });

  it("ne change rien pour un mort ou un stabilise", () => {
    const dead = down({ success: 0, fail: 3 });
    const stable = down({ success: 3, fail: 0 });
    expect(rollDeathSave(dead, 15)).toEqual(dead);
    expect(rollDeathSave(stable, 3)).toEqual(stable);
  });
});

describe("soins", () => {
  it("remettent les jets a zero et retirent Inconscient", () => {
    const out = applyHealing(down({ success: 2, fail: 2 }), 4);
    expect(out.hp.current).toBe(4);
    expect(out.deathSaves).toEqual({ success: 0, fail: 0 });
    expect(out.conditions).not.toContain(UNCONSCIOUS);
  });

  it("gardent les autres conditions", () => {
    const state = { ...down(), conditions: [UNCONSCIOUS, "prone"] };
    expect(applyHealing(state, 1).conditions).toEqual(["prone"]);
  });

  it("ne depassent pas le maximum", () => {
    expect(applyHealing(alive(10), 99).hp.current).toBe(12);
  });

  it("un soin nul ne change rien", () => {
    const state = down({ success: 1, fail: 1 });
    expect(applyHealing(state, 0)).toEqual(state);
  });

  it("ne ramenent pas un mort : il faut une magie de resurrection, pas un soin", () => {
    const dead = down({ success: 0, fail: 3 });
    expect(applyHealing(dead, 10)).toEqual(dead);
  });

  it("n'enlevent pas un Inconscient qui ne vient pas d'un passage a 0 PV", () => {
    const sleeping = { ...alive(5), conditions: [UNCONSCIOUS] };
    expect(applyHealing(sleeping, 3).conditions).toContain(UNCONSCIOUS);
  });
});

describe("stabilise frappe", () => {
  it("reprend ses jets : reussites a zero, un echec", () => {
    const out = applyDamageWithDeath(down({ success: 3, fail: 0 }), 2);
    expect(out.deathSaves).toEqual({ success: 0, fail: 1 });
    expect(isStabilized(out)).toBe(false);
  });
});
