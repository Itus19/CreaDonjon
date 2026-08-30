"use client";

import { useEffect, useState } from "react";

interface MyInvite {
  id: string;
  hasPassword: boolean;
}

/**
 * « Mon lien d'invitation » (V2-M4 suite, retour utilisateur 30 août :
 * « seul le superadmin et la personne concernée peut le changer »). Ne
 * s'affiche que pour un compte qui a rejoint par un lien (`/api/my-invite`
 * renvoie `null` pour tout autre compte, y compris le superadmin) — jamais
 * un encart vide.
 */
export default function MyInvitePanel() {
  const [invite, setInvite] = useState<MyInvite | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/my-invite")
      .then((res) => (res.ok ? res.json() : { invite: null }))
      .then((body: { invite: MyInvite | null }) => setInvite(body.invite))
      .catch(() => setInvite(null));
  }, []);

  if (!invite) return null;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/my-invite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Échec de la mise à jour.");
      return;
    }
    setInvite((prev) => (prev ? { ...prev, hasPassword: password.trim() !== "" } : prev));
    setPassword("");
    setSaved(true);
  }

  return (
    <section className="flex flex-col gap-2 border-t border-edge pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Mon lien d&apos;invitation</h3>
      <p className="text-sm text-ink-muted">
        {invite.hasPassword ? "Ce lien est protégé par un mot de passe." : "Ce lien n'a pas de mot de passe."}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={invite.hasPassword ? "Nouveau mot de passe (vide pour retirer)" : "Ajouter un mot de passe"}
          className="flex-1 rounded-md border border-edge bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="shrink-0 rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {busy ? "..." : "Enregistrer"}
        </button>
      </div>
      {saved && <p className="text-xs text-accent">Enregistré.</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </section>
  );
}
