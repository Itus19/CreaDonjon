"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { deleteAccountAction, type DeleteAccountState } from "@/app/settings/actions";
import { confirmationValide } from "@/lib/ui/pageCompte";

/**
 * Suppression du compte (V1-A1b), section rouge de la page Compte (V3.1-80) :
 * ce qui disparait est nomme, le champ est toujours visible, le bouton reste
 * desactive tant que le mot attendu n'est pas tape. Action et mot inchanges.
 */
export default function DeleteAccountSection({ mondesPossedes }: { mondesPossedes: string[] }) {
  const t = useTranslations("settings.suppression");
  const tc = useTranslations("compte");
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(deleteAccountAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <p className="text-sm text-ink-muted">
        {mondesPossedes.length > 0 ? tc("suppressionIntro") : tc("suppressionAucunMonde")}
      </p>
      {mondesPossedes.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-ink">
          {mondesPossedes.map((nom, i) => (
            <li key={i} className="break-words">
              {nom}
            </li>
          ))}
        </ul>
      )}
      <label htmlFor="compte-suppression" className="text-xs text-ink-muted">
        {tc("suppressionTape")}
      </label>
      <input
        id="compte-suppression"
        name="confirmation"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className="w-full rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 font-mech text-sm text-ink outline-none"
        autoComplete="off"
      />
      {state?.error && <p className="text-xs text-danger">{t("erreur")}</p>}
      <button
        type="submit"
        disabled={pending || !confirmationValide(confirmation, t("confirmationMot"))}
        className="self-start rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-danger/90 disabled:opacity-40 motion-reduce:transition-none"
      >
        {pending ? t("enCours") : t("confirmer")}
      </button>
    </form>
  );
}
