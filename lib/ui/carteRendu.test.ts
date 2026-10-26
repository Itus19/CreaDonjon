import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import CarteListe from "@/components/entities/map/CarteListe";
import { rangerParCouches, type CoucheCarte, type ElementCarte } from "@/lib/ui/carte";
import messages from "@/messages/fr.json";

function avec(element: React.ReactElement): string {
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "fr", messages, children: element }));
}

const couches: CoucheCarte[] = [{ id: "l1", name: "Routes", displayOrder: 1, visibilityLevel: "players" }];
const elements: ElementCarte[] = [
  { id: "p1", genre: "pin", nom: "Auberge", layerId: "l1", visibilityLevel: "gm", centre: { x: 0.1, y: 0.1 } },
  { id: "r1", genre: "region", nom: "Forêt", layerId: "l1", visibilityLevel: "public", centre: { x: 0.5, y: 0.5 } },
];
const groupes = rangerParCouches(couches, elements);
const noop = () => {};

describe("rendu de la liste de la carte", () => {
  it("éditeur : couche et éléments avec leur pastille, et les trois « + »", () => {
    const html = avec(
      createElement(CarteListe, {
        groupes,
        allumeId: null,
        onChoisir: noop,
        ecrire: async () => true,
        actions: { onAjouterPunaise: noop, onAjouterZone: noop, onAjouterCouche: async () => true },
      }),
    );
    expect(html).toContain("Routes");
    expect(html).toContain("Auberge");
    expect(html).toContain("Forêt");
    // Trois pastilles : la couche et ses deux éléments.
    expect(html.match(/Toucher pour passer à/g)).toHaveLength(3);
    expect(html).toContain("+ Punaise");
    expect(html).toContain("+ Zone");
    expect(html).toContain("+ Couche");
    // Point orange pour la punaise du MJ, carré vert pour la zone.
    expect(html).toMatch(/bg-gm rounded-full/);
    expect(html).toMatch(/bg-success rounded-\[2px\]/);
  });

  it("référent : lecture seule, sans « + », avec la fiche source", () => {
    const html = avec(createElement(CarteListe, { groupes, allumeId: null, onChoisir: noop, titreSource: "Sildar" }));
    expect(html).toContain("Carte de Sildar");
    expect(html).not.toContain("+ Punaise");
    expect(html).not.toContain("Toucher pour passer à");
  });

  it("wiki public : liste plate, aucun niveau ni bouton d'écriture", () => {
    const html = avec(
      createElement(CarteListe, { groupes: rangerParCouches([], elements), allumeId: "p1", onChoisir: noop, afficherNiveaux: false }),
    );
    expect(html).toContain("Auberge");
    expect(html).not.toContain("Joueurs");
    expect(html).not.toContain("+ Couche");
    expect(html).toContain('aria-pressed="true"');
  });
});
