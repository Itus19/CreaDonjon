import { describe, expect, it } from "vitest";
import type { Segment } from "../schemas/entities/segments";
import { retirerCiblesCachees } from "./refsCachees";

function segment(content: Segment["content"]): Segment {
  return { content } as Segment;
}

function aplatirRefsCachees(segments: Segment[], visibles: ReadonlySet<string>): Segment[] {
  return (retirerCiblesCachees("text", { segments }, visibles) as { segments: Segment[] }).segments;
}

describe("le lien d'un texte (AG-11)", () => {
  const visibles = new Set(["visible"]);

  it("garde le lien vers une fiche que le lecteur voit, et un renvoi de règle", () => {
    const s = [
      segment([
        { t: "ref", kind: "entity", id: "visible", label: "Neverwinter" },
        { t: "ref", kind: "rule", key: "fireball", label: "Boule de feu" },
      ]),
    ];
    expect(aplatirRefsCachees(s, visibles)).toEqual(s);
  });

  it("change le lien vers une fiche cachée en texte ordinaire, sans son identifiant", () => {
    const s = [segment([{ t: "text", v: "Le journal d'" }, { t: "ref", kind: "entity", id: "secret", label: "Aldren Voss" }])];
    const sortie = aplatirRefsCachees(s, visibles);
    expect(sortie[0].content).toEqual([{ t: "text", v: "Le journal d'" }, { t: "text", v: "Aldren Voss" }]);
    expect(JSON.stringify(sortie)).not.toContain("secret");
  });

  it("ne modifie pas les segments reçus", () => {
    const s = [segment([{ t: "ref", kind: "entity", id: "secret", label: "X" }])];
    aplatirRefsCachees(s, visibles);
    expect(s[0].content[0]).toEqual({ t: "ref", kind: "entity", id: "secret", label: "X" });
  });
});

describe("retirerCiblesCachees (AG-11)", () => {
  const visibles = new Set(["visible"]);
  const cachee = { kind: "entity", id: "secret" };
  const vue = { kind: "entity", id: "visible" };

  it("aplatit les mentions d'un texte et d'un Encadré", () => {
    const texte = retirerCiblesCachees("text", { __v: 1, segments: [{ content: [{ t: "ref", kind: "entity", id: "secret", label: "Voss" }] }] }, visibles);
    expect(JSON.stringify(texte)).not.toContain("secret");
    const encadre = retirerCiblesCachees("infobox", { __v: 1, entries: [{ label: "Maître", value: [{ t: "ref", kind: "entity", id: "secret", label: "Voss" }] }, { label: "Âge", value: "40" }] }, visibles);
    expect(encadre).toEqual({ __v: 1, entries: [{ label: "Maître", value: [{ t: "text", v: "Voss" }] }, { label: "Âge", value: "40" }] });
  });

  it("retire la référence d'une chronologie ou d'une quête vers une fiche cachée, garde les autres", () => {
    const frise = retirerCiblesCachees("timeline", { entries: [{ title: "a", ref: cachee }, { title: "b", ref: vue }] }, visibles);
    expect(frise).toEqual({ entries: [{ title: "a" }, { title: "b", ref: vue }] });
    const quete = retirerCiblesCachees("quest", { giver: cachee, objectives: [{ text: "x", ref: cachee }], rewards: [], prerequisites: [{ text: "y", ref: vue }] }, visibles) as Record<string, unknown>;
    expect(quete.giver).toBeNull();
    expect(JSON.stringify(quete)).not.toContain("secret");
    expect(JSON.stringify(quete)).toContain("visible");
  });

  it("rend tel quel un bloc d'un autre type", () => {
    const data = { ref: cachee };
    expect(retirerCiblesCachees("statblock", data, visibles)).toBe(data);
  });
});
