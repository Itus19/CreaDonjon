"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import Checkbox from "@/components/shared/Checkbox";
import { useEditCommit } from "@/components/shared/EditCommitContext";
import QuestLigne from "@/components/entities/quest/QuestLigne";
import { QUEST_STATES, type QuestBlockData, type QuestNote, type QuestObjective } from "@/src/core/schemas/blocks/quest";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import { objectifsAffiches, teinteEtat, type TeinteEtat } from "@/lib/ui/quete";

const NO_ENTITY = "";

function newId(): string {
  return crypto.randomUUID();
}

/** La pastille d'état choisie : ambre, vert ou rouge selon l'état (jetons de la charte), neutre sinon. */
const PILULE_ACTIVE: Record<TeinteEtat, string> = {
  accent: "border-accent bg-accent/15 text-accent",
  success: "border-success/60 bg-success/15 text-success",
  danger: "border-danger/60 bg-danger/15 text-danger",
  muted: "border-edge-strong bg-panel-raised text-ink",
};

/**
 * Bloc `quest` (V2-H4, refait en V3.1-76 « C ») : une ligne repliée (anneau
 * de progression, état, commanditaire, prochain objectif) que toucher déplie ;
 * dépliée, la pilule d'état à cinq choix, les objectifs à cocher, puis
 * Récompenses et Prérequis côte à côte (l'un sous l'autre dans une fenêtre
 * étroite). L'état replié/déplié est local, jamais enregistré.
 *
 * Mêmes chemins d'écriture qu'avant : l'état, les textes et les fiches liées
 * passent par `onChange` (sauvegarde de la carte) ; cocher un objectif passe
 * par sa route dédiée (`quest-objective`, un fait de partie). La case suit le
 * toucher TOUT DE SUITE (l'anneau et « Prochain » aussi) : la valeur attend la
 * réponse du serveur dans `optimiste`, qui disparaît quand la donnée fraîche
 * arrive. La case n'est jamais désactivée pendant la requête (elle a le focus :
 * le blur sauverait la carte en même temps) ; un second clic est ignoré.
 */
export default function QuestBlockEditor({
  blockId,
  version,
  data,
  otherEntities,
  worldSlug,
  onChange,
  onBlockRefreshed,
}: {
  blockId: string;
  version: number;
  data: QuestBlockData;
  otherEntities: OtherEntityOption[];
  /** Pour le lien vers la fiche du commanditaire ; sans lui, son nom s'écrit sans lien. */
  worldSlug?: string;
  onChange: (data: QuestBlockData) => void;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
}) {
  const t = useTranslations("fiche.quete");
  const commit = useEditCommit();
  const [ouvert, setOuvert] = useState(false);
  const [optimiste, setOptimiste] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const enCoursRef = useRef<Record<string, boolean>>({});

  const objectifs = objectifsAffiches(data.objectives, optimiste);

  async function toggleObjective(objective: QuestObjective) {
    if (enCoursRef.current[objective.id]) return;
    enCoursRef.current[objective.id] = true;
    setError(null);
    const visee = !objective.done;
    setOptimiste((o) => ({ ...o, [objective.id]: visee }));
    try {
      const res = await fetch(`/api/blocks/${blockId}/quest-objective`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, objectiveId: objective.id, done: visee }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? t("erreurObjectif"));
        return;
      }
      onBlockRefreshed((await res.json()) as { id: string; data: unknown; version: number });
    } catch (e) {
      console.error("Objectif de quête non mis à jour", e);
      setError(t("erreurObjectif"));
    } finally {
      enCoursRef.current[objective.id] = false;
      // La donnée fraîche (ou l'ancienne, en cas d'échec) reprend la main.
      setOptimiste((o) => {
        const suite = { ...o };
        delete suite[objective.id];
        return suite;
      });
    }
  }

  function addObjective() {
    onChange({ ...data, objectives: [...data.objectives, { id: newId(), text: "", done: false }] });
  }
  function updateObjective(id: string, patch: Partial<QuestObjective>) {
    onChange({ ...data, objectives: data.objectives.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  }
  function removeObjective(id: string) {
    onChange({ ...data, objectives: data.objectives.filter((o) => o.id !== id) });
  }

  function lienFiche(ref: BlockReference | null | undefined) {
    if (!ref || ref.kind !== "entity") return null;
    const fiche = otherEntities.find((e) => e.id === ref.id);
    if (!fiche) return null;
    if (!worldSlug) return <span>{fiche.name}</span>;
    return (
      <Link href={`/m/${worldSlug}/f/${fiche.slug}`} prefetch={false} className="rich-ref-mention">
        {fiche.name}
      </Link>
    );
  }

  /**
   * Ce a quoi CETTE liste rattache une fiche. Obligatoire, et distinct a chaque
   * appel : ce meme selecteur sert au commanditaire, a chaque objectif et a
   * chaque recompense/prerequis — un meme libelle partout donnerait autant de
   * boutons homonymes qu'il y a de lignes.
   */
  function choixFiche(ref: BlockReference | null | undefined, onRef: (ref: BlockReference | null) => void, ariaLabel: string) {
    const value = ref?.kind === "entity" ? ref.id : NO_ENTITY;
    return (
      <Dropdown
        value={value}
        options={[{ value: NO_ENTITY, label: t("aucuneEntite") }, ...otherEntities.map((e) => ({ value: e.id, label: e.name }))]}
        onChange={(v) => onRef(v === NO_ENTITY ? null : { kind: "entity", id: v })}
        triggerClassName="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink-muted outline-none transition-colors hover:bg-panel-raised"
        aria-label={ariaLabel}
      />
    );
  }

  function noteList(key: "rewards" | "prerequisites", titre: string, ajouterLabel: string) {
    const items = data[key];
    function add() {
      onChange({ ...data, [key]: [...items, { id: newId(), text: "" }] });
    }
    function update(id: string, patch: Partial<QuestNote>) {
      onChange({ ...data, [key]: items.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
    }
    function remove(id: string) {
      onChange({ ...data, [key]: items.filter((n) => n.id !== id) });
    }
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-edge bg-panel-sunken p-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{titre}</span>
        {items.map((note, index) => (
          <div key={note.id} className="flex items-center gap-2">
            <input
              value={note.text}
              onChange={(e) => update(note.id, { text: e.target.value })}
              placeholder="…"
              aria-label={`${titre} ${index + 1}`}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            />
            {choixFiche(
              note.ref,
              (ref) => update(note.id, { ref: ref ?? undefined }),
              // Le texte de la ligne quand il existe : c'est ce qui distingue vraiment deux selecteurs d'une meme liste.
              t("ficheNote", { note: note.text || `${titre} ${index + 1}` })
            )}
            <button type="button" onClick={() => remove(note.id)} aria-label={t("retirer")} className="text-xs text-danger hover:underline">
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={add} aria-label={ajouterLabel} title={ajouterLabel} className="self-start rounded-full border border-edge px-2.5 py-0.5 text-xs text-ink transition-colors hover:bg-panel-raised">
          +
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <QuestLigne
        etat={data.state}
        objectifs={objectifs}
        commanditaire={lienFiche(data.giver)}
        ouvert={ouvert}
        onBascule={() => setOuvert(!ouvert)}
      />

      {ouvert && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div role="group" aria-label={t("etat")} className="flex flex-wrap gap-1">
              {QUEST_STATES.map((etat) => (
                <button
                  key={etat}
                  type="button"
                  aria-pressed={data.state === etat}
                  onClick={() => {
                    onChange({ ...data, state: etat });
                    // L'état s'engage tout de suite, comme le menu d'avant (ADR 0023) : rien ne se perd si l'on quitte la page.
                    commit?.();
                  }}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    data.state === etat ? PILULE_ACTIVE[teinteEtat(etat)] : "border-edge text-ink-muted hover:bg-panel-raised hover:text-ink"
                  }`}
                >
                  {t(`etats.${etat}`)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("commanditaire")}</span>
              {choixFiche(data.giver, (ref) => onChange({ ...data, giver: ref }), t("ficheCommanditaire"))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("objectifs")}</span>
            {objectifs.map((objective, index) => (
              <div key={objective.id} className="flex items-center gap-2">
                <Checkbox
                  checked={objective.done}
                  onChange={() => void toggleObjective(data.objectives[index])}
                  ecritAilleurs
                  aria-label={`${objective.done ? t("marquerNonAtteint") : t("marquerAtteint")} : ${objective.text || t("objectifSansTexte")}`}
                />
                <input
                  value={objective.text}
                  onChange={(e) => updateObjective(objective.id, { text: e.target.value })}
                  placeholder="…"
                  aria-label={t("objectifLabel", { n: index + 1 })}
                  className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${objective.done ? "text-ink-muted line-through" : "text-ink"}`}
                />
                {lienFiche(objective.ref) && <span className="shrink-0 text-xs">{lienFiche(objective.ref)}</span>}
                {choixFiche(
                  objective.ref,
                  (ref) => updateObjective(objective.id, { ref: ref ?? undefined }),
                  t("ficheObjectif", { objectif: objective.text || String(index + 1) })
                )}
                <button type="button" onClick={() => removeObjective(objective.id)} aria-label={t("retirer")} className="text-xs text-danger hover:underline">
                  ×
                </button>
              </div>
            ))}
            {error && <p className="text-xs text-danger">{error}</p>}
            <button
              type="button"
              onClick={addObjective}
              className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
            >
              {t("ajouterObjectif")}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 @xl/bloc:grid-cols-2">
            {noteList("rewards", t("recompenses"), t("ajouterRecompense"))}
            {noteList("prerequisites", t("prerequis"), t("ajouterPrerequis"))}
          </div>
        </div>
      )}
    </div>
  );
}
