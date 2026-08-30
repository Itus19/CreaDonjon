"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateDisplayNameAction, type UpdateDisplayNameState } from "@/app/settings/actions";

/** Champ modifiable en place (V1-A1) — reutilise dans Reglages et sur l'ecran d'accueil (colonne profil, retour utilisateur). */
export default function DisplayNameForm({ initialDisplayName }: { initialDisplayName: string }) {
  const t = useTranslations("settings.compte");
  const [state, formAction, pending] = useActionState<UpdateDisplayNameState, FormData>(
    updateDisplayNameAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input
        name="displayName"
        defaultValue={initialDisplayName}
        placeholder={t("pseudoPlaceholder")}
        maxLength={80}
        className="w-full rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
      >
        {state && "ok" in state ? t("enregistre") : t("enregistrer")}
      </button>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}
