"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * « Rejoindre une table » (V3.1-35) : on colle un lien d'invitation, le serveur
 * dit s'il est valide (`POST /api/invitations/verifier`, lecture seule, rien
 * n'est créé), puis l'écran part vers le parcours existant `/rejoindre/…`.
 * L'appel part d'un geste (envoi du formulaire), jamais d'un chargement.
 */
export default function RejoindreTable() {
  const t = useTranslations("accueil");
  const router = useRouter();
  const [lien, setLien] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    if (enCours || lien.trim() === "") return;
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch("/api/invitations/verifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lien }),
      });
      if (!res.ok) {
        setErreur(t("lienErreur"));
        return;
      }
      const corps = (await res.json()) as { valide: boolean; chemin?: string };
      if (corps.valide && corps.chemin) {
        router.push(corps.chemin);
        return;
      }
      setErreur(t("lienInvalide"));
    } catch (e2) {
      console.error("Vérification du lien d'invitation impossible", e2);
      setErreur(t("lienErreur"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form onSubmit={verifier} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={lien}
        onChange={(e) => setLien(e.target.value)}
        placeholder={t("lienPlaceholder")}
        aria-label={t("lienLibelle")}
        autoComplete="off"
        className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={enCours || lien.trim() === ""}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {enCours ? t("lienVerification") : t("lienAction")}
      </button>
      {erreur && (
        <p role="alert" className="w-full text-sm text-danger">
          {erreur}
        </p>
      )}
    </form>
  );
}
