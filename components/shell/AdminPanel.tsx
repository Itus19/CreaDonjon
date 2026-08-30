"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import type { CampaignInviteAdminSummary } from "@/src/server/services/campaignInvites";
import type { JournalEntry } from "@/src/server/services/activityJournal";

const ROLE_LABELS: Record<string, string> = { gm: "MJ", player: "Joueur" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

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
    if (!invite.claimedByUserId) return;
    if (!window.confirm(`Supprimer définitivement le compte de ${invite.claimedName ?? "cet ami"} ?`)) return;
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

  return (
    <li className="flex flex-col gap-1 border-b border-edge/40 pb-2 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink-muted">
          <span className="text-ink">{invite.worldName ?? "?"}</span>
          {invite.campaignName && <> — {invite.campaignName}</>}
          {" · "}
          {invite.intendedRole ? ROLE_LABELS[invite.intendedRole] : "Au choix"}
          {invite.hasPassword && <span className="ml-1.5 text-accent">· protégé</span>}
        </span>
        <div className="flex items-center gap-2">
          {url && <CopyButton url={url} copiedUrl={copiedUrl} onCopy={onCopy} />}
          <button type="button" onClick={() => setEditingPassword((v) => !v)} className="text-ink-muted hover:text-ink">
            Mot de passe
          </button>
          <button type="button" onClick={reset} disabled={busy} className="text-ink-muted hover:text-ink disabled:opacity-50">
            Réinitialiser
          </button>
          <button type="button" onClick={revoke} disabled={busy} className="text-danger hover:underline disabled:opacity-50">
            Révoquer
          </button>
          {invite.claimedByUserId && (
            <button type="button" onClick={deleteAccount} disabled={busy} className="text-danger hover:underline disabled:opacity-50">
              Supprimer le compte
            </button>
          )}
        </div>
      </div>
      {invite.claimedName && <span className="text-[11px] text-ink-muted">Réclamé par {invite.claimedName}</span>}
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
    </li>
  );
}

function JournalSection() {
  const [worlds, setWorlds] = useState<{ id: string; name: string }[] | null>(null);
  const [worldId, setWorldId] = useState("");
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/worlds")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { worlds: { id: string; name: string }[] }) => {
        setWorlds(body.worlds);
        setWorldId((prev) => prev || body.worlds[0]?.id || "");
      })
      .catch(() => setLoadError("Impossible de charger les mondes."));
  }, []);

  useEffect(() => {
    if (!worldId) return;
    fetch(`/api/admin/journal?worldId=${worldId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((body: { entries: JournalEntry[] }) => setEntries(body.entries))
      .catch(() => setLoadError("Impossible de charger le journal."));
  }, [worldId]);

  if (worlds === null) {
    return loadError ? <p className="text-xs text-danger">{loadError}</p> : <p className="text-xs text-ink-muted">…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Dropdown
        value={worldId}
        onChange={setWorldId}
        options={worlds.map((w) => ({ value: w.id, label: w.name }))}
        aria-label="Monde"
        className="self-start rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
      />
      {loadError && <p className="text-xs text-danger">{loadError}</p>}
      {entries && entries.length === 0 && <p className="text-xs text-ink-muted">Aucune activité pour l&apos;instant.</p>}
      {entries && entries.length > 0 && (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto text-xs">
          {entries.map((entry, i) => (
            <li key={i} className="flex items-center justify-between gap-2 border-b border-edge/30 pb-1">
              <span className="text-ink-muted">
                <span className={entry.source === "wiki" ? "text-accent" : "text-ink"}>
                  {entry.source === "wiki" ? "wiki" : "jeu"}
                </span>
                {"  "}
                {entry.label}
                {entry.entityName && <> — {entry.entityName}</>}
              </span>
              <span className="shrink-0 text-ink-muted">
                {entry.accountName} · {formatDateTime(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Section Administration (V2-M6, Lot M) — visible uniquement pour
 * `is_superadmin()` (verifie cote serveur avant meme de rendre ce
 * composant, voir app/page.tsx). Deux blocs : la liste transversale des
 * liens d'invitation, et le journal fusionne par monde.
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

      <section className="flex flex-col gap-2 border-t border-edge/60 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Journal fusionné</h3>
        <JournalSection />
      </section>
    </div>
  );
}
