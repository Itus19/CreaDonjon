"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { choixDepuisValeur, optionsChoix, valeurChoix, type FournisseurIaVue, type FournisseursIaReponse } from "@/lib/ia/fournisseurs";

/**
 * V3.1-224 (ADR 0103), ADR 0108 — « Mes fournisseurs d'IA », dans la page Compte.
 *
 * Chaque compte déclare les siens (au plus dix) : une clé chez un fournisseur
 * distant, ou l'adresse de sa propre machine, et pour chacun un ou plusieurs
 * modèles. Un seul couple (fournisseur, modèle) sert à la fois ; on le choisit
 * ici ou depuis le solo, à côté du voyant.
 *
 * **La clé ne redescend jamais du serveur**, pas même pour son propriétaire :
 * l'écran dit qu'il y en a une et depuis quand, et le champ reste vide. La
 * remplacer veut dire la retaper : c'est le prix de ne jamais la rendre.
 */

const CHAMP = "rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none";
const BTN_PRIMARY = "rounded-full border border-accent bg-accent px-3 py-1 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50";
const BTN_SECONDARY = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";

/** Une ligne par modèle dans le champ ; les lignes vides ne comptent pas. */
function modelesDepuisTexte(texte: string): string[] {
  return texte
    .split("\n")
    .map((m) => m.trim())
    .filter((m) => m !== "");
}

async function lireErreur(res: Response, defaut: string): Promise<string> {
  const corps = (await res.json().catch(() => null)) as { error?: string } | null;
  return corps?.error ?? defaut;
}

export default function FournisseurIaSection() {
  const [donnees, setDonnees] = useState<FournisseursIaReponse | null>(null);
  /** L'identifiant du fournisseur ouvert en édition, `"nouveau"` pour un ajout, `null` si rien n'est ouvert. */
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Lu à l'ouverture de la page, puis après chaque écriture (docs/CABLAGE.md) ; aucun sondage.
  async function recharger() {
    const res = await fetch("/api/compte/ia");
    if (!res.ok) throw new Error("Impossible de relire tes fournisseurs.");
    setDonnees((await res.json()) as FournisseursIaReponse);
  }

  useEffect(() => {
    let vivant = true;
    fetch("/api/compte/ia")
      .then((r) => (r.ok ? (r.json() as Promise<FournisseursIaReponse>) : Promise.reject(new Error())))
      .then((corps) => vivant && setDonnees(corps))
      .catch(() => vivant && setErreur("Impossible de lire tes fournisseurs."));
    return () => {
      vivant = false;
    };
  }, []);

  async function choisir(valeur: string) {
    const choix = choixDepuisValeur(valeur);
    if (!choix) return;
    setErreur(null);
    setMessage(null);
    const res = await fetch("/api/compte/ia/choix", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(choix) });
    if (!res.ok) {
      setErreur(await lireErreur(res, "Le changement de modèle a échoué."));
      return;
    }
    setDonnees((d) => (d ? { ...d, actif: choix } : d));
  }

  async function apresEcriture(texte: string) {
    setOuvert(null);
    setMessage(texte);
    // Relu : l'ajout du premier ou le retrait de celui qui servait change le couple actif.
    await recharger().catch((e: unknown) => setErreur(e instanceof Error ? e.message : "Impossible de relire tes fournisseurs."));
  }

  if (!donnees) {
    return erreur ? (
      <p role="alert" className="text-sm text-danger">
        {erreur}
      </p>
    ) : (
      <p className="text-sm text-ink-muted">Chargement…</p>
    );
  }

  const options = optionsChoix(donnees.fournisseurs);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">
        Le récit de tes parties est écrit par le fournisseur d&apos;IA que tu déclares ici : ta clé chez un fournisseur distant, ou l&apos;adresse de ta propre machine. Chaque
        compte joue sur ses ressources ; sans fournisseur, le jeu continue, sans narration.
      </p>
      <p className="text-xs text-ink-muted">
        Avec un fournisseur distant, le lieu, les PNJ présents et les faits de chaque tour quittent ta machine et transitent chez lui. Avec un modèle local, rien ne sort.
      </p>

      {options.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-ink-muted">Modèle utilisé (aussi modifiable depuis le solo, à côté du voyant)</span>
          <Dropdown
            size="md"
            className="w-full"
            aria-label="Modèle utilisé"
            value={donnees.actif ? valeurChoix(donnees.actif) : ""}
            options={options}
            onChange={(v) => void choisir(v)}
          />
        </div>
      )}

      {!donnees.chiffrementDisponible && (
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

      <ul className="flex flex-col gap-2">
        {donnees.fournisseurs.map((f) =>
          ouvert === f.id ? (
            <li key={f.id} className="rounded-md border border-edge p-3">
              <FormulaireFournisseur
                fournisseur={f}
                onAnnuler={() => setOuvert(null)}
                onFait={(texte) => apresEcriture(texte)}
                onErreur={setErreur}
              />
            </li>
          ) : (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-md border border-edge px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{f.label}</p>
                <p className="truncate text-xs text-ink-muted">
                  {f.models.length === 1 ? f.models[0] : `${f.models.length} modèles`} · {f.aUneCle ? "clé posée" : "sans clé"}
                </p>
              </div>
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => {
                  setMessage(null);
                  setErreur(null);
                  setOuvert(f.id);
                }}
              >
                Modifier
              </button>
            </li>
          ),
        )}
      </ul>

      {ouvert === "nouveau" ? (
        <div className="rounded-md border border-edge p-3">
          <FormulaireFournisseur fournisseur={null} onAnnuler={() => setOuvert(null)} onFait={(texte) => apresEcriture(texte)} onErreur={setErreur} />
        </div>
      ) : (
        donnees.fournisseurs.length < 10 && (
          <div>
            <button
              type="button"
              className={donnees.fournisseurs.length === 0 ? BTN_PRIMARY : BTN_SECONDARY}
              onClick={() => {
                setMessage(null);
                setErreur(null);
                setOuvert("nouveau");
              }}
            >
              Ajouter un fournisseur
            </button>
          </div>
        )
      )}
    </div>
  );
}

/** Un fournisseur, à créer (`fournisseur: null`) ou à modifier. */
function FormulaireFournisseur({
  fournisseur,
  onAnnuler,
  onFait,
  onErreur,
}: {
  fournisseur: FournisseurIaVue | null;
  onAnnuler: () => void;
  onFait: (message: string) => Promise<void>;
  onErreur: (message: string | null) => void;
}) {
  const [label, setLabel] = useState(fournisseur?.label ?? "");
  const [baseUrl, setBaseUrl] = useState(fournisseur?.baseUrl ?? "");
  const [modeles, setModeles] = useState(fournisseur?.models.join("\n") ?? "");
  const [secret, setSecret] = useState("");
  const [occupe, setOccupe] = useState(false);

  const listeModeles = modelesDepuisTexte(modeles);
  const dateCle = fournisseur?.aUneCle ? new Date(fournisseur.posePar).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : null;

  async function enregistrer() {
    setOccupe(true);
    onErreur(null);
    try {
      const res = await fetch(fournisseur ? `/api/compte/ia/${fournisseur.id}` : "/api/compte/ia", {
        method: fournisseur ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        // Champ laissé vide : la clé en place ne bouge pas (elle n'est jamais redescendue pour y être remise).
        body: JSON.stringify({ label, baseUrl, models: listeModeles, ...(secret.trim() === "" ? {} : { secret: secret.trim() }) }),
      });
      if (!res.ok) throw new Error(await lireErreur(res, "L'enregistrement a échoué."));
      await onFait(fournisseur ? "Fournisseur enregistré." : "Fournisseur ajouté.");
    } catch (e: unknown) {
      onErreur(e instanceof Error ? e.message : "L'enregistrement a échoué.");
    } finally {
      setOccupe(false);
    }
  }

  async function retirer() {
    if (!fournisseur) return;
    setOccupe(true);
    onErreur(null);
    try {
      const res = await fetch(`/api/compte/ia/${fournisseur.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await lireErreur(res, "La suppression a échoué."));
      await onFait("Fournisseur retiré.");
    } catch (e: unknown) {
      onErreur(e instanceof Error ? e.message : "La suppression a échoué.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">Nom (pour t&apos;y retrouver)</span>
        <input className={CHAMP} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="OpenRouter, ou mon PC" maxLength={60} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">Adresse de l&apos;API (compatible OpenAI)</span>
        <input className={CHAMP} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" maxLength={300} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">Modèles, un par ligne (douze au plus)</span>
        <textarea
          className={`${CHAMP} min-h-[4.5rem] font-mono`}
          value={modeles}
          onChange={(e) => setModeles(e.target.value)}
          placeholder={"openai/gpt-4o-mini\nanthropic/claude-sonnet-4.5"}
          rows={3}
          spellCheck={false}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">Clé d&apos;API{dateCle ? `, posée depuis le ${dateCle}` : " (laisse vide pour un modèle local sans clé)"}</span>
        <input
          className={CHAMP}
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={fournisseur?.aUneCle ? "•••••••• (laisse vide pour la garder)" : "sk-…"}
          autoComplete="off"
          maxLength={500}
        />
        <span className="text-xs text-ink-muted">Ta clé ne ressort jamais d&apos;ici, pas même pour toi : pour la changer, retape-la.</span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={BTN_PRIMARY}
          onClick={() => void enregistrer()}
          disabled={occupe || label.trim() === "" || baseUrl.trim() === "" || listeModeles.length === 0}
        >
          {occupe ? "…" : "Enregistrer"}
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={onAnnuler} disabled={occupe}>
          Annuler
        </button>
        {fournisseur && (
          <button type="button" className={`${BTN_SECONDARY} ml-auto`} onClick={() => void retirer()} disabled={occupe}>
            Retirer
          </button>
        )}
      </div>
    </div>
  );
}
