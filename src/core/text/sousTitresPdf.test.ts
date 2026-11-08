import { describe, expect, it } from "vitest";
import { fragmentDeSousTitre, retrouverSousTitre, paragraphesDeLaSource } from "./sousTitresPdf";

/**
 * V3.1-188 — la fin du sous-titre d'un objet magique (rareté, harmonisation)
 * a glissé au début de sa description : « (bronze) ou légendaire (fer) Souffler… ».
 */
describe("fragmentDeSousTitre", () => {
  it.each([
    ["(bronze) ou légendaire (fer) Souffler dans le cor.", "(bronze) ou légendaire (fer)", "Souffler dans le cor."],
    ["rare (+3) Tant que vous tenez ce bouclier.", "rare (+3)", "Tant que vous tenez ce bouclier."],
    ["très rare (+2) ou légendaire (+3) Vous recevez un bonus.", "très rare (+2) ou légendaire (+3)", "Vous recevez un bonus."],
    ["(+2) ou très rare (+3) Vous recevez", "(+2) ou très rare (+3)", "Vous recevez"],
    ["ou très rare (+3) Vous recevez", "ou très rare (+3)", "Vous recevez"],
    ["(Harmonisation requise avec un Paladin) Vous recevez", "(Harmonisation requise avec un Paladin)", "Vous recevez"],
    ["(+3) (harmonisation requise avec un incantateur) Tant que", "(+3) (harmonisation requise avec un incantateur)", "Tant que"],
    ["(harmonisation requise) La boule de cristal classique, objet très rare, mesure", "(harmonisation requise)", "La boule de cristal classique, objet très rare, mesure"],
  ])("« %s »", (texte, fragment, reste) => {
    expect(fragmentDeSousTitre(texte)).toEqual({ fragment, reste });
  });

  it("une description qui commence normalement n'a pas de fragment", () => {
    expect(fragmentDeSousTitre("Tant que vous portez cet anneau, vous…")).toBeNull();
    expect(fragmentDeSousTitre("rare et précieux, ce cor…")).toBeNull();
  });
});

describe("retrouverSousTitre", () => {
  const lignes = [
    "Cor du Valhalla",
    "Objet merveilleux, rare (argent ou airain), très ",
    "rare (bronze) ou légendaire (fer) ",
    "Souffler dans le cor s’effectue au prix de l’action Magie.",
  ];
  it("relit le sous-titre entier, de la catégorie jusqu'au fragment", () => {
    expect(retrouverSousTitre(lignes, "(bronze) ou légendaire (fer)", "Souffler dans le cor s’effectue")).toBe("Objet merveilleux, rare (argent ou airain), très rare (bronze) ou légendaire (fer)");
  });
  it("deux objets qui commencent par la même phrase : le titre départage", () => {
    const deux = ["Bâton de frappe", "Arme (bâton de combat), très rare ", "(Harmonisation requise)", "Vous recevez un bonus de +2.", "Voleuse de neuf vies", "Arme (toute épée), très rare ", "(Harmonisation requise)", "Vous recevez un bonus de +2."];
    expect(retrouverSousTitre(deux, "(Harmonisation requise)", "Vous recevez un bonus de +2.", "Voleuse de neuf vies")).toBe("Arme (toute épée), très rare (Harmonisation requise)");
    expect(retrouverSousTitre(deux, "(Harmonisation requise)", "Vous recevez un bonus de +2.", "Titre absent")).toBeNull();
  });

  it("un sous-titre sur trois lignes, avec des lignes vides intercalées (fin de ligne « \\r\\r\\n »)", () => {
    const l = ["Fer gelé", "", "Arme (cimeterre, coutille, ", "", "épée longue ou rapière), très rare ", "", "(Harmonisation requise)", "", "Lorsque votre jet d’attaque touche."];
    expect(retrouverSousTitre(l, "(Harmonisation requise)", "Lorsque votre jet d’attaque touche.", "Fer gelé")).toBe("Arme (cimeterre, coutille, épée longue ou rapière), très rare (Harmonisation requise)");
  });

  it("introuvable : null, rien n'est deviné", () => {
    expect(retrouverSousTitre(lignes, "(fer)", "Un texte qui n'existe pas")).toBeNull();
  });
});

describe("paragraphesDeLaSource", () => {
  it("recolle les lignes et ne coupe qu'après une phrase finie", () => {
    const l = ["Intrus", "Ce sort vous met en contact avec un dieu. Vous posez ", "une question.", "Si vous lancez le sort deux fois, vous ", "courez un risque.", "Doigt de mort"];
    expect(paragraphesDeLaSource(l, "Ce sort vous met en contact", "Doigt de mort")).toBe("Ce sort vous met en contact avec un dieu. Vous posez une question.\nSi vous lancez le sort deux fois, vous courez un risque.");
    expect(paragraphesDeLaSource(l, "Absent", "Doigt de mort")).toBeNull();
  });
});
