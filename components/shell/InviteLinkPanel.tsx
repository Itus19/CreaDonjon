"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import ActionsMenu, { type ActionsMenuItem } from "@/components/shared/ActionsMenu";
import EmptyState from "./EmptyState";
import type { CampaignInviteSummary } from "@/src/server/services/campaignInvites";
import { useCachedGet } from "./useCachedGet";

const ROLE_LABELS: Record<string, string> = { gm: "MJ", player: "Joueur" };
const ROLE_OPTIONS = [
  { value: "", label: "Au choix" },
  { value: "player", label: "Joueur" },
  { value: "gm", label: "MJ" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Une ligne de la liste (V2.1-25, lot 2 — esquisse « liste calme » retenue
 * par l'auteur). Trois choses la gouvernent, et chacune corrige un defaut
 * compte sur sa capture :
 *
 * - **La hierarchie est remise a l'endroit.** Ce qu'on cherche ici, c'est
 *   qui est a la table : le nom passe en `text-sm`, le role et la date
 *   descendent en `text-xs`. C'etait l'inverse.
 * - **Les actions sont a abscisse fixe**, dans un `ActionsMenu` colle a
 *   droite. Avant, « Reinitialiser le personnage » etait accroche a la fin
 *   d'une phrase de longueur variable : quatre lignes, quatre positions.
 * - **Les deux gestes destructeurs confirment.** Ils partaient au premier
 *   clic, alors que l'un coupe un acces et l'autre libere la fiche d'une
 *   joueuse.
 *
 * `Copier` reste un bouton visible pour un lien EN ATTENTE, ou c'est la
 * seule action qui compte, et descend dans le menu pour un lien deja
 * reclame : recopier le lien de quelqu'un qui est entre il y a dix jours
 * n'avance sur rien.
 */
function InviteRow({
  invite,
  copiedUrl,
  onCopy,
  onRevoked,
  onChanged,
}: {
  invite: CampaignInviteSummary;
  copiedUrl: string | null;
  onCopy: (url: string) => void;
  onRevoked: (id: string) => void;
  onChanged: () => void;
}) {
  const [editingPassword, setEditingPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(invite.hasPassword);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const url = invite.token ? `${window.location.origin}/rejoindre/${invite.token}` : null;
  const copied = copiedUrl !== null && copiedUrl === url;
  const claimed = invite.claimedName !== null;
  const roleLabel = invite.intendedRole ? ROLE_LABELS[invite.intendedRole] : "Au choix";

  /**
   * Reinitialise le choix de personnage (retour utilisateur : "je dois
   * pouvoir, en tant que MJ, reinitialiser le choix d'un personnage PJ")
   * — reutilise l'endpoint existant d'attribution de personnage
   * (`CampaignDetail.tsx`, "Personnages attribues"), un `userId: null`
   * revient exactement a une fiche jamais encore reclamee. `isPc: true`
   * explicite : seul un personnage deja marque PJ atteint ce bouton.
   */
  async function resetCharacter() {
    setConfirmingReset(false);
    if (!invite.claimedEntityId || !invite.campaignId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${invite.campaignId}/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId: invite.claimedEntityId, userId: null, isPc: true }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la réinitialisation du personnage.");
      return;
    }
    onChanged();
  }

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
    setHasPassword(password.trim() !== "");
    setEditingPassword(false);
    setPassword("");
  }

  /**
   * V2.1-25 (lot 1) : revoquer retire desormais l'ACCES et plus seulement le
   * jeton — d'ou la confirmation, qui NOMME ce qui va partir plutot que de
   * demander « etes-vous sur ? » a vide. Le compte, lui, survit.
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

  function copy() {
    if (!url) return;
    void navigator.clipboard.writeText(url).then(() => onCopy(url));
  }

  /** La garde vit dans le geste : `ActionsMenuItem` n'a pas de champ `disabled`, et sans elle deux clics pendant une requete en cours enverraient deux revocations. */
  const ignoreSiBusy = (geste: () => void) => () => {
    if (busy) return;
    geste();
  };

  const actions: ActionsMenuItem[] = [
    ...(url && claimed ? [{ label: copied ? "Copié ✓" : "Copier le lien", onSelect: copy }] : []),
    { label: editingPassword ? "Fermer le mot de passe" : hasPassword ? "Changer le mot de passe" : "Ajouter un mot de passe", onSelect: () => setEditingPassword((v) => !v) },
    ...(invite.claimedEntityId
      ? [{ label: "Réinitialiser le personnage", onSelect: ignoreSiBusy(() => setConfirmingReset(true)), danger: true }]
      : []),
    { label: "Révoquer", onSelect: ignoreSiBusy(() => setConfirmingRevoke(true)), danger: true },
  ];

  // Aucun pronom : les messages nomment la personne puis parlent du COMPTE,
  // ce qui evite de lui supposer un genre — la table en compte de plusieurs.
  const revokeMessage = claimed
    ? `${invite.claimedName} perd l'accès à cette campagne${invite.claimedCharacterName ? `, et ${invite.claimedCharacterName} redevient libre` : ""}. Le compte et les fiches créées depuis ce compte sont conservés.`
    : "Ce lien cesse de fonctionner. Personne ne l'avait encore utilisé.";

  return (
    <li className="flex flex-col gap-2 border-b border-edge/40 py-2 last:border-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {claimed ? (
            <>
              <p className="truncate text-sm text-ink">
                {invite.claimedName}
                {invite.claimedCharacterName && <span className="text-ink-muted"> joue {invite.claimedCharacterName}</span>}
              </p>
              <p className="text-xs text-ink-muted">
                {roleLabel} · lien créé le {formatDate(invite.createdAt)}
                {hasPassword && <span className="ml-1.5 text-accent">· protégé</span>}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-ink">{roleLabel}</p>
              <p className="text-xs text-ink-muted">
                Créé le {formatDate(invite.createdAt)} · jamais ouvert
                {hasPassword && <span className="ml-1.5 text-accent">· protégé</span>}
              </p>
            </>
          )}
        </div>

        {url && !claimed && (
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
          >
            {copied ? "Copié ✓" : "Copier"}
          </button>
        )}
        <ActionsMenu items={actions} aria-label={`Actions sur le lien de ${invite.claimedName ?? roleLabel}`} />
      </div>

      {editingPassword && (
        <div className="flex items-center gap-2 rounded-md border border-edge bg-panel-sunken p-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={hasPassword ? "Nouveau mot de passe (vide pour retirer)" : "Mot de passe (optionnel)"}
            className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none placeholder:text-ink-muted"
          />
          <button
            type="button"
            onClick={savePassword}
            disabled={busy}
            className="shrink-0 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      <ConfirmDialog
        open={confirmingRevoke}
        title="Révoquer ce lien ?"
        message={revokeMessage}
        confirmLabel="Révoquer"
        danger
        onConfirm={revoke}
        onCancel={() => setConfirmingRevoke(false)}
      />
      <ConfirmDialog
        open={confirmingReset}
        title="Réinitialiser le personnage ?"
        message={`${invite.claimedCharacterName ?? "Ce personnage"} redevient libre : un autre lien, ou celui-ci rouvert, pourra le réclamer. ${invite.claimedName ?? "La personne"} garde son accès à la campagne.`}
        confirmLabel="Réinitialiser"
        danger
        onConfirm={resetCharacter}
        onCancel={() => setConfirmingReset(false)}
      />
    </li>
  );
}

/**
 * Panneau complet (V2-M4 suite) : créer un lien (rôle + mot de passe
 * optionnel), lister les liens actifs, les copier/révoquer/reprotéger à
 * tout moment.
 *
 * Deux sections depuis V2.1-25 (lot 2), sur demande de l'auteur : **une
 * personne a ta table** et **un lien qui attend quelqu'un** sont deux objets
 * differents, que cette liste rendait a l'identique. La premiere section
 * repond a « qui joue ? », la seconde a « qu'est-ce que je dois encore
 * envoyer ? ».
 *
 * Pas de titre de panneau : les deux en-tetes de section disent deja ce que
 * chaque bloc contient, et l'ancien (« Liens d'invitation (sans email) »)
 * decrivait l'implementation tout en faisant doublon avec l'onglet Acces qui
 * le surmonte.
 */
export default function InviteLinkPanel({ campaignId }: { campaignId: string }) {
  // `useCachedGet` (retour utilisateur : "elle a l'air de se recharger a
  // chaque changement d'onglet") — evite le flash "Chargement..." quand ce
  // composant remonte a chaque bascule de section (Monde/Regles/MJ).
  const { data, reload: load } = useCachedGet<{ invites: CampaignInviteSummary[] }>(
    `invites:${campaignId}`,
    `/api/campaigns/${campaignId}/invites`
  );
  const invites = data?.invites ?? null;
  const [role, setRole] = useState<"gm" | "player" | "">("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const claimed = invites?.filter((i) => i.claimedName !== null) ?? [];
  const pending = invites?.filter((i) => i.claimedName === null) ?? [];

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intendedRole: role || null, password: password || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la génération du lien.");
      return;
    }
    setPassword("");
    load();
  }

  function handleRevoked() {
    load();
  }

  const rowProps = { copiedUrl, onCopy: setCopiedUrl, onRevoked: handleRevoked, onChanged: load };

  return (
    <div className="flex flex-col gap-4">
      {/* Le mot de passe est optionnel et rarement pose : il ne prend plus
          toute la largeur disponible, qui faisait de lui le champ principal
          d'un formulaire dont l'action est ailleurs. */}
      <form onSubmit={generate} className="flex flex-wrap items-center gap-2">
        <Dropdown
          value={role}
          options={ROLE_OPTIONS}
          onChange={(v) => setRole(v as "gm" | "player" | "")}
          aria-label="Rôle du lien"
          triggerClassName="shrink-0 rounded-full border border-edge px-3 py-1.5 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe (optionnel)"
          className="w-56 min-w-0 rounded-md border border-edge bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-full border border-accent px-4 py-1.5 text-sm text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          {busy ? "Génération..." : "Générer un lien"}
        </button>
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}

      {claimed.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            À la table — {claimed.length}
          </h3>
          <ul className="flex flex-col">
            {claimed.map((invite) => (
              <InviteRow key={invite.id} invite={invite} {...rowProps} />
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Liens en attente — {pending.length}
        </h3>
        {pending.length > 0 ? (
          <ul className="flex flex-col">
            {pending.map((invite) => (
              <InviteRow key={invite.id} invite={invite} {...rowProps} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Aucun lien en attente"
            description="Génère un lien ci-dessus, puis envoie-le à la personne que tu veux inviter. Elle choisira son personnage en l'ouvrant."
          />
        )}
      </section>
    </div>
  );
}
