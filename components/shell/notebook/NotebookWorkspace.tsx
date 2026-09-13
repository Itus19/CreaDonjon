"use client";

import { useRef, useState } from "react";
import RichTextEditor from "@/components/entities/richtext/RichTextEditor";
import RefLinkPopover, { type RefLinkTarget } from "@/components/entities/richtext/RefLinkPopover";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import type { NotebookData } from "@/src/server/services/notebook";
import type { NoteTreeItem } from "@/src/core/schemas/blocks/noteTree";
import { moveItem, nextSiblingPosition, removeItemAndDescendants, renamePage } from "@/src/core/notebook/tree";
import FicheCompanion, { type CompanionTarget } from "./FicheCompanion";

const SAVE_DEBOUNCE_MS = 1000;

function newId(): string {
  return crypto.randomUUID();
}

const SESSION_PREP_SECTIONS = ["Accroche", "PNJ prévus", "Rencontre", "Complications"];

function sessionPrepContent(userId: string) {
  return SESSION_PREP_SECTIONS.map((label) => ({
    id: newId(),
    blockType: "paragraph" as const,
    visibility: { level: "user" as const, scopeId: userId },
    content: [{ t: "text" as const, v: label + " — ", marks: ["bold" as const] }, { t: "text" as const, v: "" }],
    align: "left" as const,
  }));
}

function siblingsOf(items: NoteTreeItem[], parentId: string | null): NoteTreeItem[] {
  return items.filter((i) => i.parentId === parentId).sort((a, b) => a.position - b.position);
}

/**
 * Cahier de notes (V2.1-2, piste "un seul compagnon") — arbre de pages et de
 * fiches épinglées à gauche, page sélectionnée à droite, compagnon dans un
 * panneau fixe à droite. Même disposition pour le MJ et pour une joueuse
 * (retour utilisateur : copier celle de la coquille joueur côté MJ plutôt
 * que la fenêtre flottante séparée utilisée au premier passage) — l'outil
 * "Bloc-notes" reste une fenêtre du bureau côté MJ, mais son compagnon
 * s'ouvre désormais À L'INTÉRIEUR de cette fenêtre, jamais dans une seconde.
 */
export default function NotebookWorkspace({
  worldSlug,
  initial,
  isGm,
  sessionPrepTemplate,
}: {
  worldSlug: string;
  initial: NotebookData;
  /** Affiché depuis la fenêtre MJ : lève les restrictions d'affichage du compagnon (assistance IA, etc.) et propose le modèle "Préparation de séance". */
  isGm?: boolean;
  /** MJ seulement : propose un modèle "Préparation de séance" en plus de "Nouvelle page". */
  sessionPrepTemplate?: boolean;
}) {
  const [items, setItems] = useState<NoteTreeItem[]>(initial.items);
  const [selectedId, setSelectedId] = useState<string | null>(() => siblingsOf(initial.items, null).find((i) => i.kind === "page")?.id ?? null);
  const [pinPopoverOpen, setPinPopoverOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [companion, setCompanion] = useState<CompanionTarget | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const versionRef = useRef(initial.version);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ruleEntries = useWorldRuleEntries(worldSlug);

  function persist(next: NoteTreeItem[]) {
    setItems(next);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus("saving");
      fetch(`/api/blocks/${initial.blockId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: versionRef.current,
          display: { label: "Cahier", layout: "prose" },
          data: { __v: 1, items: next },
          visibility: { level: "user", scopeId: initial.userId },
        }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
        .then((block: { version: number }) => {
          versionRef.current = block.version;
          setSaveStatus("saved");
        })
        .catch(() => setSaveStatus("error"));
    }, SAVE_DEBOUNCE_MS);
  }

  function addPage(content?: ReturnType<typeof sessionPrepContent>) {
    const id = newId();
    const page: NoteTreeItem = {
      id,
      parentId: null,
      position: nextSiblingPosition(items, null),
      kind: "page",
      title: content ? "Préparation de séance" : "Nouvelle page",
      content: content ?? [],
    };
    persist([...items, page]);
    setSelectedId(id);
  }

  function addPin(target: RefLinkTarget) {
    const id = newId();
    const pin: NoteTreeItem =
      target.kind === "entity"
        ? { id, parentId: null, position: nextSiblingPosition(items, null), kind: "pinned_entity", targetId: target.id! }
        : { id, parentId: null, position: nextSiblingPosition(items, null), kind: "pinned_rule", targetKey: target.key! };
    persist([...items, pin]);
    setPinPopoverOpen(false);
  }

  function move(id: string, direction: -1 | 1) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const siblings = siblingsOf(items, item.parentId);
    const index = siblings.findIndex((i) => i.id === id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    persist(moveItem(items, id, item.parentId, targetIndex));
  }

  function indent(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const siblings = siblingsOf(items, item.parentId);
    const index = siblings.findIndex((i) => i.id === id);
    const previousSibling = siblings[index - 1];
    if (!previousSibling) return;
    const newParentChildrenCount = siblingsOf(items, previousSibling.id).length;
    persist(moveItem(items, id, previousSibling.id, newParentChildrenCount));
  }

  function outdent(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || item.parentId === null) return;
    const parent = items.find((i) => i.id === item.parentId);
    const grandparentId = parent?.parentId ?? null;
    const targetIndex = siblingsOf(items, grandparentId).findIndex((i) => i.id === parent?.id) + 1;
    persist(moveItem(items, id, grandparentId, targetIndex));
  }

  function remove(id: string) {
    persist(removeItemAndDescendants(items, id));
    if (selectedId === id) setSelectedId(null);
    setPendingDeleteId(null);
  }

  function rename(id: string, title: string) {
    persist(renamePage(items, id, title));
  }

  function openCompanion(target: CompanionTarget) {
    setCompanion(target);
  }

  function renderRow(item: NoteTreeItem, depth: number) {
    const children = siblingsOf(items, item.id);
    const isPage = item.kind === "page";
    const label =
      item.kind === "page"
        ? item.title
        : item.kind === "pinned_entity"
          ? (initial.otherEntities.find((e) => e.id === item.targetId)?.name ?? null)
          : (ruleEntries.find((r) => r.key === item.targetKey)?.name ?? null);
    const broken = !isPage && label === null;

    return (
      <div key={item.id}>
        <div
          className={`group flex items-center gap-1 rounded px-1.5 py-1 text-xs ${selectedId === item.id ? "bg-panel-raised text-ink" : "text-ink-soft hover:bg-panel-raised/60"}`}
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          <button
            type="button"
            onClick={() => (isPage ? setSelectedId(item.id) : broken ? undefined : openCompanion(item.kind === "pinned_entity" ? { kind: "entity", slug: initial.otherEntities.find((e) => e.id === item.targetId)!.slug } : { kind: "rule", key: item.targetKey }))}
            className={`flex-1 truncate text-left ${!isPage ? "rounded bg-accent/10 px-1 text-accent" : ""} ${broken ? "rich-ref-broken bg-transparent px-0 text-danger" : ""}`}
            title={broken ? "Lien brisé" : undefined}
          >
            {isPage ? item.title || "(sans titre)" : (label ?? "Lien brisé")}
          </button>
          <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
            <button type="button" onClick={() => move(item.id, -1)} title="Monter" className="px-1 text-ink-muted hover:text-ink">
              ▲
            </button>
            <button type="button" onClick={() => move(item.id, 1)} title="Descendre" className="px-1 text-ink-muted hover:text-ink">
              ▼
            </button>
            <button type="button" onClick={() => outdent(item.id)} title="Désimbriquer" className="px-1 text-ink-muted hover:text-ink" disabled={item.parentId === null}>
              ←
            </button>
            <button type="button" onClick={() => indent(item.id)} title="Imbriquer sous le précédent" className="px-1 text-ink-muted hover:text-ink">
              →
            </button>
            <button type="button" onClick={() => setPendingDeleteId(item.id)} title="Supprimer" className="px-1 text-ink-muted hover:text-danger">
              ×
            </button>
          </span>
        </div>
        {children.map((child) => renderRow(child, depth + 1))}
      </div>
    );
  }

  const selected = items.find((i) => i.id === selectedId);
  const selectedPage = selected?.kind === "page" ? selected : null;

  return (
    <div className="flex h-full min-h-0 gap-3">
      <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r border-edge/60 pr-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Mon cahier</span>
          <span className="text-[10px] text-ink-muted">
            {saveStatus === "saving" && "Enregistrement…"}
            {saveStatus === "saved" && "Enregistré"}
            {saveStatus === "error" && "Échec"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">{siblingsOf(items, null).map((item) => renderRow(item, 0))}</div>
        <div className="mt-2 flex flex-col gap-1 border-t border-edge/60 pt-2">
          <button type="button" onClick={() => addPage()} className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink hover:bg-panel-raised">
            + Nouvelle page
          </button>
          {sessionPrepTemplate && (
            <button
              type="button"
              onClick={() => addPage(sessionPrepContent(initial.userId))}
              className="rounded-full border border-edge px-2.5 py-1 text-xs text-ink hover:bg-panel-raised"
            >
              + Modèle : Préparation de séance
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPinPopoverOpen((v) => !v)}
              className="w-full rounded-full border border-edge px-2.5 py-1 text-xs text-ink hover:bg-panel-raised"
            >
              + Épingler une fiche existante
            </button>
            {pinPopoverOpen && (
              <RefLinkPopover worldSlug={worldSlug} otherEntities={initial.otherEntities} onSelect={addPin} onClose={() => setPinPopoverOpen(false)} />
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {selectedPage ? (
          <div className="flex flex-col gap-2">
            <input
              value={selectedPage.title}
              onChange={(e) => rename(selectedPage.id, e.target.value)}
              placeholder="Titre de la page"
              className="w-full border-b border-edge bg-transparent pb-1 text-sm font-semibold text-ink outline-none"
            />
            <RichTextEditor
              segments={selectedPage.content}
              onChange={(segments) => persist(items.map((i) => (i.id === selectedPage.id ? { ...i, content: segments } : i)))}
              worldSlug={worldSlug}
              worldId={initial.worldId}
              otherEntities={initial.otherEntities}
            />
          </div>
        ) : (
          <p className="p-4 text-sm italic text-ink-muted">Sélectionnez ou créez une page.</p>
        )}
      </div>

      {companion && (
        <div className="w-[min(40%,420px)] shrink-0 border-l border-edge/60">
          <FicheCompanion
            key={companion.kind === "entity" ? `entity:${companion.slug}` : `rule:${companion.key}`}
            worldSlug={worldSlug}
            target={companion}
            isGm={isGm}
            onClose={() => setCompanion(null)}
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Supprimer cet élément ?"
        message="Cette page (et ses sous-pages) seront définitivement supprimées du cahier."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => pendingDeleteId && remove(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
