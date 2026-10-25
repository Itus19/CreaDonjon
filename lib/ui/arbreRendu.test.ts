import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import FamilyTreeCanvas from "@/components/entities/genealogy/FamilyTreeCanvas";
import { DEFAULT_CALENDAR } from "@/src/core/calendar/defaultCalendar";
import type { FamilyTree } from "@/src/core/genealogy/buildFamilyTree";
import type { GameDate } from "@/src/core/calendar/types";
import messages from "@/messages/fr.json";

const date = (year: number): GameDate => ({ year, month: null, day: null, precision: "year", end: null, label: null });

const arbre: FamilyTree = {
  nodes: [
    { id: "a", name: "Sildar Hallwinter", slug: "sildar", entityKind: "character", hasPortrait: true, birth: date(1470), generation: 0, order: 0 },
    { id: "b", name: "Elmar", slug: "elmar", entityKind: "character", hasPortrait: false, birth: date(1440), death: date(1490), generation: 0, order: 1 },
    { id: "c", name: "Sans dates", slug: "sans", entityKind: "character", generation: 0, order: 2 },
  ],
  edges: [
    { id: "e1", kind: "partner", fromId: "a", toId: "b", label: "partenaire de", visibilityLevel: "public" },
    { id: "e2", kind: "partner", fromId: "b", toId: "c", label: "ancien partenaire de", visibilityLevel: "public", ex: true },
  ],
  minGeneration: 0,
  maxGeneration: 0,
};

function rendre(extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop
    createElement(NextIntlClientProvider, {
      locale: "fr",
      messages,
      children: createElement(FamilyTreeCanvas, { tree: arbre, hrefBase: "/p", calendrier: DEFAULT_CALENDAR, ...extra }),
    }),
  );
}

describe("Généalogie : rendu", () => {
  it("ne demande le portrait qu'aux fiches qui en ont un", () => {
    const html = rendre();
    expect(html).toContain("/api/entities/a/portrait");
    expect(html).not.toContain("/api/entities/b/portrait");
    expect(html).not.toContain("/api/entities/c/portrait");
  });
  it("écrit les dates quand il y en a, et rien sous une fiche sans dates", () => {
    const html = rendre();
    expect(html).toContain("1470");
    expect(html).toContain("1440");
    expect(html.match(/whitespace-nowrap text-xs text-ink-soft/g)?.length).toBe(2);
  });
  it("sans calendrier, aucune date n'est écrite", () => {
    const html = rendre({ calendrier: null });
    expect(html).not.toContain("1470");
    expect(html.match(/whitespace-nowrap text-xs text-ink-soft/g)).toBeNull();
  });
  it("trace l'ex-partenaire en pointillé orange (jeton --gm), pas le couple actuel", () => {
    const html = rendre();
    expect(html).toContain('stroke="var(--gm)"');
    expect(html.match(/stroke="var\(--gm\)"/g)).toHaveLength(1);
  });
  it("le défunt a le portrait désaturé et la carte grise", () => {
    const html = rendre();
    expect(html).toContain("opacity-80");
    expect(html).toContain("bg-panel-sunken");
  });
  it("sans onSelectNode, une carte est un lien ; avec, un bouton", () => {
    expect(rendre()).toContain('href="/p/sildar"');
    const html = rendre({ onSelectNode: () => {} });
    expect(html).not.toContain('href="/p/sildar"');
    expect(html).toContain('aria-pressed="false"');
  });
  it("ne montre la case « + enfant » que sous un couple sans enfant, dans l'éditeur", () => {
    expect(rendre()).not.toContain("+ enfant");
    expect(rendre({ onAddChild: () => {} })).toContain("+ enfant");
  });
});
