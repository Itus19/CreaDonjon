import { classesPastille } from "@/lib/ui/statsJoueur";
import IconeTitre from "./IconeTitre";

/**
 * La carte d'un titre telle que la joueuse la voit dans « Tes dés et tes
 * titres » (V3.1-91), partagée avec l'aperçu de l'éditeur (V3.1-92) pour
 * qu'ils ne divergent jamais. Le texte est affiché en TEXTE BRUT.
 */
export default function CarteTitre({ icone, couleur, nom, texte }: { icone: string; couleur: string; nom: string; texte: string | null }) {
  return (
    <div className="flex h-full min-w-0 items-center gap-2 rounded-lg border border-edge bg-panel-sunken p-2">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${classesPastille(couleur)}`}>
        <IconeTitre cle={icone} className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight text-ink">{nom}</span>
        {texte && <span className="block text-xs leading-snug text-ink-muted">{texte}</span>}
      </span>
    </div>
  );
}
