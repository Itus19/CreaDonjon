"use client";

import { useRef, useState } from "react";
import RichTextEditor from "@/components/entities/richtext/RichTextEditor";
import RefLinkPopover, { type RefLinkTarget } from "@/components/entities/richtext/RefLinkPopover";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import type { NotebookData } from "@/src/server/services/notebook";
import type { NoteTreeItem } from "@/src/core/schemas/blocks/noteTree";
import type { Segment } from "@/src/core/schemas/entities/segments";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
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
 * Un panneau de page (titre + éditeur) — composant à part plutôt qu'une
 * simple fonction appelée pendant le rendu : `react-hooks/refs` refuse
 * qu'une fermeture créée à l'intérieur d'une fonction invoquée pendant le
 * rendu capture `rename`/`onChangeContent` (qui lisent `versionRef`/
 * `saveTimeoutRef` au moment de l'appel) — un vrai composant, où ces
 * fonctions arrivent en props, ne déclenche pas cette règle.
 */
function NotePagePane({
  page,
  worldSlug,
  worldId,
  otherEntities,
  onRename,
  onChangeContent,
  onClose,
}: {
  page: Extract<NoteTreeItem, { kind: "page" }>;
  worldSlug: string;
  worldId: string;
  otherEntities: OtherEntityOption[];
  onRename: (id: string, title: string) => void;
  onChangeContent: (id: string, segments: Segment[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-edge/60 pb-1">
        <input
          value={page.title}
          onChange={(e) => onRename(page.id, e.target.value)}
          placeholder="Titre de la page"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
        />
        <button type="button" onClick={onClose} title="Fermer" aria-label="Fermer" className="shrink-0 rounded px-1.5 py-0.5 text-sm text-ink-muted hover:bg-panel-raised hover:text-ink">
          ×
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pt-2">
        <RichTextEditor
          segments={page.content}
          onChange={(segments) => onChangeContent(page.id, segments)}
          worldSlug={worldSlug}
          worldId={worldId}
          otherEntities={otherEntities}
        />
      </div>
    </div>
  );
}

/** Contenu du second panneau — une fiche/règle épinglée (comme avant) ou une autre page du même cahier (retour utilisateur : "ouvrir deux pages de ses propres notes"). */
type SecondaryContent = { kind: "companion"; target: CompanionTarget } | { kind: "page"; pageId: string };

function companionKey(target: CompanionTarget): string {
  return target.kind === "entity" ? `entity:${target.slug}` : `rule:${target.key}`;
}

/**
 * Cahier de notes (V2.1-2, piste "un seul compagnon") — arbre à gauche, deux
 * panneaux de contenu à droite, partagés à parts égales (retour
 * utilisateur : "vraiment à la moitié"). Le panneau principal montre
 * toujours une page du cahier ; le second montre soit une fiche/règle
 * épinglée, soit une AUTRE page du même cahier — chacun se ferme
 * indépendamment (le survivant reprend alors toute la largeur). Même
 * disposition pour le MJ et pour une joueuse.
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
  const [primaryPageId, setPrimaryPageId] = useState<string | null>(() => siblingsOf(initial.items, null).find((i) => i.kind === "page")?.id ?? null);
  const [secondary, setSecondary] = useState<SecondaryContent | null>(null);
  const [pinPopoverOpen, setPinPopoverOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
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
    setPrimaryPageId(id);
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
    const next = removeItemAndDescendants(items, id);
    persist(next);
    if (primaryPageId && !next.some((i) => i.id === primaryPageId)) setPrimaryPageId(null);
    if (secondary?.kind === "page" && !next.some((i) => i.id === secondary.pageId)) setSecondary(null);
    setPendingDeleteId(null);
  }

  function rename(id: string, title: string) {
    persist(renamePage(items, id, title));
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
    const isOpen =
      (isPage && (primaryPageId === item.id || (secondary?.kind === "page" && secondary.pageId === item.id))) ||
      (!isPage &&
        secondary?.kind === "companion" &&
        ((item.kind === "pinned_entity" && secondary.target.kind === "entity" && initial.otherEntities.find((e) => e.id === item.targetId)?.slug === secondary.target.slug) ||
          (item.kind === "pinned_rule" && secondary.target.kind === "rule" && item.targetKey === secondary.target.key)));

    return (
      <div key={item.id}>
        <div
          className={`group flex items-center gap-1 rounded px-1.5 py-1 text-xs ${isOpen ? "bg-panel-raised text-ink" : "text-ink-soft hover:bg-panel-raised/60"}`}
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          <button
            type="button"
            onClick={() =>
              isPage
                ? setPrimaryPageId(item.id)
                : broken
                  ? undefined
                  : setSecondary({
                      kind: "companion",
                      target: item.kind === "pinned_entity" ? { kind: "entity", slug: initial.otherEntities.find((e) => e.id === item.targetId)!.slug } : { kind: "rule", key: item.targetKey },
                    })
            }
            className={`flex-1 truncate text-left ${!isPage ? "rounded bg-accent/10 px-1 text-accent" : ""} ${broken ? "rich-ref-broken bg-transparent px-0 text-danger" : ""}`}
            title={broken ? "Lien brisé" : undefined}
          >
            {isPage ? item.title || "(sans titre)" : (label ?? "Lien brisé")}
          </button>
          <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
            {isPage && (
              <button
                type="button"
                onClick={() => setSecondary({ kind: "page", pageId: item.id })}
                title="Ouvrir dans le second panneau"
                className="px-1 text-ink-muted hover:text-ink"
              >
                ⇒
              </button>
            )}
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

  function changePageContent(id: string, segments: Segment[]) {
    persist(items.map((i) => (i.id === id ? { ...i, content: segments } : i)));
  }

  const primaryPage = items.find((i) => i.id === primaryPageId);
  const secondaryPage = secondary?.kind === "page" ? items.find((i) => i.id === secondary.pageId) : undefined;

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

      <div className="flex min-w-0 flex-1 gap-3">
        {primaryPage?.kind === "page" ? (
          <div className="min-w-0 flex-1">
            <NotePagePane
              page={primaryPage}
              worldSlug={worldSlug}
              worldId={initial.worldId}
              otherEntities={initial.otherEntities}
              onRename={rename}
              onChangeContent={changePageContent}
              onClose={() => setPrimaryPageId(null)}
            />
          </div>
        ) : (
          !secondary && <p className="min-w-0 flex-1 p-4 text-sm italic text-ink-muted">Sélectionnez ou créez une page.</p>
        )}

        {secondary && (
          <div className={`min-w-0 flex-1 ${primaryPage?.kind === "page" ? "border-l border-edge/60 pl-3" : ""}`}>
            {secondary.kind === "page" ? (
              secondaryPage?.kind === "page" ? (
                <NotePagePane
                  page={secondaryPage}
                  worldSlug={worldSlug}
                  worldId={initial.worldId}
                  otherEntities={initial.otherEntities}
                  onRename={rename}
                  onChangeContent={changePageContent}
                  onClose={() => setSecondary(null)}
                />
              ) : null
            ) : (
              <FicheCompanion
                key={companionKey(secondary.target)}
                worldSlug={worldSlug}
                target={secondary.target}
                isGm={isGm}
                onClose={() => setSecondary(null)}
              />
            )}
          </div>
        )}
      </div>

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
