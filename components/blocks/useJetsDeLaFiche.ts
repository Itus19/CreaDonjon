"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useDiceRoll } from "@/components/shell/DiceRollPanel";
import { useTextesJetCible } from "@/components/shell/useTextesJetCible";
import type { AdvantageState, AttackRollResult, DamageRollResult } from "@/src/core/rules/action";
import { degatsProposes, genreCiblableDuLancer, sortieAttaque, sortieDegats, sortieSort, type ArmeFiche, type SortFiche } from "@/lib/ui/ficheDes";
import { lireCombatEnCours, lireCombatEnCoursJoueur, posterActionFiche, type CombatEnCours, type CombatEnCoursJoueur } from "@/lib/ui/ficheDesApi";
import { desDeLaFormule } from "@/lib/ui/initiative";
import { preReglageCible, type ParametresJetCible } from "@/lib/ui/jetCibleOutil";
import type { PreReglage } from "@/lib/ui/outilDes";

/**
 * V3.1-106 : les boutons Attaquer, Dégâts, attaque de sort et lancer de sort de
 * la fiche OUVRENT l'outil de dés pré-rempli (`openDiceTool`) au lieu de lancer
 * directement. « Lancer » appelle les mêmes routes qu'avant
 * (`/api/entities/[id]/actions/*`) : le serveur lance (règle 8), l'outil montre
 * ce qu'il rend. Pour le MJ, pendant une initiative (`running`) de la
 * campagne, le jet passe par `targeted-roll` et « Cibler » liste les
 * participants ; hors initiative, ou pour une joueuse, c'est un simple jet.
 * Le combat se lit AU TOUCHER du bouton, jamais au montage.
 */
export function useJetsDeLaFiche(params: {
  entityId: string;
  campaignId: string | null;
  /** MJ du monde (`isWorldAdmin`) : cible par la route du MJ ; sinon la joueuse cible avec son PJ (V3.1-107). */
  estMj: boolean;
  /** Après un sort lancé ou appliqué : la fiche se recharge (emplacements, PV). */
  apresSort: () => void;
}) {
  const { entityId, campaignId, estMj, apresSort } = params;
  const t = useTranslations("outilDes");
  const textes = useTextesJetCible();
  const { openDiceTool } = useDiceRoll();
  const occupe = useRef(false);

  /**
   * Ouvre l'outil : le préréglage ciblé si un combat est en cours, sinon le simple jet.
   * `ciblerJoueur` : ce que la joueuse sait cibler avec son PJ (V3.1-107) ; `null` = simple jet pour elle.
   */
  async function ouvrir(
    simple: () => PreReglage,
    cibler: ((combat: CombatEnCours, campagne: string) => PreReglage) | null,
    ciblerJoueur: ((combat: CombatEnCoursJoueur, campagne: string) => PreReglage) | null = null
  ) {
    if (occupe.current) return;
    occupe.current = true;
    try {
      let preReglage: PreReglage | null = null;
      if (campaignId !== null) {
        if (estMj && cibler) {
          const combat = await lireCombatEnCours(campaignId, t("ouvertureImpossible"));
          preReglage = combat ? cibler(combat, campaignId) : null;
        } else if (!estMj && ciblerJoueur) {
          const combat = await lireCombatEnCoursJoueur(campaignId);
          preReglage = combat ? ciblerJoueur(combat, campaignId) : null;
        }
      }
      openDiceTool(preReglage ?? simple());
    } finally {
      occupe.current = false;
    }
  }

  /** V3.1-107 : les paramètres d'un jet ciblé d'une joueuse avec son PJ (la vue filtrée remplace les participants). */
  function cibleeJoueur(combat: CombatEnCoursJoueur, campagne: string, nom: string, reste: Pick<ParametresJetCible, "titre" | "titreDegats" | "kind" | "action" | "formule" | "touche" | "modifier" | "avantageInitial">): PreReglage {
    return preReglageCible({
      ...reste,
      acteur: { kind: "character", entityId },
      nomActeur: nom,
      participants: [],
      joueur: combat.participants,
      campaignId: campagne,
      combatId: combat.combatId,
      textes,
      apresJet: apresSort,
    });
  }

  /** Les paramètres communs d'un jet ciblé de cette fiche. */
  function ciblee(combat: CombatEnCours, campagne: string, nom: string, reste: Pick<ParametresJetCible, "titre" | "titreDegats" | "kind" | "action" | "formule" | "touche" | "modifier" | "avantageInitial">): PreReglage {
    return preReglageCible({
      ...reste,
      acteur: { kind: "character", entityId },
      nomActeur: nom,
      participants: combat.participants,
      campaignId: campagne,
      combatId: combat.combatId,
      textes,
      apresJet: apresSort,
    });
  }

  // ---- armes ---------------------------------------------------------------------

  function degatsArmeSimple(arme: ArmeFiche, options: { critique: boolean; deuxMains: boolean }): PreReglage {
    const titre = t("titreDegats", { nom: arme.nom });
    const formule = options.deuxMains && arme.formuleDeuxMains ? arme.formuleDeuxMains : arme.formuleDegats;
    const grille = desDeLaFormule(formule);
    return {
      label: titre,
      dice: grille.dice,
      modifier: grille.modifier,
      lancer: async () => {
        const r = await posterActionFiche<{ weaponLabel: string; damage: DamageRollResult }>(
          entityId,
          "damage",
          { campaignId, itemId: arme.itemId, critical: options.critique, versatile: options.deuxMains },
          t("erreurJet")
        );
        return sortieDegats(r.damage, { who: r.weaponLabel, what: titre });
      },
    };
  }

  function attaqueArmeSimple(arme: ArmeFiche, advantage: AdvantageState): PreReglage {
    const titre = t("titreAttaque", { nom: arme.nom });
    return {
      label: titre,
      dice: { d20: 1 },
      modifier: arme.modificateurAttaque,
      advantage,
      avantageLibre: true,
      lancer: async (_cibleId, options) => {
        const r = await posterActionFiche<{ weaponLabel: string; attack: AttackRollResult }>(
          entityId,
          "attack",
          { campaignId, itemId: arme.itemId, advantage: options.avantage },
          t("erreurJet")
        );
        const sortie = sortieAttaque(r.attack, { who: r.weaponLabel, what: titre });
        if (!degatsProposes(r.attack)) return sortie;
        // Le critique double les dés : la suite le porte (l'état « critique en attente » n'existe plus).
        const degats = degatsArmeSimple(arme, { critique: r.attack.isCritical, deuxMains: false });
        return {
          ...sortie,
          suite: { libelle: textes.lancerDegats(arme.formuleDegats), lancer: async () => (await degats.lancer?.(null, { avantage: "normal" })) ?? null, preReglage: degats },
        };
      },
    };
  }

  function attaquerArme(arme: ArmeFiche, advantage: AdvantageState) {
    const titre = t("titreAttaque", { nom: arme.nom });
    void ouvrir(
      () => attaqueArmeSimple(arme, advantage),
      (combat, campagne) =>
        ciblee(combat, campagne, arme.nom, {
          titre,
          titreDegats: t("titreDegats", { nom: arme.nom }),
          kind: "attack",
          action: { kind: "weapon", itemId: arme.itemId },
          formule: arme.formuleDegats,
          touche: true,
          modifier: arme.modificateurAttaque,
          avantageInitial: advantage,
        }),
      (combat, campagne) =>
        cibleeJoueur(combat, campagne, arme.nom, {
          titre,
          titreDegats: t("titreDegats", { nom: arme.nom }),
          kind: "attack",
          action: { kind: "weapon", itemId: arme.itemId },
          formule: arme.formuleDegats,
          touche: true,
          modifier: arme.modificateurAttaque,
          avantageInitial: advantage,
        })
    );
  }

  function degatsArme(arme: ArmeFiche, deuxMains: boolean) {
    // `targeted-roll` ne connaît pas l'arme à deux mains : ce jet reste un simple jet.
    // Une joueuse ne lance jamais des dégâts seuls : ils suivent sa touche (jeton signé), donc simple jet ici.
    void ouvrir(
      () => degatsArmeSimple(arme, { critique: false, deuxMains }),
      deuxMains
        ? null
        : (combat, campagne) =>
            ciblee(combat, campagne, arme.nom, {
              titre: t("titreDegats", { nom: arme.nom }),
              titreDegats: t("titreDegats", { nom: arme.nom }),
              kind: "damage",
              action: { kind: "weapon", itemId: arme.itemId },
              formule: arme.formuleDegats,
              touche: false,
            }),
      null
    );
  }

  // ---- sorts ---------------------------------------------------------------------

  /** Le lancer d'un sort (dégâts ou simple lancer) : la route dépense l'emplacement et lance ses dégâts. */
  function lancerSortSimple(sort: SortFiche, options: { critique: boolean }): PreReglage {
    const titre = sort.formuleDegats ? t("titreDegats", { nom: sort.nom }) : t("titreLancer", { nom: sort.nom });
    const grille = sort.formuleDegats ? desDeLaFormule(sort.formuleDegats) : { dice: {}, modifier: 0 };
    return {
      label: titre,
      dice: grille.dice,
      modifier: grille.modifier,
      lancer: async () => {
        const r = await posterActionFiche<{ damage?: DamageRollResult }>(
          entityId,
          "cast-spell",
          { campaignId, spellKey: sort.spellKey, slotLevel: sort.niveauLance, critical: options.critique },
          t("erreurJet")
        );
        apresSort();
        return sortieSort(r.damage, { who: sort.nom, what: titre }, t("sortLance"));
      },
    };
  }

  function attaqueSortSimple(sort: SortFiche, advantage: AdvantageState): PreReglage {
    const titre = t("titreAttaque", { nom: sort.nom });
    return {
      label: titre,
      dice: { d20: 1 },
      modifier: sort.modificateurAttaque,
      advantage,
      avantageLibre: true,
      lancer: async (_cibleId, options) => {
        const r = await posterActionFiche<{ attack: AttackRollResult }>(entityId, "roll-spell-attack", { campaignId, spellKey: sort.spellKey, advantage: options.avantage }, t("erreurJet"));
        const sortie = sortieAttaque(r.attack, { who: sort.nom, what: titre });
        if (!degatsProposes(r.attack)) return sortie;
        const lancer = lancerSortSimple(sort, { critique: r.attack.isCritical });
        return {
          ...sortie,
          suite: { libelle: textes.lancerDegats(sort.formuleDegats), lancer: async () => (await lancer.lancer?.(null, { avantage: "normal" })) ?? null, preReglage: lancer },
        };
      },
    };
  }

  function attaquerSort(sort: SortFiche, advantage: AdvantageState) {
    // Jamais ciblée depuis la fiche (relu par Opus) : `targeted-roll` en
    // `spell_attack` dépense l'emplacement et applique les dégâts d'un coup,
    // et le bouton « Dégâts » du même sort le relancerait — emplacement
    // dépensé deux fois. Le simple jet n'en dépense aucun ; sa suite
    // « Lancer les dégâts » lance le sort une seule fois. Un sort ciblé se
    // lance depuis la ligne de l'initiative, d'un seul tenant.
    void ouvrir(() => attaqueSortSimple(sort, advantage), null);
  }

  function lancerSort(sort: SortFiche) {
    const genre = genreCiblableDuLancer(sort.genre);
    void ouvrir(
      () => lancerSortSimple(sort, { critique: false }),
      genre === null
        ? null
        : (combat, campagne) =>
            ciblee(combat, campagne, sort.nom, {
              titre: sort.formuleDegats ? t("titreDegats", { nom: sort.nom }) : t("titreLancer", { nom: sort.nom }),
              titreDegats: t("titreDegats", { nom: sort.nom }),
              kind: genre,
              action: { kind: "spell", spellKey: sort.spellKey, slotLevel: sort.niveauLance },
              formule: sort.formuleDegats,
              touche: false,
            }),
      // Un sort à sauvegarde se résout par le MJ (409) : la joueuse ne cible que le soin.
      genre === "heal"
        ? (combat, campagne) =>
            cibleeJoueur(combat, campagne, sort.nom, {
              titre: sort.formuleDegats ? t("titreDegats", { nom: sort.nom }) : t("titreLancer", { nom: sort.nom }),
              titreDegats: t("titreDegats", { nom: sort.nom }),
              kind: "heal",
              action: { kind: "spell", spellKey: sort.spellKey, slotLevel: sort.niveauLance },
              formule: sort.formuleDegats,
              touche: false,
            })
        : null
    );
  }

  return { attaquerArme, degatsArme, attaquerSort, lancerSort };
}
