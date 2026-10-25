import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import PublicRelationshipBlock from "@/components/entities/public/PublicRelationshipBlock";
import VueRelation, { type FaceRelation } from "@/components/entities/psyche/VueRelation";
import type { AttitudeEventRow } from "@/src/server/repos/psyche";
import messages from "@/messages/fr.json";

function avec(element: React.ReactElement): string {
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "fr", messages, children: element }));
}
function enTexte(html: string): string {
  return html.replace(/<title>[^<]*<\/title>/g, "").replace(/<[^>]*>/g, " ").replace(/&#?\w+;/g, " ");
}

const face = (kind: string): FaceRelation => ({
  source: { id: "s", name: "Sildar Hallwinter", slug: "sildar", entityKind: "character", hasPortrait: false },
  target: { id: "t", name: "Alliance des Lords", slug: "alliance", entityKind: kind, hasPortrait: false },
  campaignId: "c",
  axes: { trust_distrust: 50, friendship_hostility: -50, attraction_repulsion: 90 },
  souvenirs: { count: 5, last: { occurredAtIngame: null, createdAt: "2026-10-07T12:00:00Z" } },
  block: { id: "b", knownAs: "" },
  canEditSource: true,
});

describe("rendu public de la Relation : aucun nombre", () => {
  it("dit vers où pousse le souvenir, sans chiffre", () => {
    const events = [
      { id: "e1", summary: "A payé sa rançon", deltas: { trust_distrust: 35, fear_assurance: -10 }, occurred_at_ingame: null, created_at: "2026-01-01T00:00:00Z", is_public: true },
    ] as unknown as AttitudeEventRow[];
    const texte = enTexte(
      avec(createElement(PublicRelationshipBlock, { axes: { trust_distrust: 40 }, target: { name: "Gundren", slug: "gundren" }, hrefBase: "/p", events, calendar: null })),
    );
    expect(texte).toContain("vers Confiance");
    expect(texte).toContain("vers Assurance");
    expect(texte).not.toMatch(/\d/);
  });
});

describe("face-à-face de l'éditeur", () => {
  it("une cible faction ne montre pas l'Attirance, ni dans les fils ni dans le résumé", () => {
    const html = avec(createElement(VueRelation, { face: face("faction"), worldSlug: "w", isGm: true, onEcrit: () => {} }));
    expect(html).not.toContain("Attirance");
    expect(enTexte(html)).not.toMatch(/(^|\s)épris(\s|$)/);
  });
  it("une cible personne la montre, avec « MJ » en petit", () => {
    const html = avec(createElement(VueRelation, { face: face("character"), worldSlug: "w", isGm: true, onEcrit: () => {} }));
    expect(html).toContain("Attirance");
    expect(html).toContain(">MJ<");
  });
  it("le nombre de souvenirs vient du serveur ; le résumé nomme les axes marquants", () => {
    const texte = enTexte(avec(createElement(VueRelation, { face: face("character"), worldSlug: "w", isGm: false, onEcrit: () => {} })));
    expect(texte).toContain("5 souvenirs au journal");
    expect(texte).toContain("confiant");
  });
  it("n'affiche aucun nombre dans les fils", () => {
    const texte = enTexte(avec(createElement(VueRelation, { face: { ...face("character"), souvenirs: { count: 0, last: null } }, worldSlug: "w", isGm: false, onEcrit: () => {} })));
    expect(texte).not.toMatch(/\d/);
  });
});
