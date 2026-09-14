"use client";

import { createContext, useContext } from "react";

/**
 * « Cette valeur est engagee » (ADR 0023) — le signal qu'un controle discret
 * envoie quand la personne a fini de le regler.
 *
 * Un bloc de fiche s'enregistre quand le focus quitte sa carte. Cette regle
 * epouse bien la saisie de texte (on sort d'un champ pour aller ailleurs) et
 * mal tout le reste : avec une case a cocher, le geste naturel est de cocher
 * PUIS de partir, et la modification se perdait en silence.
 *
 * Les deux composants concernes (`Checkbox`, `Dropdown`) sont des widgets ARIA
 * maison — un `<span role="checkbox">`, un `<button>` et sa liste — imposes par
 * la charte pour ne pas dependre des controles natifs. Ils n'emettent donc
 * aucun evenement `change` que le conteneur pourrait ecouter : il faut qu'ils
 * le disent eux-memes.
 *
 * Ce contexte est le canal. Il vaut `null` partout ailleurs dans
 * l'application, ou ces deux composants se comportent exactement comme avant :
 * c'est ce qui permet de ne modifier aucun des dix editeurs de bloc concernes.
 */
const EditCommitContext = createContext<(() => void) | null>(null);

export function EditCommitProvider({ commit, children }: { commit: () => void; children: React.ReactNode }) {
  return <EditCommitContext.Provider value={commit}>{children}</EditCommitContext.Provider>;
}

/** `null` hors d'un conteneur qui sait enregistrer — appeler avec `?.()`, jamais supposer sa presence. */
export function useEditCommit(): (() => void) | null {
  return useContext(EditCommitContext);
}
