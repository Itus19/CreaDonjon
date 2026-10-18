"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { updateOwnPasswordAction, type UpdatePasswordState } from "@/app/settings/actions";
import { motsDePasseDifferents } from "@/lib/ui/pageCompte";

const CHAMP =
  "w-full rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted";

/**
 * Definir/changer son mot de passe (section Connexion de la page Compte,
 * V3.1-80) — toujours optionnel, jamais impose. Deux champs : le bouton reste
 * desactive tant qu'ils different, l'action serveur ne change pas. Champs
 * vides apres un enregistrement, jamais le mot de passe reaffiche.
 */
export default function PasswordForm() {
  const t = useTranslations("compte");
  const [state, formAction, pending] = useActionState<UpdatePasswordState, FormData>(updateOwnPasswordAction, null);
  const [value, setValue] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const differents = motsDePasseDifferents(value, confirmation);

  return (
    <form
      action={(formData) => {
        formAction(formData);
        setValue("");
        setConfirmation("");
      }}
      className="flex flex-col gap-2"
    >
      <label htmlFor="compte-mdp" className="text-xs text-ink-muted">
        {t("nouveauMotDePasse")}
      </label>
      <input
        id="compte-mdp"
        type="password"
        name="password"
        autoComplete="new-password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={CHAMP}
      />
      <label htmlFor="compte-mdp-bis" className="text-xs text-ink-muted">
        {t("encoreUneFois")}
      </label>
      <input
        id="compte-mdp-bis"
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className={CHAMP}
      />
      <button
        type="submit"
        disabled={pending || differents}
        className="self-start rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50 motion-reduce:transition-none"
      >
        {state && "ok" in state ? t("motDePasseChange") : t("changerMotDePasse")}
      </button>
      {differents && confirmation !== "" && <p className="text-xs text-danger">{t("motsDePasseDifferents")}</p>}
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}
