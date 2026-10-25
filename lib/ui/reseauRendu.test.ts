import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import RelationsGraphCanvas from "@/components/entities/psyche/RelationsGraphCanvas";
import type { RelationsGraph } from "@/src/core/relationsGraph/buildRelationsGraph";
import messages from "@/messages/fr.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const graph: RelationsGraph = {
  nodes: [
    { id: "c", name: "Sildar Hallwinter", slug: "sildar", entityKind: "character", hasPortrait: true, degree: 0 },
    { id: "l1", name: "Phandalin", slug: "phandalin", entityKind: "location", hasPortrait: false, degree: 1 },
    { id: "l2", name: "Néverwinter", slug: "neverwinter", entityKind: "location", hasPortrait: false, degree: 1 },
    { id: "f", name: "Alliance des Lords", slug: "alliance", entityKind: "faction", hasPortrait: false, degree: 1 },
  ],
  edges: [
    { id: "e1", fromId: "c", toId: "l1", relationType: "originaire_de", label: "originaire de", visibilityLevel: "public" },
    { id: "e2", fromId: "c", toId: "f", relationType: "member_of", label: "membre de", visibilityLevel: "public" },
  ],
};

function rendre(): string {
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop
    createElement(NextIntlClientProvider, {
      locale: "fr",
      messages,
      children: createElement(RelationsGraphCanvas, { graph, hrefBase: "/m/w/f", edgeColor: () => "var(--edge)" }),
    }),
  );
}

describe("Réseau : rendu", () => {
  it("montre un filtre par genre avec son nombre, sans compter la fiche du centre", () => {
    const html = rendre();
    expect(html).toContain("Lieux · 2");
    expect(html).toContain("Factions · 1");
    expect(html).not.toContain("Personnes ·");
  });
  it("écrit les noms sous les vignettes, avec 'Trouver…' et sans 'Tout montrer' tant que rien n'est filtré", () => {
    const html = rendre();
    expect(html).toContain("Alliance des Lords");
    expect(html).toContain("Trouver…");
    expect(html).not.toContain("Tout montrer");
  });
  it("une vignette est un bouton qui choisit, la carte n'existe pas avant le choix", () => {
    const html = rendre();
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("Ouvrir la fiche");
  });
});
