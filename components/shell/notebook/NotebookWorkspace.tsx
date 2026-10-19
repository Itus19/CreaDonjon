"use client";

import { useRef, useState } from "react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { RefLinkTarget } from "@/components/entities/richtext/RefLinkPopover";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import type { NotebookWorkspaceData, SharedNoteView } from "@/src/server/services/sharedNotes";
import type { NoteTreeItem } from "@/src/core/schemas/blocks/noteTree";
import type { Segment } from "@/src/core/schemas/entities/segments";
import { pageToSharedLink } from "@/src/core/notebook/share";
import { moveItem, nextSiblingPosition, removeItemAndDescendants, renamePage } from "@/src/core/notebook/tree";
import {
  construireSommaire,
  contientPageSharee,
  notesDeMoi,
  notesDesAutres,
  pageParDefaut,
  visibiliteEnregistrement,
  type LigneSommaire,
} from "@/lib/ui/cahier";
import EmptyState from "../EmptyState";
import { useMatchMedia, WINDOWS_MOBILE_QUERY } from "../useMatchMedia";
import BoutonEpingler from "./BoutonEpingler";
import FicheCompanion, { type CompanionTarget } from "./FicheCompanion";
import PageCahier, { type PageOuverte } from "./PageCahier";
import type { PortePartage } from "./SelecteurPartage";
import SommaireCahier, { LIBELLE_ENREGISTREMENT, type AutreNote, type EtatEnregistrement } from "./SommaireCahier";
import TelephoneCahier, { type OngletTelephone } from "./TelephoneCahier";

const SAVE_DEBOUNCE_MS = 1000;
const GLASS = "rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)]";
const MESSAGE_PARTAGE = "Le partage a échoué.";

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

/** La page ouverte : une ligne du cahier (page ou page partagée à soi), ou la page d'une autre personne. */
type Selection = { kind: "item"; itemId: string } | { kind: "autre"; entityId: string };

function companionKey(target: CompanionTarget): string {
  return target.kind === "entity" ? `entity:${target.slug}` : `rule:${target.key}`;
}

/** Le libellé d'une page partagée dans l'en-tête de la route des blocs : non vide, 100 caractères au plus (schéma du serveur). */
function libelleBloc(titre: string): string {
  return titre.trim().slice(0, 100) || "(sans titre)";
}

/**
 * Cahier de notes (V2.1-2, refait en V3.1-42) : le sommaire arborescent à
 * gauche (« Mon cahier » ou « Mes notes », puis « Partagées à la table »), la
 * page au centre, la fiche citée ou épinglée à droite. Même écran pour le MJ
 * (en fenêtre) et pour une joueuse (en page pleine).
 *
 * Disposition : au-dessus de ~640 px de CONTENEUR (requête de conteneur, pas la
 * largeur de l'écran : un volet partagé prend la même disposition qu'une
 * tablette), les trois colonnes ; en dessous, le sommaire passe en tiroir ☰ et
 * la fiche en panneau par-dessus la page. Sous la largeur d'un téléphone, la
 * liste puis la page en plein écran, et la fiche en feuille du bas.
 *
 * Tout arrive en props (`initial`) : aucun écran « Chargement… » à la première
 * vue. Les gestes de partage rafraîchissent la liste partagée, jamais la page.
 */
export default function NotebookWorkspace({
  worldSlug,
  initial,
  isGm,
  sessionPrepTemplate,
}: {
  worldSlug: string;
  initial: NotebookWorkspaceData;
  /** Affiché depuis la fenêtre MJ : lève les restrictions d'affichage du compagnon (assistance IA, etc.) et propose le modèle "Préparation de séance". */
  isGm?: boolean;
  /** MJ seulement : propose un modèle "Préparation de séance" en plus de "Nouvelle page". */
  sessionPrepTemplate?: boolean;
}) {
  const estMj = Boolean(isGm);
  const titreSection = estMj ? "Mon cahier" : "Mes notes";
  const estTelephone = useMatchMedia(WINDOWS_MOBILE_QUERY);

  const [items, setItems] = useState<NoteTreeItem[]>(initial.items);
  const [notes, setNotes] = useState<SharedNoteView[]>(initial.sharedNotes);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [companion, setCompanion] = useState<CompanionTarget | null>(null);
  const [tiroir, setTiroir] = useState(false);
  const [onglet, setOnglet] = useState<OngletTelephone>("miennes");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [etat, setEtat] = useState<EtatEnregistrement>("idle");
  const [partageEnCours, setPartageEnCours] = useState(false);
  const [erreurPartage, setErreurPartage] = useState<string | null>(null);
  const ruleEntries = useWorldRuleEntries(worldSlug);

  // Les enregistrements lisent l'état LE PLUS RÉCENT au moment où ils partent : des références, pas des états.
  const versionRef = useRef(initial.version);
  const itemsRef = useRef(initial.items);
  const notesRef = useRef(initial.sharedNotes);
  const versionsNotesRef = useRef(new Map(initial.sharedNotes.map((n) => [n.entityId, n.version])));
  const minuteursRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const tachesRef = useRef(new Map<string, () => Promise<void>>());
  const fileRef = useRef<Promise<void>>(Promise.resolve());
  const echecRef = useRef(false);

  // ---- Enregistrement : une tâche par cible (le cahier, ou chaque page partagée), exécutées l'une après l'autre.

  function lancer(cle: string) {
    const minuteur = minuteursRef.current.get(cle);
    if (minuteur) clearTimeout(minuteur);
    minuteursRef.current.delete(cle);
    const tache = tachesRef.current.get(cle);
    if (!tache) return;
    tachesRef.current.delete(cle);
    fileRef.current = fileRef.current.then(tache);
  }

  function planifier(cle: string, tache: () => Promise<void>) {
    tachesRef.current.set(cle, tache);
    const minuteur = minuteursRef.current.get(cle);
    if (minuteur) clearTimeout(minuteur);
    minuteursRef.current.set(
      cle,
      setTimeout(() => lancer(cle), SAVE_DEBOUNCE_MS)
    );
  }

  /** Vide la file. Vrai si tout est parti sans échec : un partage ne se fait pas sur un cahier que le serveur n'a pas reçu. */
  async function toutEnregistrer(): Promise<boolean> {
    for (const cle of [...tachesRef.current.keys()]) lancer(cle);
    await fileRef.current;
    return !echecRef.current;
  }

  async function patchBloc(blockId: string, corps: object): Promise<number> {
    const res = await fetch(`/api/blocks/${blockId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
    if (!res.ok) throw new Error(`Enregistrement refusé (${res.status}).`);
    const bloc = (await res.json()) as { version: number };
    return bloc.version;
  }

  async function enregistrer(ecrire: () => Promise<void>) {
    setEtat("saving");
    try {
      await ecrire();
      echecRef.current = false;
      setEtat("saved");
    } catch (erreur) {
      console.error("Cahier non enregistré", erreur);
      echecRef.current = true;
      setEtat("error");
    }
  }

  function persist(next: NoteTreeItem[]) {
    itemsRef.current = next;
    setItems(next);
    planifier("cahier", () =>
      enregistrer(async () => {
        versionRef.current = await patchBloc(initial.blockId, {
          version: versionRef.current,
          display: { label: "Cahier", layout: "prose" },
          data: { __v: 1, items: next },
          visibility: { level: "user", scopeId: initial.userId },
        });
      })
    );
  }

  /** Écrit SA page partagée par la route des blocs, sous la visibilité que dit son état de partage (jamais une autre). */
  function majNote(entityId: string, patch: Partial<Pick<SharedNoteView, "title" | "segments">>) {
    const courante = notesRef.current.find((n) => n.entityId === entityId && n.authorId === initial.userId);
    if (!courante) return;
    const suivante = { ...courante, ...patch };
    notesRef.current = notesRef.current.map((n) => (n.entityId === entityId ? suivante : n));
    setNotes(notesRef.current);
    planifier(entityId, () =>
      enregistrer(async () => {
        const version = await patchBloc(suivante.blockId, {
          version: versionsNotesRef.current.get(entityId) ?? suivante.version,
          display: { label: libelleBloc(suivante.title), layout: "prose" },
          data: { __v: 1, segments: suivante.segments, dropCap: false },
          visibility: visibiliteEnregistrement(suivante.shared, initial.userId),
        });
        versionsNotesRef.current.set(entityId, version);
      })
    );
  }

  // ---- Partage : relit la liste partagée (jamais la page entière) après chaque geste.

  async function rafraichirNotes() {
    const res = await fetch(`/api/worlds/${worldSlug}/notes/shared`);
    if (!res.ok) throw new Error(MESSAGE_PARTAGE);
    const { notes: fraiches } = (await res.json()) as { notes: SharedNoteView[] };
    notesRef.current = fraiches;
    versionsNotesRef.current = new Map(fraiches.map((n) => [n.entityId, n.version]));
    setNotes(fraiches);
  }

  async function changerPartage(itemId: string, partager: boolean) {
    setPartageEnCours(true);
    setErreurPartage(null);
    try {
      if (!(await toutEnregistrer())) throw new Error("Le cahier n'a pas pu être enregistré : le partage est annulé.");
      const res = await fetch(`/api/worlds/${worldSlug}/notes/${partager ? "share" : "unshare"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        const corps = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(corps?.error ?? MESSAGE_PARTAGE);
      }
      const item = itemsRef.current.find((i) => i.id === itemId);
      if (partager && item?.kind === "page") {
        // La page devient un lien à la même place ; le serveur a changé la version du cahier, on la relit (une seule fois, sur geste).
        const { entityId } = (await res.json()) as { entityId: string };
        const cahier = await fetch(`/api/worlds/${worldSlug}/notes`);
        if (!cahier.ok) throw new Error(MESSAGE_PARTAGE);
        versionRef.current = ((await cahier.json()) as { version: number }).version;
        const lie = pageToSharedLink(itemsRef.current, itemId, entityId);
        if (lie) {
          itemsRef.current = lie;
          setItems(lie);
        }
      }
      await rafraichirNotes();
    } catch (erreur) {
      setErreurPartage(erreur instanceof Error ? erreur.message : MESSAGE_PARTAGE);
    } finally {
      setPartageEnCours(false);
    }
  }

  // ---- Gestes sur le cahier.

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
    setSelection({ kind: "item", itemId: id });
    setTiroir(false);
  }

  function addPin(target: RefLinkTarget) {
    const id = newId();
    const pin: NoteTreeItem =
      target.kind === "entity"
        ? { id, parentId: null, position: nextSiblingPosition(items, null), kind: "pinned_entity", targetId: target.id! }
        : { id, parentId: null, position: nextSiblingPosition(items, null), kind: "pinned_rule", targetKey: target.key! };
    persist([...items, pin]);
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
    // Garde-fou : retirer une page partagée du cahier la laisserait lisible de la table, sans plus aucun moyen de la reprendre.
    if (contientPageSharee(items, id)) {
      setPendingDeleteId(null);
      return;
    }
    const next = removeItemAndDescendants(items, id);
    persist(next);
    if (selection?.kind === "item" && !next.some((i) => i.id === selection.itemId)) setSelection(null);
    setPendingDeleteId(null);
  }

  // ---- Données dérivées du rendu.

  const mesNotes = notesDeMoi(notes, initial.userId);
  const lignes = construireSommaire(items, {
    notes: mesNotes,
    nomFiche: (id) => initial.otherEntities.find((e) => e.id === id)?.name ?? null,
    nomRegle: (key) => ruleEntries.find((r) => r.key === key)?.name ?? null,
  });
  const autres: AutreNote[] = notesDesAutres(notes, initial.userId).map((n) => ({ entityId: n.entityId, titre: n.title, autrice: n.authorName }));
  const protegees = new Set(lignes.filter((l) => contientPageSharee(items, l.itemId)).map((l) => l.itemId));

  function pageDe(sel: Selection): PageOuverte | null {
    if (sel.kind === "autre") {
      const note = notesDesAutres(notes, initial.userId).find((n) => n.entityId === sel.entityId);
      return note ? { mode: "autre", cle: `autre:${note.entityId}`, fil: "Partagées à la table", titre: note.title, segments: note.segments, autrice: note.authorName } : null;
    }
    const item = items.find((i) => i.id === sel.itemId);
    if (!item) return null;
    const fil = (item.parentId ? lignes.find((l) => l.itemId === item.parentId)?.libelle : null) ?? titreSection;
    if (item.kind === "page") {
      return { mode: "page", cle: item.id, itemId: item.id, fil, titre: item.title, segments: item.content, peutSupprimer: !protegees.has(item.id) };
    }
    if (item.kind === "shared_page") {
      const note = mesNotes.find((n) => n.entityId === item.targetId);
      return note ? { mode: "partagee", cle: item.id, itemId: item.id, fil, titre: note.title, segments: note.segments, partagee: note.shared } : null;
    }
    return null;
  }

  // Sur téléphone, rien n'est ouvert d'office : on arrive sur la liste. Ailleurs, la première page.
  const parDefaut = pageParDefaut(items);
  const selectionAffichee: Selection | null = selection ?? (estTelephone || !parDefaut ? null : { kind: "item", itemId: parDefaut });
  const pageOuverte = (selectionAffichee && pageDe(selectionAffichee)) ?? (!estTelephone && parDefaut ? pageDe({ kind: "item", itemId: parDefaut }) : null);

  const lignesActives = new Set<string>();
  if (pageOuverte && pageOuverte.mode !== "autre") lignesActives.add(pageOuverte.itemId);
  for (const ligne of lignes) {
    const item = items.find((i) => i.id === ligne.itemId);
    if (!companion || !item) continue;
    if (item.kind === "pinned_entity" && companion.kind === "entity" && initial.otherEntities.find((e) => e.id === item.targetId)?.slug === companion.slug) lignesActives.add(ligne.itemId);
    if (item.kind === "pinned_rule" && companion.kind === "rule" && item.targetKey === companion.key) lignesActives.add(ligne.itemId);
  }

  // ---- Gestes de l'écran.

  function ouvrirLigne(ligne: LigneSommaire) {
    if (ligne.cassee) return;
    const item = items.find((i) => i.id === ligne.itemId);
    if (!item) return;
    if (item.kind === "page" || item.kind === "shared_page") {
      setSelection({ kind: "item", itemId: item.id });
      setTiroir(false);
    } else if (item.kind === "pinned_entity") {
      const slug = initial.otherEntities.find((e) => e.id === item.targetId)?.slug;
      if (slug) setCompanion({ kind: "entity", slug });
    } else {
      setCompanion({ kind: "rule", key: item.targetKey });
    }
  }

  function ouvrirAutre(entityId: string) {
    setSelection({ kind: "autre", entityId });
    setTiroir(false);
  }

  function changerContenu(page: PageOuverte, segments: Segment[]) {
    if (page.mode === "page") persist(itemsRef.current.map((i) => (i.id === page.itemId && i.kind === "page" ? { ...i, content: segments } : i)));
    else if (page.mode === "partagee") {
      const item = itemsRef.current.find((i) => i.id === page.itemId);
      if (item?.kind === "shared_page") majNote(item.targetId, { segments });
    }
  }

  function changerTitre(page: PageOuverte, titre: string) {
    if (page.mode === "page") persist(renamePage(itemsRef.current, page.itemId, titre));
    else if (page.mode === "partagee") {
      const item = itemsRef.current.find((i) => i.id === page.itemId);
      if (item?.kind === "shared_page") majNote(item.targetId, { title: titre });
    }
  }

  function partager(page: PageOuverte, valeur: PortePartage) {
    if (page.mode === "autre") return;
    void changerPartage(page.itemId, valeur === "table");
  }

  const epingleur = <BoutonEpingler worldSlug={worldSlug} otherEntities={initial.otherEntities} libelle="Épingler une fiche ou une règle" onEpingler={addPin} />;
  const preparation = sessionPrepTemplate ? () => addPage(sessionPrepContent(initial.userId)) : undefined;

  const pageNode = pageOuverte ? (
    <PageCahier
      page={pageOuverte}
      estMj={estMj}
      worldSlug={worldSlug}
      worldId={initial.worldId}
      otherEntities={initial.otherEntities}
      occupe={partageEnCours}
      erreur={erreurPartage}
      onTitre={(titre) => changerTitre(pageOuverte, titre)}
      onContenu={(segments) => changerContenu(pageOuverte, segments)}
      onPartage={(valeur) => partager(pageOuverte, valeur)}
      onSupprimer={() => pageOuverte.mode === "page" && setPendingDeleteId(pageOuverte.itemId)}
      onOuvrirFiche={(slug) => setCompanion({ kind: "entity", slug })}
      onOuvrirRegle={(key) => setCompanion({ kind: "rule", key })}
    />
  ) : null;

  const ficheNode = companion ? (
    <FicheCompanion key={companionKey(companion)} worldSlug={worldSlug} target={companion} isGm={isGm} dansFeuille={estTelephone} onClose={() => setCompanion(null)} />
  ) : null;

  const dialogue = (
    <ConfirmDialog
      open={pendingDeleteId !== null}
      title="Supprimer cet élément ?"
      message="Cet élément (et ses sous-éléments) seront définitivement supprimés du cahier."
      confirmLabel="Supprimer"
      danger
      onConfirm={() => pendingDeleteId && remove(pendingDeleteId)}
      onCancel={() => setPendingDeleteId(null)}
    />
  );

  if (estTelephone) {
    return (
      <>
        <TelephoneCahier
          estMj={estMj}
          titreSection={titreSection}
          lignes={lignes}
          autres={autres}
          etat={etat}
          enPage={pageOuverte !== null}
          titrePage={pageOuverte?.titre ?? ""}
          page={pageNode}
          fiche={ficheNode}
          titreFiche={companion?.kind === "rule" ? "Règle citée" : "Fiche citée"}
          onglet={onglet}
          epingleur={epingleur}
          onOnglet={setOnglet}
          onOuvrirLigne={ouvrirLigne}
          onOuvrirAutre={ouvrirAutre}
          onRetour={() => setSelection(null)}
          onFermerFiche={() => setCompanion(null)}
          onNouvellePage={() => addPage()}
          onPreparation={preparation}
        />
        {dialogue}
      </>
    );
  }

  return (
    // `@container` : tablette ou ordinateur selon la largeur de CETTE zone, pas celle de l'écran (un volet partagé prend la disposition de tablette).
    <div className="@container relative flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between @2xl:hidden">
        <button
          type="button"
          aria-expanded={tiroir}
          onClick={() => setTiroir((v) => !v)}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          ☰ Sommaire
        </button>
        <span role="status" className="text-xs text-ink-muted">
          {LIBELLE_ENREGISTREMENT[etat]}
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 gap-3">
        {tiroir && <div aria-hidden="true" onClick={() => setTiroir(false)} className="absolute inset-0 z-10 rounded-[18px] bg-scrim @2xl:hidden" />}
        <aside
          className={`${GLASS} ${
            tiroir ? "absolute inset-y-0 left-0 z-20 flex w-64 max-w-[85%] bg-panel-raised shadow-lg" : "hidden"
          } shrink-0 @2xl:static @2xl:z-auto @2xl:flex @2xl:w-60 @2xl:max-w-none @2xl:bg-panel @2xl:shadow-none`}
        >
          <div className="min-w-0 flex-1">
            <SommaireCahier
              titreSection={titreSection}
              lignes={lignes}
              autres={autres}
              lignesActives={lignesActives}
              autreActive={pageOuverte?.mode === "autre" ? pageOuverte.cle.slice("autre:".length) : null}
              etat={etat}
              protegees={protegees}
              epingleur={epingleur}
              onOuvrirLigne={ouvrirLigne}
              onOuvrirAutre={ouvrirAutre}
              onDeplacer={move}
              onImbriquer={indent}
              onDesimbriquer={outdent}
              onSupprimer={setPendingDeleteId}
              onNouvellePage={() => addPage()}
              onPreparation={preparation}
            />
          </div>
        </aside>

        <section className={`${GLASS} min-w-0 flex-1 p-4`}>
          {pageNode ?? (
            <EmptyState
              title="Aucune page ouverte"
              description="Choisissez une page dans le sommaire, ou commencez-en une."
              action={
                <button type="button" onClick={() => addPage()} className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover">
                  + Nouvelle page
                </button>
              }
            />
          )}
        </section>

        {ficheNode && (
          <aside
            className={`${GLASS} absolute inset-y-0 right-0 z-20 flex w-[min(100%,26rem)] flex-col overflow-hidden bg-panel-raised shadow-lg @2xl:static @2xl:z-auto @2xl:w-[22rem] @2xl:shrink-0 @2xl:bg-panel @2xl:shadow-none`}
          >
            {ficheNode}
          </aside>
        )}
      </div>
      {dialogue}
    </div>
  );
}
