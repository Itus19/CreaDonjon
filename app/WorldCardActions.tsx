"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteWorldAction,
  renameCampaignAction,
  renameWorldAction,
  type DeleteWorldState,
  type RenameCampaignState,
  type RenameWorldState,
} from "@/app/actions";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

/**
 * Renommage (V2, retour utilisateur, ecran d'accueil) : "etes-vous sur ?"
 * avant d'ecrire, meme reflexe que `DeleteWorldSection` ci-dessous mais
 * sans mot de confirmation — un renommage se defait (on peut retaper
 * l'ancien nom), une suppression non.
 */
function RenameWorldSection({ worldId, worldName }: { worldId: string; worldName: string }) {
  const [revealed, setRevealed] = useState(false);
  const [name, setName] = useState(worldName);
  const [state, formAction, pending] = useActionState<RenameWorldState, FormData>(renameWorldAction, null);
  // Ferme le panneau des la reussite — ajustement pendant le rendu (React,
  // "Adjusting state when a prop changes"), pas dans un effet : meme motif
  // que `prevRelations` dans RelationsChips.tsx, la regle react-hooks
  // refuse un `setState` synchrone dans un effet pour ce cas.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state && "ok" in state) setRevealed(false);
  }

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(worldName);
          setRevealed(true);
        }}
        className="rounded-full border border-edge px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:bg-panel-raised"
      >
        Renommer
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 rounded-md border border-edge bg-panel-raised p-3">
      <input type="hidden" name="worldId" value={worldId} />
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Nouveau nom
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
          className="w-full rounded-md border border-edge bg-panel px-2.5 py-1.5 text-sm text-ink outline-none"
        />
      </label>
      <p className="text-xs text-ink-muted">Êtes-vous sûr de vouloir renommer ce monde ?</p>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || name.trim() === "" || name.trim() === worldName}
          className="rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel disabled:opacity-40"
        >
          {pending ? "Renommage..." : "Confirmer"}
        </button>
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="rounded-md border border-edge px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-panel-raised"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

/**
 * Renommage de la CAMPAGNE, pas du monde (V2-M1, retour utilisateur :
 * plusieurs copies d'un meme monde — une par ami MJ — deviennent
 * distinguables par le nom de leur campagne, ex. "La Croisade des Ombres
 * avec Jérémy"). Meme reflexe que `RenameWorldSection`, sur un champ
 * different.
 */
function RenameCampaignSection({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const [revealed, setRevealed] = useState(false);
  const [name, setName] = useState(campaignName);
  const [state, formAction, pending] = useActionState<RenameCampaignState, FormData>(renameCampaignAction, null);
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state && "ok" in state) setRevealed(false);
  }

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(campaignName);
          setRevealed(true);
        }}
        className="rounded-full border border-edge px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:bg-panel-raised"
      >
        Renommer la campagne
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 rounded-md border border-edge bg-panel-raised p-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Nom de la campagne
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
          className="w-full rounded-md border border-edge bg-panel px-2.5 py-1.5 text-sm text-ink outline-none"
        />
      </label>
      <p className="text-xs text-ink-muted">Êtes-vous sûr de vouloir renommer cette campagne ?</p>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || name.trim() === "" || name.trim() === campaignName}
          className="rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel disabled:opacity-40"
        >
          {pending ? "Renommage..." : "Confirmer"}
        </button>
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="rounded-md border border-edge px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-panel-raised"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

/**
 * Suppression definitive (V2, retour utilisateur, ecran d'accueil) : meme
 * DA que `DeleteAccountSection` (SettingsMenu.tsx) — mais le mot de
 * confirmation est le nom EXACT du monde, pas un mot fixe, puisqu'il n'y a
 * ici aucune traduction figee a comparer.
 */
function DeleteWorldSection({ worldId, worldName }: { worldId: string; worldName: string }) {
  const [revealed, setRevealed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState<DeleteWorldState, FormData>(deleteWorldAction, null);

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="rounded-full border border-danger/50 px-2 py-0.5 text-[11px] text-danger transition-colors hover:bg-danger/10"
      >
        Supprimer
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 rounded-md border border-danger/50 bg-danger/5 p-3">
      <input type="hidden" name="worldId" value={worldId} />
      <p className="text-xs text-danger">
        Suppression définitive : le monde, ses fiches et son historique seront perdus, sans retour en arrière possible.
      </p>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Tapez « {worldName} » pour confirmer
        <input
          name="confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          className="w-full rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 font-mech text-sm text-ink outline-none"
        />
      </label>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || confirmation !== worldName}
          className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-danger/90 disabled:opacity-40"
        >
          {pending ? "Suppression..." : "Confirmer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRevealed(false);
            setConfirmation("");
          }}
          className="rounded-md border border-edge px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-panel-raised"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

/** Exporter/dupliquer/renommer/supprimer un monde depuis l'ecran d'accueil (V2-G1, dernier point ; V2 renommage+suppression) — hors du <Link> de la carte, ce sont des actions, pas une navigation. */
export default function WorldCardActions({
  worldId,
  worldSlug,
  worldName,
  campaignId,
  campaignName,
  isOwner,
}: {
  worldId: string;
  worldSlug: string;
  worldName: string;
  /** `null` : monde sans campagne (ancien monde pas encore complete) — pas de bouton "Renommer la campagne" dans ce cas. */
  campaignId: string | null;
  campaignName: string | null;
  /** Renommer/supprimer sont reserves au proprietaire (RLS `worlds_write` les refuserait sinon) — inutile d'afficher un bouton qui echoue toujours a un simple membre invite. */
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"export" | "duplicate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Export deja recu du serveur, en attente d'un accord sur ses
   * avertissements (`ConfirmDialog` remplace `window.confirm`, asynchrone
   * la ou l'ancien etait bloquant) : les donnees sont conservees telles
   * quelles pour ne pas refaire l'aller-retour a la confirmation.
   */
  const [pendingExport, setPendingExport] = useState<{ data: unknown; warnings: string[]; suggestedFilename: string } | null>(null);

  function downloadExport(payload: { data: unknown; suggestedFilename: string }) {
    const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = payload.suggestedFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExport(e: React.MouseEvent) {
    e.preventDefault();
    setPending("export");
    setError(null);
    const res = await fetch(`/api/worlds/${worldSlug}/export`);
    setPending(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de l'export.");
      return;
    }
    const payload = (await res.json()) as { data: unknown; warnings: string[]; suggestedFilename: string };
    if (payload.warnings.length > 0) {
      setPendingExport(payload);
      return;
    }
    downloadExport(payload);
  }

  async function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault();
    setPending("duplicate");
    setError(null);
    const res = await fetch(`/api/worlds/${worldSlug}/duplicate`, { method: "POST" });
    setPending(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec de la duplication.");
      return;
    }
    const { world, campaign } = await res.json();
    router.push(campaign.mode === "solo" ? `/m/${world.slug}/mj/creation-personnage` : `/m/${world.slug}`);
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={pending !== null}
          className="rounded-full border border-edge px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {pending === "export" ? "Export..." : "Exporter"}
        </button>
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={pending !== null}
          className="rounded-full border border-edge px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {pending === "duplicate" ? "Duplication..." : "Dupliquer"}
        </button>
        {isOwner && <RenameWorldSection worldId={worldId} worldName={worldName} />}
        {isOwner && campaignId && campaignName && (
          <RenameCampaignSection campaignId={campaignId} campaignName={campaignName} />
        )}
        {isOwner && <DeleteWorldSection worldId={worldId} worldName={worldName} />}
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>

      <ConfirmDialog
        open={pendingExport !== null}
        title="Exporter ce monde ?"
        message={`${pendingExport?.warnings.join(" ") ?? ""} Continuer le téléchargement ?`}
        confirmLabel="Télécharger"
        onConfirm={() => {
          const payload = pendingExport;
          setPendingExport(null);
          if (payload) downloadExport(payload);
        }}
        onCancel={() => setPendingExport(null)}
      />
    </div>
  );
}
