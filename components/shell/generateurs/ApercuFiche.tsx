"use client";

import { useState } from "react";
import { isProseSlot, PROSE_LENGTH_PRESETS, type ProseLength } from "@/src/core/generators/types";
import type { GeneratorToolWindowData } from "@/src/server/services/generators";
import { assemblerApercu, CLE_SECTION_MENU, etiquettesVariantes, texteACopier, type Morceau } from "@/lib/ui/generateurs";
import BoutonRelance from "./BoutonRelance";
import CreerLaFiche from "./CreerLaFiche";
import MenuTaverne from "./MenuTaverne";
import { sectionOccupee, ETAT_VIDE, type EtatSection, type SectionOutil, type SectionResult } from "./useTirages";

/** Les morceaux d'un gabarit : le texte fixe tel quel, chaque morceau tire souligne en pointille et relancable d'un toucher (↻). */
function Morceaux({ morceaux, occupee, onRelancer }: { morceaux: Morceau[]; occupee: boolean; onRelancer: (cle: string) => void }) {
  return (
    <>
      {morceaux.map((m, i) => {
        if (m.type === "texte") return <span key={i}>{m.texte}</span>;
        if (m.texte === null) return <span key={i} className="text-ink-muted">…</span>;
        if (m.texte === "") return <span key={i} className="italic text-ink-muted">(rien reçu)</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onRelancer(m.cle)}
            disabled={occupee}
            title="Relancer ce morceau"
            className="inline cursor-pointer whitespace-pre-line text-left underline decoration-edge-strong decoration-dotted underline-offset-4 transition-colors hover:text-accent disabled:cursor-wait disabled:opacity-60"
          >
            {m.texte}
            <span aria-hidden="true" className="ml-0.5 text-[0.7em] text-ink-muted">↻</span>
          </button>
        );
      })}
    </>
  );
}

/**
 * L'apercu de la fiche assemblee (V3.1-45) : chaque morceau tire est souligne
 * en pointille et se relance d'un toucher — la MEME relance par emplacement
 * que la colonne des tirages (`onlySlotKey`), sur le meme etat, donc les deux
 * colonnes affichent toujours les memes resultats. La prose de l'IA porte une
 * etiquette « IA » ; sans fournisseur joignable elle reste vide et l'ecran
 * sert quand meme. Aucune valeur n'est tiree ici : on assemble les gabarits
 * avec ce que le serveur a renvoye.
 */
export default function ApercuFiche({
  worldSlug,
  tool,
  etats,
  variante,
  resultats,
  onTirer,
  onToutTirer,
  onLongueur,
}: {
  worldSlug: string;
  tool: GeneratorToolWindowData;
  etats: Record<string, EtatSection>;
  variante: Record<string, string>;
  resultats: Record<string, SectionResult>;
  onTirer: (section: SectionOutil, slotKey: string | null) => void;
  onToutTirer: () => void;
  onLongueur: (blockId: string, longueur: ProseLength) => void;
}) {
  const [copie, setCopie] = useState(false);
  const [copieError, setCopieError] = useState<string | null>(null);
  const fixes = etiquettesVariantes(tool.variants, variante);
  const cleNom = tool.promote?.nameSectionKey;
  const sectionNom = tool.sections.find((s) => s.key === cleNom);
  const autres = tool.sections.filter((s) => s.key !== cleNom);
  const toutOccupe = tool.sections.some((s) => sectionOccupee(etats[s.blockId] ?? ETAT_VIDE));

  function morceauxDe(section: SectionOutil, etat: EtatSection): Morceau[] {
    const textes = Object.fromEntries(Object.entries(etat.slotResults).map(([k, s]) => [k, s.text]));
    return assemblerApercu(section.data.template, section.data.slots.map((s) => s.key), textes, fixes);
  }

  async function copier() {
    const titre = sectionNom ? (etats[sectionNom.blockId]?.text ?? null) : null;
    const texte = texteACopier(
      titre,
      autres.map((s) => ({ libelle: s.label, texte: etats[s.blockId]?.text ?? null })),
    );
    if (!texte) return;
    try {
      await navigator.clipboard.writeText(texte);
      setCopieError(null);
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    } catch (e) {
      setCopieError(e instanceof Error ? e.message : "Copie impossible.");
    }
  }

  function sectionApercu(section: SectionOutil) {
    const etat = etats[section.blockId] ?? ETAT_VIDE;
    const occupee = sectionOccupee(etat);
    const prose = section.data.slots.some(isProseSlot);
    return (
      <div key={section.blockId} className="flex flex-col gap-1.5 border-t border-edge/40 pt-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-xs font-semibold text-ink-muted">{section.label}</span>
          {prose && (
            <>
              <span className="rounded-full border border-edge px-1.5 text-xs text-ink-muted" title="Texte écrit par l'IA">IA</span>
              <span className="flex items-center gap-1" role="group" aria-label="Longueur de la prose">
                {PROSE_LENGTH_PRESETS.map((longueur) => (
                  <button
                    key={longueur}
                    type="button"
                    aria-pressed={etat.proseLength === longueur}
                    onClick={() => onLongueur(section.blockId, longueur)}
                    className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                      etat.proseLength === longueur ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-soft hover:bg-panel-raised"
                    }`}
                  >
                    {longueur} mots
                  </button>
                ))}
              </span>
            </>
          )}
          <BoutonRelance onClick={() => onTirer(section, null)} desactive={occupee} enCours={etat.enCours} titre={`Relancer la section ${section.label}`} />
        </div>
        {etat.error && <p className="text-xs text-danger">{etat.error}</p>}
        {etat.text === null ? (
          <p className="text-xs italic text-ink-muted">Pas encore tiré.</p>
        ) : section.data.key === CLE_SECTION_MENU ? (
          <MenuTaverne etat={etat} onRelancer={(cle) => onTirer(section, cle)} />
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
            <Morceaux morceaux={morceauxDe(section, etat)} occupee={occupee} onRelancer={(cle) => onTirer(section, cle)} />
          </p>
        )}
      </div>
    );
  }

  const etatNom = sectionNom ? (etats[sectionNom.blockId] ?? ETAT_VIDE) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-md border border-edge/60 bg-panel-sunken p-3">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-ink-muted">Aperçu de la fiche · {tool.label}</span>
          <button
            type="button"
            onClick={onToutTirer}
            disabled={toutOccupe}
            className="rounded-full border border-edge px-3 py-0.5 text-xs text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            {toutOccupe ? "Tirage…" : "Tout relancer"}
          </button>
        </div>
        {sectionNom && etatNom && (
          <div className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
            <h2 className="flex-1 text-lg font-semibold text-ink">
              {etatNom.text === null ? (
                <span className="text-sm font-normal italic text-ink-muted">Pas encore tiré.</span>
              ) : (
                <Morceaux morceaux={morceauxDe(sectionNom, etatNom)} occupee={sectionOccupee(etatNom)} onRelancer={(cle) => onTirer(sectionNom, cle)} />
              )}
            </h2>
            <BoutonRelance
              onClick={() => onTirer(sectionNom, null)}
              desactive={sectionOccupee(etatNom)}
              enCours={etatNom.enCours}
              titre={`Relancer la section ${sectionNom.label}`}
            />
            </div>
            {etatNom.error && <p className="text-xs text-danger">{etatNom.error}</p>}
          </div>
        )}
        {autres.map(sectionApercu)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copier()}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
        >
          {copie ? "Copié" : (
            <>
              <span className="@md:hidden">Copier</span>
              <span className="hidden @md:inline">Copier le texte</span>
            </>
          )}
        </button>
        {tool.promote && (
          <CreerLaFiche
            worldSlug={worldSlug}
            toolKey={tool.key}
            nameSectionKey={tool.promote.nameSectionKey}
            withCreature={tool.promote.withCreature}
            results={resultats}
          />
        )}
        {copieError && <p className="w-full text-xs text-danger">{copieError}</p>}
      </div>
    </div>
  );
}
