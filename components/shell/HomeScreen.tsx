"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JournalEntry } from "@/src/server/services/activityJournal";
import WorldCardActions from "@/app/WorldCardActions";
import HomeProfilePanel from "./HomeProfilePanel";
import DiceStatsPanel from "./DiceStatsPanel";

export interface HomeWorldCard {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  mode: "campaign" | "solo" | null;
  campaignId: string | null;
  campaignName: string | null;
  rulesetName: string | null;
  lastModified: string;
  myRole: "gm" | "player" | null;
  myCharacter: { entityId: string; entitySlug: string; name: string } | null;
  players: { entityId: string; name: string; speciesLabel: string | null; classesLabel: string | null; claimedByDisplayName: string | null }[];
  gmNames: string[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Journal recent (MJ) ou stats de jets (Joueur) + bouton Rejoindre (retour
 * utilisateur, colonne de droite) — le serveur adapte deja le detail au role
 * (`/journal/mine`), rien a filtrer ici. Cote joueur, retour utilisateur :
 * "a la place d'avoir le journal... un petit ecran sur les stats de lance de
 * des" — `DiceStatsPanel` remplace la liste, jamais un second onglet.
 */
function WorldDetail({ world, currentUserId }: { world: HomeWorldCard; currentUserId: string }) {
  const isPlayer = world.myRole === "player";
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isPlayer) return;
    fetch(`/api/worlds/${world.slug}/journal/mine`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { entries: JournalEntry[] }) => setEntries(body.entries))
      .catch(() => setLoadError("Impossible de charger le journal."));
  }, [world.slug, isPlayer]);

  const roleLabel = world.myRole === "player" ? "Joueur" : world.mode === "solo" ? "Solo" : "MJ";
  // V2-M7b (Lot M, coquille joueur) : un role Joueur mene desormais a la
  // coquille allegee (Fiche/Notes/Wiki/Regles), jamais directement a la
  // fiche brute — celle-ci gere elle-meme le cas "personnage pas encore
  // reclame".
  const href = world.myRole === "player" ? `/m/${world.slug}/joueur` : `/m/${world.slug}`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-ink">{world.name}</p>
          <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
            {roleLabel}
          </span>
        </div>
        {world.campaignName && <p className="text-xs text-ink-muted">Campagne : {world.campaignName}</p>}
        {world.myRole !== "player" && (
          <p className="text-xs text-ink-muted">
            {world.rulesetName ?? "Aucun ruleset"} · Modifié le {formatDate(world.lastModified)}
          </p>
        )}
      </div>

      {/* Seule cette partie defile (retour utilisateur) : Rejoindre et les
          actions MJ ci-dessous restent toujours visibles, jamais au fond
          d'une zone qui defile. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPlayer ? (
          <>
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Stats de jets</span>
            <DiceStatsPanel campaignId={world.campaignId} />
          </>
        ) : (
          <>
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Journal récent</span>
            {loadError && <p className="mt-1 text-xs text-danger">{loadError}</p>}
            {entries === null && !loadError && <p className="mt-1 text-xs text-ink-muted">…</p>}
            {entries && entries.length === 0 && <p className="mt-1 text-xs text-ink-muted">Aucune activité pour l&apos;instant.</p>}
            {entries && entries.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1.5 text-xs">
                {entries.slice(0, 30).map((entry, i) => (
                  <li key={i} className="border-b border-edge/30 pb-1">
                    <span className={entry.source === "wiki" ? "text-accent" : "text-ink"}>
                      {entry.source === "wiki" ? "wiki" : "jeu"}
                    </span>{" "}
                    <span className="text-ink-muted">
                      {entry.label}
                      {entry.entityName && <> — {entry.entityName}</>}
                      {entry.blockLabel && <> ({entry.blockLabel})</>}
                    </span>
                    <div className="text-ink-muted">
                      {entry.accountName} · {formatDateTime(entry.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {world.myRole !== "player" && (
        <div className="shrink-0">
          <WorldCardActions
            worldId={world.id}
            worldSlug={world.slug}
            worldName={world.name}
            campaignId={world.campaignId}
            campaignName={world.campaignName}
            isOwner={world.ownerId === currentUserId}
          />
        </div>
      )}

      <Link
        href={href}
        className="shrink-0 self-end rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
      >
        Rejoindre
      </Link>
    </div>
  );
}

/**
 * Ecran d'accueil en trois colonnes (retour utilisateur) : profil, mondes,
 * detail du monde selectionne — une seule grille a trois pistes egales
 * (`grid-cols-3`) plutot qu'une grille imbriquee, pour une repartition
 * homogene de la largeur d'ecran (retour utilisateur : "mieux repartir
 * l'espace... aussi leur repartition dans l'ecran", pas seulement l'espace
 * entre colonnes). La selection reste locale a ce composant, jamais dans
 * l'URL (pas de navigation tant qu'on n'a pas clique "Rejoindre").
 */
export default function HomeScreen({
  worlds,
  currentUserId,
  email,
  displayName,
  adminPanel,
  createTools,
}: {
  worlds: HomeWorldCard[];
  currentUserId: string;
  email: string;
  displayName: string;
  /** Section Administration (superadmin, M6) — sous le profil, dans la meme colonne (retour utilisateur : libere l'espace en hauteur plutot qu'un bandeau pleine largeur). `null` pour tout compte non-superadmin. */
  adminPanel: React.ReactNode;
  /** Formulaires de creation/import (retour utilisateur : "en haut de la colonne centrale") — rendus ici plutot que par l'appelant pour rester au-dessus de la liste dans la MEME colonne du grid. */
  createTools: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = worlds.find((w) => w.id === selectedId) ?? null;

  return (
    <div className="grid h-full min-h-0 grid-cols-3 gap-6">
      {/* Colonne profil (retour utilisateur, tient sur un ecran) : defile
          comme un bloc si Administration + Profil depassent la hauteur
          disponible — chacun des deux garde deja son propre plafond interne
          (AdminPanel plafonne son journal a 320px). */}
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
        <HomeProfilePanel email={email} displayName={displayName} />
        {adminPanel}
      </div>

      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="shrink-0">{createTools}</div>
        <ul className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-2">
          {worlds.map((world) => {
            const roleLabel = world.myRole === "player" ? "Joueur" : world.mode === "solo" ? "Solo" : "MJ";
            return (
              <li key={world.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(world.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-panel-raised ${
                    selectedId === world.id ? "border-accent bg-panel-raised" : "border-edge bg-panel"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-ink">{world.name}</p>
                    <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                      {roleLabel}
                    </span>
                  </div>
                  {world.campaignName && <p className="text-xs text-ink-muted">Campagne : {world.campaignName}</p>}
                  {world.myRole === "player" ? (
                    <p className="text-sm text-ink-muted">{world.myCharacter ? world.myCharacter.name : "Personnage introuvable"}</p>
                  ) : (
                    <>
                      <p className="text-sm text-ink-muted">
                        {world.rulesetName ?? "Aucun ruleset"} · Modifié le {formatDate(world.lastModified)}
                      </p>
                      {world.gmNames.length > 0 && <p className="text-xs text-ink-muted">MJ : {world.gmNames.join(", ")}</p>}
                      {world.players.length > 0 ? (
                        <ul className="mt-0.5 flex flex-col">
                          {world.players.map((pc) => (
                            <li key={pc.entityId} className="text-sm text-ink-muted">
                              {pc.name}
                              {(pc.speciesLabel || pc.classesLabel) && (
                                <> — {[pc.speciesLabel, pc.classesLabel].filter(Boolean).join(" · ")}</>
                              )}
                              {pc.claimedByDisplayName && <> · jouée par {pc.claimedByDisplayName}</>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-ink-muted">Aucun joueur</p>
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
          {worlds.length === 0 && <p className="text-ink-muted">Aucun monde pour l&apos;instant.</p>}
        </ul>
      </div>

      <div className="h-full min-h-0 rounded-lg border border-edge bg-panel-sunken p-4">
        {selected ? (
          // `key` force un remontage complet a chaque changement de monde
          // selectionne : sans lui, `WorldCardActions`/`RenameWorldSection`
          // gardent leur etat local (`revealed`, `name`) d'un monde a l'autre
          // (bug reel constate : renommage de Valdoria en "Faerûn" apres
          // avoir ouvert "Renommer" sur Faerûn puis change de selection sans
          // fermer le panneau — le nom tape restait celui de l'ancien monde
          // pendant que `worldId` (input cache) pointait deja sur le nouveau).
          <WorldDetail key={selected.id} world={selected} currentUserId={currentUserId} />
        ) : (
          <p className="text-sm text-ink-muted">Sélectionnez un monde pour voir son détail.</p>
        )}
      </div>
    </div>
  );
}
