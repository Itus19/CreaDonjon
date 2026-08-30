"use client";

import { useActionState, useState } from "react";
import { updateOwnPasswordAction, type UpdatePasswordState } from "@/app/settings/actions";

/**
 * Definir/changer son mot de passe (retour utilisateur, ecran d'accueil
 * colonne profil) — toujours optionnel, jamais impose (les comptes invites
 * restent sans mot de passe par defaut, lien magique uniquement). Champ vide
 * apres un enregistrement reussi, jamais le mot de passe reaffiche.
 */
export default function PasswordForm() {
  const [state, formAction, pending] = useActionState<UpdatePasswordState, FormData>(updateOwnPasswordAction, null);
  const [value, setValue] = useState("");

  return (
    <form
      action={(formData) => {
        formAction(formData);
        setValue("");
      }}
      className="flex flex-col gap-2"
    >
      <input
        type="password"
        name="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Nouveau mot de passe"
        className="w-full rounded-md border border-edge bg-panel-raised px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
      >
        {state && "ok" in state ? "Enregistré" : "Enregistrer"}
      </button>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}
