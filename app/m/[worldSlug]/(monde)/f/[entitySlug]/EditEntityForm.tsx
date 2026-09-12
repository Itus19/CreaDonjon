"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RelationsChips, { type OtherEntityOption, type RelationChip } from "@/components/entities/RelationsChips";
import EntityHistoryPanel from "@/components/entities/EntityHistoryPanel";
import PortraitUpload from "@/components/entities/PortraitUpload";
import EntityBlocks, { type BlockItem } from "@/components/blocks/EntityBlocks";
import CharacterCreatorWizard from "@/components/blocks/CharacterCreatorWizard";
import CarteMapPanel from "@/components/entities/map/CarteMapPanel";
import Dropdown from "@/components/shared/Dropdown";
import EyeIcon from "@/components/shared/EyeIcon";
import RequestEditButton from "@/components/entities/RequestEditButton";
import { DEFAULT_ENTITY_NAME, ENTITY_KINDS } from "@/lib/entities/schemas";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import type { EntitySummary } from "@/src/server/repos/entities";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";

const ENTITY_KIND_DROPDOWN_OPTIONS = ENTITY_KINDS.map((kind) => ({
  value: kind,
  label: ENTITY_KIND_LABELS[kind],
}));

/** Sentinelle jamais persistee (V2-G7) : selectionner cette option ouvre un champ, ne sauvegarde rien tant qu'un nom n'est pas confirme. */
const CUSTOM_KIND_OPTION = "__custom__";

/**
 * PJ/PNJ (V2-G10, specs/arbitrage-modifications.md §3.1) : jamais un
 * `entity_kind` distinct — ces deux valeurs de selecteur persistent toutes
 * les deux `entityKind: "character"`, seul `campaign_characters.is_pc`
 * change. Sentinelles composees pour rester distinctes de "character" tout
 * en restant reconnaissables dans `kindOptions`.
 */
const PJ_VALUE = "character:pj";
const PNJ_VALUE = "character:pnj";

/**
 * Toujours editable en place, comme l'ancienne application (master,
 * EntityDetail.tsx) : chaque champ sauvegarde tout seul (blur/changement),
 * jamais de bouton "Enregistrer" separe a chercher.
 */
export default function EditEntityForm({
  entity,
  worldSlug,
  initialBlocks,
  initialRelations,
  otherEntities,
  worldCustomKinds,
  campaignId,
  initialIsPc,
  campaignCharacterUserId,
  initialPortraitLayout,
  playerRestricted,
}: {
  entity: EntitySummary;
  worldSlug: string;
  initialBlocks: BlockItem[];
  initialRelations: RelationChip[];
  otherEntities: OtherEntityOption[];
  worldCustomKinds: string[];
  /** null si le monde n'a pas encore de campagne (ne devrait plus arriver, "un monde = une campagne") : le choix PJ/PNJ n'a alors pas de sens et n'ecrit rien. */
  campaignId: string | null;
  initialIsPc: boolean;
  /** Compte joueur deja attribue (panneau MJ) — jamais efface par un changement PJ/PNJ depuis la fiche. */
  campaignCharacterUserId: string | null;
  initialPortraitLayout: EntityPortraitLayout;
  /** Coquille joueur (retour utilisateur, V2-M7b) : masque l'assistant de creation et limite "Ajouter un bloc" au texte — "si les joueurs veulent ajouter des choses il faudra demander au MJ". `undefined`/`false` en contexte MJ, rien ne change. */
  playerRestricted?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(entity.name);
  const [entityKind, setEntityKind] = useState(entity.entity_kind);
  const [isPublic, setIsPublic] = useState(entity.is_public);
  const [isPc, setIsPc] = useState(initialIsPc);
  const [aliases, setAliases] = useState<string[]>(entity.aliases);
  const [newAlias, setNewAlias] = useState("");
  // Categorie personnalisee (V2-G7) : `null` hors edition, une chaine
  // (meme vide) pendant la composition du nom — rien n'est sauvegarde tant
  // que ce champ n'est pas confirme (Entree) ou abandonne (Echap/blur vide).
  const [customCategoryDraft, setCustomCategoryDraft] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const versionRef = useRef(entity.version);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "conflict" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Assistant de creation lance depuis cette fiche (retour utilisateur) :
  // remplace TOUT le contenu de la fiche tant qu'il est ouvert (en-tete,
  // blocs, relations) — jamais un bloc de plus a cote des autres, l'ecran du
  // wizard "prend la place de la fiche" le temps de la composition.
  const [wizardOpen, setWizardOpen] = useState(false);
  // Version capturee au lancement (pas versionRef.current directement : un
  // ref ne se lit jamais pendant le rendu, react-hooks/refs). Suffisant ici
  // car rien d'autre ne modifie la version pendant que le wizard est ouvert.
  const [wizardVersion, setWizardVersion] = useState(entity.version);
  // Retour utilisateur : les blocs genealogie/reseau chargent leur propre
  // graphe via `useEffect` (entityId, degre...) — une relation ajoutee ou
  // masquee ailleurs sur la page (cette liste, l'autre bloc) ne les fait
  // jamais rejouer cet effet, `router.refresh()` ne remonte pas ces
  // composants client. Ce compteur, partage entre RelationsChips et
  // EntityBlocks (qui le relaie aux deux blocs), force leur refetch a
  // chaque changement de relation, peu importe d'ou il vient.
  const [relationsReloadSignal, setRelationsReloadSignal] = useState(0);
  const bumpRelationsReloadSignal = () => setRelationsReloadSignal((n) => n + 1);

  useEffect(() => {
    // Fiche fraiche (V2-G8) : le nom par defaut est deja selectionne au
    // montage pour que la premiere frappe le remplace directement, sans
    // devoir le vider a la main — jamais reexecute au fil des re-rendus.
    if (entity.name === DEFAULT_ENTITY_NAME) {
      titleInputRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (wizardOpen) {
    const characterBlock = initialBlocks.find((b) => b.blockType === "character");
    const inventoryBlock = initialBlocks.find((b) => b.blockType === "inventory");
    const spellcastingBlock = initialBlocks.find((b) => b.blockType === "spellcasting");
    return (
      <CharacterCreatorWizard
        worldSlug={worldSlug}
        entityMode={{
          entityId: entity.id,
          expectedVersion: wizardVersion,
          initialName: name,
          initialCharacter: characterBlock?.data as CharacterBlockData | undefined,
          initialInventory: inventoryBlock?.data as InventoryBlockData | undefined,
          initialSpellcasting: spellcastingBlock?.data as SpellcastingBlockData | undefined,
          onCancel: () => setWizardOpen(false),
          onDone: (result) => {
            setName(result.name);
            versionRef.current = result.version;
            setWizardVersion(result.version);
            setWizardOpen(false);
            router.refresh();
          },
        }}
      />
    );
  }

  type SaveOverrides = {
    name?: string;
    entityKind?: string;
    aliases?: string[];
    isPublic?: boolean;
  };

  /**
   * Deux declencheurs de sauvegarde peuvent se suivre a quelques
   * millisecondes d'intervalle (ex. changer le type puis quitter le champ
   * resume) : sans serialisation, le second part avec une version deja
   * perimee et echoue en 409, perdant silencieusement son changement. La
   * chaine garantit l'ordre et une version toujours a jour.
   */
  function save(overrides?: SaveOverrides) {
    const run = () => doSave(overrides);
    const next = saveChainRef.current.then(run, run);
    saveChainRef.current = next;
    return next;
  }

  async function doSave(overrides?: SaveOverrides) {
    setStatus("saving");
    setErrorMessage(null);

    const res = await fetch(`/api/entities/${entity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: versionRef.current,
        name: overrides?.name ?? name,
        entityKind: overrides?.entityKind ?? entityKind,
        aliases: overrides?.aliases ?? aliases,
        isPublic: overrides?.isPublic ?? isPublic,
      }),
    });

    if (res.status === 409) {
      setStatus("conflict");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setErrorMessage(body?.error ?? "Erreur inattendue.");
      setStatus("error");
      return;
    }

    const updated = await res.json();
    versionRef.current = updated.version;
    setStatus("saved");
    router.refresh();
  }

  function addAlias() {
    const value = newAlias.trim();
    if (value === "" || aliases.includes(value)) return;
    const next = [...aliases, value];
    setAliases(next);
    setNewAlias("");
    save({ aliases: next });
  }

  function removeAlias(alias: string) {
    const next = aliases.filter((a) => a !== alias);
    setAliases(next);
    save({ aliases: next });
  }

  /** N'ecrit rien si le monde n'a pas de campagne (ne devrait plus arriver) : is_pc n'a pas de sens hors campagne. */
  async function assignCampaignRole(nextIsPc: boolean) {
    if (!campaignId) return;
    await fetch(`/api/campaigns/${campaignId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId: entity.id, userId: campaignCharacterUserId, isPc: nextIsPc }),
    });
    router.refresh();
  }

  function handleKindChange(kind: string) {
    if (kind === CUSTOM_KIND_OPTION) {
      setCustomCategoryDraft("");
      return;
    }
    if (kind === PJ_VALUE || kind === PNJ_VALUE) {
      const nextIsPc = kind === PJ_VALUE;
      setIsPc(nextIsPc);
      if (entityKind !== "character") {
        setEntityKind("character");
        save({ entityKind: "character" });
      }
      void assignCampaignRole(nextIsPc);
      return;
    }
    setEntityKind(kind);
    save({ entityKind: kind });
  }

  /** Bouton oeil a cote du type de fiche (V2, retour utilisateur point 2) — bascule binaire, meme geste que RelationsChips.tsx. */
  function toggleEntityPublic() {
    const next = !isPublic;
    setIsPublic(next);
    save({ isPublic: next });
  }

  function confirmCustomCategory() {
    const value = (customCategoryDraft ?? "").trim();
    setCustomCategoryDraft(null);
    if (value === "" || value === entityKind) return;
    setEntityKind(value);
    save({ entityKind: value });
  }

  // Categories deja utilisees dans ce monde (fixes + personnelles) plus,
  // en dernier, l'option qui ouvre le champ de creation — jamais l'inverse
  // (V2-G7 : "en dernier choix"). La valeur courante est ajoutee si elle
  // n'y figure pas deja (categorie personnalisee saisie par une AUTRE
  // fiche de ce monde depuis, ou creee ailleurs entre deux chargements).
  //
  // "Personnage" n'apparait jamais tel quel (V2-G10) : PJ/PNJ a la place,
  // deux entrees qui persistent toutes les deux entityKind "character" —
  // jamais un entity_kind distinct (specs/arbitrage-modifications.md §3.1).
  const knownKinds = new Set([...ENTITY_KINDS, ...worldCustomKinds]);
  const fixedOptions = ENTITY_KIND_DROPDOWN_OPTIONS.flatMap((opt) =>
    opt.value === "character" ? [{ value: PJ_VALUE, label: "PJ" }, { value: PNJ_VALUE, label: "PNJ" }] : [opt]
  );
  const kindOptions = [
    ...fixedOptions,
    ...worldCustomKinds.map((kind) => ({ value: kind, label: kind })),
    ...(knownKinds.has(entityKind) ? [] : [{ value: entityKind, label: entityKind }]),
    { value: CUSTOM_KIND_OPTION, label: "+ Créer une catégorie…" },
  ];
  const kindDropdownValue = entityKind === "character" ? (isPc ? PJ_VALUE : PNJ_VALUE) : entityKind;

  // Fiche `carte` (Lot I, retour utilisateur : "une catégorie 'Cartes'...
  // une fiche fenêtre avec la carte en grand et les outils pour la
  // modifier en bas") : ni chrome habituel (portrait, alias, relations,
  // liste de blocs), ni bouton "Agrandir" a chercher — la carte EST le
  // contenu de la fenetre. Le nom, le type et la visibilite du bloc
  // restent accessibles (aucune autre porte d'entree dans l'appli pour
  // les modifier : le titre de la fenetre, lui, n'est qu'un affichage).
  // Le bloc `map` est cree automatiquement cote serveur des que le type
  // passe a "carte" (`updateEntity`, `src/server/services/entities.ts`) —
  // s'il manque encore ("Chargement…"), c'est cette creation server qui
  // n'a pas encore ete refletee par un `router.refresh()`.
  if (entityKind === "carte") {
    const mapBlock = initialBlocks.find((b) => b.blockType === "map");
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <input
            ref={titleInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => save()}
            placeholder="Nouvelle carte"
            className="entity-title flex-1 bg-transparent outline-none placeholder:text-ink-muted focus:border-b focus:border-accent"
          />
          <button
            type="button"
            onClick={toggleEntityPublic}
            className="shrink-0 text-ink-muted hover:text-ink"
            aria-label={isPublic ? "Masquer cette fiche au wiki public" : "Rendre cette fiche visible au wiki public"}
            title={isPublic ? "Visible au wiki public — cliquer pour masquer" : "Masquée au wiki public — cliquer pour rendre visible"}
          >
            <EyeIcon open={isPublic} className="h-4 w-4" />
          </button>
          {customCategoryDraft !== null ? (
            <input
              autoFocus
              value={customCategoryDraft}
              onChange={(e) => setCustomCategoryDraft(e.target.value)}
              onBlur={confirmCustomCategory}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmCustomCategory();
                } else if (e.key === "Escape") {
                  setCustomCategoryDraft(null);
                }
              }}
              placeholder="Nom de la catégorie"
              maxLength={40}
              className="w-40 shrink-0 rounded-md border border-accent bg-transparent px-2 py-1 text-sm text-ink outline-none"
            />
          ) : (
            <Dropdown
              value={kindDropdownValue}
              options={kindOptions}
              onChange={handleKindChange}
              triggerClassName="inline-flex min-w-0 items-center gap-1 overflow-hidden bg-transparent px-1 py-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            />
          )}
        </div>
        {status === "conflict" && (
          <p className="text-sm text-danger">Cette fiche a été modifiée entre-temps. Rechargez la page avant de réessayer.</p>
        )}
        {status === "error" && errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
        <div className="min-h-0 flex-1">
          {mapBlock ? (
            <CarteMapPanel worldSlug={worldSlug} block={mapBlock} otherEntities={otherEntities} />
          ) : (
            <p className="text-sm italic text-ink-muted">Chargement…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[1fr_auto] gap-6">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-3">
            <input
              ref={titleInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => save()}
              placeholder="Nouvelle entité"
              // Fiche vierge (V0-06g) : pas d'ecran de creation separe, on
              // arrive directement ici — le focus automatique invite a
              // nommer la fiche tout de suite, sans action supplementaire.
              autoFocus={entity.name === DEFAULT_ENTITY_NAME}
              className="entity-title min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-muted focus:border-b focus:border-accent"
            />
            {/* Aligne avec le titre, comme dans l'ancienne application : le
                type de fiche se choisit en haut a droite, pas sous le titre.
                L'historique (icone ronde) vit juste a cote, dans le meme coin
                que les pastilles orange/rouge de la barre de fenetre au-dessus
                (V1-C4, specs/arbitrage-modifications.md §3.1). Le portrait
                (colonne "auto" a droite) garde toujours sa place : retour
                utilisateur, une categorie au nom long ne doit jamais le
                pousser ni faire apparaitre un ascenseur horizontal — c'est ce
                groupe de boutons qui retrecit, la categorie se tronquant en
                dernier recours (titre complet visible au survol). */}
            <div className="flex min-w-0 items-center gap-2">
              {playerRestricted && (
                <span className="shrink-0">
                  <RequestEditButton campaignId={campaignId} entityId={entity.id} />
                </span>
              )}
              {entity.entity_kind === "session_prep" && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="shrink-0 rounded-full border border-edge px-2.5 py-1 text-xs text-ink-muted transition-colors hover:bg-panel hover:text-ink"
                  title="Imprimer cette fiche"
                >
                  Imprimer
                </button>
              )}
              <EntityHistoryPanel entityId={entity.id} />
              <button
                type="button"
                onClick={toggleEntityPublic}
                className="shrink-0 text-ink-muted hover:text-ink"
                aria-label={isPublic ? "Masquer cette fiche au wiki public" : "Rendre cette fiche visible au wiki public"}
                title={isPublic ? "Visible au wiki public — cliquer pour masquer" : "Masquée au wiki public — cliquer pour rendre visible"}
              >
                <EyeIcon open={isPublic} className="h-4 w-4" />
              </button>
              {customCategoryDraft !== null ? (
                <input
                  autoFocus
                  value={customCategoryDraft}
                  onChange={(e) => setCustomCategoryDraft(e.target.value)}
                  onBlur={confirmCustomCategory}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmCustomCategory();
                    } else if (e.key === "Escape") {
                      setCustomCategoryDraft(null);
                    }
                  }}
                  placeholder="Nom de la catégorie"
                  maxLength={40}
                  className="w-40 shrink-0 rounded-md border border-accent bg-transparent px-2 py-1 text-sm text-ink outline-none"
                />
              ) : (
                <Dropdown
                  value={kindDropdownValue}
                  options={kindOptions}
                  onChange={handleKindChange}
                  triggerClassName="inline-flex min-w-0 items-center gap-1 overflow-hidden bg-transparent px-1 py-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                />
              )}
            </div>
          </div>
          {/* Le slug (identifiant d'URL, sans accents ni ponctuation) vit
              sous le titre — utile comme reference technique, mais pas assez
              pour meriter la place a cote du titre. */}
          <div className="mt-0.5 flex items-center gap-3">
            <span className="font-mech text-xs text-ink-muted">{entity.slug}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Alias :
            </span>
            {aliases.map((alias) => (
              <span
                key={alias}
                className="flex items-center gap-1 rounded-full border border-edge bg-panel-raised px-2.5 py-1"
              >
                {alias}
                <button
                  type="button"
                  onClick={() => removeAlias(alias)}
                  className="text-ink-muted hover:text-danger"
                  aria-label={`Retirer l'alias ${alias}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAlias();
                }
              }}
              placeholder="+ ajouter"
              className="w-24 rounded-full border border-edge bg-transparent px-2.5 py-1 outline-none focus:border-accent"
            />
          </div>

          <div className="mt-4 flex flex-col gap-1.5 border-t border-edge/60 pt-2.5 text-xs">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Relations :
            </span>
            <RelationsChips
              entityId={entity.id}
              worldSlug={worldSlug}
              relations={initialRelations}
              otherEntities={otherEntities}
              onRelationsChanged={bumpRelationsReloadSignal}
              relationsReloadSignal={relationsReloadSignal}
            />
          </div>
        </div>

        <PortraitUpload entityId={entity.id} initialLayout={initialPortraitLayout} />
      </div>

      {status === "conflict" && (
        <p className="text-sm text-danger">
          Cette fiche a été modifiée entre-temps. Rechargez la page avant de réessayer.
        </p>
      )}
      {status === "error" && errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

      <div className="border-t border-edge pt-3">
        <EntityBlocks
          entityId={entity.id}
          worldId={entity.world_id}
          initialBlocks={initialBlocks}
          worldSlug={worldSlug}
          otherEntities={otherEntities}
          relationsReloadSignal={relationsReloadSignal}
          onRelationsChanged={bumpRelationsReloadSignal}
          onLaunchWizard={
            playerRestricted
              ? undefined
              : () => {
                  setWizardVersion(versionRef.current);
                  setWizardOpen(true);
                }
          }
          restrictAddableTypes={
            playerRestricted
              ? ["timeline", "relations_graph", "relationship", "map", "genealogy", "text", "image", "music", "personality", "worldview"]
              : undefined
          }
          hideAiAssist={playerRestricted}
        />
      </div>
    </div>
  );
}
