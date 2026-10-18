"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { joinInviteAction, type JoinInviteState } from "./actions";
import { PANNEAU_VERRE, TITRE_PANNEAU } from "@/components/brand/CadreTitre";

const initialState: JoinInviteState = null;

/**
 * Écran « MJ / PJ » (V2-M4, retour utilisateur 29 août) — le rôle est déjà
 * fixé si le lien est nominatif pour un rôle précis, sinon proposé au choix.
 * V3.1-100 (ADR 0049) : plus de choix de personnage ici ; la joueuse le fait
 * ensuite sur l'écran de choix.
 */
export default function JoinForm({
  token,
  intendedRole,
  currentAccountName,
}: {
  token: string;
  intendedRole: "gm" | "player" | null;
  /** Retour utilisateur 30 août ("Jérémy MJ dans un monde ET joueur dans un autre") : non nul si ce navigateur a déjà une session — ce nouveau rôle s'y ajoutera plutôt que de créer un second compte. */
  currentAccountName: string | null;
}) {
  const [state, formAction, pending] = useActionState<JoinInviteState, FormData>(joinInviteAction, initialState);
  const [role, setRole] = useState<"gm" | "player" | null>(intendedRole);

  return (
    <form action={formAction} className={PANNEAU_VERRE}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="role" value={role ?? ""} />

      <h2 className={TITRE_PANNEAU}>Bienvenue</h2>

      {currentAccountName !== null ? (
        <p className="text-xs text-ink-muted">
          Connecté·e en tant que <span className="text-ink">{currentAccountName || "toi"}</span> — ce nouveau rôle
          s&apos;ajoutera à ce compte.
        </p>
      ) : (
        <p className="text-xs text-ink-muted">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Connecte-toi d&apos;abord
          </Link>
          , puis rouvre ce lien.
        </p>
      )}

      {!intendedRole && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRole("gm")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
              role === "gm" ? "border-accent text-accent" : "border-edge text-ink hover:bg-panel-raised"
            }`}
          >
            Je suis MJ
          </button>
          <button
            type="button"
            onClick={() => setRole("player")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
              role === "player" ? "border-accent text-accent" : "border-edge text-ink hover:bg-panel-raised"
            }`}
          >
            Je suis PJ
          </button>
        </div>
      )}

      {role && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Ton nom
            <input
              name="name"
              required
              maxLength={80}
              autoFocus
              className="rounded-md border border-edge bg-transparent px-3 py-2"
            />
          </label>

          {currentAccountName === null && (
            <label className="flex flex-col gap-1 text-sm">
              Choisis un mot de passe
              <input
                name="accountPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="rounded-md border border-edge bg-transparent px-3 py-2"
              />
            </label>
          )}

          {state?.error && <p className="text-sm text-danger">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Connexion..." : "Rejoindre"}
          </button>
        </>
      )}
    </form>
  );
}
