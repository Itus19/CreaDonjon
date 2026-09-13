/**
 * Formes féminines des espèces SRD dont le nom français est au masculin
 * (détection automatique de liens, V2.1-1, retour utilisateur : "humaine"
 * ne se détectait pas contre la règle "Humain"). Liste fermée et
 * délibérément courte plutôt qu'une règle grammaticale générale —
 * féminiser un nom en français n'est pas un simple suffixe, et une règle
 * trop large risquerait de faux positifs. "Orc"/"orque" en est l'exemple :
 * l'analogie existe, mais "orque" désigne aussi un cétacé — exclu pour
 * cette raison, un texte mentionnant une vraie orque ne doit jamais
 * suggérer un lien vers la race.
 */
export const SPECIES_FEMININE_FORMS: Record<string, string> = {
  human: "Humaine",
  tiefling: "Tieffeline",
  halfling: "Halfeline",
  dwarf: "Naine",
};
