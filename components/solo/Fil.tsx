"use client";

import { useState } from "react";
import EmptyState from "@/components/shell/EmptyState";
import type { FilItem } from "@/lib/solo/types";

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

function NarrationRow({ item }: { item: Extract<FilItem, { kind: "narration" }> }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm leading-relaxed text-ink">{item.text}</p>
      {item.npcReaction && <p className="text-sm italic leading-relaxed text-ink-soft">« {item.npcReaction.text} »</p>}
    </div>
  );
}

function PlayerActionRow({ item }: { item: Extract<FilItem, { kind: "player_action" }> }) {
  return (
    <div className="flex flex-col items-end gap-0.5 text-right">
      <p className="text-sm text-ink-soft">{item.text}</p>
    </div>
  );
}

function RollRow({ item }: { item: Extract<FilItem, { kind: "roll" }> }) {
  const [open, setOpen] = useState(false);
  const label = originLabel(item.origin);
  return (
    <div className={CARD}>
      <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen((v) => !v)} disabled={item.trace.length === 0}>
        <span className="text-sm text-ink">{item.facts.join(" ")}</span>
        {item.total !== null && <span className={`shrink-0 text-sm font-semibold ${verdictColorClass(item.verdict)}`}>{item.total}</span>}
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

function filRowKey(item: FilItem): string {
  return item.id;
}

export default function Fil({ items }: { items: FilItem[] | null }) {
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
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        switch (item.kind) {
          case "narration":
            return <NarrationRow key={filRowKey(item)} item={item} />;
          case "player_action":
            return <PlayerActionRow key={filRowKey(item)} item={item} />;
          case "roll":
            return <RollRow key={filRowKey(item)} item={item} />;
          case "rule_application":
            return <RuleApplicationRow key={filRowKey(item)} item={item} />;
          case "world_update":
            return <WorldUpdateRow key={filRowKey(item)} item={item} />;
          case "other":
            return null;
        }
      })}
    </div>
  );
}
