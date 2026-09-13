"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import type { CampaignInviteAdminSummary } from "@/src/server/services/campaignInvites";

const ROLE_LABELS: Record<string, string> = { gm: "MJ", player: "Joueur" };

function CopyButton({ url, copiedUrl, onCopy }: { url: string; copiedUrl: string | null; onCopy: (url: string) => void }) {
  const copied = copiedUrl === url;
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(url).then(() => onCopy(url))}
      className="shrink-0 rounded-md border border-accent px-2 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
    >
      {copied ? "Copié ✓" : "Copier"}
    </button>
  );
}

/**
 * Une ligne de la liste transversale (V2-M6) : même geste que
 * `InviteLinkPanel.tsx` (mot de passe, révoquer), plus « Réinitialiser »
 * (nouveau jeton) et « Supprimer le compte » (superadmin uniquement,
 * définitif — libère la fiche revendiquée et les octrois, cf.
 * `accountProvisioning.ts`).
 */
function InviteAdminRow({
  invite,
  copiedUrl,
  onCopy,
  onRevoked,
  onChanged,
}: {
  invite: CampaignInviteAdminSummary;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
  onRevoked: (id: string) => void;
  onChanged: () => void;
}) {
  const [editingPassword, setEditingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  /** Suppression d'un compte invite : `ConfirmDialog` est asynchrone, contrairement a `window.confirm` qu'il remplace ici. */
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const url = freshUrl ?? (invite.token ? `${window.location.origin}/rejoindre/${invite.token}` : null);

  async function savePassword() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${invite.campaignId}/invites/${invite.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la mise à jour.");
      return;
    }
    setEditingPassword(false);
    setPassword("");
    onChanged();
  }

  async function reset() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/invites/${invite.id}/reset`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la réinitialisation.");
      return;
    }
    const body = (await res.json()) as { url: string };
    setFreshUrl(`${window.location.origin}${body.url}`);
  }

  async function revoke() {
    setBusy(true);
    const res = await fetch(`/api/campaigns/${invite.campaignId}/invites/${invite.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onRevoked(invite.id);
  }

  async function deleteAccount() {
    setConfirmingDelete(false);
    if (!invite.claimedByUserId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/accounts/${invite.claimedByUserId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la suppression.");
      return;
    }
    onRevoked(invite.id);
  }

  /**
   * "Voir comme" (retour utilisateur) : changement de session REEL — un
   * bandeau (ViewAsBanner, rendu depuis app/layout.tsx) reste visible
   * partout tant que ce mode est actif, avec un bouton de retour immediat.
   */
  async function viewAs() {
    if (!invite.claimedByUserId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: invite.claimedByUserId }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Échec du changement de session.");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  }

  return (
    <li className="flex flex-col gap-1 border-b border-edge/40 pb-2 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-ink-muted">
          <span>
            <span className="text-ink">{invite.worldName ?? "?"}</span>
            {invite.campaignName && <> — {invite.campaignName}</>}
            {" · "}
            {invite.intendedRole ? ROLE_LABELS[invite.intendedRole] : "Au choix"}
            {invite.claimedName && <> · Réclamé par {invite.claimedName}</>}
            {invite.hasPassword && <span className="ml-1.5 text-accent">· protégé</span>}
          </span>
          {invite.claimedByUserId && (
            <button
              type="button"
              onClick={viewAs}
              disabled={busy}
              className="shrink-0 rounded-md border border-accent px-2 py-1 text-xs text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              Voir comme
            </button>
          )}
        </span>
        <div className="flex items-center gap-2">
          {url && <CopyButton url={url} copiedUrl={copiedUrl} onCopy={onCopy} />}
          <button
            type="button"
            onClick={() => setEditingPassword((v) => !v)}
            className="shrink-0 rounded-md border border-edge px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
          >
            Mot de passe
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="shrink-0 rounded-md border border-edge px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={revoke}
            disabled={busy}
            className="shrink-0 rounded-md border border-danger px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
          >
            Révoquer
          </button>
          {invite.claimedByUserId && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="shrink-0 rounded-md border border-danger px-2 py-1 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
            >
              Supprimer le compte
            </button>
          )}
        </div>
      </div>
      {freshUrl && (
        <p className="text-[11px] text-danger">Nouveau lien généré — copiez-le maintenant, l&apos;ancien ne fonctionne plus.</p>
      )}
      {editingPassword && (
        <div className="flex items-center gap-2 rounded-md border border-edge bg-panel-sunken p-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={invite.hasPassword ? "Nouveau mot de passe (vide pour retirer)" : "Mot de passe (optionnel)"}
            className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none placeholder:text-ink-muted"
          />
          <button
            type="button"
            onClick={savePassword}
            disabled={busy}
            className="shrink-0 rounded-md border border-edge px-2 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      )}
      {error && <p className="text-[11px] text-danger">{error}</p>}

      <ConfirmDialog
        open={confirmingDelete}
        title="Supprimer ce compte ?"
        message={`Le compte de ${invite.claimedName ?? "cet ami"} est définitivement supprimé, ainsi que son accès à la campagne. Les fiches qu'il a créées sont conservées.`}
        confirmLabel="Supprimer le compte"
        danger
        onConfirm={deleteAccount}
        onCancel={() => setConfirmingDelete(false)}
      />
    </li>
  );
}

/**
 * Section Administration (V2-M6, Lot M) — visible uniquement pour
 * `is_superadmin()` (verifie cote serveur avant meme de rendre ce
 * composant, voir app/page.tsx). Liste transversale des liens
 * d'invitation, tous mondes confondus.
 *
 * Le journal fusionne transversal (V2-M6) a ete retire d'ici (retour
 * utilisateur) : il faisait doublon exact avec celui de la colonne de
 * droite de l'ecran d'accueil (meme fonction, `getMergedJournalForWorld`)
 * tant que le superadmin est membre de tous les mondes existants — ce qui
 * est toujours le cas aujourd'hui. Redeviendra utile avec V2-M8 (dupliquer
 * Valdoria pour un ami MJ) : un monde appartenant entierement a un ami,
 * absent de la liste personnelle du superadmin, mais que ce dernier garde
 * le droit de consulter. `getMergedJournalForWorld`/`/api/admin/journal`
 * restent en place, prets a etre reexposes a ce moment-la.
 */
export default function AdminPanel() {
  const [invites, setInvites] = useState<CampaignInviteAdminSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/invites")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { invites: CampaignInviteAdminSummary[] }) => setInvites(body.invites))
      .catch(() => setLoadError("Impossible de charger les liens."));
  }

  useEffect(load, []);

  function handleRevoked(id: string) {
    setInvites((prev) => prev?.filter((i) => i.id !== id) ?? null);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-accent/40 bg-panel-sunken p-4">
      <h2 className="block-title text-base text-accent">Administration</h2>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Liens d&apos;invitation — tous mondes</h3>
        {loadError && <p className="text-xs text-danger">{loadError}</p>}
        {invites === null && !loadError && <p className="text-xs text-ink-muted">…</p>}
        {invites && invites.length === 0 && <p className="text-xs text-ink-muted">Aucun lien actif pour l&apos;instant.</p>}
        {invites && invites.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-xs">
            {invites.map((invite) => (
              <InviteAdminRow key={invite.id} invite={invite} copiedUrl={copiedUrl} onCopy={setCopiedUrl} onRevoked={handleRevoked} onChanged={load} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
