"use client";

import { useEffect, useRef, useState } from "react";
import PlayableCharacterSheet from "@/components/blocks/PlayableCharacterSheet";
import CharacterCreatorWizard from "@/components/blocks/CharacterCreatorWizard";
import type { BlockItem } from "@/components/blocks/EntityBlocks";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import type { ResourcesBlockData } from "@/src/core/schemas/blocks/resources";

/**
 * Fiche de personnage complete d'un participant `entity` (PJ/PNJ), pour le
 * derouleur "Caracteristiques" de l'ecran Initiative (V1-E4 suite, retour
 * utilisateur : "meme chose avec les PJ ou PNJ... ce bouton ouvre leur
 * fiche de personnage dans le derouleur"). Se charge elle-meme (contrairement
 * a `EntityBlocks.tsx`, qui recoit ses blocs deja resolus du rendu serveur
 * de la fiche du wiki) via `GET /api/entities/[id]/blocks` — meme filtrage
 * de visibilite (`listVisibleBlocks`) que la fenetre secondaire de fiche.
 *
 * `campaignId` reel transmis a `PlayableCharacterSheet` (contrairement a
 * `EntityBlocks.tsx`, qui passe toujours `null`) : les jets d'attaque/degats
 * et les changements de PV faits depuis l'ecran Initiative doivent compter
 * pour de vrai dans la campagne en cours, pas rester des essais non
 * enregistres.
 */
export default function ParticipantCharacterSheet({
  worldSlug,
  campaignId,
  entityId,
  entityName,
  entityVersion,
}: {
  worldSlug: string;
  campaignId: string;
  entityId: string;
  /** Amorce l'assistant de creation (retour utilisateur : "si le PJ reclame n'a pas de fiche de personnage") — non lu tant qu'un bloc `character` existe deja. Absent depuis l'ecran Initiative (`InitiativeTracker.tsx`) : ouvrir l'assistant complet en pleine bagarre n'a pas de sens, le bouton reste alors absent, comportement inchange. */
  entityName?: string;
  entityVersion?: number;
}) {
  const [blocks, setBlocks] = useState<BlockItem[] | "loading" | "error">("loading");
  const versionsRef = useRef<Record<string, number>>({});
  const saveChainsRef = useRef<Record<string, Promise<void>>>({});
  // Meme mecanisme que le `wizardOpen` de `EditEntityForm.tsx` (fiche MJ) —
  // ici amorce d'un PJ deja revendique mais sans bloc `character` encore
  // compose, jamais une creation de nouvelle entite (celle-ci existe deja).
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reloadSignal, setReloadSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entities/${entityId}/blocks`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BlockItem[] | null) => {
        if (cancelled) return;
        if (!data) {
          setBlocks("error");
          return;
        }
        versionsRef.current = Object.fromEntries(data.map((b) => [b.id, b.version]));
        setBlocks(data);
      })
      .catch(() => {
        if (!cancelled) setBlocks("error");
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, reloadSignal]);

  function patchBlock(id: string, data: unknown) {
    setBlocks((prev) => (Array.isArray(prev) ? prev.map((b) => (b.id === id ? { ...b, data } : b)) : prev));
  }

  /** Un bloc a ete ecrit par une autre voie que `saveBlock` (V2-G1, montee de niveau — sauvegarde chirurgicale avec sa propre verification de version) — meme motif que `EntityBlocks.handleBlockRefreshed` : synchronise version ET donnee sans redeclencher une sauvegarde. */
  function handleBlockRefreshed(fresh: { id: string; data: unknown; version: number }) {
    versionsRef.current[fresh.id] = fresh.version;
    setBlocks((prev) => (Array.isArray(prev) ? prev.map((b) => (b.id === fresh.id ? { ...b, data: fresh.data, version: fresh.version } : b)) : prev));
  }

  /** Meme motif de chaine de promesses par bloc que `EntityBlocks.tsx` (`saveBlock`) : un blur et un clic voisin peuvent partir a quelques millisecondes d'intervalle sur le meme bloc, la chaine garantit que le second n'ecrit qu'apres la version a jour du premier. */
  function saveBlock(id: string, data: unknown) {
    const run = () => doSaveBlock(id, data);
    const previous = saveChainsRef.current[id] ?? Promise.resolve();
    const next = previous.then(run, run);
    saveChainsRef.current[id] = next;
    return next;
  }

  async function doSaveBlock(id: string, data: unknown) {
    if (!Array.isArray(blocks)) return;
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const res = await fetch(`/api/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: versionsRef.current[id],
        display: block.display,
        data,
        visibility: { level: block.visibilityLevel, scopeId: block.visibilityScopeId ?? null },
      }),
    });
    if (!res.ok) return; // 409 (modifie ailleurs) ou 400 : silencieux ici, ecran de combat, pas un editeur de fiche complet — la fiche se recharge a la prochaine ouverture du derouleur.
    const updated = (await res.json()) as BlockItem;
    versionsRef.current[id] = updated.version;
  }

  /** Cree le bloc s'il manque encore (inventaire/incantation, bootstrap-si-absent) — meme motif que `EntityBlocks.tsx` (`createBlockWithData`) : la fiche jouable affiche toujours ces onglets meme sans bloc existant, sans ce bootstrap la premiere modification serait silencieusement perdue. */
  async function createBlockWithData(blockType: string, label: string, data: unknown): Promise<BlockItem | null> {
    const res = await fetch(`/api/entities/${entityId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId, blockType, label, visibility: { level: "public", scopeId: null } }),
    });
    if (!res.ok) return null;
    const block = (await res.json()) as BlockItem;
    versionsRef.current[block.id] = block.version;
    const patchRes = await fetch(`/api/blocks/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: block.version,
        display: block.display,
        data,
        visibility: { level: block.visibilityLevel, scopeId: block.visibilityScopeId ?? null },
      }),
    });
    if (!patchRes.ok) return block;
    const updated = (await patchRes.json()) as BlockItem;
    versionsRef.current[updated.id] = updated.version;
    return updated;
  }

  if (blocks === "loading") return <p className="pl-2 text-xs italic text-ink-muted">Chargement…</p>;
  if (blocks === "error") return <p className="pl-2 text-xs italic text-ink-muted">Fiche introuvable.</p>;

  const characterBlock = blocks.find((b) => b.blockType === "character");

  if (!characterBlock) {
    if (wizardOpen && entityName !== undefined && entityVersion !== undefined) {
      return (
        <CharacterCreatorWizard
          worldSlug={worldSlug}
          playerRestricted
          entityMode={{
            entityId,
            expectedVersion: entityVersion,
            initialName: entityName,
            onCancel: () => setWizardOpen(false),
            onDone: () => {
              setWizardOpen(false);
              setReloadSignal((n) => n + 1);
            },
          }}
        />
      );
    }
    return (
      <div className="flex flex-col items-start gap-2 pl-2">
        <p className="text-xs italic text-ink-muted">Aucune fiche de personnage pour cette entrée.</p>
        {entityName !== undefined && entityVersion !== undefined && (
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
          >
            Créer mon personnage
          </button>
        )}
      </div>
    );
  }

  const inventoryBlock = blocks.find((b) => b.blockType === "inventory");
  const spellcastingBlock = blocks.find((b) => b.blockType === "spellcasting");
  const resourcesBlock = blocks.find((b) => b.blockType === "resources");

  function updateCharacter(data: CharacterBlockData) {
    if (!characterBlock) return;
    patchBlock(characterBlock.id, data);
    saveBlock(characterBlock.id, data);
  }

  async function updateInventory(data: InventoryBlockData) {
    if (inventoryBlock) {
      patchBlock(inventoryBlock.id, data);
      saveBlock(inventoryBlock.id, data);
      return;
    }
    const created = await createBlockWithData("inventory", "Inventaire", data);
    if (created) setBlocks((prev) => (Array.isArray(prev) ? [...prev, created] : prev));
  }

  async function updateSpellcasting(data: SpellcastingBlockData) {
    if (spellcastingBlock) {
      patchBlock(spellcastingBlock.id, data);
      saveBlock(spellcastingBlock.id, data);
      return;
    }
    const created = await createBlockWithData("spellcasting", "Incantation", data);
    if (created) setBlocks((prev) => (Array.isArray(prev) ? [...prev, created] : prev));
  }

  return (
    <PlayableCharacterSheet
      worldSlug={worldSlug}
      entityId={entityId}
      campaignId={campaignId}
      character={characterBlock.data as CharacterBlockData}
      inventory={inventoryBlock?.data as InventoryBlockData | undefined}
      spellcasting={spellcastingBlock?.data as SpellcastingBlockData | undefined}
      resources={resourcesBlock?.data as ResourcesBlockData | undefined}
      characterBlockId={characterBlock.id}
      characterBlockVersion={characterBlock.version}
      onUpdateCharacter={updateCharacter}
      onUpdateInventory={updateInventory}
      onUpdateSpellcasting={updateSpellcasting}
      onBlockRefreshed={handleBlockRefreshed}
    />
  );
}
