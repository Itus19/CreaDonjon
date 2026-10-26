import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import RandomTableBlockEditor from "@/components/blocks/RandomTableBlockEditor";
import { CarreDe } from "@/components/shared/DeAnime";
import type { RandomTableBlockData } from "@/src/core/schemas/blocks/randomTable";
import messages from "@/messages/fr.json";

const donnee: RandomTableBlockData = {
  __v: 1,
  key: "rumeurs",
  die: "d20",
  unique_draws: true,
  attribution: "Par Orkish Blade",
  entries: [
    { range: { min: 1, max: 3 }, weight: 3, text: "Un enfant a disparu.", price: { amount: 4, coin: "cp" } },
    { range: { min: 4, max: 4 }, weight: 1, text: "Le moulin brûle.", tier: "rare" },
  ],
};

function avec(element: React.ReactElement): string {
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "fr", messages, children: element }));
}

describe("Table aléatoire : rendu", () => {
  const onChange = vi.fn();
  const html = avec(createElement(RandomTableBlockEditor, { data: donnee, onChange, blockId: "b" }));

  it("se lit comme sur le papier : plages, textes, prix et palier en pastilles", () => {
    expect(html).toContain("1–3");
    expect(html).toContain("Un enfant a disparu.");
    expect(html).toContain("Le moulin brûle.");
    expect(html).toContain("rare");
  });
  it("« Tirer · d20 », « Sans répétition », « Remettre à zéro », l'attribution en italique", () => {
    expect(html).toContain("Tirer · d20");
    expect(html).toContain("Sans répétition");
    expect(html).toContain("Remettre à zéro");
    expect(html).toContain("Par Orkish Blade");
    expect(html).toContain("italic");
  });
  it("n'écrit rien au montage, et n'a ni résultat ni édition ouverts", () => {
    expect(onChange).not.toHaveBeenCalled();
    expect(html).not.toContain("Résultat du tirage");
    expect(html).not.toContain("Terminer les modifications");
  });
  it("« Tirer » n'est jamais désactivé", () => {
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>\s*<span aria-hidden="true">⬡/);
  });
});

describe("le dé partagé", () => {
  it("vide et flou tant qu'il défile, ambre au maximum, rouge sur un 1", () => {
    expect(avec(createElement(CarreDe, { faces: 20, valeur: undefined, bruit: 7, petit: false }))).toContain("blur-[2px]");
    expect(avec(createElement(CarreDe, { faces: 20, valeur: 20, bruit: undefined, petit: false }))).toContain("border-accent");
    expect(avec(createElement(CarreDe, { faces: 20, valeur: 1, bruit: undefined, petit: false }))).toContain("border-danger");
    expect(avec(createElement(CarreDe, { faces: 20, valeur: 11, bruit: undefined, petit: false }))).toContain("border-edge-strong");
  });
});
