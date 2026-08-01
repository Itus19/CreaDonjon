type Messages = typeof import("./messages/fr.json");

declare global {
  // Autocomplete + verification des cles de traduction par TypeScript
  // (next-intl) : les deux catalogues (fr.json/en.json) doivent rester
  // structurellement identiques, seul fr.json fait foi pour la forme.
  // Extension vide intentionnelle : c'est le mecanisme de fusion de
  // declarations attendu par next-intl, pas un type incomplet.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
