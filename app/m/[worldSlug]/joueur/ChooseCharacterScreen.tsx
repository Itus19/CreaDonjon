"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { claimCharacterAction } from "./actions";

/**
 * Ecran "Choisis ton personnage" (V3.1-10) : une joueuse membre d'un monde
 * sans PJ assigné choisit parmi les PJ ouverts, ou en crée un nouveau — le
 * MJ garde la main pour réassigner ensuite (`CampaignDetail.tsx`).
 */
export default function ChooseCharacterScreen({
  worldSlug,
  characters,
}: {
  worldSlug: string;
  characters: { entityId: string; entityName: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(entityId: string) {
    setError(null);
    setClaimingId(entityId);
    startTransition(async () => {
      const result = await claimCharacterAction(worldSlug, entityId);
      if (result?.error) setError(result.error);
      setClaimingId(null);
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div>
        <h1 className="block-title text-base">Choisis ton personnage</h1>
        <p className="text-xs text-ink-muted">Aucun personnage ne t&apos;est encore assigné dans ce monde.</p>
      </div>

      {characters.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucun personnage disponible pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {characters.map((c) => (
            <li key={c.entityId}>
              <button
                type="button"
                onClick={() => choose(c.entityId)}
                disabled={pending}
                className="w-full rounded-md border border-edge px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
              >
                {c.entityName}
                {pending && claimingId === c.entityId ? "…" : ""}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <Link
        href={`/m/${worldSlug}/joueur/nouveau-personnage`}
        className="rounded-full border border-accent px-4 py-2 text-center text-sm text-accent transition-colors hover:bg-accent/10"
      >
        Nouveau PJ
      </Link>
    </div>
  );
}
