import "server-only";
import { grantingClassLevel } from "@/src/core/rules/sheet";
import { ABILITIES } from "@/src/core/rules/abilities";
import type { CharacterActionContext } from "@/src/server/services/characterActions";

/**
 * V3.1-160 — les nombres que lisent les formules d'une règle jouée par un
 * personnage : niveau, `class.level` (le niveau dans la classe qui accorde la
 * règle, V3.1-133), maîtrise, DD de sorts, modificateurs et sauvegardes.
 * Partagé par l'activation au clic et par les réactions.
 */
export function actorNumbersFor(ctx: Pick<CharacterActionContext, "characterData" | "sheet">, ruleKey: string): Record<string, number> {
  const sheet = ctx.sheet;
  const classesDuPerso = ctx.characterData.classes.flatMap((c) => (c.class.kind === "rule" ? [{ key: c.class.key, level: c.level }] : []));
  const source = sheet.features.find((f) => f.key === ruleKey)?.source ?? "";
  const numbers: Record<string, number> = {
    level: ctx.characterData.classes.reduce((s, c) => s + c.level, 0),
    "class.level": grantingClassLevel(source, classesDuPerso),
    proficiency: sheet.proficiencyBonus,
    ...(sheet.spellcasting ? { spell_save_dc: sheet.spellcasting.saveDc } : {}),
  };
  for (const a of ABILITIES) {
    numbers[`ability.${a}`] = sheet.abilities[a].mod;
    numbers[`save.${a}`] = sheet.savingThrows[a].mod;
  }
  return numbers;
}
