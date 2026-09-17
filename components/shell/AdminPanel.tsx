"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import ActionsMenu, { type ActionsMenuItem } from "@/components/shared/ActionsMenu";
import type { CampaignInviteAdminSummary } from "@/src/server/services/campaignInvites";

const ROLE_LABELS: Record<string, string> = { gm: "MJ", player: "Joueur" };

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
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const url = freshUrl ?? (invite.token ? `${window.location.origin}/rejoindre/${invite.token}` : null);
  const copied = copiedUrl !== null && copiedUrl === url;

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

  /**
   * V2.1-25 (lot 1) : cette route est partagee avec `InviteLinkPanel`, et
   * revoquer y retire desormais l'ACCES et plus seulement le jeton. Ce
   * panneau doit donc confirmer lui aussi — sans quoi le geste le plus
   * destructeur de l'ecran resterait le seul a partir au premier clic.
   */
  async function revoke() {
    setConfirmingRevoke(false);
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${invite.campaignId}/invites/${invite.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la révocation.");
      return;
    }
    onRevoked(invite.id);
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
    // `assign` et non `href = …` : une affectation sur un objet defini hors
    // du composant est refusee par `react-hooks/immutability` (compilateur
    // React). Le defaut dormait ici depuis V2-M7d ; il n'est remonte qu'en
    // V2.1-25, quand ce composant est devenu analysable par le compilateur.
    // Comportement identique — `assign` empile la meme entree d'historique.
    window.location.assign(url);
  }

  /**
   * Les six boutons de cette ligne sont devenus UN menu (V2.1-24, lot 4).
   * Trois raisons, toutes mesurees sur la capture de l'auteur : neuf lignes
   * a six boutons faisaient 52 controles simultanes ; ils se repliaient
   * faute de place, ce qui detruisait tout alignement d'une ligne a
   * l'autre ; et les deux actions destructrices avaient exactement le meme
   * dessin que « Copier ». L'ordre suit la frequence, et `danger` marque ce
   * qui ne se defait pas.
   *
   * Les anciens boutons portaient `disabled={busy}` ; `ActionsMenuItem` n'a
   * pas de champ `disabled`, donc la garde passe DANS le geste (`ignoreSiBusy`)
   * plutot que de disparaitre avec le bouton. Sans elle, deux clics pendant
   * une requete en cours enverraient deux revocations.
   */
  const ignoreSiBusy = (geste: () => void) => () => {
    if (busy) return;
    geste();
  };
  const actions: ActionsMenuItem[] = [
    ...(url ? [{ label: copied ? "Copié ✓" : "Copier le lien", onSelect: () => void navigator.clipboard.writeText(url).then(() => onCopy(url)) }] : []),
    ...(invite.claimedByUserId ? [{ label: "Voir comme", onSelect: ignoreSiBusy(() => void viewAs()) }] : []),
    { label: editingPassword ? "Fermer le mot de passe" : "Mot de passe", onSelect: () => setEditingPassword((v) => !v) },
    { label: "Réinitialiser le lien", onSelect: ignoreSiBusy(() => void reset()), danger: true },
    { label: "Révoquer", onSelect: ignoreSiBusy(() => setConfirmingRevoke(true)), danger: true },
    ...(invite.claimedByUserId ? [{ label: "Supprimer le compte", onSelect: ignoreSiBusy(() => setConfirmingDelete(true)), danger: true }] : []),
  ];

  return (
    <>
      <tr className="border-b border-edge/40">
        <td className="py-1.5 pr-2 align-top text-ink">{invite.worldName ?? "?"}</td>
        <td className="py-1.5 pr-2 align-top">{invite.campaignName ?? "—"}</td>
        <td className="py-1.5 pr-2 align-top">{invite.intendedRole ? ROLE_LABELS[invite.intendedRole] : "Au choix"}</td>
        <td className="py-1.5 pr-2 align-top">{invite.claimedName ?? "—"}</td>
        <td className="py-1.5 pr-2 align-top">
          {invite.hasPassword ? <span className="text-accent">protégé</span> : "—"}
        </td>
        <td className="py-1.5 align-top text-right">
          <ActionsMenu items={actions} aria-label={`Actions sur le lien ${invite.worldName ?? ""}`} />
          {/* `ConfirmDialog` rend `null` tant qu'il est ferme et passe par un
              portail quand il s'ouvre : il ne coute donc rien dans cette
              cellule et n'a pas besoin d'une ligne a lui. */}
          <ConfirmDialog
            open={confirmingRevoke}
            title="Révoquer ce lien ?"
            message={
              invite.claimedName
                ? `${invite.claimedName} perd l'accès à ${invite.campaignName ?? invite.worldName ?? "cette campagne"}, et son personnage redevient libre. Le compte et les fiches créées depuis ce compte sont conservés.`
                : "Ce lien cesse de fonctionner. Personne ne l'avait encore utilisé."
            }
            confirmLabel="Révoquer"
            danger
            onConfirm={revoke}
            onCancel={() => setConfirmingRevoke(false)}
          />
          <ConfirmDialog
            open={confirmingDelete}
            title="Supprimer ce compte ?"
            message={`Le compte de ${invite.claimedName ?? "cet ami"} est définitivement supprimé, ainsi que son accès à la campagne. Les fiches créées depuis ce compte sont conservées.`}
            confirmLabel="Supprimer le compte"
            danger
            onConfirm={deleteAccount}
            onCancel={() => setConfirmingDelete(false)}
          />
        </td>
      </tr>
      {freshUrl && (
        <tr>
          <td colSpan={6} className="pb-1.5 text-[11px] text-danger">
            Nouveau lien généré — copiez-le maintenant, l&apos;ancien ne fonctionne plus.
          </td>
        </tr>
      )}
      {editingPassword && (
        <tr>
          <td colSpan={6} className="pb-1.5">
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
          </td>
        </tr>
      )}
      {error && (
        <tr>
          <td colSpan={6} className="pb-1.5 text-[11px] text-danger">
            {error}
          </td>
        </tr>
      )}

    </>
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
        {/* Un vrai `<table>` et non une grille de `div` : les colonnes
            s'alignent d'une ligne a l'autre sans qu'on ait a figer des
            largeurs, et un lecteur d'ecran annonce l'en-tete de colonne avec
            chaque cellule. C'est ce que la liste d'avant ne faisait pas —
            ses six boutons se repliaient et plus rien ne s'alignait. */}
        {invites && invites.length > 0 && (
          <table className="w-full border-collapse text-left text-xs text-ink-muted">
            <thead>
              <tr className="border-b border-edge">
                <th className="py-1 pr-2 font-medium">Monde</th>
                <th className="py-1 pr-2 font-medium">Campagne</th>
                <th className="py-1 pr-2 font-medium">Rôle</th>
                <th className="py-1 pr-2 font-medium">Réclamé par</th>
                <th className="py-1 pr-2 font-medium">État</th>
                <th className="py-1 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <InviteAdminRow key={invite.id} invite={invite} copiedUrl={copiedUrl} onCopy={setCopiedUrl} onRevoked={handleRevoked} onChanged={load} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
