/**
 * Points de vie temporaires (V3.1-24, ADR 0036 §8 et ticket 24 point 5) :
 * deux fonctions pures, partagees par `changeHp` (fiche), la resolution de
 * degats du tour (`applyEffects`) et, plus tard, un effet « accorder des PV
 * temporaires ». Aucune lecture de base ici.
 */

export interface HpPool {
  current: number;
  max: number;
  temp: number;
}

export interface DamageToHpResult {
  hp: HpPool;
  /**
   * Degats qui depassent ce que les PV temporaires puis courants pouvaient
   * absorber. C'est le « dégâts restants » de la mort directe (2024) : s'il
   * atteint les PV max, le personnage meurt sur le coup.
   */
  excess: number;
}

/**
 * Les degats entament les PV TEMPORAIRES d'abord, puis les courants, et
 * s'arretent a zero. Un montant nul ou negatif ne change rien.
 */
export function applyDamageToHp(hp: HpPool, amount: number): DamageToHpResult {
  if (amount <= 0) return { hp, excess: 0 };
  const absorbedByTemp = Math.min(hp.temp, amount);
  const afterTemp = amount - absorbedByTemp;
  const lost = Math.min(hp.current, afterTemp);
  return {
    hp: { ...hp, temp: hp.temp - absorbedByTemp, current: hp.current - lost },
    excess: afterTemp - lost,
  };
}

/**
 * Choix en 2024 : les PV temporaires ne se cumulent pas, on garde les anciens
 * ou on prend les nouveaux. `largest` (par defaut, ce que propose l'interface)
 * retient le plus grand des deux.
 */
export type TempHpChoice = "keep" | "replace" | "largest";

export function grantTempHp(currentTemp: number, incoming: number, choice: TempHpChoice = "largest"): number {
  const amount = Math.max(0, incoming);
  if (choice === "keep") return currentTemp;
  if (choice === "replace") return amount;
  return Math.max(currentTemp, amount);
}
