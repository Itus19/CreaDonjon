"use client";

import { useActionState, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { joinInviteAction, type JoinInviteState } from "./actions";

const initialState: JoinInviteState = null;

/** Écran « MJ / PJ » (V2-M4, retour utilisateur 29 août) — le rôle est déjà fixé si le lien est nominatif pour un rôle précis, sinon proposé au choix. */
export default function JoinForm({
  token,
  intendedRole,
  characters,
  currentAccountName,
}: {
  token: string;
  intendedRole: "gm" | "player" | null;
  characters: { entityId: string; entityName: string }[];
  /** Retour utilisateur 30 août ("Jérémy MJ dans un monde ET joueur dans un autre") : non nul si ce navigateur a déjà une session — ce nouveau rôle s'y ajoutera plutôt que de créer un second compte. */
  currentAccountName: string | null;
}) {
  const [state, formAction, pending] = useActionState<JoinInviteState, FormData>(joinInviteAction, initialState);
  const [role, setRole] = useState<"gm" | "player" | null>(intendedRole);
  const [entityId, setEntityId] = useState("");

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-edge bg-panel p-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="role" value={role ?? ""} />
      <input type="hidden" name="entityId" value={entityId} />

      <h1 className="text-xl font-semibold text-accent">Bienvenue</h1>

      {currentAccountName !== null && (
        <p className="text-xs text-ink-muted">
          Connecté·e en tant que <span className="text-ink">{currentAccountName || "toi"}</span> — ce nouveau rôle
          s&apos;ajoutera à ce compte.
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

          {role === "player" && (
            <div className="flex flex-col gap-1 text-sm">
              Ton personnage
              {characters.length === 0 ? (
                <p className="text-sm text-danger">Aucun personnage disponible pour l&apos;instant.</p>
              ) : (
                <Dropdown
                  value={entityId}
                  onChange={setEntityId}
                  aria-label="Ton personnage"
                  options={[
                    { value: "", label: "Choisis…" },
                    ...characters.map((c) => ({ value: c.entityId, label: c.entityName })),
                  ]}
                  className="rounded-md border border-edge bg-panel px-3 py-2 text-left text-sm text-ink outline-none transition-colors hover:bg-panel-raised"
                />
              )}
            </div>
          )}

          {state?.error && <p className="text-sm text-danger">{state.error}</p>}

          <button
            type="submit"
            disabled={pending || (role === "player" && (characters.length === 0 || !entityId))}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Connexion..." : "Rejoindre"}
          </button>
        </>
      )}
    </form>
  );
}
