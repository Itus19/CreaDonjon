# 0023 — Un contrôle discret enregistre son bloc immédiatement

**Date :** 2026-09-14
**Statut :** acceptée

## Contexte

Un bloc de fiche s'enregistre quand le focus quitte sa carte : `handleBlockBlur`
(`components/blocks/EntityBlocks.tsx`), posé en `onBlur` sur le conteneur du
bloc. C'est le seul déclencheur automatique pour la donnée générique d'un bloc.

Cette règle épouse bien la saisie de texte : on sort d'un champ pour aller
ailleurs, donc le blur arrive de lui-même. Elle épouse mal tout le reste. Avec
une case à cocher ou une liste déroulante, le geste naturel est d'agir **puis
de partir** — et deux choses peuvent alors mal tourner :

1. le focus ne quitte jamais vraiment la carte, donc rien n'est enregistré ;
2. le blur arrive, mais la requête `PATCH` part au moment même où la personne
   navigue, et la navigation l'interrompt.

Constaté deux fois le 14 septembre 2026 pendant le ticket V2.1-6, sur la même
case du bloc musique — une fois par l'assistant, une fois par l'auteur. Dans
les deux cas la case paraissait cochée à l'écran alors que la donnée servie au
wiki public disait encore `false`. **Aucun message, aucune trace** : c'est ce
silence qui rend le défaut grave, bien plus que sa fréquence.

Mesure de l'étendue avant de décider : des 19 éditeurs de bloc, **11** portent
des contrôles non textuels et **10** passent par ce chemin (seul le pointage
d'un objectif de quête y échappe, il a sa propre route).

**Ce défaut a mordu trois fois.** C'est ce qui justifie de le traiter à la
racine plutôt que sur place une fois de plus — la règle des trois, appliquée à
la lettre :

1. **Bloc carte** (Lot I) : un téléversement « visible à l'écran, jamais
   persisté », parce qu'aucun clic dans la fenêtre imbriquée ne faisait sortir
   le focus du bloc. Corrigé par une prop `onSaveNow`, passée de main en main
   jusqu'à `MapWorkspace`.
2. **Listes déroulantes** : voir ci-dessous.
3. **Case du bloc musique** (V2.1-6) : le cas présent.

À chaque fois, un correctif ponctuel là où ça faisait mal, jamais la cause.

**Le deuxième cas, sous un autre visage.** `Dropdown` porte un
`onMouseDown={(e) => e.preventDefault()}` sur chaque option, et son commentaire
raconte l'histoire : le menu vit dans un portail hors de la carte du bloc, donc
cliquer une option faisait quitter le focus AVANT que la sélection ne soit
appliquée — la sauvegarde au blur partait alors avec l'état précédent, et la
valeur choisie disparaissait au premier rechargement. Le garde a supprimé le
symptôme, mais il a aussi fixé l'autre moitié du problème : le focus reste
désormais sur le déclencheur, à l'intérieur du bloc, donc choisir une option ne
déclenche **aucun** enregistrement. Deux symptômes, une seule cause — c'est
cette cause qu'on traite ici.

Fait déterminant : les deux composants concernés — `components/shared/Checkbox.tsx`
(un `<span role="checkbox">`) et `components/shared/Dropdown.tsx` (un `<button>`
et une liste `role="listbox"`) — **n'émettent aucun événement `change` natif**.
La charte d'interface impose ces composants ARIA maison précisément pour ne pas
dépendre des contrôles natifs, que le navigateur peint lui-même. Écouter le
`change` natif sur la carte du bloc, qui donnerait pourtant exactement la bonne
sémantique, ne les couvrirait donc jamais.

## Options

**A. Un enregistrement différé (debounce) après toute modification.** Couvre
tout d'un coup, y compris ce qu'on n'a pas anticipé, et tient en un seul
endroit. Mais multiplie les `PATCH` pendant la frappe — un paragraphe devient
une requête par pause — alors que le projet a déjà touché ses quotas Supabase
(voir le commit qui a remplacé les comptes de test jetables par un pool).
Écarté : on paierait en écriture permanente un défaut qui ne concerne pas le
texte.

**B. Avertir plutôt qu'enregistrer** — indicateur « non enregistré » et garde
au départ de la page. Ne corrige pas la perte, la nomme ; et en App Router,
intercepter une navigation client est peu fiable. Écarté.

**C. Un bouton « Enregistrer » par bloc.** Renverserait le caractère
automatique de tout l'éditeur pour un défaut localisé. Écarté.

**D. Les contrôles discrets engagent leur valeur, le texte garde le blur.**
Retenu.

## Décision

**Un contrôle discret — case cochée, option choisie — enregistre son bloc
immédiatement. Un champ de texte continue de s'enregistrer à la perte du
focus.**

Le mécanisme est un contexte minuscule (`components/shared/EditCommitContext.tsx`)
qui expose une fonction `commit`. `Checkbox` et `Dropdown` la réclament et
l'appellent après avoir prévenu leur propre `onChange` ; `EntityBlocks` la
fournit, pour chaque carte, comme « enregistre CE bloc ».

Trois raisons à cette forme plutôt qu'à une prop passée de main en main :

- **aucun des 10 éditeurs concernés n'est touché** — la règle vit là où vit le
  contrôle, pas dans chaque appelant ;
- hors d'un conteneur qui sait enregistrer, le contexte vaut `null` et les deux
  composants se comportent exactement comme avant : ils sont utilisés partout
  dans l'application, pas seulement dans des blocs ;
- l'ordre est garanti : le `onChange` du composant met à jour `blocksRef`
  (miroir synchrone, déjà en place) dans le même tour, donc le `commit` qui
  suit envoie bien la valeur neuve.

Appeler `saveBlock` plus souvent est sûr : il est déjà sérialisé par bloc
(`saveChainsRef`, contre les 409) et lit `blocksRef` plutôt que l'état React.
La seule dépense est le nombre de requêtes — ici exactement **une de plus par
clic sur un contrôle discret**, et aucune pendant la frappe.

**Complément : un indicateur d'enregistrement, en deux temps.** Le défaut a
coûté cher parce qu'il était muet ; rendre l'écriture visible fait qu'un
prochain de la même famille se verra sur le coup, au lieu de se découvrir après
coup dans la donnée servie.

Le premier jet n'affichait « Enregistré » qu'au **retour** de la requête —
mesuré à une à deux secondes après le geste, le temps de l'aller-retour vers un
Supabase distant. Trop tard pour rassurer : c'est précisément l'instant du
geste qu'il faut accuser. Tout annoncer au départ mentirait en cas d'échec, on
dit donc la vérité du moment : **« Enregistrement… » dès le départ de la
requête, « Enregistré » à son arrivée**, et l'indicateur s'efface si l'écriture
échoue — ce sont alors les bandeaux de conflit et d'erreur qui parlent, jamais
une réussite annoncée à tort.

Mesuré en navigateur : « Enregistrement… » à 262 ms, « Enregistré » à 2 257 ms
sur la même écriture. Et sur un échec simulé (500 forcé), aucun « Enregistré »
n'apparaît jamais — seul le bandeau d'erreur, à 401 ms.

## Conséquences

- Les contrôles **natifs** (`<input type="range">`, quatre au total) ne sont pas
  couverts par ce mécanisme, et n'en ont pas besoin : ils prennent le focus
  quand on les manipule, donc le blur les enregistre déjà. On n'ajoute pas
  d'écouteur `change` natif pour un besoin que personne n'a — la règle des
  trois vaut aussi ici. Le jour où un contrôle natif discret pose vraiment
  problème, l'écouteur se pose sur la carte du bloc en quelques lignes.
- Le texte reste la seule chose qu'on puisse encore perdre en quittant la page
  au milieu d'une phrase. C'est le comportement d'avant, inchangé, et il est
  cohérent : une phrase en cours n'est pas une valeur engagée.
- **`onSaveNow` reste en place pour le bloc carte**, et fait double emploi en
  principe : c'est la même idée, trouvée plus tôt pour un seul bloc et câblée
  en prop. Les deux devraient converger vers le contexte, mais c'est un
  remplacement mécanique qui n'appartient pas à ce correctif — le noter plutôt
  que l'entreprendre au passage. Tant qu'il vit, il ne fait courir aucun
  risque : les deux chemins aboutissent au même `saveBlock`, sérialisé.
- `Checkbox` et `Dropdown` gagnent une dépendance à un contexte. Elle est
  optionnelle par construction, et c'est ce qui permet de ne pas modifier les
  éditeurs — mais elle rend leur comportement dépendant de leur environnement,
  ce qu'il faut savoir en les lisant. Les deux fichiers le disent en tête.
