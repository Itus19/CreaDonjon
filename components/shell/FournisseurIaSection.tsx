"use client";

import { useEffect, useState } from "react";

/**
 * V3.1-224 (ADR 0103) — « Mon fournisseur d'IA », dans la page Compte.
 *
 * Chacun déclare le sien : sa clé chez un fournisseur distant, ou l'adresse de
 * sa propre machine. Personne ne consomme les ressources d'un autre.
 *
 * **La clé ne redescend jamais du serveur**, pas même pour son propriétaire :
 * l'écran dit qu'il y en a une et depuis quand, et le champ reste vide. La
 * remplacer veut dire la retaper — c'est le prix de ne jamais la rendre.
 */

const CARTE = "flex flex-col gap-3";
const CHAMP = "rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none";
const BTN_PRIMARY = "rounded-full border border-accent bg-accent px-3 py-1 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50";
const BTN_SECONDARY = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";

interface Fournisseur {
  label: string;
  baseUrl: string;
  model: string;
  aUneCle: boolean;
  posePar: string;
}

export default function FournisseurIaSection() {
  const [fournisseur, setFournisseur] = useState<Fournisseur | null>(null);
  const [chiffrement, setChiffrement] = useState(true);
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [secret, setSecret] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Lu une fois à l'ouverture de la page (docs/CABLAGE.md) ; aucun sondage.
  useEffect(() => {
    let vivant = true;
    fetch("/api/compte/ia")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((corps: { fournisseur: Fournisseur | null; chiffrementDisponible: boolean }) => {
        if (!vivant) return;
        setChiffrement(corps.chiffrementDisponible);
        if (!corps.fournisseur) return;
        setFournisseur(corps.fournisseur);
        setLabel(corps.fournisseur.label);
        setBaseUrl(corps.fournisseur.baseUrl);
        setModel(corps.fournisseur.model);
      })
      .catch(() => vivant && setErreur("Impossible de lire ton fournisseur."));
    return () => {
      vivant = false;
    };
  }, []);

  async function enregistrer() {
    setOccupe(true);
    setErreur(null);
    setMessage(null);
    try {
      const res = await fetch("/api/compte/ia", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Champ laissé vide : la clé en place ne bouge pas (elle n'est jamais redescendue pour y être remise).
        body: JSON.stringify({ label, baseUrl, model, ...(secret.trim() === "" ? {} : { secret: secret.trim() }) }),
      });
      const corps = (await res.json().catch(() => null)) as { fournisseur?: Fournisseur; error?: string } | null;
      if (!res.ok || !corps?.fournisseur) throw new Error(corps?.error ?? "L'enregistrement a échoué.");
      setFournisseur(corps.fournisseur);
      setSecret("");
      setMessage("Fournisseur enregistré.");
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : "L'enregistrement a échoué.");
    } finally {
      setOccupe(false);
    }
  }

  async function retirer() {
    setOccupe(true);
    setErreur(null);
    setMessage(null);
    try {
      const res = await fetch("/api/compte/ia", { method: "DELETE" });
      if (!res.ok) throw new Error("La suppression a échoué.");
      setFournisseur(null);
      setLabel("");
      setBaseUrl("");
      setModel("");
      setSecret("");
      setMessage("Fournisseur retiré. Tes parties se jouent désormais sans IA.");
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : "La suppression a échoué.");
    } finally {
      setOccupe(false);
    }
  }

  const dateCle = fournisseur?.posePar ? new Date(fournisseur.posePar).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : null;

  return (
    <div className={CARTE}>
      <p className="text-sm text-ink-soft">
        Le récit de tes parties est écrit par le fournisseur d&apos;IA que tu déclares ici — ta clé chez un fournisseur distant, ou l&apos;adresse de ta propre machine. Chacun
        joue sur ses ressources ; sans fournisseur, le jeu continue, sans narration.
      </p>
      <p className="text-xs text-ink-muted">
        Avec un fournisseur distant, le lieu, les PNJ présents et les faits de chaque tour quittent ta machine et transitent chez lui. Avec un modèle local, rien ne sort.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">Nom (pour t&apos;y retrouver)</span>
        <input className={CHAMP} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Venice, ou mon PC" maxLength={60} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">Adresse de l&apos;API (compatible OpenAI)</span>
        <input className={CHAMP} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.venice.ai/api/v1" maxLength={300} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">Modèle</span>
        <input className={CHAMP} value={model} onChange={(e) => setModel(e.target.value)} placeholder="venice-uncensored" maxLength={120} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">
          Clé d&apos;API{fournisseur?.aUneCle && dateCle ? ` — une clé est posée depuis le ${dateCle}` : " (laisse vide pour un modèle local sans clé)"}
        </span>
        <input
          className={CHAMP}
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={fournisseur?.aUneCle ? "•••••••• — laisse vide pour la garder" : "sk-…"}
          autoComplete="off"
          maxLength={500}
        />
        <span className="text-xs text-ink-muted">Ta clé ne ressort jamais d&apos;ici, pas même pour toi : pour la changer, retape-la.</span>
      </label>

      {!chiffrement && (
        <p role="alert" className="text-xs text-danger">
          Le serveur n&apos;a pas de clé de chiffrement (AI_SECRETS_KEY) : une clé d&apos;API ne peut pas y être rangée en sécurité. Une adresse sans clé reste possible.
        </p>
      )}
      {erreur && (
        <p role="alert" className="text-sm text-danger">
          {erreur}
        </p>
      )}
      {message && <p className="text-sm text-success">{message}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_PRIMARY} onClick={() => void enregistrer()} disabled={occupe || label.trim() === "" || baseUrl.trim() === "" || model.trim() === ""}>
          {occupe ? "…" : "Enregistrer"}
        </button>
        {fournisseur && (
          <button type="button" className={BTN_SECONDARY} onClick={() => void retirer()} disabled={occupe}>
            Retirer
          </button>
        )}
      </div>
    </div>
  );
}
