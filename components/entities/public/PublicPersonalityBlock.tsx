import PersonalityRadar from "@/components/entities/psyche/PersonalityRadar";
import { archetypeFor } from "@/src/core/psyche/archetype";
import type { PersonalityBlockData } from "@/src/core/schemas/blocks/personality";

/**
 * Rendu public du bloc `personality` (V2-H2, retour utilisateur : "juste
 * la partie des schemas") — le radar seul. Jamais les curseurs, le
 * tableau de souvenirs, les aspirations/lignes rouges/limites : ce sont
 * des outils d'edition et de suivi MJ, pas un schema a montrer.
 */
export default function PublicPersonalityBlock({ data }: { data: PersonalityBlockData }) {
  const archetype = archetypeFor(Object.fromEntries(data.poles.map((p) => [p.key, p.value])));
  return <PersonalityRadar poles={data.poles} archetype={archetype} />;
}
