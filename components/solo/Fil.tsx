"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import EmptyState from "@/components/shell/EmptyState";
import type { FilItem } from "@/lib/solo/types";
import { factSansIssue } from "@/src/core/rules/rollFactDisplay";
import AnnulerTour from "@/components/solo/AnnulerTour";

/**
 * V3-D4 — Le fil : `session_events` rendu, un gabarit par genre.
 *
 * Composant purement présentationnel — la lecture (et son sondage) vit
 * dans `SoloScreen.tsx`, qui possède aussi le conteneur défilant et le
 * défilement automatique : un fil qui gérait son propre scroll ne pourrait
 * pas partager cette logique avec ce qui s'affiche au-dessus de lui
 * (`ScenePanel`), dans la MÊME zone défilante.
 */

const CARD = "rounded-md border border-edge bg-panel-sunken px-3 py-2";

/**
 * V3.2-1 — qui parle, et comment on le voit.
 *
 * Trois voix, trois traitements, et surtout PAS trois bulles : la narration
 * est du texte long ; l'emballer la rendrait illisible au bout de six tours.
 * - le joueur : une bulle à droite, dans le bleu `players` (le jeton porte
 *   déjà ce sens, V3.1-63) ;
 * - la narration : pas de bulle, un liseré terracotta `gm` — la même marque
 *   que les passages du MJ dans le wiki ;
 * - un PNJ qui parle : une bulle à gauche, posée sur `panel-raised`, et son
 *   nom (petites capitales accent) suivi de son attitude dans un onglet
 *   accroché sous la bulle : coin bas gauche carré, même fond, la bordure du
 *   bas de la bulle sert de haut à l'onglet. Bulle et nom font un seul objet,
 *   on ne rattache jamais un nom à la mauvaise réplique.
 * Bulles : `py-1`, pas `py-2` : le fil gagne de la hauteur à chaque tour.
 * Le MJ hors du temps de jeu garde son liseré d'accent (`NoteRow`), qui ne
 * doit jamais se confondre avec le récit.
 */
const BULLE_JOUEUR = "max-w-[85%] self-end rounded-lg rounded-br-sm border border-players bg-panel-raised px-3 py-1";
const BULLE_PNJ = "rounded-lg border border-edge bg-panel-raised px-3 py-1";

function verdictColorClass(verdict: "success" | "fail" | null): string {
  if (verdict === "success") return "text-success";
  if (verdict === "fail") return "text-danger";
  return "text-ink";
}

function originLabel(origin: string | null): string | null {
  if (origin === "a_la_main") return "annoncé";
  if (origin === "volet") return "volet de dés";
  if (origin === "fiche") return "depuis la fiche";
  return null;
}

type Replique = NonNullable<Extract<FilItem, { kind: "narration" }>["npcReaction"]>;

function RepliquePnj({ reaction }: { reaction: Replique }) {
  const texte = <p className={`${BULLE_PNJ} text-sm italic leading-relaxed text-ink-soft ${reaction.npcName ? "rounded-bl-none" : "rounded-bl-sm"}`}>« {reaction.text} »</p>;
  // Une réplique écrite avant qu'on garde le nom : la bulle seule, comme avant.
  if (!reaction.npcName) return <div className="max-w-[85%] self-start">{texte}</div>;
  return (
    <figure className="m-0 flex max-w-[85%] flex-col self-start">
      {texte}
      <figcaption className="-mt-px flex items-baseline gap-1.5 self-start rounded-b-md border border-t-0 border-edge bg-panel-raised px-2.5 pb-0.5 text-xs">
        <span className="font-semibold uppercase tracking-wide text-accent">{reaction.npcName}</span>
        {reaction.attitude && (
          <>
            <span aria-hidden="true" className="text-ink-muted">
              ·
            </span>
            <span className="text-ink-muted">{reaction.attitude}</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}

function NarrationRow({ item }: { item: Extract<FilItem, { kind: "narration" }> }) {
  return (
    <div className="flex flex-col gap-2">
      {/* `text-base` : la narration est ce qui se lit vraiment (docs/CHARTE-UI.md §4).
          V3.2-12 : le fil s'étale quand les volets se replient, mais le paragraphe garde un plafond de 110 caractères : au-delà, l'œil perd le début de la ligne suivante. Le plafond est sur le paragraphe, pas sur la colonne, pour que bulles et défilement prennent toute la largeur. */}
      <p className="max-w-[110ch] border-l-2 border-gm pl-3 text-base leading-relaxed text-ink">{item.text}</p>
      {item.npcReaction && <RepliquePnj reaction={item.npcReaction} />}
    </div>
  );
}

function PlayerActionRow({ item }: { item: Extract<FilItem, { kind: "player_action" }> }) {
  return <p className={`${BULLE_JOUEUR} text-sm text-ink`}>{item.text}</p>;
}

/**
 * V3.2-20 — un jet du tour : la phrase du joueur en bulle (elle n'apparaît pas
 * ailleurs pour un tour à jet), puis la carte du jet. Réglage coupé
 * (`montrerIssue`), la carte tait le DD et l'issue : c'est le récit qui les dit.
 */
function RollRow({ item, montrerIssue }: { item: Extract<FilItem, { kind: "roll" }>; montrerIssue: boolean }) {
  const [open, setOpen] = useState(false);
  const label = originLabel(item.origin);
  const faits = montrerIssue ? item.facts : item.facts.map(factSansIssue);
  return (
    <>
      {item.actionText && <p className={`${BULLE_JOUEUR} text-sm text-ink`}>{item.actionText}</p>}
      <div className={CARD}>
        <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen((v) => !v)} disabled={item.trace.length === 0}>
          <span className="text-sm text-ink">{faits.join(" ")}</span>
          {item.total !== null && <span className={`shrink-0 text-sm font-semibold ${montrerIssue ? verdictColorClass(item.verdict) : "text-ink"}`}>{item.total}</span>}
        </button>
        {label && <p className="mt-0.5 text-xs text-ink-muted">{label}</p>}
        {open && item.trace.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5 border-t border-edge pt-2">
            {item.trace.map((step, i) => (
              <li key={i} className="text-xs text-ink-muted">
                {step.text} = {step.value}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function RuleApplicationRow({ item }: { item: Extract<FilItem, { kind: "rule_application" }> }) {
  const [open, setOpen] = useState(false);
  if (item.changes.length === 0 && item.hints.length === 0 && item.ignored.length === 0) return null;
  return (
    <div className={CARD}>
      <button type="button" className="text-xs font-medium text-ink-muted" onClick={() => setOpen((v) => !v)}>
        {open ? "▾" : "▸"} {item.changes.length} changement{item.changes.length > 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1 border-t border-edge pt-2">
          {item.changes.map((line, i) => (
            <p key={i} className="text-sm text-ink-soft">
              {line}
            </p>
          ))}
          {item.hints.map((hint, i) => (
            <p key={i} className="text-sm italic text-ink-soft">
              {hint}
            </p>
          ))}
          {/* Ce que le moteur n'a PAS pu appliquer se voit, toujours : une
              regle qui ne s'applique pas en silence est pire qu'une regle
              absente (meme raison que l'ancien rendu de IntentBar.tsx). */}
          {item.ignored.map((reason, i) => (
            <p key={i} className="text-xs text-ink-muted">
              Non appliqué — {reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function WorldUpdateRow({ item }: { item: Extract<FilItem, { kind: "world_update" }> }) {
  if (!item.note) return null;
  return <p className="text-xs text-ink-muted">{item.note}</p>;
}

const PUCE = "rounded-full border border-edge bg-panel-sunken px-2 py-0.5 text-xs text-ink-soft";

/**
 * V3.2-27 (option A, ADR 0114) — la ligne du tour : l'heure, toujours en
 * tête (« +8 h · 06:08, jour 2 », « Round · 6 s » en combat), puis une puce
 * par chose que le tour a changé. Les conseils et ce que le moteur n'a pas pu
 * appliquer restent derrière « détails », jamais tus. Le dernier tour porte
 * « Annuler ce tour » : on voit ce qu'on annule.
 */
function TurnSummaryRow({
  item,
  annulation,
  onAnnule,
  onVoirChangements,
}: {
  item: Extract<FilItem, { kind: "turn_summary" }>;
  annulation: { campaignId: string } | null;
  onAnnule: () => void;
  onVoirChangements: () => void;
}) {
  const t = useTranslations("solo.changements");
  const [details, setDetails] = useState(false);
  const aDetails = item.hints.length > 0 || item.ignored.length > 0;
  const annulable = item.last && annulation !== null;
  if (!item.time && item.changes.length === 0 && !aDetails && !annulable) return null;
  return (
    <div className="flex flex-col gap-1.5" aria-label={t("ligneAria")} role="group">
      <div className="flex flex-wrap items-center gap-1.5">
        {item.time && <span className={`${PUCE} font-medium tabular-nums text-ink`}>{item.time}</span>}
        {item.changes.map((change, i) => (
          <span key={i} className={PUCE}>
            {change}
          </span>
        ))}
        {item.worldNotes > 0 && (
          <button type="button" onClick={onVoirChangements} className="rounded-full px-2 py-0.5 text-xs text-accent underline-offset-2 hover:underline">
            {t("voirChangements")}
          </button>
        )}
        {aDetails && (
          <button type="button" onClick={() => setDetails((v) => !v)} aria-expanded={details} className="rounded-full px-2 py-0.5 text-xs text-ink-muted hover:text-ink">
            {details ? "▾" : "▸"} {t("details")}
          </button>
        )}
      </div>
      {details && (
        <div className="flex flex-col gap-0.5 pl-1">
          {item.hints.map((hint, i) => (
            <p key={i} className="text-xs italic text-ink-soft">
              {hint}
            </p>
          ))}
          {item.ignored.map((raison, i) => (
            <p key={i} className="text-xs text-ink-muted">
              {t("nonApplique", { raison })}
            </p>
          ))}
        </div>
      )}
      {annulable && <AnnulerTour campaignId={annulation.campaignId} onDone={onAnnule} />}
    </div>
  );
}

/** V3-D4 — la réponse du MJ à une question posée hors du temps de jeu : un liseré d'accent qui le dit en toutes lettres, jamais confondu avec un fait de tour. */
function NoteRow({ item }: { item: Extract<FilItem, { kind: "note" }> }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-accent pl-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">MJ — hors du temps de jeu</p>
      <p className="text-sm text-ink-soft">{item.question}</p>
      <p className="text-sm text-ink">{item.answer}</p>
    </div>
  );
}

function filRowKey(item: FilItem): string {
  return item.id;
}

export default function Fil({
  items,
  montrerIssue,
  annulation = null,
  onAnnule = () => {},
  onVoirChangements = () => {},
}: {
  items: FilItem[] | null;
  /** V3.2-20 : réglage de partie, DD et issue des jets visibles. */
  montrerIssue: boolean;
  /** V3.2-27 : la campagne solo, pour « Annuler ce tour » au bout du dernier tour ; `null` : pas de geste. */
  annulation?: { campaignId: string } | null;
  onAnnule?: () => void;
  /** V3.2-27 : ouvre l'onglet « Changements » (colonne Monde, ou feuille du bas sur téléphone). */
  onVoirChangements?: () => void;
}) {
  if (items === null) {
    return <p className="text-sm text-ink-muted">Chargement…</p>;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucun tour joué"
        description="Les faits établis s'écriront ici, au fur et à mesure. Ils sont journalisés avant toute narration — la prose viendra plus tard, les faits sont acquis."
      />
    );
  }
  return (
    <div className="flex flex-col items-stretch gap-2">
      {items.map((item) => {
        switch (item.kind) {
          case "narration":
            return <NarrationRow key={filRowKey(item)} item={item} />;
          case "player_action":
            return <PlayerActionRow key={filRowKey(item)} item={item} />;
          case "roll":
            return <RollRow key={filRowKey(item)} item={item} montrerIssue={montrerIssue} />;
          case "rule_application":
            return <RuleApplicationRow key={filRowKey(item)} item={item} />;
          case "world_update":
            return <WorldUpdateRow key={filRowKey(item)} item={item} />;
          case "note":
            return <NoteRow key={filRowKey(item)} item={item} />;
          case "turn_summary":
            return <TurnSummaryRow key={filRowKey(item)} item={item} annulation={annulation} onAnnule={onAnnule} onVoirChangements={onVoirChangements} />;
          case "other":
            return null;
        }
      })}
    </div>
  );
}
