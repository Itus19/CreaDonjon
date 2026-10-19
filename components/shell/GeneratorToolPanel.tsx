"use client";

import { useState } from "react";
import Tabs from "@/components/shared/Tabs";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import type { GeneratorToolWindowData } from "@/src/server/services/generators";
import { etiquettesVariantes } from "@/lib/ui/generateurs";
import ApercuFiche from "./generateurs/ApercuFiche";
import ColonneTirages from "./generateurs/ColonneTirages";
import PuceVariantes from "./generateurs/PuceVariantes";
import { useTirages } from "./generateurs/useTirages";

const PANNEAU_VERRE = "rounded-[18px] border border-edge bg-panel backdrop-blur-[var(--blur)]";

/**
 * Outil MJ « Générateurs » (V2-J1 Phase 2, refait en V3.1-45) : les tirages a
 * gauche, la fiche assemblee a droite. La disposition suit la LARGEUR DU
 * CONTENEUR (`@container`, comme `OutilTable.tsx`), pas celle de l'ecran :
 * - large (>= 48rem) : deux colonnes, tirages puis apercu ;
 * - tablette : l'apercu d'abord, les tirages dessous ;
 * - telephone (< 28rem) : pilule des outils, « Variantes » et « Les tirages »
 *   en feuilles du bas, puis l'apercu.
 *
 * Un SEUL etat des tirages (`useTirages`), remonte ici : la colonne de gauche
 * et l'apercu affichent les memes resultats. Aucune requete au chargement ;
 * chaque tirage part d'un geste et passe par `/api/blocks/[id]/generate`
 * (jamais de tirage cote client). Chaque section est un bloc `generator` de
 * l'entite « Générateurs de MJ » du monde ; « Créer la fiche » combine les
 * sections de l'outil actif (V2-J2).
 */
export default function GeneratorToolPanel({ worldSlug, tools }: { worldSlug: string; tools: GeneratorToolWindowData[] }) {
  const [activeKey, setActiveKey] = useState(tools[0]?.key ?? null);
  const activeTool = tools.find((t) => t.key === activeKey) ?? null;
  const [sectionEditee, setSectionEditee] = useState<string | null>(null);
  const [feuille, setFeuille] = useState<"variantes" | "tirages" | null>(null);
  const { etats, variantes, majVariante, tirer, toutTirer, choisirLongueur, resultatsDeLOutil } = useTirages();

  if (tools.length === 0) {
    return <p className="text-sm italic text-ink-muted">Aucun outil de génération configuré pour l&apos;instant.</p>;
  }

  const choix = activeTool ? (variantes[activeTool.key] ?? {}) : {};
  const axes = activeTool?.variants && activeTool.variants.length > 0 ? activeTool.variants : null;

  return (
    <div className="@container flex flex-col gap-3">
      {tools.length > 1 && (
        <Tabs
          value={activeKey ?? tools[0].key}
          items={tools.map((t) => ({ value: t.key, label: t.label }))}
          onChange={(key) => {
            setActiveKey(key);
            setSectionEditee(null);
          }}
          aria-label="Outils de génération"
        />
      )}

      {activeTool && (
        <>
          {axes && (
            <div className="hidden @md:block">
              <PuceVariantes axes={axes} choix={choix} onChoisir={(axe, valeur) => majVariante(activeTool.key, { [axe]: valeur })} />
            </div>
          )}

          <div className="flex gap-2 @md:hidden">
            {axes && (
              <button
                type="button"
                onClick={() => setFeuille("variantes")}
                aria-haspopup="dialog"
                className="rounded-full border border-edge px-3 py-1 text-xs text-ink-soft transition-colors hover:bg-panel-raised"
              >
                {Object.values(etiquettesVariantes(axes, choix)).join(" · ") || "Variantes"} ▾
              </button>
            )}
            <button
              type="button"
              onClick={() => setFeuille("tirages")}
              aria-haspopup="dialog"
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink-soft transition-colors hover:bg-panel-raised"
            >
              Les tirages ▴
            </button>
          </div>

          {activeTool.sections.length === 0 ? (
            <p className="text-sm italic text-ink-muted">
              Aucune section configurée pour « {activeTool.label} » — ajoutez du contenu sur la fiche « Générateurs de MJ ».
            </p>
          ) : (
            <div className="flex flex-col gap-3 @3xl:flex-row @3xl:items-start">
              <section aria-label="Les tirages" className={`${PANNEAU_VERRE} hidden p-3 @md:block @3xl:order-1 @3xl:w-[28rem] @3xl:shrink-0`}>
                <ColonneTirages
                  tool={activeTool}
                  etats={etats}
                  variante={choix}
                  onTirer={(section, slotKey) => void tirer(activeTool.key, section, slotKey)}
                  sectionEditee={sectionEditee}
                  onEditer={setSectionEditee}
                  onFermerEdition={() => setSectionEditee(null)}
                />
              </section>
              <section aria-label="Aperçu de la fiche" className={`${PANNEAU_VERRE} order-first min-w-0 p-3 @3xl:order-2 @3xl:flex-1`}>
                <ApercuFiche
                  worldSlug={worldSlug}
                  tool={activeTool}
                  etats={etats}
                  variante={choix}
                  resultats={resultatsDeLOutil(activeTool)}
                  onTirer={(section, slotKey) => void tirer(activeTool.key, section, slotKey)}
                  onToutTirer={() => void toutTirer(activeTool)}
                  onLongueur={choisirLongueur}
                />
              </section>
            </div>
          )}

          {feuille === "variantes" && axes && (
            <FeuilleDuBas titre="Variantes" titreVisible onFermer={() => setFeuille(null)}>
              <PuceVariantes axes={axes} choix={choix} onChoisir={(axe, valeur) => majVariante(activeTool.key, { [axe]: valeur })} />
            </FeuilleDuBas>
          )}
          {feuille === "tirages" && (
            <FeuilleDuBas titre="Les tirages" onFermer={() => setFeuille(null)}>
              <ColonneTirages
                tool={activeTool}
                etats={etats}
                variante={choix}
                onTirer={(section, slotKey) => void tirer(activeTool.key, section, slotKey)}
              />
            </FeuilleDuBas>
          )}
        </>
      )}
    </div>
  );
}
