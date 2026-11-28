import { describe, expect, it } from "vitest";
import { concealedMarks, markFacet, paragrapheNomme, readSegmentsWithMarks, segmentPlainText } from "./concealedMarks";

const seg = (id: string, text: string, extra: Record<string, unknown> = {}) => ({ id, content: [{ t: "text" as const, v: text }], level: "public", ...extra });
const tatouage = seg("s2", "Un serpent tatoué sur l'avant-bras gauche.", { concealed: { dc: 15 }, level: "gm" });
const page = [seg("s1", "Une aubergiste au tablier taché."), tatouage, seg("s3", "Elle doit de l'argent au Cercle.", { level: "gm" })];
const lisible = (s: { level: string }) => s.level === "public";

describe("V3.2-81 — les signes distinctifs dissimulés", () => {
  it("un paragraphe dissimulé n'apparaît pas tant qu'il n'est pas découvert ; ce que la visibilité cache reste caché", () => {
    expect(readSegmentsWithMarks(page, lisible, { owner: false, known: new Set() }).map((s) => s.id)).toEqual(["s1"]);
  });

  it("découvert, il apparaît, même écrit pour le MJ, et sans sa difficulté", () => {
    const lu = readSegmentsWithMarks(page, lisible, { owner: false, known: new Set([markFacet("s2")]) });
    expect(lu.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(lu[1]).not.toHaveProperty("concealed");
  });

  it("la personne qui joue lit toujours les signes de son propre personnage, avec leur difficulté", () => {
    const lu = readSegmentsWithMarks(page, lisible, { owner: true, known: new Set() });
    expect(lu.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(lu[1]).toHaveProperty("concealed", { dc: 15 });
  });

  it("un lecteur sans indices (partage public, aperçu) ne voit aucun paragraphe dissimulé", () => {
    expect(readSegmentsWithMarks(page, () => true, null).map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("les marques et leur texte, pour les jets et les faits", () => {
    expect(concealedMarks(page)).toEqual([{ id: "s2", dc: 15, text: "Un serpent tatoué sur l'avant-bras gauche." }]);
    expect(segmentPlainText(tatouage)).toBe("Un serpent tatoué sur l'avant-bras gauche.");
  });

  it("retrouve le paragraphe dont parle la phrase, par ses mots", () => {
    const signes = [{ id: "s2", text: "Un serpent tatoué sur l'avant-bras gauche." }, { id: "s4", text: "Une cicatrice qui barre la joue droite." }];
    expect(paragrapheNomme("je mets un bandage sur mon tatouage de serpent", signes)).toBe("s2");
    expect(paragrapheNomme("je cache ma cicatrice sous ma capuche", signes)).toBe("s4");
    expect(paragrapheNomme("je cache ma dague", signes)).toBeNull();
  });
});
