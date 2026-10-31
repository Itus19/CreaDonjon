import type { CombatParticipantRow } from "@/src/server/repos/combats";
import type { AdvantageState } from "@/src/core/rules/action";
import type { PlayerCombatParticipant, WoundState } from "@/src/core/rules/combatPlayerView";
import {
  corpsJetCible,
  corpsJetJoueur,
  demandeDegatsApres,
  desDeLaFormule,
  libellePv,
  sortieDepuisJetCible,
  validationMjRequise,
  type DemandeJetCible,
  type GenreJetCible,
} from "@/lib/ui/initiative";
import { ErreurInitiative, lancerJetCible, lancerJetCibleJoueur } from "@/lib/ui/initiativeApi";
import { ErreurLancer, sortieSansDes, type CibleDeJet, type PreReglage, type SortieJet, type SuiteDeJet } from "@/lib/ui/outilDes";

/**
 * Le préréglage d'un jet CIBLÉ de l'outil de dés (V3.1-38, V3.1-106) : « Cibler »
 * liste les participants du combat en cours, « Lancer » passe par
 * `POST …/targeted-roll` (le serveur lance, tranche et applique : règle 8), et la
 * bande du pied propose la suite. Partagé par l'outil Initiative et par la fiche
 * du MJ. Aucun effet de montage (docs/CABLAGE.md §6).
 */

/** Les textes, déjà traduits par l'appelant (ce fichier ne connaît pas next-intl). */
export interface TextesJetCible {
  libelle: (cle: "touche" | "rate" | "attaque" | "degats" | "sauvegarde" | "soin", cible: string) => string;
  erreurJet: string;
  allie: string;
  adversaire: string;
  /** « Lancer les dégâts · 1d4 + 2 » (la formule quand elle est connue). */
  lancerDegats: (formule: string | null) => string;
  /** Les deux boutons du MJ quand un monstre touche un allié. */
  validerDegats: string;
  faireEchouer: string;
  /** « Raté (MJ) — Le MJ fait échouer la touche, aucun dégât ». */
  refusMj: string;
  /** V3.1-107 : l'état de blessure d'un adversaire, tel que la joueuse le voit (« Blessé »). */
  blessure: (etat: WoundState) => string;
}

export interface ParametresJetCible {
  /** Le titre de l'outil : « Morsure · Touche ». */
  titre: string;
  /** Le titre du préréglage des dégâts qui suit une touche : « Morsure · Dégâts ». */
  titreDegats: string;
  kind: GenreJetCible;
  action: DemandeJetCible["action"];
  acteur: DemandeJetCible["acteur"];
  nomActeur: string;
  /** Les dégâts (ou le soin) quand on les connaît : libellé de la bande, dés de la grille. */
  formule: string | null;
  /** Le bonus du d20 de la grille, pour un jet de touche. */
  modifier?: number;
  /** Le jet est une touche : la grille montre un d20 (sinon les dés de `formule`). */
  touche: boolean;
  /** Dégâts relancés après un critique : les dés sont doublés par le serveur. */
  critique?: boolean;
  avantageInitial?: AdvantageState;
  participants: CombatParticipantRow[];
  /**
   * V3.1-107 : une JOUEUSE avec son PJ. La vue filtrée du combat (jamais de CA ni
   * de PV d'adversaire) remplace `participants` (laissé vide), et « Lancer » passe
   * par `player-targeted-roll`.
   */
  joueur?: PlayerCombatParticipant[];
  campaignId: string;
  combatId: string;
  textes: TextesJetCible;
  /** Appelé après chaque jet appliqué (l'écran relit le combat, la fiche se recharge). */
  apresJet: () => void;
}

/** Les participants qu'un jet peut viser, avec leur camp et leurs PV. */
export function ciblesDuCombat(participants: readonly CombatParticipantRow[], textes: Pick<TextesJetCible, "allie" | "adversaire">): CibleDeJet[] {
  return participants.map((p) => ({
    id: p.id,
    label: p.label,
    info: [p.is_ally ? textes.allie : textes.adversaire, libellePv(p)].filter((x): x is string => x !== null).join(" · "),
  }));
}

/** V3.1-107 : les cibles de la vue filtrée : PV d'un allié, état de blessure d'un adversaire. */
export function ciblesDuCombatJoueur(participants: readonly PlayerCombatParticipant[], textes: Pick<TextesJetCible, "allie" | "adversaire" | "blessure">): CibleDeJet[] {
  return participants.map((p) => {
    const pv = p.side === "ally" && p.hp !== null && p.hp.max !== null && p.hp.max > 0 ? `${(p.hp.current ?? 0) + p.hp.temp}/${p.hp.max}` : null;
    const etat = p.side === "enemy" && p.wound !== null ? textes.blessure(p.wound) : null;
    return { id: p.id, label: p.label, info: [p.side === "ally" ? textes.allie : textes.adversaire, pv ?? etat].filter((x): x is string => x !== null).join(" · ") };
  });
}

export function preReglageCible(p: ParametresJetCible): PreReglage {
  const { participants, textes } = p;
  const grille = p.touche ? { dice: { d20: 1 }, modifier: p.modifier ?? 0 } : desDeLaFormule(p.formule);

  return {
    label: p.titre,
    dice: grille.dice,
    modifier: grille.modifier,
    advantage: p.avantageInitial,
    cibles: p.joueur ? ciblesDuCombatJoueur(p.joueur, textes) : ciblesDuCombat(participants, textes),
    // Un jet d'attaque garde l'avantage au choix dans l'outil.
    avantageLibre: p.kind === "attack" || p.kind === "spell_attack",
    lancer: async (cibleId, options) => {
      if (!cibleId) return null;
      const cible = participants.find((x) => x.id === cibleId);
      const nomCible = cible?.label ?? p.joueur?.find((x) => x.id === cibleId)?.label ?? "";

      /** Un jet ciblé : le serveur lance, tranche et applique ; on affiche ses dés, et la suite qu'il propose. */
      const executer = async (demande: DemandeJetCible, options2: { avantage?: AdvantageState; critique?: boolean; jeton?: string | null }): Promise<SortieJet> => {
        try {
          // Une joueuse : le critique des dégâts vient du jeton signé à la touche, jamais d'elle.
          const reponse = p.joueur
            ? await lancerJetCibleJoueur(p.campaignId, p.combatId, corpsJetJoueur(demande, options2), textes.erreurJet)
            : await lancerJetCible(p.campaignId, p.combatId, corpsJetCible(demande, options2), textes.erreurJet);
          p.apresJet();
          const sortie = sortieDepuisJetCible(reponse, demande.kind, { acteur: p.nomActeur, cible: nomCible, libelle: textes.libelle });
          const degats = demandeDegatsApres(reponse);
          if (!degats) return sortie;

          const lancerDegats = () => executer(degats.demande, { critique: degats.critique, jeton: degats.jeton });
          // La grille de l'outil passe aux dés des dégâts quand la suite est lancée.
          const preReglage = preReglageCible({
            ...p,
            titre: p.titreDegats,
            kind: "damage",
            action: degats.demande.action,
            touche: false,
            critique: degats.critique,
            avantageInitial: undefined,
          });
          const suite: SuiteDeJet = { libelle: textes.lancerDegats(p.formule), lancer: lancerDegats, preReglage };
          if (validationMjRequise(p.acteur, cible)) {
            // Un monstre touche un joueur : le MJ valide la touche ou la fait échouer, sans rien lancer ni écrire.
            return {
              ...sortie,
              suite: { ...suite, libelle: textes.validerDegats, refus: { libelle: textes.faireEchouer, sortie: sortieSansDes(p.nomActeur, textes.refusMj) } },
            };
          }
          return { ...sortie, suite };
        } catch (e) {
          if (e instanceof ErreurInitiative) throw new ErreurLancer(e.message);
          throw e;
        }
      };

      return executer({ kind: p.kind, acteur: p.acteur, action: p.action, cibleId }, { avantage: options.avantage, critique: p.critique });
    },
  };
}
