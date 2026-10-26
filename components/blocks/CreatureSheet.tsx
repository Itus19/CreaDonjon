"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StatblockBlockData } from "@/src/core/schemas/blocks/statblock";
import { ABILITY_LABELS as ABILITY_NAMES, SKILLS, type Skill } from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";
import BouclierCA from "@/components/shared/BouclierCA";
import CommandeE from "@/components/shared/CommandeE";
import Dropdown from "@/components/shared/Dropdown";
import Tabs, { TabPanel } from "@/components/shared/Tabs";
import { StatBadge } from "./RangeeChiffree";
import EtatsEnCours from "./EtatsEnCours";
import NomDeRegle from "./NomDeRegle";
import TuileCaracteristique from "./TuileCaracteristique";
import { ABILITY_LABELS } from "./sheetLabels";
import { useWorldRuleEntries } from "./useWorldRuleEntries";
import {
  ACTIONS_DE_BASE,
  libellesInstances,
  CARACTERISTIQUES,
  bonusMaitrise,
  capacitesARecharge,
  formaterNombre,
  instanceChoisie,
  jetD20,
  jetDegats,
  lireVitesses,
  modificateur,
  perceptionPassive,
  sectionsActions,
  signe,
  tailleCourte,
  xpDuFp,
  type CombatCreature,
  type EntreeAction,
  type JetPastille,
} from "@/lib/ui/creature";

type Onglet = "actions" | "traits" | "maitrises";

const PASTILLE_JET =
  "rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

function skillLabel(skill: string): string {
  return (SKILLS as readonly string[]).includes(skill) ? SKILL_LABELS_FR[skill as Skill] : skill;
}

/** Le portrait de la fiche, ou l'initiale du nom tant qu'il manque (même repli que `MapPinMarker`). */
function Portrait({ entityId, nom }: { entityId: string; nom: string }) {
  const [absent, setAbsent] = useState(false);
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-accent bg-panel-sunken">
      <span aria-hidden="true" className="text-lg font-semibold text-ink-muted">
        {nom.slice(0, 1).toUpperCase() || "?"}
      </span>
      {!absent && (
        // eslint-disable-next-line @next/next/no-img-element -- portrait dynamique, même motif que MapPinMarker
        <img
          src={`/api/entities/${entityId}/portrait`}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setAbsent(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

/** Un nom de capacité : lien de règle (souligné en pointillé) quand la fiche existe dans le ruleset du monde, sinon du texte. */
function NomAction({ worldSlug, nom }: { worldSlug: string; nom: string }) {
  const regles = useWorldRuleEntries(worldSlug);
  const nu = nom.replace(/\s*\((?:recharge|Recharge)[^)]*\)\s*/, "").trim();
  const cle = regles.find((e) => e.name.toLowerCase() === nu.toLowerCase())?.key;
  return <b className="text-sm text-ink">{cle ? <NomDeRegle worldSlug={worldSlug} ruleKey={cle}>{nu}</NomDeRegle> : nu}</b>;
}

export interface FicheCreatureProps {
  worldSlug: string;
  entityId: string;
  /** Le nom de la fiche ; absent, l'en-tête ne montre que la ligne d'identité. */
  nom?: string;
  data: StatblockBlockData;
  /** L'initiative en cours où cette créature a des instances, ou `null` : la fiche est alors un modèle, sans aucune commande de jeu. */
  combat: CombatCreature | null;
  participantId: string | null;
  onChoisirInstance: (participantId: string) => void;
  /** Un ÉCART de PV (la commande E ne transmet jamais une valeur cible). */
  onDeltaPv: (delta: number) => void;
  onRetirerEtat: (nom: string) => void;
  onAjouterEtat: (nom: string) => void;
  etatsDisponibles: string[];
  /** Chaque pastille de jet ouvre l'outil de dés avec cette formule : le serveur lance (règle 8). */
  onJet: (jet: JetPastille) => void;
  /** Message d'échec d'une écriture dans le combat, affiché tel quel. */
  erreur: string | null;
}

/**
 * V3.1-79 — la fiche de créature (A, deux colonnes), bâtie avec les éléments
 * de la fiche de personnage : bouclier de CA, anneaux à commande E, tuiles de
 * constantes, boîte des états, tuiles de caractéristiques à deux boutons,
 * pilule glissante. Le bloc est un MODÈLE : hors combat, aucune écriture de PV
 * ni d'état n'est possible ; en combat, l'anneau, la commande E et les états
 * lisent et écrivent l'instance choisie (par les routes de l'initiative).
 * Seuls les modificateurs, la maîtrise, les PX et la perception passive se
 * calculent (règle 16).
 */
export default function CreatureSheet({
  worldSlug,
  entityId,
  nom,
  data,
  combat,
  participantId,
  onChoisirInstance,
  onDeltaPv,
  onRetirerEtat,
  onAjouterEtat,
  etatsDisponibles,
  onJet,
  erreur,
}: FicheCreatureProps) {
  const t = useTranslations("fiche.creature");
  const [onglet, setOnglet] = useState<Onglet>("actions");

  const instance = combat ? instanceChoisie(combat, participantId) : null;
  const vitesses = lireVitesses(data.speed);
  const xp = xpDuFp(data.challenge_rating);
  const maitrise = bonusMaitrise(data.challenge_rating);
  const sections = sectionsActions(data);
  const recharges = capacitesARecharge(sections);
  const sauvegardes = data.saving_throws ?? {};
  const competences = Object.entries(data.skills ?? {}).sort(([a], [b]) => skillLabel(a).localeCompare(skillLabel(b)));
  const alignement = data.alignment?.trim();
  const ligneIdentite = alignement
    ? t("identiteAlignement", { type: data.creature_type, taille: tailleCourte(data.size), alignement })
    : t("identite", { type: data.creature_type, taille: tailleCourte(data.size) });
  const hpMax = instance ? instance.hpMax : data.hp.value;
  const hpCourant = instance ? instance.hpCurrent : data.hp.value;
  const complementPv = [
    data.hp.hit_dice ? t("pvSous", { des: data.hp.hit_dice }) : t("pvSousSans"),
    instance && instance.tempHp > 0 ? t("pvTemp", { n: instance.tempHp }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function pastille(jet: JetPastille, texte: string) {
    return (
      <button key={`${jet.label}:${texte}`} type="button" onClick={() => onJet(jet)} title={t("jetTitre", { jet: jet.label })} className={PASTILLE_JET}>
        {texte}
      </button>
    );
  }

  function ligneAction(e: EntreeAction) {
    const { toucher, degats, dd } = e.jets;
    return (
      <div key={`${e.name}:${e.text}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-edge/40 pb-2 last:border-b-0">
        <NomAction worldSlug={worldSlug} nom={e.name} />
        {e.recharge && <span className="text-xs text-ink-muted">· {t("rechargeRegle", { plage: e.recharge.libelle })}</span>}
        {toucher !== undefined && pastille(jetD20(t("jetAttaque", { nom: e.name }), toucher), signe(toucher))}
        {dd !== undefined && (
          <span title={t("ddTitre")} className="rounded-full border border-edge px-2 py-0.5 text-xs font-semibold text-ink-muted">
            {t("dd", { dd })}
          </span>
        )}
        {degats.length > 0 && pastille(jetDegats(t("jetDegats", { nom: e.name }), degats), degats.join(" · "))}
        {e.text.trim() !== "" && <p className="basis-full text-sm leading-relaxed text-ink-muted">{e.text}</p>}
      </div>
    );
  }

  return (
    <div className="@container flex flex-col gap-4 @min-[40rem]:flex-row @min-[40rem]:items-start">
      {/* ---- colonne de gauche ---- */}
      <div className="flex min-w-0 flex-col gap-3 rounded-md border border-edge/60 bg-panel-raised p-3 @min-[40rem]:w-[21rem] @min-[40rem]:shrink-0">
        <div className="flex items-center gap-3">
          <Portrait entityId={entityId} nom={nom ?? data.creature_type} />
          <div className="min-w-0">
            {nom && <div className="truncate font-display text-lg font-bold text-ink">{nom}</div>}
            <div className="text-sm text-ink-soft">{ligneIdentite}</div>
            {data.challenge_rating && (
              <div className="text-xs text-ink-muted">
                {xp !== null ? t("fpLigne", { fp: data.challenge_rating, px: formaterNombre(xp) }) : t("fpLigneSansPx", { fp: data.challenge_rating })}
              </div>
            )}
          </div>
        </div>

        {combat && combat.instances.length > 1 && instance && (
          <Dropdown
            value={instance.participantId}
            onChange={onChoisirInstance}
            options={libellesInstances(combat.instances)}
            aria-label={t("instance")}
          />
        )}
        {instance && combat && combat.instances.length === 1 && <span className="text-xs text-ink-muted">{t("enCombat")} · {instance.label}</span>}

        {/* Trois colonnes égales : au téléphone, chaque jauge reste dans son tiers au lieu de déborder de la carte. */}
        <div className="grid grid-cols-3 items-start justify-items-center gap-x-2">
          <BouclierCA titre={t("ca")}>
            <span className="text-xl font-bold text-ink">{data.ac.value}</span>
          </BouclierCA>
          <CommandeE
            libelle={t("pv")}
            valeur={hpCourant}
            maximum={hpMax}
            danger={instance !== null && hpCourant * 3 <= hpMax}
            complement={complementPv}
            lectureSeule={instance === null}
            onDelta={onDeltaPv}
          />
          {data.challenge_rating && (
            <CommandeE
              libelle={t("fp")}
              valeur={0}
              progression={100}
              teinte="link-entity"
              texteCentre={t("fpCentre", { fp: data.challenge_rating })}
              complement={xp !== null ? t("pxSous", { px: formaterNombre(xp) }) : undefined}
              lectureSeule
              onDelta={() => {}}
            />
          )}
        </div>
        {erreur && (
          <p role="alert" className="text-xs text-danger">
            {erreur}
          </p>
        )}

        <div className="grid grid-cols-4 gap-2">
          <StatBadge fluide label={t("initiative")} value={signe(modificateur(data.abilities.dex))} onClick={() => onJet(jetD20(t("initiative"), modificateur(data.abilities.dex)))} />
          <StatBadge fluide label={t("vitesse")} value={vitesses.principale || "—"} />
          <StatBadge fluide label={t("maitrise")} value={maitrise === null ? "—" : signe(maitrise)} />
          <StatBadge fluide label={t("taille")} value={tailleCourte(data.size)} />
        </div>
        {vitesses.autres.length > 0 && <span className="text-xs text-ink-muted">{t("aussi", { liste: vitesses.autres.join(" · ") })}</span>}

        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-2">
          <StatBadge fluide label={t("perception")} value={String(perceptionPassive(data))} />
          {/* Même rang que la tuile : 2 rem de libellé (le « États » de la boîte), puis 3,5 rem de case. */}
          <div className="min-w-0 pt-8">
            <div className="flex min-h-14 items-center rounded-md border border-edge bg-panel-raised px-2 py-1">
              {instance === null && <span className="text-xs text-ink-muted">{t("aucunEtat")}</span>}
              <EtatsEnCours
                worldSlug={worldSlug}
                conditions={instance?.conditions ?? []}
                busy={false}
                onRetirerEtat={instance ? onRetirerEtat : undefined}
                onAjouterEtat={instance ? onAjouterEtat : undefined}
                etatsDisponibles={etatsDisponibles}
              />
            </div>
          </div>
        </div>

        {recharges.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("recharge")}</span>
            {recharges.map((r) => (
              <div key={r.name} className="flex flex-wrap items-baseline gap-2 text-sm">
                <b className="text-ink">{r.name.replace(/\s*\((?:recharge|Recharge)[^)]*\)\s*/, "").trim()}</b>
                <span className="text-xs text-ink-muted">{t("rechargeRegle", { plage: r.recharge.libelle })}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            {t("caracteristiques")} <span className="font-normal normal-case tracking-normal">· {t("aideCaracteristiques")}</span>
          </span>
          <div className="grid grid-cols-3 gap-2">
            {CARACTERISTIQUES.map((a) => {
              const mod = modificateur(data.abilities[a]);
              const maitrisee = a in sauvegardes;
              const modSauvegarde = sauvegardes[a] ?? mod;
              return (
                <TuileCaracteristique
                  key={a}
                  abreviation={ABILITY_LABELS[a]}
                  modificateur={signe(mod)}
                  titreTest={t("testTitre", { nom: ABILITY_NAMES[a] })}
                  libelleTest={t("test", { nom: ABILITY_NAMES[a] })}
                  onTest={() => onJet(jetD20(t("test", { nom: ABILITY_NAMES[a] }), mod))}
                  milieu={<span className="text-xs text-ink-muted">{data.abilities[a]}</span>}
                  sauvegarde={t("js", { mod: signe(modSauvegarde) })}
                  titreSauvegarde={t("sauvegardeTitre", { nom: ABILITY_NAMES[a] })}
                  libelleSauvegarde={t("sauvegarde", { nom: ABILITY_NAMES[a] })}
                  maitrise={maitrisee}
                  onSauvegarde={() => onJet(jetD20(t("sauvegarde", { nom: ABILITY_NAMES[a] }), modSauvegarde))}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- colonne de droite : la pilule glissante ---- */}
      <div className="min-w-0 flex-1">
        <Tabs
          idPrefix="creature"
          value={onglet}
          onChange={setOnglet}
          aria-label={t("sections")}
          items={(["actions", "traits", "maitrises"] as Onglet[]).map((o) => ({ value: o, label: t(`onglets.${o}`) }))}
        />
        <TabPanel idPrefix="creature" value={onglet} className="mt-2 flex flex-col gap-3 rounded-lg border border-edge bg-panel p-3">
          {onglet === "actions" && (
            <>
              {sections.map((s) => (
                <div key={s.cle} className="flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-accent">{t(`section.${s.cle}`)}</span>
                  {s.entrees.length === 0 ? <p className="text-sm italic text-ink-muted">{t("aucuneReaction")}</p> : s.entrees.map(ligneAction)}
                </div>
              ))}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-accent">{t("section.base")}</span>
                <ul className="flex flex-wrap gap-1.5">
                  {ACTIONS_DE_BASE.map((cle) => (
                    <li key={cle} className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-ink-soft">
                      {t(`base_actions.${cle}`)}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          {onglet === "traits" && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-accent">{t("onglets.traits")}</span>
              {data.traits.length === 0 ? (
                <p className="text-sm italic text-ink-muted">{t("aucunTrait")}</p>
              ) : (
                data.traits.map((e) => (
                  <div key={`${e.name}:${e.text}`} className="flex flex-col gap-0.5 border-b border-edge/40 pb-2 last:border-b-0">
                    <NomAction worldSlug={worldSlug} nom={e.name} />
                    {e.text.trim() !== "" && <p className="text-sm leading-relaxed text-ink-muted">{e.text}</p>}
                  </div>
                ))
              )}
            </div>
          )}
          {onglet === "maitrises" && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-accent">{t("sauvegardes")}</span>
                {Object.keys(sauvegardes).length === 0 ? (
                  <p className="text-sm italic text-ink-muted">{t("aucune")}</p>
                ) : (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
                    {CARACTERISTIQUES.filter((a) => a in sauvegardes).map((a) => (
                      <span key={a}>
                        {ABILITY_NAMES[a]} {signe(sauvegardes[a] ?? 0)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-accent">{t("competences")}</span>
                {competences.length === 0 ? (
                  <p className="text-sm italic text-ink-muted">{t("aucune")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {competences.map(([cle, valeur]) => pastille(jetD20(skillLabel(cle), valeur), `${skillLabel(cle)} ${signe(valeur)}`))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-accent">{t("sens")}</span>
                <p className="text-sm text-ink">{data.senses?.trim() || t("aucunSens")}</p>
                <span className="text-xs font-bold uppercase tracking-wide text-accent">{t("langues")}</span>
                <p className="text-sm text-ink">{data.languages?.trim() || t("aucunSens")}</p>
              </div>
            </>
          )}
        </TabPanel>
      </div>
    </div>
  );
}
