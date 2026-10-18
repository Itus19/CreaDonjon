"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface MyInvite {
  id: string;
  hasPassword: boolean;
}

/**
 * « Mon lien d'invitation » (V2-M4 suite). V3.1-80 : l'invitation arrive avec
 * la page (`initialInvite`, docs/CABLAGE.md C1) — plus aucun chargement au
 * montage. La page ne monte ce panneau que pour un compte qui a rejoint par un
 * lien. Seul le PATCH de `/api/my-invite` reste.
 */
export default function MyInvitePanel({ initialInvite }: { initialInvite: MyInvite }) {
  const t = useTranslations("compte");
  const [invite, setInvite] = useState<MyInvite>(initialInvite);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
      setError(t("invitationEchec"));
      return;
    }
    setInvite((prev) => ({ ...prev, hasPassword: password.trim() !== "" }));
    setPassword("");
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink-muted">{invite.hasPassword ? t("invitationProtege") : t("invitationLibre")}</p>
      <label htmlFor="compte-invitation-mdp" className="text-xs text-ink-muted">
        {t("invitationLabel")}
      </label>
      <input
        id="compte-invitation-mdp"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={invite.hasPassword ? t("invitationPlaceholderProtege") : t("invitationPlaceholderLibre")}
        className="w-full rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="self-start rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none"
      >
        {busy ? "…" : t("enregistrer")}
      </button>
      {saved && <p className="text-xs text-accent">{t("enregistre")}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
