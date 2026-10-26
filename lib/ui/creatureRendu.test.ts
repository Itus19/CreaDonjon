import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import CreatureSheet, { type FicheCreatureProps } from "@/components/blocks/CreatureSheet";
import { lireCombat } from "@/lib/ui/creature";
import type { StatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import messages from "@/messages/fr.json";

function avec(element: React.ReactElement): string {
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "fr", messages, children: element }));
}

const noop = () => {};
const donnees: StatblockBlockData = {
  __v: 1,
  size: "Grande",
  creature_type: "Dragon",
  alignment: "loyal mauvais",
  ac: { value: 18, source: "armure naturelle" },
  hp: { value: 136, hit_dice: "16d10 + 48" },
  speed: "12 m, vol 24 m, nage 12 m",
  abilities: { str: 19, dex: 12, con: 17, int: 16, wis: 13, cha: 15 },
  saving_throws: { con: 6 },
  skills: { perception: 7 },
  senses: "vision dans le noir 36 m",
  languages: "commun, draconique",
  challenge_rating: "8",
  traits: [{ name: "Amphibie", text: "respire sous l'eau." }],
  actions: [
    { name: "Lacération", text: "+7 pour toucher. 2d6+4 tranchant plus 2d6 poison" },
    { name: "Souffle empoisonné (recharge 5–6)", text: "DD 14. 12d6 poison" },
  ],
  reactions: [],
  legendary_actions: [],
};

const props = (reste: Partial<FicheCreatureProps> = {}): FicheCreatureProps => ({
  worldSlug: "monde",
  entityId: "e1",
  nom: "Venomfang",
  data: donnees,
  combat: null,
  participantId: null,
  onChoisirInstance: noop,
  onDeltaPv: noop,
  onRetirerEtat: noop,
  onAjouterEtat: noop,
  etatsDisponibles: ["Aveuglé"],
  onJet: noop,
  erreur: null,
  ...reste,
});

const combat = lireCombat({
  combat: {
    campaignId: "c",
    combatId: "k",
    instances: [
      { participantId: "p1", label: "Venomfang 1", hpCurrent: 100, hpMax: 136, tempHp: 0, conditions: ["Aveuglé"] },
      { participantId: "p2", label: "Venomfang 2", hpCurrent: 136, hpMax: 136, tempHp: 0, conditions: [] },
    ],
  },
});

describe("rendu de la fiche de créature", () => {
  it("hors combat : valeurs plates, aucune commande de PV ni d'état", () => {
    const html = avec(createElement(CreatureSheet, props()));
    // Au-delà de cinq signes, le maximum passe sous la valeur dans l'anneau (« 136 » puis « /136 »).
    expect(html).toContain('<span>136</span><span class="text-ink-muted">/136</span>');
    expect(html).toContain("FP 8");
    expect(html).toContain("3 900 PX");
    expect(html).toContain("Aussi : vol 24 m · nage 12 m");
    // Aucune commande E : ni ▲ ▼ ni champ d'écart, ni « × » ni « + » des états.
    expect(html).not.toContain("Ajouter : Points de vie");
    expect(html).not.toContain("Écart : Points de vie");
    expect(html).not.toContain("Ajouter un état");
    expect(html).not.toContain("Retirer l");
    expect(html).toContain("Aucun état hors combat");
    // Le modificateur est calculé : FOR 19 donne +4.
    expect(html).toContain("+4");
    expect(html).toContain("Test de Force");
  });

  it("les quatre constantes sont des tuiles fluides, libellés sur une ligne", () => {
    const html = avec(createElement(CreatureSheet, props()));
    for (const libelle of ["Initiative", "Vitesse", "Maîtrise", "Taille"]) expect(html).toContain(libelle);
    expect(html).toContain("grid-cols-4");
    expect((html.match(/whitespace-nowrap font-semibold/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("« Ce qui se recharge » montre la règle, sans point ni bouton", () => {
    const html = avec(createElement(CreatureSheet, props()));
    expect(html).toContain("Ce qui se recharge");
    expect(html).toContain("recharge 5–6");
  });

  it("en combat : la commande E, les états et le sélecteur d'instance", () => {
    const html = avec(createElement(CreatureSheet, props({ combat, participantId: "p1" })));
    expect(html).toContain('<span>100</span><span class="text-ink-muted">/136</span>');
    expect(html).toContain("Ajouter : Points de vie");
    expect(html).toContain("Aveuglé");
    expect(html).toContain("Venomfang 1");
  });

  it("les attaques ont leurs pastilles de jet : bonus et dégâts réunis", () => {
    const html = avec(createElement(CreatureSheet, props()));
    expect(html).toContain("+7");
    expect(html).toContain("2d6+4 · 2d6");
    expect(html).toContain("DD 14");
    expect(html).toContain("12d6");
  });

  it("le repaire est un lien de fiche quand elle est connue, rien sinon", () => {
    const avecRepaire = { ...donnees, lair: { kind: "entity" as const, id: "l1" } };
    const lieux = [{ id: "l1", name: "Thundertree", slug: "thundertree", entity_kind: "location" }];
    const html = avec(createElement(CreatureSheet, props({ data: avecRepaire, otherEntities: lieux })));
    expect(html).toContain('href="/m/monde/f/thundertree"');
    expect(html).toContain("rich-ref-mention");
    expect(html).toContain("Thundertree");
    const inconnu = avec(createElement(CreatureSheet, props({ data: avecRepaire, otherEntities: [] })));
    expect(inconnu).not.toContain("Thundertree");
    expect(inconnu).not.toContain("rich-ref-mention");
  });

  it("Maîtrises : une ligne de défenses par catégorie présente, rien quand c'est vide", () => {
    const avecDef = { ...donnees, defenses: { damage_immunities: ["poison"], condition_immunities: ["empoisonné", "charmé"] } };
    const onglet = (data: StatblockBlockData) =>
      // Le panneau actif est « Actions » : on rend le HTML de l'onglet Maîtrises par son état initial forcé.
      avec(createElement(CreatureSheet, props({ data, ongletInitial: "maitrises" })));
    const html = onglet(avecDef);
    expect(html).toContain("Défenses");
    expect(html).toContain("Immunités");
    expect(html).toContain("poison");
    expect(html).toContain("empoisonné, charmé");
    expect(html).not.toContain("Résistances");
    expect(onglet(donnees)).not.toContain("Défenses");
  });
});
