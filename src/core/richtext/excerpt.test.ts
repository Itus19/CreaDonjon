import { describe, expect, it } from "vitest";
import { excerptFromSegments } from "./excerpt";
import { filterSegments } from "@/src/core/visibility";
import type { Segment } from "@/src/core/schemas/entities/segments";

/** Segment minimal : les tests ne parlent que de `blockType` et `content`. */
function seg(blockType: Segment["blockType"], content: Segment["content"]): Segment {
  return { id: `s-${blockType}-${content.length}`, blockType, visibility: { level: "public", scopeId: null }, content, align: "left" };
}

function text(v: string): Segment["content"][number] {
  return { t: "text", v };
}

describe("excerptFromSegments", () => {
  it("rend le premier paragraphe, pas le titre qui le precede", () => {
    const segments = [seg("h2", [text("Les Braises de l'amitie")]), seg("paragraph", [text("On raconte que Faerun est un monde.")])];
    expect(excerptFromSegments(segments)).toBe("On raconte que Faerun est un monde.");
  });

  it("ignore les titres seuls et rend null quand aucun paragraphe n'existe", () => {
    expect(excerptFromSegments([seg("h1", [text("Un titre")]), seg("h3", [text("Un autre")])])).toBeNull();
  });

  it("ignore un divider, qui n'a pas de contenu", () => {
    const segments = [seg("divider", []), seg("paragraph", [text("Apres le trait.")])];
    expect(excerptFromSegments(segments)).toBe("Apres le trait.");
  });

  it("aplatit les marques et les liens en texte : un apercu n'est jamais interactif", () => {
    // Un noeud `ref` porte son libelle dans `label`, jamais dans `v` — sans
    // ce cas, l'extrait d'un paragraphe qui commence par un lien perdrait
    // son premier mot.
    const segments = [
      seg("paragraph", [
        text("Les quatre aventurieres rencontrent "),
        { t: "ref", kind: "entity", id: "e1", label: "Brennan" },
        text(", un ancien forgeron "),
        { t: "ref", kind: "rule", key: "dwarf", label: "nain" },
        text("."),
      ]),
    ];
    expect(excerptFromSegments(segments)).toBe("Les quatre aventurieres rencontrent Brennan, un ancien forgeron nain.");
  });

  it("normalise les espaces : la prose est stockee avec ses retours a la ligne", () => {
    expect(excerptFromSegments([seg("paragraph", [text("  Deux   mots\n\nsepares.  ")])])).toBe("Deux mots separes.");
  });

  it("saute un paragraphe vide de sens plutot que de rendre une chaine vide", () => {
    const segments = [seg("paragraph", [text("   ")]), seg("paragraph", [text("Le vrai premier paragraphe.")])];
    expect(excerptFromSegments(segments)).toBe("Le vrai premier paragraphe.");
  });

  it("tronque sur une frontiere de mot et pose une ellipse", () => {
    const long = "mot ".repeat(100).trim();
    const result = excerptFromSegments([seg("paragraph", [text(long)])]);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(241);
    expect(result!.endsWith("…")).toBe(true);
    expect(result!).not.toContain("mo…");
  });

  it("ne tronque pas un texte deja assez court, et n'y ajoute aucune ellipse", () => {
    const result = excerptFromSegments([seg("paragraph", [text("Court.")])]);
    expect(result).toBe("Court.");
  });

  it("coupe net un mot unique plus long que la limite, faute de frontiere", () => {
    const result = excerptFromSegments([seg("paragraph", [text("a".repeat(400))])]);
    expect(result!.endsWith("…")).toBe(true);
    expect(result!.length).toBeLessThanOrEqual(241);
  });

  it("rend null sur une liste vide", () => {
    expect(excerptFromSegments([])).toBeNull();
  });

  it("rend null quand un paragraphe ne contient qu'une ponctuation d'espacement", () => {
    expect(excerptFromSegments([seg("paragraph", [text("\n\t  ")])])).toBeNull();
  });
});

/**
 * V2.1-18 lot 2 — la preuve NEGATIVE du critere de visibilite.
 *
 * `excerptFromSegments` ne filtre rien et ne doit rien filtrer : c'est
 * `filterSegments` qui le fait, en amont, exactement comme pour le corps de
 * la fiche (`refPreview.ts`). Ce qu'on verifie ici est leur COMPOSITION —
 * qu'un extrait ne puisse pas naitre d'un segment que le lecteur ne voit
 * pas. Les deux moities sont pures, donc la garantie se teste pour de vrai
 * plutot que de se constater a l'ecran.
 */
describe("extrait et visibilite, composes", () => {
  function aware(level: "public" | "gm" | "players", content: string) {
    return {
      id: `s-${level}`,
      blockType: "paragraph" as const,
      visibility: { level, scopeId: null, createdBy: null },
      content: [text(content)],
      align: "left" as const,
    };
  }

  function excerptFor(viewer: Parameters<typeof filterSegments>[1], segments: ReturnType<typeof aware>[]) {
    return excerptFromSegments(filterSegments(segments, viewer) as unknown as Segment[]);
  }

  const secret = aware("gm", "Le baron finance en secret la guilde des voleurs.");
  const publie = aware("public", "Le baron tient la ville depuis vingt ans.");

  it("un visiteur anonyme n'obtient jamais le paragraphe MJ, meme place en premier", () => {
    const resultat = excerptFor({ kind: "anonymous" }, [secret, publie]);
    expect(resultat).toBe("Le baron tient la ville depuis vingt ans.");
    expect(resultat).not.toContain("guilde des voleurs");
  });

  it("une fiche dont TOUS les paragraphes sont masques ne rend aucun extrait, jamais un extrait vide", () => {
    expect(excerptFor({ kind: "anonymous" }, [secret])).toBeNull();
  });

  it("le MJ, lui, obtient bien le premier paragraphe — le filtre depend du lecteur, pas de l'extrait", () => {
    const mj = { kind: "user" as const, userId: "u-mj", worldRole: "owner" as const, campaignRoles: {} };
    expect(excerptFor(mj, [secret, publie])).toBe("Le baron finance en secret la guilde des voleurs.");
  });
});
