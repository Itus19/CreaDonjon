import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import PublicPersonalityBlock from "@/components/entities/public/PublicPersonalityBlock";
import PublicWorldviewBlock from "@/components/entities/public/PublicWorldviewBlock";
import PoleBars from "@/components/entities/psyche/PoleBars";
import { PERSONALITY_POLE_KEYS } from "@/src/core/psyche/keys";
import { PERSONALITY_POLES_FR, PERSONALITY_POLE_DESCRIPTIONS_FR } from "@/src/i18n/fr";
import type { PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import type { WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import type { PersonalityEventRow } from "@/src/server/repos/psyche";
import messages from "@/messages/fr.json";

/**
 * V3.1-70 — « aucun nombre à l'écran pour un joueur ». On rend le wiki public
 * et les barres du joueur côté serveur, et on cherche un chiffre dans le TEXTE
 * (les coordonnées du dessin ne sont pas du texte).
 */
function enTexte(html: string): string {
  return html.replace(/<title>[^<]*<\/title>/g, "").replace(/<[^>]*>/g, " ").replace(/&#?\w+;/g, " ");
}

function avec(element: React.ReactElement): string {
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "fr", messages, children: element }));
}

const evenement = (id: string, deltas: Record<string, number>): PersonalityEventRow =>
  ({
    id,
    summary: "A vu une personne mourir",
    deltas,
    occurred_at_ingame: null,
    created_at: "2026-01-01T00:00:00Z",
    is_public: true,
  }) as unknown as PersonalityEventRow;

describe("rendu public : aucun nombre", () => {
  it("Personnalité : le radar nomme les bandes, le souvenir dit vers où il pousse", () => {
    const data = {
      __v: 1,
      poles: [
        { key: "curiosity_caution", value: 55 },
        { key: "empathy_hardness", value: -20 },
      ],
      priority: [],
      aspirations: [],
      lines: [],
      limits: [],
      baseline: { trust: 0, affinity: 0, respect: 0, fear: 0 },
      speech: { register: "", tics: [] },
    } as PersonalityBlockData;
    const texte = enTexte(avec(createElement(PublicPersonalityBlock, { data, events: [evenement("e1", { curiosity_caution: 20, empathy_hardness: -35 })], calendar: null })));
    expect(texte).toContain("Curiosité forte");
    expect(texte).toContain("Dureté légère");
    expect(texte).toContain("vers Curiosité");
    expect(texte).toContain("vers Dureté");
    expect(texte).not.toMatch(/\d/);
  });

  it("Convictions : pareil", () => {
    const data = {
      __v: 1,
      poles: [{ key: "wealth_honor", value: 80 }],
      priority: [],
    } as WorldviewBlockData;
    const texte = enTexte(avec(createElement(PublicWorldviewBlock, { data, events: [evenement("e1", { wealth_honor: 15 })], calendar: null })));
    expect(texte).toContain("Honneur extrême");
    expect(texte).toContain("vers Honneur");
    expect(texte).not.toMatch(/\d/);
  });
});

describe("barres de l'éditeur", () => {
  const rendre = (valeurExacte: boolean) =>
    avec(
      createElement(PoleBars<(typeof PERSONALITY_POLE_KEYS)[number]>, {
        keys: PERSONALITY_POLE_KEYS,
        table: PERSONALITY_POLES_FR,
        descriptions: PERSONALITY_POLE_DESCRIPTIONS_FR,
        poles: [{ key: "altruism_selfishness", value: 47 }],
        onCommit: vi.fn(),
        valeurExacte,
      }),
    );

  it("aucun nombre écrit, et la valeur exacte au survol pour le MJ seulement", () => {
    const joueur = rendre(false);
    const mj = rendre(true);
    expect(enTexte(joueur)).not.toMatch(/\d/);
    expect(enTexte(mj)).not.toMatch(/\d/);
    expect(joueur).not.toContain("Valeur exacte");
    expect(mj).toContain("Valeur exacte : 47");
  });

  it("n'écrit rien au montage", () => {
    const onCommit = vi.fn();
    avec(
      createElement(PoleBars<(typeof PERSONALITY_POLE_KEYS)[number]>, {
        keys: PERSONALITY_POLE_KEYS,
        table: PERSONALITY_POLES_FR,
        descriptions: PERSONALITY_POLE_DESCRIPTIONS_FR,
        poles: [],
        onCommit,
        valeurExacte: true,
      }),
    );
    expect(onCommit).not.toHaveBeenCalled();
  });
});
