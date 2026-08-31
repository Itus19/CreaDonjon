"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteAccountAction, type DeleteAccountState } from "@/app/settings/actions";

/** Extrait tel quel de l'ancien menu de reglages (`SettingsMenu.tsx`, retour utilisateur : "supprimer le bouton de reglages") — deplace vers l'ecran d'accueil du compte, aux cotes du reste du profil (`HomeProfilePanel.tsx`). */
export default function DeleteAccountSection() {
  const t = useTranslations("settings.suppression");
  const [revealed, setRevealed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(deleteAccountAction, null);

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="self-start rounded-md border border-danger/50 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10"
      >
        {t("supprimerCompte")}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-danger/50 bg-danger/5 p-3">
      <p className="text-xs text-danger">{t("avertissement")}</p>
      <label className="text-xs text-ink-muted">
        {t("confirmationLabel")}
        <input
          name="confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className="mt-1 w-full rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 font-mech text-sm text-ink outline-none"
          autoComplete="off"
        />
      </label>
      {state?.error && <p className="text-xs text-danger">{t("erreur")}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || confirmation !== t("confirmationMot")}
          className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-danger/90 disabled:opacity-40"
        >
          {pending ? t("enCours") : t("confirmer")}
        </button>
        <button
          type="button"
          onClick={() => {
            setRevealed(false);
            setConfirmation("");
          }}
          className="rounded-md border border-edge px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-panel-raised"
        >
          {t("annuler")}
        </button>
      </div>
    </form>
  );
}
