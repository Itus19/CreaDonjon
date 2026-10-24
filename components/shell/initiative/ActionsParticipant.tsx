"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useDiceRoll } from "@/components/shell/DiceRollPanel";
import { useRuleEntryBlocks } from "@/components/blocks/useRuleEntryBlocks";
import { refIdentity, useReferenceChips } from "@/components/blocks/useReferenceChips";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { zSpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { CombatParticipantRow } from "@/src/server/repos/combats";
import type { ParticipantCharacteristics } from "@/src/server/services/combats";
import { useTextesJetCible } from "@/components/shell/useTextesJetCible";
import { actionsDeMonstre, classerSort, estUneArme, type ActionAffichee, type DemandeJetCible, type GenreJetCible } from "@/lib/ui/initiative";
import type { BlocEntiteLu } from "@/lib/ui/initiativeApi";
import { preReglageCible } from "@/lib/ui/jetCibleOutil";

/** Ce qu'on a lu d'un participant en le dépliant : son bloc de monstre, ou les blocs de sa fiche. */
export type DetailsParticipant =
  | { kind: "monstre"; caracteristiques: ParticipantCharacteristics; actions: ActionAffichee[] }
  | { kind: "personnage"; blocs: BlocEntiteLu[] }
  | { kind: "aucun" };

export function detailsDepuisCaracteristiques(c: ParticipantCharacteristics): DetailsParticipant {
  return c.kind === "monster" ? { kind: "monstre", caracteristiques: c, actions: actionsDeMonstre(c) } : { kind: "aucun" };
}

const BOUTON_JET =
  "rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-ink";

interface OuvrirJet {
  nom: string;
  titre: string;
  kind: GenreJetCible;
  action: DemandeJetCible["action"];
  formule: string | null;
  modifier?: number;
  touche: boolean;
}

/** Ouvre l'outil de dés (le même que partout) pré-rempli, avec « Cibler » parmi les participants. */
function useOuvrirJet(params: {
  acteur: CombatParticipantRow;
  participants: CombatParticipantRow[];
  campaignId: string;
  combatId: string;
  apresJet: () => void;
}): (jet: OuvrirJet) => void {
  const t = useTranslations("initiative");
  const textes = useTextesJetCible();
  const { openDiceTool } = useDiceRoll();
  const { acteur, participants, campaignId, combatId, apresJet } = params;

  return (jet) => {
    const acteurJet: DemandeJetCible["acteur"] =
      acteur.source_kind === "entity" && acteur.entity_id
        ? { kind: "character", entityId: acteur.entity_id }
        : { kind: "participant", participantId: acteur.id };
    openDiceTool(
      preReglageCible({
        titre: jet.titre,
        titreDegats: `${jet.nom} · ${t("degats")}`,
        kind: jet.kind,
        action: jet.action,
        acteur: acteurJet,
        nomActeur: acteur.label,
        formule: jet.formule,
        modifier: jet.modifier,
        touche: jet.touche,
        participants,
        campaignId,
        combatId,
        textes,
        apresJet,
      })
    );
  };
}

interface Contexte {
  acteur: CombatParticipantRow;
  participants: CombatParticipantRow[];
  worldSlug: string;
  campaignId: string;
  combatId: string;
  /** Le combat est commencé : les jets ciblés n'existent que pendant le combat. */
  enCours: boolean;
  apresJet: () => void;
}

/** Toutes les actions d'un participant, deux boutons « touche » puis « dégâts » (ou la sauvegarde). */
export default function ActionsParticipant({ details, contexte }: { details: DetailsParticipant | "chargement" | "erreur" | undefined; contexte: Contexte }) {
  const t = useTranslations("initiative");
  if (details === undefined || details === "chargement") return <p className="text-xs text-ink-muted">{t("chargement")}</p>;
  if (details === "erreur") return <p className="text-xs text-danger">{t("erreurActions")}</p>;
  if (details.kind === "monstre") return <ActionsMonstre actions={details.actions} contexte={contexte} />;
  if (details.kind === "personnage") return <ActionsPersonnage blocs={details.blocs} contexte={contexte} />;
  return <p className="text-xs text-ink-muted">{t("aucuneAction")}</p>;
}

function Rangee({ nom, detail, children }: { nom: string; detail?: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-panel-sunken px-2.5 py-1.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-sm font-semibold text-ink">{nom}</b>
        {detail && <small className="truncate text-xs text-ink-muted">{detail}</small>}
      </span>
      {children}
    </li>
  );
}

function ActionsMonstre({ actions, contexte }: { actions: ActionAffichee[]; contexte: Contexte }) {
  const t = useTranslations("initiative");
  const ouvrir = useOuvrirJet(contexte);
  const indice = contexte.enCours ? undefined : t("jetsApresDebut");
  if (actions.length === 0) return <p className="text-xs text-ink-muted">{t("aucuneAction")}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {actions.map((a) => (
        <Rangee key={a.nom} nom={a.nom} detail={a.dd !== null ? t("sauvegardeDd", { dd: a.dd }) : undefined}>
          {a.touche !== null && (
            <button
              type="button"
              disabled={!contexte.enCours}
              title={indice}
              onClick={() => ouvrir({ nom: a.nom, titre: `${a.nom} · ${t("touche")}`, kind: "attack", action: { kind: "monster_action", name: a.nom }, formule: a.degats, modifier: a.touche ?? 0, touche: true })}
              className={BOUTON_JET}
            >
              {t("toucheBonus", { bonus: a.touche >= 0 ? `+${a.touche}` : String(a.touche) })} ▸
            </button>
          )}
          {a.degats !== null && (
            <button
              type="button"
              disabled={!contexte.enCours}
              title={indice}
              onClick={() => ouvrir({ nom: a.nom, titre: `${a.nom} · ${t("degats")}`, kind: "damage", action: { kind: "monster_action", name: a.nom }, formule: a.degats, touche: false })}
              className={BOUTON_JET}
            >
              {t("degats")} {a.degats} ▸
            </button>
          )}
        </Rangee>
      ))}
    </ul>
  );
}

function ActionsPersonnage({ blocs, contexte }: { blocs: BlocEntiteLu[]; contexte: Contexte }) {
  const t = useTranslations("initiative");
  const ouvrir = useOuvrirJet(contexte);
  const indice = contexte.enCours ? undefined : t("jetsApresDebut");

  const inventaire = useMemo(() => zInventoryBlockData.safeParse(blocs.find((b) => b.blockType === "inventory")?.data), [blocs]);
  const sorts = useMemo(() => zSpellcastingBlockData.safeParse(blocs.find((b) => b.blockType === "spellcasting")?.data), [blocs]);

  const objets = useMemo(
    () =>
      inventaire.success
        ? inventaire.data.items.flatMap((item) => {
            const ref = (item as { ref?: BlockReference }).ref;
            return item.equipped && ref?.kind === "rule" ? [{ itemId: item.id, ref }] : [];
          })
        : [],
    [inventaire]
  );
  const sortsPrepares = useMemo(
    () =>
      sorts.success
        ? sorts.data.known.flatMap((k) => (k.ref.kind === "rule" && sorts.data.prepared.includes(k.ref.key) ? [{ ref: k.ref, cle: k.ref.key }] : []))
        : [],
    [sorts]
  );

  const refs = useMemo(() => [...objets.map((o) => o.ref), ...sortsPrepares.map((s) => s.ref)], [objets, sortsPrepares]);
  const puces = useReferenceChips(contexte.worldSlug, refs);
  const blocsDeRegle = useRuleEntryBlocks(contexte.worldSlug, refs.map((r) => (r.kind === "rule" ? r.key : "")).filter((k) => k !== ""));
  const nomDe = (ref: BlockReference) => {
    const puce = puces.get(refIdentity(ref));
    return puce?.found ? puce.name : ref.kind === "rule" ? ref.key : ref.id;
  };

  const armes = objets.filter((o) => o.ref.kind === "rule" && estUneArme(blocsDeRegle[o.ref.key]));
  if (armes.length === 0 && sortsPrepares.length === 0) return <p className="text-xs text-ink-muted">{t("aucuneAction")}</p>;

  return (
    <ul className="flex flex-col gap-1.5">
      {armes.map((o) => {
        const nom = nomDe(o.ref);
        const action = { kind: "weapon" as const, itemId: o.itemId };
        return (
          <Rangee key={o.itemId} nom={nom}>
            <button type="button" disabled={!contexte.enCours} title={indice} onClick={() => ouvrir({ nom: nom, titre: `${nom} · ${t("touche")}`, kind: "attack", action, formule: null, touche: true })} className={BOUTON_JET}>
              {t("touche")} ▸
            </button>
            <button type="button" disabled={!contexte.enCours} title={indice} onClick={() => ouvrir({ nom: nom, titre: `${nom} · ${t("degats")}`, kind: "damage", action, formule: null, touche: false })} className={BOUTON_JET}>
              {t("degats")} ▸
            </button>
          </Rangee>
        );
      })}
      {sortsPrepares.map((s) => {
        const nom = nomDe(s.ref);
        const { genre, niveau } = classerSort(blocsDeRegle[s.cle]);
        const action = { kind: "spell" as const, spellKey: s.cle, slotLevel: niveau };
        const detail = niveau === 0 ? t("sortMineur") : t("sortNiveau", { niveau });
        return (
          <Rangee key={s.cle} nom={nom} detail={detail}>
            {genre === "spell_attack" && (
              <button type="button" disabled={!contexte.enCours} title={indice} onClick={() => ouvrir({ nom: nom, titre: `${nom} · ${t("touche")}`, kind: "spell_attack", action, formule: null, touche: true })} className={BOUTON_JET}>
                {t("touche")} ▸
              </button>
            )}
            {genre === "spell_save" && (
              <button type="button" disabled={!contexte.enCours} title={indice} onClick={() => ouvrir({ nom: nom, titre: `${nom} · ${t("sauvegarde")}`, kind: "spell_save", action, formule: null, touche: false })} className={BOUTON_JET}>
                {t("sauvegarde")} ▸
              </button>
            )}
            {genre === "heal" && (
              <button type="button" disabled={!contexte.enCours} title={indice} onClick={() => ouvrir({ nom: nom, titre: `${nom} · ${t("soin")}`, kind: "heal", action, formule: null, touche: false })} className={BOUTON_JET}>
                {t("soin")} ▸
              </button>
            )}
          </Rangee>
        );
      })}
    </ul>
  );
}
