"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Dropdown from "@/components/shared/Dropdown";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import {
  BLOCK_TYPE_LABELS,
  BarreAjoutBloc,
  BlockDataEditor,
  creerBloc,
  type BlockItem,
} from "@/components/blocks/EntityBlocks";
import { CUSTOM_KIND_OPTION, PJ_VALUE, PNJ_VALUE, optionsTypeFiche } from "@/components/entities/optionsTypeFiche";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import {
  aDesChangements,
  changementsAEnvoyer,
  deplacer,
  deplacerVers,
  estDepliable,
  resumeBloc,
  type IdentiteBrouillon,
} from "@/lib/ui/editeurPlein";

/** Ce que l'éditeur rend à la fiche en se fermant. */
export interface ResultatEditeur {
  /** Les blocs tels qu'ils sont en base maintenant, dans l'ordre d'affichage (même sans enregistrement : un bloc créé ou une sous-écriture a pu avoir lieu). */
  blocks: BlockItem[];
  /** `true` quand « Enregistrer » est allé au bout. */
  enregistre: boolean;
  /** Identité à jour et version d'entité à jour (celles de l'écriture, ou les initiales). */
  identite: IdentiteBrouillon;
  version: number;
}

function trierParOrdre(blocs: readonly BlockItem[]): BlockItem[] {
  return [...blocs].sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * V3.1-31 — éditeur plein écran en accordéon (téléphone).
 *
 * Tient un BROUILLON (identité + blocs) ; rien n'est écrit avant
 * « Enregistrer », qui envoie l'identité (si elle a changé) puis tous les blocs
 * changés en une seule écriture (`PATCH /api/entities/[id]/blocks`, ADR 0065).
 * Les éditeurs de blocs sont ceux de la fiche, réutilisés tels quels
 * (`BlockDataEditor` : donnée / `onChange`).
 *
 * Il ne charge rien de plus que la page (docs/CABLAGE.md) : les blocs lui sont
 * donnés ; seuls les éditeurs de blocs font les lectures qui leur sont propres.
 */
export default function EditeurPleinEcran({
  entityId,
  entityVersion,
  identiteInitiale,
  worldSlug,
  worldId,
  campaignId,
  campaignCharacterUserId,
  worldCustomKinds,
  otherEntities,
  blocsInitiaux,
  restrictAddableTypes,
  hideAiAssist,
  onClose,
}: {
  entityId: string;
  entityVersion: number;
  identiteInitiale: IdentiteBrouillon;
  worldSlug: string;
  worldId: string;
  campaignId: string | null;
  campaignCharacterUserId: string | null;
  worldCustomKinds: string[];
  otherEntities: OtherEntityOption[];
  /** Les blocs que la page a reçus (filtrés par visibilité côté serveur), à l'état courant. */
  blocsInitiaux: BlockItem[];
  restrictAddableTypes?: string[];
  hideAiAssist?: boolean;
  onClose: (resultat: ResultatEditeur) => void;
}) {
  // Ce qui est en base (identité, blocs) : avance avec les écritures faites
  // pendant l'édition (bloc créé, sous-écriture, identité déjà enregistrée).
  const [identiteBase, setIdentiteBase] = useState<IdentiteBrouillon>(identiteInitiale);
  const [versionEntite, setVersionEntite] = useState(entityVersion);
  const [blocsBase, setBlocsBase] = useState<BlockItem[]>(() => trierParOrdre(blocsInitiaux));
  const [identite, setIdentite] = useState<IdentiteBrouillon>(identiteInitiale);
  const [brouillon, setBrouillon] = useState<BlockItem[]>(() => trierParOrdre(blocsInitiaux));
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [nouvelAlias, setNouvelAlias] = useState("");
  const [categorieSaisie, setCategorieSaisie] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmeAnnuler, setConfirmeAnnuler] = useState(false);
  const [annonce, setAnnonce] = useState("");
  const [glisseId, setGlisseId] = useState<string | null>(null);
  const lignesRef = useRef<Map<string, HTMLElement>>(new Map());

  // Le document ne défile pas derrière la couche.
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  const modifie = aDesChangements(blocsBase, brouillon, identiteBase, identite);
  const nombreChangements = changementsAEnvoyer(blocsBase, brouillon).length;

  function patchBrouillon(id: string, patch: Partial<BlockItem>) {
    setBrouillon((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  /**
   * Une sous-écriture d'un éditeur (objectif de quête, événement de
   * personnalité, proposition IA appliquée…) a déjà écrit le bloc côté
   * serveur et renvoie sa donnée ET sa nouvelle version : le brouillon ET le
   * point de départ les reprennent, sinon l'enregistrement final serait refusé
   * (409) et « Annuler » croirait à tort qu'il y a quelque chose à perdre.
   */
  function blocRafraichi(fresh: { id: string; data: unknown; version: number }) {
    const reprendre = (liste: BlockItem[]) =>
      liste.map((b) => (b.id === fresh.id ? { ...b, data: fresh.data, version: fresh.version } : b));
    setBrouillon(reprendre);
    setBlocsBase(reprendre);
  }

  async function ajouterBloc(blockType: string) {
    setErreur(null);
    const cree = await creerBloc(entityId, blockType);
    if (!cree) {
      setErreur("Impossible d'ajouter ce bloc.");
      return;
    }
    setBrouillon((prev) => [...prev, cree]);
    setBlocsBase((prev) => [...prev, cree]);
    setOuvertId(cree.id);
  }

  function deplacerBloc(id: string, sens: -1 | 1) {
    const index = brouillon.findIndex((b) => b.id === id);
    const apres = deplacer(brouillon, index, sens);
    if (apres === brouillon || apres.findIndex((b) => b.id === id) === index) return;
    setBrouillon(apres);
    const bloc = brouillon[index];
    const nouvelIndex = index + sens;
    setAnnonce(
      `${bloc.display.label || BLOCK_TYPE_LABELS[bloc.blockType] || bloc.blockType} : position ${nouvelIndex + 1} sur ${brouillon.length}.`,
    );
  }

  // Glisser (doigt et souris, évènements du pointeur) : la poignée capture le
  // pointeur ; la ligne sous le doigt devient la place du bloc, en direct.
  function ligneSousLePointeur(y: number): number {
    const ordre = brouillon.map((b) => lignesRef.current.get(b.id));
    for (let i = 0; i < ordre.length; i++) {
      const rect = ordre[i]?.getBoundingClientRect();
      if (rect && y < rect.bottom) return i;
    }
    return ordre.length - 1;
  }

  function surGlisse(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (glisseId !== id) return;
    const de = brouillon.findIndex((b) => b.id === id);
    const vers = ligneSousLePointeur(e.clientY);
    if (de !== -1 && vers !== -1 && vers !== de) setBrouillon(deplacerVers(brouillon, de, vers));
  }

  function changerType(valeur: string) {
    if (valeur === CUSTOM_KIND_OPTION) {
      setCategorieSaisie("");
      return;
    }
    if (valeur === PJ_VALUE || valeur === PNJ_VALUE) {
      setIdentite((prev) => ({ ...prev, entityKind: "character", isPc: valeur === PJ_VALUE }));
      return;
    }
    setIdentite((prev) => ({ ...prev, entityKind: valeur }));
  }

  function confirmerCategorie() {
    const valeur = (categorieSaisie ?? "").trim();
    setCategorieSaisie(null);
    if (valeur === "" || valeur === identite.entityKind) return;
    setIdentite((prev) => ({ ...prev, entityKind: valeur }));
  }

  function ajouterAlias() {
    const valeur = nouvelAlias.trim();
    if (valeur === "" || identite.aliases.includes(valeur)) return;
    setIdentite((prev) => ({ ...prev, aliases: [...prev.aliases, valeur] }));
    setNouvelAlias("");
  }

  function retirerAlias(alias: string) {
    setIdentite((prev) => ({ ...prev, aliases: prev.aliases.filter((a) => a !== alias) }));
  }

  function fermer(resultat: { enregistre: boolean; blocks?: BlockItem[]; identite?: IdentiteBrouillon; version?: number }) {
    onClose({
      blocks: resultat.blocks ?? blocsBase,
      enregistre: resultat.enregistre,
      identite: resultat.identite ?? identiteBase,
      version: resultat.version ?? versionEntite,
    });
  }

  function demanderAnnuler() {
    if (enregistrement) return;
    if (modifie) setConfirmeAnnuler(true);
    else fermer({ enregistre: false });
  }

  async function enregistrer() {
    if (enregistrement || !modifie) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      let identiteEcrite = identiteBase;
      let versionEcrite = versionEntite;

      // 1. L'identité d'abord, comme `EditEntityForm` : sa propre version.
      const kindChange =
        identite.name !== identiteBase.name ||
        identite.entityKind !== identiteBase.entityKind ||
        identite.isPublic !== identiteBase.isPublic ||
        JSON.stringify(identite.aliases) !== JSON.stringify(identiteBase.aliases);
      if (kindChange) {
        const res = await fetch(`/api/entities/${entityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: versionEcrite,
            name: identite.name,
            entityKind: identite.entityKind,
            aliases: identite.aliases,
            isPublic: identite.isPublic,
          }),
        });
        if (!res.ok) {
          setErreur(await messageDEchec(res, "fiche"));
          return;
        }
        const mise = (await res.json()) as { version: number };
        versionEcrite = mise.version;
        identiteEcrite = { ...identite, isPc: identiteBase.isPc };
        setVersionEntite(versionEcrite);
        setIdentiteBase(identiteEcrite);
      }

      // PJ/PNJ : une autre ecriture (campagne), comme l'en-tete de la fiche.
      if (identite.entityKind === "character" && identite.isPc !== identiteBase.isPc && campaignId) {
        const res = await fetch(`/api/campaigns/${campaignId}/characters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityId, userId: campaignCharacterUserId, isPc: identite.isPc }),
        });
        if (!res.ok) {
          setErreur("Le rôle PJ/PNJ n'a pas pu être enregistré. Le reste n'a pas été envoyé : réessaie.");
          return;
        }
        identiteEcrite = { ...identiteEcrite, isPc: identite.isPc };
        setIdentiteBase(identiteEcrite);
      }

      // 2. Les blocs : UNE écriture, tout ou rien.
      const changements = changementsAEnvoyer(blocsBase, brouillon);
      let blocsFinaux = brouillon;
      if (changements.length > 0) {
        const res = await fetch(`/api/entities/${entityId}/blocks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changes: changements }),
        });
        if (!res.ok) {
          setErreur(await messageDEchec(res, "bloc"));
          return;
        }
        const corps = (await res.json()) as { blocks: BlockItem[] };
        const parId = new Map(corps.blocks.map((b) => [b.id, b]));
        // Les versions à jour remplacent celles du brouillon ; les blocs non
        // renvoyés n'ont pas changé.
        blocsFinaux = brouillon.map((b) => parId.get(b.id) ?? b);
      }

      fermer({
        enregistre: true,
        blocks: trierParOrdre(blocsFinaux),
        identite: { ...identite, isPc: identiteEcrite.isPc },
        version: versionEcrite,
      });
    } catch (e) {
      console.error("Enregistrement de l'éditeur plein écran échoué", e);
      setErreur("L'enregistrement a échoué (réseau ?). Ton brouillon est conservé : réessaie.");
    } finally {
      setEnregistrement(false);
    }
  }

  const options = optionsTypeFiche(worldCustomKinds, identite.entityKind);
  const valeurType = identite.entityKind === "character" ? (identite.isPc ? PJ_VALUE : PNJ_VALUE) : identite.entityKind;
  const characterBlock = brouillon.find((b) => b.blockType === "character");

  // En portail dans `<body>` : montee depuis la fiche, la couche vivrait sinon
  // dans la pile d'empilement de la zone de travail (`WindowsDesktop`, qui
  // porte son propre z-index) — son `z-[900]` y resterait enferme, et la barre
  // flottante, le de et le ☰ passaient par-dessus (verifie a 390 px).
  return createPortal(
    <div
      className="fixed inset-0 z-[900] flex flex-col bg-bg md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Modifier la fiche"
    >
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-edge bg-bg px-3 py-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={demanderAnnuler}
          disabled={enregistrement}
          className="rounded-full border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          Annuler
        </button>
        <h2 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-ink">
          {identite.name || "Nouvelle entité"}
        </h2>
        <button
          type="button"
          onClick={enregistrer}
          disabled={!modifie || enregistrement}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {enregistrement ? "Enregistrement…" : "Enregistrer"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 pb-[max(24px,env(safe-area-inset-bottom))] pt-3">
        {erreur && (
          <p role="alert" className="mb-3 rounded-md border border-danger px-3 py-2 text-sm text-danger">
            {erreur}
          </p>
        )}
        <p role="status" aria-live="polite" className="sr-only">
          {annonce}
        </p>

        <ul className="flex flex-col gap-2">
          {/* Identité : nom, type, alias — mêmes règles que l'en-tête de la fiche. */}
          <li className="rounded-lg border border-edge bg-panel">
            <button
              type="button"
              onClick={() => setOuvertId(ouvertId === "identite" ? null : "identite")}
              aria-expanded={ouvertId === "identite"}
              className="flex w-full items-center gap-2 px-3 py-3 text-left"
            >
              <span aria-hidden className="text-ink-muted">{ouvertId === "identite" ? "▾" : "▸"}</span>
              <span className="text-sm font-semibold text-ink">Identité</span>
              <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{identite.name}</span>
            </button>
            {ouvertId === "identite" && (
              <div className="flex flex-col gap-3 border-t border-edge/60 px-3 py-3">
                <label className="flex flex-col gap-1 text-xs text-ink-muted">
                  Nom
                  <input
                    value={identite.name}
                    onChange={(e) => setIdentite((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nouvelle entité"
                    className="rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>
                <div className="flex flex-col gap-1 text-xs text-ink-muted">
                  <span>Type de fiche</span>
                  {categorieSaisie !== null ? (
                    <input
                      autoFocus
                      value={categorieSaisie}
                      onChange={(e) => setCategorieSaisie(e.target.value)}
                      onBlur={confirmerCategorie}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          confirmerCategorie();
                        } else if (e.key === "Escape") {
                          setCategorieSaisie(null);
                        }
                      }}
                      placeholder="Nom de la catégorie"
                      maxLength={40}
                      className="rounded-md border border-accent bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
                    />
                  ) : (
                    <Dropdown
                      value={valeurType}
                      options={options}
                      onChange={changerType}
                      aria-label="Type de fiche"
                      size="md"
                      className="w-full"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5 text-xs">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Alias :</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {identite.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="flex items-center gap-1 rounded-full border border-edge bg-panel-raised px-2.5 py-1 text-ink"
                      >
                        {alias}
                        <button
                          type="button"
                          onClick={() => retirerAlias(alias)}
                          className="text-ink-muted hover:text-danger"
                          aria-label={`Retirer l'alias ${alias}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      value={nouvelAlias}
                      onChange={(e) => setNouvelAlias(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          ajouterAlias();
                        }
                      }}
                      onBlur={ajouterAlias}
                      placeholder="+ ajouter"
                      aria-label="Ajouter un alias"
                      className="w-24 rounded-full border border-edge bg-transparent px-2.5 py-1 text-ink outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            )}
          </li>

          {brouillon.map((bloc, index) => {
            const ouvert = ouvertId === bloc.id;
            const depliable = estDepliable(bloc.blockType);
            const typeLibelle = BLOCK_TYPE_LABELS[bloc.blockType] ?? bloc.blockType;
            const libelle = bloc.display.label || typeLibelle;
            const resume = resumeBloc(bloc.blockType, bloc.data);
            return (
              <li
                key={bloc.id}
                ref={(el) => {
                  if (el) lignesRef.current.set(bloc.id, el);
                  else lignesRef.current.delete(bloc.id);
                }}
                className={`rounded-lg border bg-panel ${glisseId === bloc.id ? "border-accent" : "border-edge"}`}
              >
                <div className="flex items-center gap-1 pl-1">
                  <button
                    type="button"
                    aria-label={`Réordonner « ${libelle} » : glisser, ou flèches haut et bas`}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setGlisseId(bloc.id);
                    }}
                    onPointerMove={(e) => surGlisse(e, bloc.id)}
                    onPointerUp={() => setGlisseId(null)}
                    onPointerCancel={() => setGlisseId(null)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        deplacerBloc(bloc.id, e.key === "ArrowUp" ? -1 : 1);
                      }
                    }}
                    className="flex h-11 w-9 shrink-0 touch-none cursor-grab items-center justify-center text-ink-muted transition-colors hover:text-ink active:cursor-grabbing"
                  >
                    ⠿
                  </button>
                  {depliable ? (
                    <button
                      type="button"
                      onClick={() => setOuvertId(ouvert ? null : bloc.id)}
                      aria-expanded={ouvert}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-left"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold text-ink">{libelle}</span>
                        {resume && !ouvert && <span className="truncate text-xs text-ink-muted">{resume}</span>}
                      </span>
                      <span className="shrink-0 rounded-full border border-edge bg-panel-raised px-2 py-0.5 text-xs text-ink-muted">
                        {typeLibelle}
                      </span>
                      <span aria-hidden className="shrink-0 text-ink-muted">{ouvert ? "▾" : "▸"}</span>
                    </button>
                  ) : (
                    <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pr-3">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold text-ink">{libelle}</span>
                        <span className="truncate text-xs italic text-ink-muted">Se modifie sur la fiche</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-edge bg-panel-raised px-2 py-0.5 text-xs text-ink-muted">
                        {typeLibelle}
                      </span>
                    </div>
                  )}
                </div>
                {ouvert && depliable && (
                  <div className="flex flex-col gap-3 border-t border-edge/60 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={bloc.display.label}
                        onChange={(e) => patchBrouillon(bloc.id, { display: { ...bloc.display, label: e.target.value } })}
                        placeholder={typeLibelle}
                        aria-label="Titre du bloc"
                        className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
                      />
                      <Dropdown
                        value={bloc.visibilityLevel}
                        options={VISIBILITY_OPTIONS}
                        onChange={(v) => patchBrouillon(bloc.id, { visibilityLevel: v, visibilityScopeId: null })}
                        aria-label="Visibilité du bloc"
                        triggerClassName="rounded-full border border-edge bg-panel-raised px-2 py-1 text-xs text-ink transition-colors hover:bg-panel"
                      />
                    </div>
                    <BlockDataEditor
                      block={bloc}
                      onChange={(data) => patchBrouillon(bloc.id, { data })}
                      worldSlug={worldSlug}
                      worldId={worldId}
                      campaignId={campaignId}
                      otherEntities={otherEntities}
                      onRelationsChanged={() => {}}
                      relationsReloadSignal={0}
                      characterData={characterBlock?.data as CharacterBlockData | undefined}
                      onBlockRefreshed={blocRafraichi}
                      hideAiAssist={hideAiAssist}
                      siblings={brouillon}
                    />
                    <div className="flex items-center justify-end gap-3 text-xs text-ink-muted">
                      <button
                        type="button"
                        onClick={() => deplacerBloc(bloc.id, -1)}
                        disabled={index === 0}
                        className="rounded-full border border-edge px-2.5 py-1 transition-colors hover:bg-panel-raised disabled:opacity-30"
                        aria-label="Monter ce bloc"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => deplacerBloc(bloc.id, 1)}
                        disabled={index === brouillon.length - 1}
                        className="rounded-full border border-edge px-2.5 py-1 transition-colors hover:bg-panel-raised disabled:opacity-30"
                        aria-label="Descendre ce bloc"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {brouillon.length === 0 && (
          <p className="py-4 text-center text-xs italic text-ink-muted">Aucun bloc. Utilise le menu ci-dessous pour en ajouter.</p>
        )}

        <div className="mt-4">
          <BarreAjoutBloc
            blocks={brouillon}
            onAdd={ajouterBloc}
            restrictAddableTypes={restrictAddableTypes}
            hasCharacterBlock={Boolean(characterBlock)}
          />
        </div>
        {nombreChangements > 0 && (
          <p className="mt-3 text-center text-xs text-ink-muted">
            {nombreChangements} bloc{nombreChangements > 1 ? "s" : ""} modifié{nombreChangements > 1 ? "s" : ""}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmeAnnuler}
        title="Abandonner les modifications ?"
        message="Ce que tu as modifié dans cet éditeur ne sera pas enregistré."
        confirmLabel="Abandonner"
        cancelLabel="Continuer à modifier"
        danger
        onConfirm={() => {
          setConfirmeAnnuler(false);
          fermer({ enregistre: false });
        }}
        onCancel={() => setConfirmeAnnuler(false)}
      />
    </div>,
    document.body
  );
}

/** Un message clair par code d'échec ; le brouillon est conservé dans tous les cas. */
async function messageDEchec(res: Response, quoi: "fiche" | "bloc"): Promise<string> {
  if (res.status === 409) {
    return quoi === "bloc"
      ? "Un bloc a été modifié entre-temps : rien n'a été enregistré. Recharge la fiche."
      : "Cette fiche a été modifiée entre-temps : rien n'a été enregistré. Recharge la fiche.";
  }
  if (res.status === 403) return "Tu n'as pas le droit de modifier cette fiche.";
  if (res.status === 404) return "Un élément de la fiche n'existe plus. Recharge la fiche.";
  if (res.status === 400) {
    const corps = (await res.json().catch(() => null)) as { error?: string } | null;
    return corps?.error ?? "Certaines données sont invalides.";
  }
  return "Erreur inattendue : rien n'a été enregistré.";
}
