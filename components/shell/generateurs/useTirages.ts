"use client";

import { useRef, useState } from "react";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import { DEFAULT_PROSE_LENGTH, type ProseLength } from "@/src/core/generators/types";
import type { GeneratorSlotResult, GeneratorToolWindowData } from "@/src/server/services/generators";

export type SectionOutil = GeneratorToolWindowData["sections"][number];

interface ReponseTirage {
  text: string;
  slots: GeneratorSlotResult[];
  resolvedVariant: Record<string, string>;
}

/** Dernier resultat connu d'une section — alimente « Créer la fiche », qui combine les sections deja tirees sans redemander un tirage. `slots` porte le texte de CHAQUE emplacement (sections promues en bloc structure : personnalite, quete). */
export interface SectionResult {
  text: string;
  refs: BlockReference[];
  slots: Record<string, string>;
}

/** Etat d'une section : un SEUL exemplaire, remonte au panneau — la colonne des tirages et l'apercu de la fiche affichent exactement les memes resultats. */
export interface EtatSection {
  /** Texte complet assemble par le serveur — nul tant que la section n'a pas ete tiree. */
  text: string | null;
  slotResults: Record<string, GeneratorSlotResult>;
  proseLength: ProseLength;
  /** Tirage de toute la section en cours. */
  enCours: boolean;
  /** Cle de l'emplacement en cours de relance. */
  relance: string | null;
  error: string | null;
}

export const ETAT_VIDE: EtatSection = {
  text: null,
  slotResults: {},
  proseLength: DEFAULT_PROSE_LENGTH,
  enCours: false,
  relance: null,
  error: null,
};

/** Vrai tant qu'une requete de cette section est en vol : les relances sont alors bloquees, pour qu'une reponse tardive n'ecrase pas l'autre. */
export function sectionOccupee(etat: EtatSection): boolean {
  return etat.enCours || etat.relance !== null;
}

/**
 * Etat des tirages de tous les outils (V3.1-45) et gestes qui l'ecrivent.
 * Aucun tirage cote client, aucune requete au chargement : chaque requete
 * part d'un geste (`/api/blocks/[id]/generate`, memes parametres qu'avant).
 *
 * Les gestes lisent l'etat le plus recent par des refs (miroir de l'etat
 * React, ecrit seulement dans les gestes) : un « Tout relancer » enchaine
 * plusieurs requetes, chacune doit voir le resultat de la precedente.
 */
export function useTirages() {
  const [etats, setEtats] = useState<Record<string, EtatSection>>({});
  const etatsRef = useRef(etats);
  const [variantes, setVariantes] = useState<Record<string, Record<string, string>>>({});
  const variantesRef = useRef(variantes);

  function majEtat(blockId: string, patch: Partial<EtatSection>) {
    const suivant = { ...etatsRef.current, [blockId]: { ...(etatsRef.current[blockId] ?? ETAT_VIDE), ...patch } };
    etatsRef.current = suivant;
    setEtats(suivant);
  }

  function majVariante(toolKey: string, patch: Record<string, string>) {
    const suivant = { ...variantesRef.current, [toolKey]: { ...variantesRef.current[toolKey], ...patch } };
    variantesRef.current = suivant;
    setVariantes(suivant);
  }

  /**
   * Tire toute la section (`onlySlotKey` nul) ou relance UN emplacement. Les
   * valeurs des autres emplacements repartent au serveur (`knownSlotTexts`,
   * `knownSlotTiers`) qui recompose le texte complet — il reste sans etat.
   * Rend les valeurs de variante apres ce tirage (un axe « Aléatoire » se fige
   * sur la valeur tiree), pour qu'un enchainement les reutilise.
   */
  async function tirer(
    toolKey: string,
    section: SectionOutil,
    onlySlotKey: string | null,
    variante: Record<string, string> = variantesRef.current[toolKey] ?? {},
  ): Promise<Record<string, string>> {
    const blockId = section.blockId;
    const avant = etatsRef.current[blockId] ?? ETAT_VIDE;
    majEtat(blockId, onlySlotKey ? { relance: onlySlotKey, error: null } : { enCours: true, error: null });
    let apres = variante;
    try {
      const connus = onlySlotKey ? Object.entries(avant.slotResults) : [];
      const res = await fetch(`/api/blocks/${blockId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proseLength: avant.proseLength,
          onlySlotKey,
          knownSlotTexts: Object.fromEntries(connus.map(([k, s]) => [k, s.text])),
          knownSlotTiers: Object.fromEntries(connus.filter(([, s]) => s.tier !== undefined).map(([k, s]) => [k, s.tier as string])),
          variant: variante,
        }),
      });
      if (!res.ok) {
        const corps = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(corps?.error ?? (onlySlotKey ? "La relance a échoué." : "La génération a échoué."));
      }
      const reponse = (await res.json()) as ReponseTirage;
      const recus = Object.fromEntries(reponse.slots.map((s) => [s.key, s]));
      const courant = etatsRef.current[blockId] ?? ETAT_VIDE;
      majEtat(blockId, { text: reponse.text, slotResults: onlySlotKey ? { ...courant.slotResults, ...recus } : recus });
      if (Object.keys(reponse.resolvedVariant).length > 0) {
        apres = { ...variante, ...reponse.resolvedVariant };
        majVariante(toolKey, reponse.resolvedVariant);
      }
    } catch (e) {
      majEtat(blockId, { error: e instanceof Error ? e.message : "La génération a échoué." });
    } finally {
      majEtat(blockId, { enCours: false, relance: null });
    }
    return apres;
  }

  /** « Tout relancer » : les sections une a une (jamais en parallele : un axe « Aléatoire » se fige au premier tirage, et l'IA n'est pas sollicitee par rafale). */
  async function toutTirer(tool: GeneratorToolWindowData) {
    let variante = variantesRef.current[tool.key] ?? {};
    for (const section of tool.sections) {
      variante = await tirer(tool.key, section, null, variante);
    }
  }

  function choisirLongueur(blockId: string, proseLength: ProseLength) {
    majEtat(blockId, { proseLength });
  }

  function resultatsDeLOutil(tool: GeneratorToolWindowData): Record<string, SectionResult> {
    const resultats: Record<string, SectionResult> = {};
    for (const section of tool.sections) {
      const etat = etats[section.blockId];
      if (!etat || etat.text === null) continue;
      const slots = Object.values(etat.slotResults);
      resultats[section.key] = {
        text: etat.text,
        refs: slots.flatMap((s) => s.refs),
        slots: Object.fromEntries(slots.map((s) => [s.key, s.text])),
      };
    }
    return resultats;
  }

  return { etats, variantes, majVariante, tirer, toutTirer, choisirLongueur, resultatsDeLOutil };
}
