import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import QuestBlockEditor from "@/components/blocks/QuestBlockEditor";
import PublicQuestBlock from "@/components/entities/public/PublicQuestBlock";
import type { QuestBlockData } from "@/src/core/schemas/blocks/quest";
import messages from "@/messages/fr.json";

const data: QuestBlockData = {
  __v: 1,
  state: "in_progress",
  giver: { kind: "entity", id: "g" },
  objectives: [
    { id: "1", text: "Trouver la clé", done: true },
    { id: "2", text: "Ouvrir la porte", done: true },
    { id: "3", text: "Vaincre le gardien", done: false },
    { id: "4", text: "Fuir", done: false },
  ],
  rewards: [{ id: "r", text: "100 po" }],
  prerequisites: [],
};

function avec(element: React.ReactElement): string {
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "fr", messages, children: element }));
}
const enTexte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ");

describe("Quête repliée", () => {
  const onChange = vi.fn();
  const html = avec(
    createElement(QuestBlockEditor, {
      blockId: "b",
      version: 1,
      data,
      otherEntities: [{ id: "g", name: "Gundren", slug: "gundren", entity_kind: "character" }],
      worldSlug: "w",
      onChange,
      onBlockRefreshed: vi.fn(),
    }),
  );
  const texte = enTexte(html);

  it("une ligne : l'anneau 2 / 4, l'état, le commanditaire en lien, le prochain objectif", () => {
    expect(texte).toContain("2 / 4");
    expect(texte).toContain("En cours");
    expect(texte).toContain("confiée par");
    expect(html).toContain('href="/m/w/f/gundren"');
    expect(texte).toContain("Prochain : Vaincre le gardien");
  });
  it("replié : ni objectifs à cocher, ni pilule d'état, ni récompenses", () => {
    expect(html).toContain('aria-expanded="false"');
    expect(texte).not.toContain("Récompenses");
    expect(texte).not.toContain("Non commencée");
    expect(html).not.toContain('type="checkbox"');
  });
  it("n'écrit rien au montage", () => {
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Quête publique", () => {
  it("la même ligne repliable, sans case ni champ, avec le lien du commanditaire", () => {
    const html = avec(createElement(PublicQuestBlock, { data, questRefs: { g: { name: "Gundren", slug: "gundren" } }, hrefBase: "/p" }));
    const texte = enTexte(html);
    expect(texte).toContain("2 / 4");
    expect(html).toContain('href="/p/gundren"');
    expect(html).not.toContain("<input");
    expect(texte).not.toContain("Récompenses");
  });
  it("tous les objectifs atteints", () => {
    const fini = { ...data, objectives: data.objectives.map((o) => ({ ...o, done: true })) };
    const texte = enTexte(avec(createElement(PublicQuestBlock, { data: fini, questRefs: undefined, hrefBase: "/p" })));
    expect(texte).toContain("4 / 4");
    expect(texte).toContain("Tous les objectifs sont atteints");
  });
});
