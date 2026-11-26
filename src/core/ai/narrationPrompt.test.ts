import { describe, expect, it } from "vitest";
import { soloSystemPrompt } from "./narrationPrompt";
import { DEFAULT_RECIT, REGISTRE_PAR_DEFAUT } from "../campaigns/recit";

describe("soloSystemPrompt — la consigne du MJ, réglée par la partie", () => {
  it("par défaut : le « tu », le registre de l'auteur, scènes intimes hors champ", () => {
    const prompt = soloSystemPrompt(DEFAULT_RECIT, "narrate_turn");
    expect(prompt).toContain("deuxième personne du singulier");
    expect(prompt).toContain(REGISTRE_PAR_DEFAUT);
    expect(prompt).toContain("hors champ");
    expect(prompt).not.toContain("Le style voulu par la table");
    expect(prompt).toContain("narrate_turn");
  });

  it("la personne suit le réglage, les PNJ restent à la troisième", () => {
    expect(soloSystemPrompt({ ...DEFAULT_RECIT, personne: "vous" }, "t")).toContain("Vous poussez la porte");
    const il = soloSystemPrompt({ ...DEFAULT_RECIT, personne: "il" }, "t");
    expect(il).toContain("troisième personne, en nommant son personnage");
    expect(il).toContain("Les PNJ restent toujours à la troisième personne");
  });

  it("un registre vide retire la section, sans laisser de titre orphelin", () => {
    expect(soloSystemPrompt({ ...DEFAULT_RECIT, registre: "  " }, "t")).not.toContain("LE REGISTRE DE CETTE PARTIE");
  });

  it("scènes intimes allumées : le style de la table entre, la limite d'âge reste", () => {
    const prompt = soloSystemPrompt({ ...DEFAULT_RECIT, scenes_intimes: true, style_intime: "Précis et cru." }, "t");
    expect(prompt).toContain("permises dans cette partie");
    expect(prompt).toContain("Précis et cru.");
    expect(prompt).toContain("que des personnages adultes");
  });

  it("scènes intimes coupées : le style saisi n'est jamais envoyé", () => {
    const prompt = soloSystemPrompt({ ...DEFAULT_RECIT, scenes_intimes: false, style_intime: "Précis et cru." }, "t");
    expect(prompt).not.toContain("Précis et cru.");
    expect(prompt).toContain("que des personnages adultes");
  });

  it("le temps ne saute que sur décision du joueur, et l'IA ne prend jamais la main du personnage", () => {
    const prompt = soloSystemPrompt(DEFAULT_RECIT, "t");
    expect(prompt).toContain("Le temps ne saute que si le joueur l'a décidé");
    expect(prompt).toContain("tu ne fais pas dormir le personnage s'il ne l'a pas écrit");
    expect(prompt).toContain("Agentivité absolue");
  });
});
