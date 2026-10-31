"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import { averageHitDie, type HpGainChoice } from "@/src/core/rules/sheet";

/** Un ou plusieurs niveaux de PV a traiter pour une classe (V2-G1) — resolu a partir du niveau choisi, jamais devine ici. */
export interface CreationHpGrant {
  /** Index dans `character.classes` — pas la cle de regle, encore vide/instable tant que la classe n'est pas choisie. */
  classIndex: number;
  classKey: string;
  className: string;
  dieFaces: number;
  /** Niveaux de CETTE classe qui ne beneficient PAS de l'exemption "tout premier niveau du personnage" (ex. [2, 3] pour la premiere classe a niveau 3, ou [1, 2] pour une deuxieme classe choisie directement a 2). */
  levels: number[];
}

/**
 * Montée de niveau : le client n'envoie JAMAIS un résultat, seulement une
 * intention par niveau gagné (« average » ou « rolled »), que le serveur
 * exécute à la validation (règle 8). L'assistant garde ces intentions.
 */
export interface IntentionsPointsDeVie {
  choiceAt: (classKey: string, index: number) => HpGainChoice;
  onChoose: (classKey: string, index: number, choice: HpGainChoice) => void;
  onAll: (choice: HpGainChoice) => void;
}

function modSuffix(conMod: number): string {
  if (conMod === 0) return "";
  return conMod > 0 ? `+${conMod}` : `${conMod}`;
}

/**
 * Étape « Points de vie » (V3.1-51) : une ligne par niveau au-delà du premier,
 * avec sa classe, son dé, et la moyenne ou le jet à basculer ; « Moyenne pour
 * tous » et « Lancer tous » en tête.
 *
 * Création : l'assistant écrit le bloc `character` tel quel à la fin, la
 * valeur doit donc être définitive en quittant l'étape. Les jets viennent du
 * serveur (`/api/character-creator/roll-hp`), jamais d'un calcul du client ;
 * « Lancer tous » fait un seul appel par taille de dé (un appel par dé
 * distinct, la route ne prenant qu'un dé à la fois). Montée de niveau
 * (`intentions` donné) : voir `IntentionsPointsDeVie`.
 */
export default function CreationHpRollStep({
  character,
  patchCharacter,
  grants,
  conMod,
  intentions,
}: {
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  grants: CreationHpGrant[];
  conMod: number;
  intentions?: IntentionsPointsDeVie;
}) {
  const t = useTranslations("creation.pv");
  const [rollingKey, setRollingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Écrit d'un coup plusieurs valeurs : `classIndex:index` → valeur. */
  function ecrire(valeurs: Map<string, number>) {
    patchCharacter({
      classes: character.classes.map((c, classIndex) => {
        const rolls = [...(c.hp_rolls ?? [])];
        let touche = false;
        for (const [cle, valeur] of valeurs) {
          const [ci, i] = cle.split(":").map(Number);
          if (ci !== classIndex) continue;
          while (rolls.length <= i) rolls.push(averageHitDie(grants.find((g) => g.classIndex === ci)?.dieFaces ?? 6));
          rolls[i] = valeur;
          touche = true;
        }
        return touche ? { ...c, hp_rolls: rolls } : c;
      }),
    });
  }

  /** Les jets d'un dé, demandés au serveur : au plus 19 par appel (la route borne `count`). */
  async function lancer(dieFaces: number, count: number): Promise<number[] | null> {
    const jets: number[] = [];
    while (jets.length < count) {
      const lot = Math.min(19, count - jets.length);
      const res = await fetch("/api/character-creator/roll-hp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dieFaces, count: lot }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { rolls: number[] };
      jets.push(...body.rolls);
    }
    return jets;
  }

  async function lancerUn(classIndex: number, index: number, dieFaces: number) {
    const key = `${classIndex}:${index}`;
    setRollingKey(key);
    setError(null);
    try {
      const jets = await lancer(dieFaces, 1);
      if (!jets) {
        setError(t("echec"));
        return;
      }
      ecrire(new Map([[key, jets[0]]]));
    } finally {
      setRollingKey(null);
    }
  }

  async function lancerTous() {
    setRollingKey("tous");
    setError(null);
    try {
      const valeurs = new Map<string, number>();
      const parDe = new Map<number, string[]>();
      for (const g of grants) {
        const cles = parDe.get(g.dieFaces) ?? [];
        g.levels.forEach((_, i) => cles.push(`${g.classIndex}:${i}`));
        parDe.set(g.dieFaces, cles);
      }
      for (const [dieFaces, cles] of parDe) {
        const jets = await lancer(dieFaces, cles.length);
        if (!jets) {
          setError(t("echec"));
          return;
        }
        cles.forEach((cle, i) => valeurs.set(cle, jets[i]));
      }
      ecrire(valeurs);
    } finally {
      setRollingKey(null);
    }
  }

  function moyennePourTous() {
    if (intentions) {
      intentions.onAll("average");
      return;
    }
    const valeurs = new Map<string, number>();
    for (const g of grants) g.levels.forEach((_, i) => valeurs.set(`${g.classIndex}:${i}`, averageHitDie(g.dieFaces)));
    ecrire(valeurs);
  }

  const occupe = rollingKey !== null;
  const mod = modSuffix(conMod);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={moyennePourTous}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          {t("moyennePourTous")}
        </button>
        <button
          type="button"
          disabled={occupe}
          onClick={intentions ? () => intentions.onAll("rolled") : lancerTous}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {rollingKey === "tous" ? t("enCours") : t("lancerTous")}
        </button>
      </div>
      {intentions && <p className="text-sm text-ink-soft">{t("noteServeur")}</p>}

      <ul className="flex flex-col gap-1.5">
        {grants.flatMap((grant) => {
          const average = averageHitDie(grant.dieFaces);
          const rolls = character.classes[grant.classIndex]?.hp_rolls ?? [];
          return grant.levels.map((level, i) => {
            const current = rolls[i];
            const choisiJet = intentions ? intentions.choiceAt(grant.classKey, i) === "rolled" : current !== undefined && current !== average;
            const enCours = rollingKey === `${grant.classIndex}:${i}`;
            return (
              <li key={`${grant.classIndex}:${level}`} className="flex flex-wrap items-center gap-2 rounded-md border border-edge/60 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 text-ink">
                  {t("ligne", { classe: grant.className, niveau: level })}
                  <span className="ml-2 text-xs text-ink-muted">d{grant.dieFaces}</span>
                </span>
                <button
                  type="button"
                  onClick={() => (intentions ? intentions.onChoose(grant.classKey, i, "average") : ecrire(new Map([[`${grant.classIndex}:${i}`, average]])))}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    !choisiJet ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                  }`}
                >
                  {t("moyenne", { moyenne: average, mod, total: average + conMod })}
                </button>
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => (intentions ? intentions.onChoose(grant.classKey, i, "rolled") : lancerUn(grant.classIndex, i, grant.dieFaces))}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                    choisiJet ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                  }`}
                >
                  {enCours
                    ? t("enCours")
                    : intentions
                      ? t("jetServeur", { faces: grant.dieFaces, mod })
                      : choisiJet && current !== undefined
                        ? t("jete", { valeur: current, mod, total: current + conMod })
                        : t("jeter", { faces: grant.dieFaces, mod })}
                </button>
              </li>
            );
          });
        })}
      </ul>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
