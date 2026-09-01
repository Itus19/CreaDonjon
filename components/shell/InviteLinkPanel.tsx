"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
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
 * Bouton copier reutilisable, meme motif que celui de `ShareLinkPanel.tsx`
 * (un seul etat "juste copie" partage par tous les liens de ce panneau).
 */
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
 * Un lien d'invitation, dans la liste (V2-M4 suite, retour utilisateur 30
 * août : « reprends ce qu'on a fait pour le lien de partage » — meme
 * structure que `ShareLinkPanel.tsx`, jamais un jeton affiche une seule
 * fois puis perdu). Le mot de passe se change en place (jamais rappele en
 * clair une fois pose : seul `hasPassword` atteint ce composant).
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
  const url = invite.token ? `${window.location.origin}/rejoindre/${invite.token}` : null;

  /**
   * Reinitialise le choix de personnage (retour utilisateur : "je dois
   * pouvoir, en tant que MJ, reinitialiser le choix d'un personnage PJ")
   * — reutilise l'endpoint existant d'attribution de personnage
   * (`CampaignDetail.tsx`, "Personnages attribues"), un `userId: null`
   * revient exactement a une fiche jamais encore reclamee. `isPc: true`
   * explicite : seul un personnage deja marque PJ atteint ce bouton.
   */
  async function resetCharacter() {
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

  async function revoke() {
    setBusy(true);
    const res = await fetch(`/api/campaigns/${invite.campaignId}/invites/${invite.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onRevoked(invite.id);
  }

  return (
    <li className="flex flex-col gap-1 border-b border-edge/40 pb-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-muted">
          {invite.intendedRole ? ROLE_LABELS[invite.intendedRole] : "Au choix"} · créé le {formatDate(invite.createdAt)}
          {hasPassword && <span className="ml-1.5 text-accent">· protégé</span>}
        </span>
        <div className="flex items-center gap-2">
          {url && <CopyButton url={url} copiedUrl={copiedUrl} onCopy={onCopy} />}
          <button type="button" onClick={() => setEditingPassword((v) => !v)} className="text-ink-muted hover:text-ink">
            Mot de passe
          </button>
          <button type="button" onClick={revoke} disabled={busy} className="text-danger hover:underline disabled:opacity-50">
            Révoquer
          </button>
        </div>
      </div>
      {invite.claimedName && (
        <span className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
          Réclamé par {invite.claimedName}
          {invite.claimedCharacterName && <> · joue {invite.claimedCharacterName}</>}
          {invite.claimedEntityId && (
            <button
              type="button"
              onClick={resetCharacter}
              disabled={busy}
              title="Libère ce personnage — un autre lien (ou celui-ci rouvert) pourra le réclamer à nouveau."
              className="text-danger hover:underline disabled:opacity-50"
            >
              Réinitialiser le personnage
            </button>
          )}
        </span>
      )}
      {editingPassword && (
        <div className="flex items-center gap-2 rounded-md border border-edge bg-panel-sunken p-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={hasPassword ? "Nouveau mot de passe (vide pour retirer)" : "Mot de passe (optionnel)"}
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
    </li>
  );
}

/**
 * Panneau complet (V2-M4 suite) : créer un lien (rôle + mot de passe
 * optionnel), lister les liens actifs, les copier/révoquer/reprotéger à
 * tout moment — remplace le générateur « affiché une seule fois » du
 * premier passage de ce ticket.
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

  return (
    <div className="flex flex-col gap-2 rounded-md border border-edge bg-panel-sunken p-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Liens d&apos;invitation (sans email)</p>

      <form onSubmit={generate} className="flex items-center gap-2">
        <Dropdown
          value={role}
          options={ROLE_OPTIONS}
          onChange={(v) => setRole(v as "gm" | "player" | "")}
          aria-label="Rôle du lien"
          className="shrink-0 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe (optionnel)"
          className="flex-1 rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {busy ? "Génération..." : "Générer un lien"}
        </button>
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}

      {invites && invites.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1.5 text-xs">
          {invites.map((invite) => (
            <InviteRow key={invite.id} invite={invite} copiedUrl={copiedUrl} onCopy={setCopiedUrl} onRevoked={handleRevoked} onChanged={load} />
          ))}
        </ul>
      )}
      {invites && invites.length === 0 && <p className="text-xs text-ink-muted">Aucun lien actif pour l&apos;instant.</p>}
    </div>
  );
}
