"use client";

import { useState } from "react";
import Link from "next/link";
import type { GeneratorBlockData } from "@/src/core/schemas/blocks/generator";
import { isProseSlot, PROSE_LENGTH_PRESETS, DEFAULT_PROSE_LENGTH, type ProseLength } from "@/src/core/generators/types";
import type { GeneratorSlotResult, GeneratorToolWindowData } from "@/src/server/services/generators";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import RuleEntryAutocomplete from "@/components/blocks/RuleEntryAutocomplete";
import { useOpenEntityLink } from "./useOpenEntityLink";

interface DrawResponse {
  text: string;
  slots: GeneratorSlotResult[];
}

/** Dernier resultat connu d'une section (V2-J2) — remonte au panneau parent pour que "Créer la fiche" puisse combiner toutes les sections actuellement tirees, sans redemander un tirage. */
export interface SectionResult {
  text: string;
  refs: BlockReference[];
}

/**
 * Une section d'un outil de generation (V2-J1 Phase 2, style "Maisons
 * Closes" demande par l'utilisateur) : un bouton "Tirer" genere TOUS les
 * emplacements du bloc `generator` de cette section ; une fois tire, un
 * panneau repliable "Détails des tirages" liste chaque emplacement avec son
 * die/resultat et son propre bouton de relance individuelle (`onlySlotKey`,
 * app/api/blocks/[blockId]/generate/route.ts). L'etat des emplacements deja
 * connus (`slotResults`) est conserve cote client — le serveur reste sans
 * etat, chaque relance individuelle lui renvoie les valeurs des AUTRES
 * emplacements pour qu'il recompose le texte complet.
 */
function GeneratorSectionCard({
  blockId,
  label,
  data,
  onResult,
}: {
  blockId: string;
  label: string;
  data: GeneratorBlockData;
  onResult: (result: SectionResult) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [slotResults, setSlotResults] = useState<Record<string, GeneratorSlotResult>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [proseLength, setProseLength] = useState<ProseLength>(DEFAULT_PROSE_LENGTH);
  const [drawing, setDrawing] = useState(false);
  const [reloadingKey, setReloadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hasProseSlot = data.slots.some(isProseSlot);

  async function draw(onlySlotKey: string | null, knownSlotTexts: Record<string, string>) {
    const res = await fetch(`/api/blocks/${blockId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proseLength, onlySlotKey, knownSlotTexts }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "La génération a échoué.");
    }
    return (await res.json()) as DrawResponse;
  }

  function reportResult(newText: string, newSlotResults: Record<string, GeneratorSlotResult>) {
    const refs = Object.values(newSlotResults).flatMap((s) => s.refs);
    onResult({ text: newText, refs });
  }

  async function handleDrawAll() {
    setDrawing(true);
    setError(null);
    try {
      const result = await draw(null, {});
      const nextSlotResults = Object.fromEntries(result.slots.map((s) => [s.key, s]));
      setText(result.text);
      setSlotResults(nextSlotResults);
      setDetailsOpen(true);
      reportResult(result.text, nextSlotResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La génération a échoué.");
    } finally {
      setDrawing(false);
    }
  }

  async function handleRerollSlot(slotKey: string) {
    setReloadingKey(slotKey);
    setError(null);
    try {
      const knownSlotTexts = Object.fromEntries(Object.entries(slotResults).map(([k, s]) => [k, s.text]));
      const result = await draw(slotKey, knownSlotTexts);
      const nextSlotResults = { ...slotResults };
      for (const s of result.slots) nextSlotResults[s.key] = s;
      setText(result.text);
      setSlotResults(nextSlotResults);
      reportResult(result.text, nextSlotResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La relance a échoué.");
    } finally {
      setReloadingKey(null);
    }
  }

  async function handleCopy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <div className="flex items-center gap-2">
          {hasProseSlot && (
            <div className="flex items-center gap-1 text-xs text-ink-muted">
              {PROSE_LENGTH_PRESETS.map((length) => (
                <button
                  key={length}
                  type="button"
                  onClick={() => setProseLength(length)}
                  className={`rounded-full border px-2 py-0.5 transition-colors ${
                    proseLength === length ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                  }`}
                >
                  {length} mots
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleDrawAll}
            disabled={drawing}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {drawing ? "Tirage…" : "Tirer"}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {text && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2 rounded-md border border-edge/60 bg-panel-sunken p-2">
            <p className="text-sm text-ink">{text}</p>
            <button
              type="button"
              onClick={handleCopy}
              title="Copier"
              className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
            >
              {copied ? "Copié" : "Copier"}
            </button>
          </div>

          <button type="button" onClick={() => setDetailsOpen((v) => !v)} className="self-start text-xs text-ink-soft hover:underline">
            {detailsOpen ? "▾" : "▸"} Détails des tirages
          </button>

          {detailsOpen && (
            <div className="flex flex-col gap-1 rounded-md border border-edge/40 p-2">
              {data.slots.map((slot) => {
                const result = slotResults[slot.key];
                return (
                  <div key={slot.key} className="flex items-center gap-2 border-b border-edge/30 py-1 text-xs last:border-b-0">
                    <span className="w-32 shrink-0 text-ink-muted">{slot.key}</span>
                    {result?.die && result.rolled !== undefined && (
                      <span className="mech shrink-0 text-ink-muted">
                        {result.die} → {result.rolled}
                      </span>
                    )}
                    <span className="flex-1 text-ink">{result?.text || "—"}</span>
                    <button
                      type="button"
                      onClick={() => handleRerollSlot(slot.key)}
                      disabled={reloadingKey === slot.key}
                      className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
                      title="Relancer cet emplacement"
                    >
                      {reloadingKey === slot.key ? "…" : "↻"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * "Créer la fiche" (V2-J2) : combine les resultats actuellement affiches
 * de toutes les sections DU MEME outil (remontes par `onResult`) et les
 * promeut en une vraie entite via `POST .../mj/generateurs/[toolKey]/promote`
 * — le mecanisme d'ecriture est generique (`promoteToEntity`,
 * src/server/services/promotion.ts), cette carte ne fait qu'assembler ce
 * que le client sait deja. Actif des que la section "nom" a un resultat ;
 * masque entierement si l'outil actif n'est pas configure pour la
 * promotion (`GeneratorToolWindowData.promote` absent).
 */
function PromoteToEntityBar({
  worldSlug,
  toolKey,
  nameSectionKey,
  withCreature,
  results,
}: {
  worldSlug: string;
  toolKey: string;
  nameSectionKey: string;
  withCreature?: boolean;
  results: Record<string, SectionResult>;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ entitySlug: string } | null>(null);
  const [creatureEntryKey, setCreatureEntryKey] = useState("");
  const link = useOpenEntityLink(worldSlug, created?.entitySlug ?? "");

  const ready = Boolean(results[nameSectionKey]?.text.trim());

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/worlds/${worldSlug}/mj/generateurs/${toolKey}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: results, creatureEntryKey: creatureEntryKey.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Impossible de créer la fiche.");
        return;
      }
      setCreated({ entitySlug: body.entitySlug });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-edge/60 pt-3">
      {withCreature && (
        <RuleEntryAutocomplete
          worldSlug={worldSlug}
          entryTypes={["monster"]}
          value={creatureEntryKey}
          onChange={setCreatureEntryKey}
          placeholder="Créature du bestiaire (optionnel)"
          className="w-64"
        />
      )}
      <button
        type="button"
        onClick={handleCreate}
        disabled={!ready || creating}
        title={ready ? undefined : "Tirez d'abord le nom."}
        className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {creating ? "Création…" : "Créer la fiche"}
      </button>
      {created && (
        <Link href={link.href} onClick={link.onClick} className="text-xs text-accent hover:underline">
          Voir la fiche →
        </Link>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/**
 * Outil MJ "Générateurs" (V2-J1 Phase 2) — un onglet par outil disponible
 * (`GENERATOR_TOOLS`, src/core/generators/tools.ts ; Phase 1 : Taverne
 * seule), une carte `GeneratorSectionCard` par section. Chaque section est
 * un bloc `generator` distinct sur l'entite "Générateurs de MJ" du monde
 * (auto-provisionnee, jamais creee par cet outil lui-meme). Les resultats
 * de chaque section remontent ici (V2-J2) pour alimenter "Créer la fiche".
 */
export default function GeneratorToolPanel({ worldSlug, tools }: { worldSlug: string; tools: GeneratorToolWindowData[] }) {
  const [activeKey, setActiveKey] = useState(tools[0]?.key ?? null);
  const activeTool = tools.find((t) => t.key === activeKey) ?? null;
  const [resultsByTool, setResultsByTool] = useState<Record<string, Record<string, SectionResult>>>({});

  if (tools.length === 0) {
    return <p className="text-sm italic text-ink-muted">Aucun outil de génération configuré pour l&apos;instant.</p>;
  }

  function reportSectionResult(toolKey: string, sectionKey: string, result: SectionResult) {
    setResultsByTool((prev) => ({
      ...prev,
      [toolKey]: { ...prev[toolKey], [sectionKey]: result },
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      {tools.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-edge/60 pb-2">
          {tools.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveKey(t.key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                activeKey === t.key ? "border-accent text-accent" : "border-edge text-ink-soft hover:bg-panel-raised"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTool && (
        <div className="flex flex-col gap-3">
          {activeTool.sections.length === 0 ? (
            <p className="text-sm italic text-ink-muted">
              Aucune section configurée pour « {activeTool.label} » — ajoutez du contenu sur la fiche « Générateurs de
              MJ ».
            </p>
          ) : (
            activeTool.sections.map((section) => (
              <GeneratorSectionCard
                key={section.blockId}
                blockId={section.blockId}
                label={section.label}
                data={section.data}
                onResult={(result) => reportSectionResult(activeTool.key, section.key, result)}
              />
            ))
          )}
          {activeTool.promote && (
            <PromoteToEntityBar
              worldSlug={worldSlug}
              toolKey={activeTool.key}
              nameSectionKey={activeTool.promote.nameSectionKey}
              withCreature={activeTool.promote.withCreature}
              results={resultsByTool[activeTool.key] ?? {}}
            />
          )}
        </div>
      )}
    </div>
  );
}
