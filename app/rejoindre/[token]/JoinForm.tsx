"use client";

import { useActionState, useState } from "react";
import { joinInviteAction, type JoinInviteState } from "./actions";

const initialState: JoinInviteState = null;

/** Écran « MJ / PJ » (V2-M4, retour utilisateur 29 août) — le rôle est déjà fixé si le lien est nominatif pour un rôle précis, sinon proposé au choix. */
export default function JoinForm({
  token,
  intendedRole,
  characters,
}: {
  token: string;
  intendedRole: "gm" | "player" | null;
  characters: { entityId: string; entityName: string }[];
}) {
  const [state, formAction, pending] = useActionState<JoinInviteState, FormData>(joinInviteAction, initialState);
  const [role, setRole] = useState<"gm" | "player" | null>(intendedRole);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-edge bg-panel p-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="role" value={role ?? ""} />

      <h1 className="text-xl font-semibold text-accent">Bienvenue</h1>

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

          {role === "player" && (
            <label className="flex flex-col gap-1 text-sm">
              Ton personnage
              {characters.length === 0 ? (
                <p className="text-sm text-danger">Aucun personnage disponible pour l&apos;instant.</p>
              ) : (
                <select
                  name="entityId"
                  required
                  defaultValue=""
                  className="rounded-md border border-edge bg-panel px-3 py-2 text-ink"
                >
                  <option value="" disabled>
                    Choisis…
                  </option>
                  {characters.map((c) => (
                    <option key={c.entityId} value={c.entityId}>
                      {c.entityName}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}

          {state?.error && <p className="text-sm text-danger">{state.error}</p>}

          <button
            type="submit"
            disabled={pending || (role === "player" && characters.length === 0)}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Connexion..." : "Rejoindre"}
          </button>
        </>
      )}
    </form>
  );
}
