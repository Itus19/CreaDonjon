"use client";

import { useState } from "react";
import Link from "next/link";
import RuleEntryAutocomplete from "@/components/blocks/RuleEntryAutocomplete";
import { useOpenEntityLink } from "../useOpenEntityLink";
import type { SectionResult } from "./useTirages";

/**
 * « Créer la fiche » (V2-J2) : combine les resultats actuellement affiches de
 * toutes les sections DU MEME outil et les promeut en une vraie entite via
 * `POST .../mj/generateurs/[toolKey]/promote` (geste inchange ; la route cree la
 * fiche en visibilite MJ seul). Actif des que la section « nom » a un resultat.
 * Le bouton est rendu par l'appelant, a cote de « Copier le texte » : ce
 * composant ne porte que le geste, le choix de creature et le retour.
 */
export default function CreerLaFiche({
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
    <>
      {withCreature && (
        <RuleEntryAutocomplete
          worldSlug={worldSlug}
          entryTypes={["monster"]}
          value={creatureEntryKey}
          onChange={setCreatureEntryKey}
          placeholder="Créature du bestiaire (optionnel)"
          className="w-full @md:w-64"
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
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </>
  );
}
