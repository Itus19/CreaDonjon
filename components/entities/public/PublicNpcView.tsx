import type { NpcDisplayView } from "@/src/server/services/facetDiscoveries";

const ABILITIES = [
  { key: "str", label: "FOR" },
  { key: "dex", label: "DEX" },
  { key: "con", label: "CON" },
  { key: "int", label: "INT" },
  { key: "wis", label: "SAG" },
  { key: "cha", label: "CHA" },
] as const;

function modificateur(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `−${Math.abs(mod)}`;
}

/**
 * V3.2-51 (ADR 0118) — Ce que le personnage sait d'un PNJ, dans le wiki
 * d'une partie solo : sa fiche allégée et son équipement, réduits à ce qui a
 * été découvert. Le serveur n'envoie que ces valeurs-là (`readNpcDisplayView`) ;
 * un « ? » marque ce qui reste à découvrir, sans jamais en porter la valeur.
 * Mêmes titres et filets que les blocs du wiki (`PublicBlockView`).
 */
export default function PublicNpcView({ view }: { view: NpcDisplayView }) {
  return (
    <>
      {view.hasSheet && (
        <div className="border-b border-edge/60 py-4 last:border-b-0">
          <h3 className="block-title mb-2">Fiche</h3>
          <dl className="grid grid-cols-6 gap-1 text-center">
            {ABILITIES.map(({ key, label }) => {
              const score = view.abilities[key];
              return (
                <div key={key} className="rounded-md border border-edge/60 px-1 py-1.5">
                  <dt className="text-xs font-semibold tracking-wide text-ink-muted">{label}</dt>
                  <dd className="text-sm text-ink">{score === undefined ? "?" : `${score} (${modificateur(score)})`}</dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-2 text-sm text-ink-soft">
            CA {view.ac ?? "?"} · PV {view.hp ?? "?"}
            {view.speed ? ` · ${view.speed}` : ""}
          </p>
          {[...view.traits, ...view.actions].map((entry) => (
            <p key={entry.name} className="mt-1 text-sm text-ink-soft">
              <span className="font-medium text-ink">{entry.name}.</span> {entry.text}
            </p>
          ))}
          <p className="mt-2 text-xs text-ink-muted">Le reste se découvre en jouant : observer, jauger, fouiller.</p>
        </div>
      )}
      {view.hasGear && (
        <div className="border-b border-edge/60 py-4 last:border-b-0">
          <h3 className="block-title mb-2">Équipement</h3>
          {view.items.length === 0 ? (
            <p className="text-sm text-ink-muted">Rien de visible pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-0.5 text-sm text-ink-soft">
              {view.items.map((item) => (
                <li key={item.id}>
                  {item.name}
                  {item.qty > 1 ? ` ×${item.qty}` : ""}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-ink-soft">Bourse : {view.purse ?? "?"}</p>
        </div>
      )}
    </>
  );
}
