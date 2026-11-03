import type { Rng } from "../dice/rng";
import { slugify } from "../slug/slug";

/**
 * V3.1-129, reçu de V3.1-79 — la recharge d'une capacité de créature
 * (« Souffle empoisonné (Recharge 5–6) »), comme une ressource à un usage.
 *
 * La RÈGLE (le seuil du d6) se lit dans le bloc de la créature, qui reste un
 * modèle (specs/outils-mj.md §5). L'ÉTAT (prête ou dépensée) vit dans
 * l'instance de combat, sous la clé de la capacité, de la même forme que
 * les compteurs d'un personnage : usages consommés, 1 = dépensée. Chaque
 * « Gobelin » a donc le sien.
 */

export interface RechargeRule {
  /** Plage du d6 qui rend la capacité prête : 5–6, ou 6 seul. */
  min: number;
  max: number;
}

export interface RechargeableAbility {
  key: string;
  recharge: RechargeRule;
}

/** « (Recharge 5–6) », « recharge 6 » : la plage du d6. `null` si le texte n'en parle pas. */
export function readRecharge(text: string): RechargeRule | null {
  const m = /recharge\s*(\d)(?:\s*[–—-]\s*(\d))?/i.exec(text);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : min;
  if (min < 1 || max > 6 || min > max) return null;
  return { min, max };
}

/** Clé stable d'une capacité, tirée de son nom sans la mention de recharge : « Souffle empoisonné (Recharge 5–6) » → `souffle-empoisonne`. */
export function abilityKey(name: string): string {
  return slugify(name.replace(/\(\s*recharge[^)]*\)/i, "").trim());
}

export function isSpent(used: Readonly<Record<string, number>>, key: string): boolean {
  return (used[key] ?? 0) > 0;
}

/** Dépense la capacité (elle n'a qu'un usage). */
export function spendAbility(used: Readonly<Record<string, number>>, key: string): Record<string, number> {
  return { ...used, [key]: 1 };
}

/**
 * Au début du tour de la créature : un d6 par capacité DÉPENSÉE, lancé par
 * le serveur (règle absolue 8) ; dans la plage, elle redevient prête. Une
 * capacité prête ne lance rien. Les jets sont rendus pour le journal.
 */
export function rollRechargesAtTurnStart(
  abilities: readonly RechargeableAbility[],
  used: Readonly<Record<string, number>>,
  rng: Rng,
): { used: Record<string, number>; rolls: { key: string; roll: number; recharged: boolean }[] } {
  const next = { ...used };
  const rolls: { key: string; roll: number; recharged: boolean }[] = [];
  for (const a of abilities) {
    if (!isSpent(next, a.key)) continue;
    const roll = rng.nextInt(6) + 1;
    const recharged = roll >= a.recharge.min && roll <= a.recharge.max;
    if (recharged) delete next[a.key];
    rolls.push({ key: a.key, roll, recharged });
  }
  return { used: next, rolls };
}

/** Les capacités à recharge d'une liste d'actions (nom et texte), dans l'ordre ; une clé déjà vue n'est gardée qu'une fois. */
export function rechargeAbilitiesFrom(entries: readonly { name: string; text: string }[]): (RechargeableAbility & { name: string })[] {
  const out: (RechargeableAbility & { name: string })[] = [];
  for (const e of entries) {
    const recharge = readRecharge(`${e.name} ${e.text}`);
    if (!recharge) continue;
    const key = abilityKey(e.name);
    if (key && !out.some((a) => a.key === key)) out.push({ key, name: e.name.replace(/\s*\(\s*recharge[^)]*\)\s*/i, "").trim(), recharge });
  }
  return out;
}
