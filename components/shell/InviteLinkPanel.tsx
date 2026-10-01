"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import ActionsMenu, { type ActionsMenuItem } from "@/components/shared/ActionsMenu";
import type { CampaignInviteSummary } from "@/src/server/services/campaignInvites";
import { useCachedGet } from "./useCachedGet";

const ROLE_LABELS: Record<string, string> = { gm: "MJ", player: "Joueur" };
// Plus de "Au choix" depuis V3.1-10 (ADR 0031) : un lien joueur reutilisable
// et un lien MJ nominatif ont des consequences trop differentes pour rester
// indecidees a la creation — c'est desormais le MJ qui tranche ici, jamais
// le visiteur qui ouvre le lien.
const ROLE_OPTIONS = [
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
  // Un lien joueur (V3.1-10, ADR 0031) est reutilisable : claimedName ne
  // veut plus rien dire pour lui (campaign_members fait foi, jamais suivi
  // par invite) — ne JAMAIS le traiter comme "reclame par une personne".
  const reusable = invite.intendedRole === "player";
  const claimed = !reusable && invite.claimedName !== null;
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
    : reusable
      ? "Ce lien cesse de fonctionner pour de nouvelles personnes. Celles qui l'ont déjà utilisé gardent leur accès (révocable individuellement dans « Membres »)."
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
          ) : reusable ? (
            <>
              <p className="text-sm text-ink">Joueur — lien réutilisable</p>
              <p className="text-xs text-ink-muted">
                Créé le {formatDate(invite.createdAt)} · qui l&apos;a utilisé apparaît dans « Membres »
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
 * Le panneau « Invitations » de la Gestion de campagne (V2-M4, refait
 * V3.1-15 d'après l'esquisse « A — Invitations en haut, une fiche par
 * personne »). En tête, les comptes ; puis **une seule ligne pour inviter** :
 * un courriel (compte déjà existant, ajouté directement) ou, sans courriel, un
 * lien — rôle et mot de passe optionnel, un seul bouton principal dont le
 * libellé dit ce qu'il va faire. Dessous, les liens en lignes calmes
 * (`InviteRow`, inchangé depuis V2.1-25).
 *
 * Trois sortes de liens, jamais confondues (V3.1-10, ADR 0031) : les liens
 * joueurs réutilisables, les liens MJ déjà utilisés, et les liens MJ qui
 * attendent quelqu'un. Une section vide ne s'affiche plus : son compte est
 * déjà dans l'en-tête.
 */
export default function InviteLinkPanel({
  campaignId,
  onEmailInvite,
  notice,
}: {
  campaignId: string;
  /** Ajout d'un compte existant par courriel — renvoie un message d'erreur, ou `null` si c'est fait. Absent (accueil, Administration) : pas de champ courriel. */
  onEmailInvite?: (email: string, role: "gm" | "player") => Promise<string | null>;
  /** Rappel affiché au-dessus de la ligne d'invitation (cadre d'une référence personnelle). */
  notice?: React.ReactNode;
}) {
  // `useCachedGet` (retour utilisateur : "elle a l'air de se recharger a
  // chaque changement d'onglet") — evite le flash "Chargement..." quand ce
  // composant remonte a chaque bascule de section (Monde/Regles/MJ).
  const { data, reload: load } = useCachedGet<{ invites: CampaignInviteSummary[] }>(
    `invites:${campaignId}`,
    `/api/campaigns/${campaignId}/invites`
  );
  const invites = data?.invites ?? null;
  // Plus de "Au choix" (V3.1-10) : "Joueur" est le cas le plus frequent, le
  // MJ change avant d'inviter si besoin.
  const [role, setRole] = useState<"gm" | "player">("player");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const notRevoked = invites?.filter((i) => i.revokedAt === null) ?? [];
  // Un lien joueur (V3.1-10) est reutilisable : jamais range parmi les liens
  // MJ, sa propre section tant qu'il n'est pas revoque.
  const reusableLinks = notRevoked.filter((i) => i.intendedRole === "player");
  const claimed = notRevoked.filter((i) => i.intendedRole !== "player" && i.claimedName !== null);
  const pending = notRevoked.filter((i) => i.intendedRole !== "player" && i.claimedName === null);
  const byEmail = email.trim() !== "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (byEmail && onEmailInvite) {
      const failure = await onEmailInvite(email.trim(), role);
      setBusy(false);
      if (failure) {
        setError(failure);
        return;
      }
      setEmail("");
      return;
    }
    const res = await fetch(`/api/campaigns/${campaignId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intendedRole: role, password: password || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la génération du lien.");
      return;
    }
    setPassword("");
    load();
  }

  const rowProps = { copiedUrl, onCopy: setCopiedUrl, onRevoked: load, onChanged: load };
  const inputClass = "min-w-0 rounded-md border border-edge bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted disabled:opacity-50";

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-edge bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg text-ink">Invitations</h3>
        <span className="text-xs text-ink-muted">
          {reusableLinks.length} lien{reusableLinks.length !== 1 ? "s" : ""} joueur{reusableLinks.length !== 1 ? "s" : ""} actif{reusableLinks.length !== 1 ? "s" : ""} · {pending.length} lien{pending.length !== 1 ? "s" : ""} MJ en attente
        </span>
      </div>
      {notice}
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        {onEmailInvite && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="courriel d'un compte existant (optionnel)"
            aria-label="Courriel"
            className={`flex-1 basis-56 ${inputClass}`}
          />
        )}
        <Dropdown
          value={role}
          options={ROLE_OPTIONS}
          onChange={(v) => setRole(v as "gm" | "player")}
          aria-label="Rôle de l'invitation"
          triggerClassName="shrink-0 rounded-full border border-edge px-3 py-1.5 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
        />
        {/* Un mot de passe protège un LIEN : sans objet pour un courriel. */}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={byEmail}
          placeholder="mot de passe (optionnel)"
          aria-label="Mot de passe du lien"
          className={`w-48 ${inputClass}`}
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Envoi…" : byEmail ? "Inviter par courriel" : "Générer un lien"}
        </button>
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}

      {reusableLinks.length > 0 && (
        <ul className="flex flex-col border-t border-edge/40">
          {reusableLinks.map((invite) => (
            <InviteRow key={invite.id} invite={invite} {...rowProps} />
          ))}
        </ul>
      )}
      {pending.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Liens MJ en attente — {pending.length}</h4>
          <ul className="flex flex-col">
            {pending.map((invite) => (
              <InviteRow key={invite.id} invite={invite} {...rowProps} />
            ))}
          </ul>
        </div>
      )}
      {claimed.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Liens MJ utilisés — {claimed.length}</h4>
          <ul className="flex flex-col">
            {claimed.map((invite) => (
              <InviteRow key={invite.id} invite={invite} {...rowProps} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
