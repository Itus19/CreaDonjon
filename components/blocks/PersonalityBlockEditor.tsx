"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import PersonalityRadar from "@/components/entities/psyche/PersonalityRadar";
import PoleBars from "@/components/entities/psyche/PoleBars";
import SouvenirsPsyche, { type SouvenirsPsycheHandle } from "@/components/entities/psyche/SouvenirsPsyche";
import { AspirationsColonnes, FaconDeParler, LignesEtLimites } from "@/components/entities/psyche/PersonnaliteChamps";
import { archetypeFor } from "@/src/core/psyche/archetype";
import { PERSONALITY_POLE_KEYS, type PersonalityPoleKey } from "@/src/core/psyche/keys";
import type { PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import { PERSONALITY_POLE_DESCRIPTIONS_FR, PERSONALITY_POLES_FR } from "@/src/i18n/fr";
import { annoncePrioritaires, basculerPrioritaire, poleVise } from "@/lib/ui/psycheBloc";

/**
 * Bloc `personality` (V2-H1, refait en V3.1-70 « A ») : en tête, côte à côte,
 * le radar (la bande nommée à chaque sommet) et les six barres bipolaires pour
 * régler, avec la ★ des deux pôles prioritaires ; puis les aspirations en trois
 * colonnes, ce qu'il ne fera jamais / fera à contrecœur, la façon de parler et
 * les souvenirs repliables. Aucun nombre à l'écran : la valeur exacte n'est
 * qu'au survol, pour le MJ.
 *
 * Les pôles ne changent JAMAIS par `onChange` (sauvegarde générique
 * silencieuse) — uniquement par la route `personality-event`, barre ou
 * souvenir, même chemin d'écriture.
 */
export default function PersonalityBlockEditor({
  blockId,
  version,
  entityId,
  worldSlug,
  data,
  onChange,
  onBlockRefreshed,
  onEnregistrer,
  isGm = false,
  nonAuteur = false,
}: {
  blockId: string;
  version: number;
  entityId: string;
  worldSlug: string;
  data: PersonalityBlockData;
  onChange: (data: PersonalityBlockData) => void;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
  /** Écrit TOUT DE SUITE ce contenu (chemin d'enregistrement du bloc) et répond `true` si le serveur l'a accepté. Absent (éditeur plein écran) : la pastille ne change que le brouillon. */
  onEnregistrer?: (data: PersonalityBlockData) => Promise<boolean>;
  /** Le MJ voit la valeur exacte d'un pôle au survol ; un joueur n'en voit jamais. */
  isGm?: boolean;
  /** Le lecteur n'est pas l'auteur du bloc : « Privé » ne lui est pas proposé. */
  nonAuteur?: boolean;
}) {
  const t = useTranslations("fiche.psyche");
  const [sliderPending, setSliderPending] = useState(false);
  const [sliderError, setSliderError] = useState<string | null>(null);
  const souvenirsRef = useRef<SouvenirsPsycheHandle>(null);
  // Position en cours de glissement, remontée à chaque pixel (avant tout appel
  // réseau) : sans cela, le radar n'a que la valeur enregistrée.
  const [liveOverride, setLiveOverride] = useState<Partial<Record<PersonalityPoleKey, number>>>({});
  // La donnée la plus fraîche : une pastille qui attend le serveur ne doit pas
  // écraser, en revenant en arrière, ce qui a été tapé pendant ce temps.
  const dataRef = useRef(data);
  useLayoutEffect(() => {
    dataRef.current = data;
  });

  function handleLiveChange(key: PersonalityPoleKey, value: number | null) {
    setLiveOverride((prev) => {
      if (value === null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }

  const radarPoles = data.poles.map((p) => ({ ...p, value: liveOverride[p.key] ?? p.value }));
  const archetype = archetypeFor(Object.fromEntries(radarPoles.map((p) => [p.key, p.value])));

  async function commitSlider(key: PersonalityPoleKey, delta: number) {
    setSliderPending(true);
    setSliderError(null);
    const summary = t("reglageManuel", { pole: poleVise(PERSONALITY_POLES_FR[key], delta) });
    const res = await fetch(`/api/blocks/${blockId}/personality-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, summary, deltas: { [key]: delta }, occurredAtIngame: null }),
    });
    setSliderPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setSliderError(body?.error ?? t("erreurPole"));
      return;
    }
    const body = (await res.json()) as { block: { id: string; data: unknown; version: number } };
    onBlockRefreshed(body.block);
    souvenirsRef.current?.recharger();
  }

  /**
   * Visibilité d'UNE aspiration : l'écran suit aussitôt, le bloc est écrit par
   * le chemin d'enregistrement habituel, l'ancienne valeur revient si le
   * serveur refuse. `true` si l'écriture a réussi (la pastille l'annonce).
   */
  async function changerVisibilite(id: string, niveau: string): Promise<boolean> {
    const avant = dataRef.current.aspirations.find((a) => a.id === id)?.visibility;
    if (!avant) return false;
    const visibility = { level: niveau as typeof avant.level, scopeId: null };
    const apres: PersonalityBlockData = {
      ...dataRef.current,
      aspirations: dataRef.current.aspirations.map((a) => (a.id === id ? { ...a, visibility } : a)),
    };
    onChange(apres);
    if (!onEnregistrer) return true;
    const ok = await onEnregistrer(apres);
    if (!ok) {
      onChange({
        ...dataRef.current,
        aspirations: dataRef.current.aspirations.map((a) => (a.id === id ? { ...a, visibility: avant } : a)),
      });
    }
    return ok;
  }

  const annonce = annoncePrioritaires(data.priority, (k) => PERSONALITY_POLES_FR[k].radar);
  const texteAnnonce =
    annonce.cle === "aucun"
      ? t("annonce.aucun")
      : annonce.cle === "un"
        ? t("annonce.un", { premier: annonce.premier })
        : t("annonce.deux", { premier: annonce.premier, second: annonce.second });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-center gap-4 @2xl/bloc:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="flex justify-center">
          <PersonalityRadar poles={radarPoles} archetype={archetype} label={t("radarLabel")} />
        </div>
        <div className="flex flex-col gap-2">
          <PoleBars
            keys={PERSONALITY_POLE_KEYS}
            table={PERSONALITY_POLES_FR}
            descriptions={PERSONALITY_POLE_DESCRIPTIONS_FR}
            poles={data.poles}
            onCommit={commitSlider}
            onLiveChange={handleLiveChange}
            occupe={sliderPending}
            valeurExacte={isGm}
            prioritaires={data.priority}
            onEtoile={(key) => onChange({ ...data, priority: basculerPrioritaire(data.priority, key) })}
          />
          <p role="status" className="text-xs text-ink-muted">
            {texteAnnonce}
          </p>
          {sliderError && <p className="text-xs text-danger">{sliderError}</p>}
        </div>
      </div>

      <AspirationsColonnes
        aspirations={data.aspirations}
        onChange={(aspirations) => onChange({ ...data, aspirations })}
        onVisibilite={changerVisibilite}
        nonAuteur={nonAuteur}
      />

      <LignesEtLimites
        lines={data.lines}
        limits={data.limits}
        onLines={(lines) => onChange({ ...data, lines })}
        onLimits={(limits) => onChange({ ...data, limits })}
      />

      <FaconDeParler
        register={data.speech.register}
        tics={data.speech.tics}
        onRegister={(register) => onChange({ ...data, speech: { ...data.speech, register } })}
        onTics={(tics) => onChange({ ...data, speech: { ...data.speech, tics } })}
      />

      <SouvenirsPsyche
        genre="personality"
        entityId={entityId}
        blockId={blockId}
        version={version}
        worldSlug={worldSlug}
        valeursActuelles={Object.fromEntries(data.poles.map((p) => [p.key, p.value]))}
        onBlockRefreshed={onBlockRefreshed}
        ref={souvenirsRef}
      />
    </div>
  );
}
