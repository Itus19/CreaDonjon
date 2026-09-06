# Audit CreaDonjon — Frontend, interface et expérience

**Date :** 2026-09-06 · **Révision auditée :** `6851a0f`
**Voir aussi :** [synthèse](./2026-09-06-synthese.md) · [backend](./2026-09-06-backend.md)

Périmètre : `app/**` (44 pages), `components/**` (179 composants, ~36 000 lignes), `app/globals.css`, `src/styles/tokens.css`, `messages/**`, `src/i18n/**`.

Ce rapport a deux parties. La première liste des constats mesurables (`F-nn`), sur le même modèle que le rapport backend. La seconde est différente : ce sont des **recommandations de conception**, sans identifiant, qui ne décrivent pas des défauts mais des choix à faire. C'est la partie qui répond à la demande de « conseils d'UI/UX » — elle est écrite comme un avis argumenté, pas comme une liste de corrections.

---

# Partie I — Constats

## 1. Ce que l'application fait déjà mieux que la moyenne

À dire d'abord, parce que la suite ne parle que des manques.

**Le système de couleurs est de niveau professionnel.** `src/styles/tokens.css` : OKLCH plutôt qu'hexadécimal — donc une clarté perceptuelle, donc un contraste qui reste garanti quand la teinte change. Quatre modes complets (`dark`/`dim`/`soft`/`light`), un mode contraste élevé, l'activation automatique sous `prefers-contrast: more`, `prefers-reduced-motion` traité globalement, un `:focus-visible` défini une fois pour toute l'application. Le commentaire d'en-tête précise que les valeurs de clarté ont été **vérifiées par calcul** (conversion OKLCH → luminance WCAG), pas à l'œil. C'est plus rigoureux que ce que font la plupart des équipes produit.

**La coquille joueur est pensée pour le vrai usage.** `PlayerShell.tsx` : barre d'onglets en bas sous 768 px (« zone du pouce »), rail latéral au-dessus, un seul composant plutôt que deux implémentations, six destinations fixes, pas de réglages pour les joueurs. Ces décisions sont justes et elles sont documentées avec leur raison. Quelqu'un qui n'a jamais joué à une table ne conçoit pas cette barre-là.

**Le noyau est propre.** Zéro `any`, zéro `@ts-ignore`, `typecheck` et `lint` verts sans un seul avertissement, 742 tests unitaires. Les `eslint-disable` sont peu nombreux et, sauf trois exceptions, accompagnés d'une justification écrite qui tient la route.

**La palette de commandes existe** (`CommandPalette.tsx`) — c'est le bon réflexe pour une application dense, et c'est en général la dernière chose que les gens ajoutent, jamais la première.

Ce qui suit ne remet rien de tout ça en cause. Les manques sont concentrés sur trois axes : **les états de l'interface** (que voit-on quand ça charge, quand ça échoue, quand c'est vide), **l'accessibilité au-delà des couleurs**, et **le volume de JavaScript envoyé au navigateur**.

---

## 2. Les états de l'interface

C'est l'axe le plus important, et le moins coûteux à traiter. Une interface, ce n'est pas seulement l'état où tout va bien.

### F‑01 · Aucun écran d'erreur — **Élevé · Défaut**

Sur 44 pages : **zéro** `error.tsx`, **zéro** `global-error.tsx`, **zéro** `not-found.tsx`.

Une erreur non rattrapée dans un composant serveur — base injoignable, session expirée pendant un rendu, entité supprimée entre deux navigations — remonte jusqu'à l'écran d'erreur par défaut de Next.js. En production, c'est une page blanche avec un message générique : pas de contexte, pas de bouton pour réessayer, pas de sortie vers l'accueil.

C'est invisible tant que rien ne casse, et c'est la seule chose dont on se souviendra le jour où quelque chose casse — c'est-à-dire en général au milieu d'une partie, devant les amis.

Ce que ça vaut de faire : un `app/error.tsx` (l'erreur nommée en français, un bouton « Réessayer » qui appelle `reset()`, un lien « Retour à mes mondes »), un `app/global-error.tsx` pour le cas où la mise en page elle-même échoue, un `app/m/[worldSlug]/error.tsx` qui reste dans la coquille du monde, et un `not-found.tsx` pour les slugs inconnus. Quatre fichiers courts, et l'application cesse de pouvoir montrer un écran qu'elle n'a pas dessiné.

### F‑02 · Aucun état de chargement pour la navigation serveur — **Élevé · Dette**

Zéro `loading.tsx`, deux `<Suspense>` dans tout le projet.

Toute navigation vers une page serveur (`/m/<monde>/f/<fiche>`, les onglets de la coquille joueur, les pages de règles) bloque jusqu'à ce que le rendu complet soit prêt. Pendant ce temps, rien ne se passe à l'écran : la page précédente reste affichée, figée. Sur une connexion lente ou une requête un peu lourde, on croit que le clic n'a pas été pris en compte, alors on reclique.

C'est un problème de *latence perçue*, pas de latence réelle : le temps de chargement est le même, l'impression est radicalement différente. Un `loading.tsx` par section — même minimal — transforme « l'application ne répond pas » en « l'application travaille ».

### F‑03 · Un échec réseau ressemble à un chargement infini — **Élevé · Défaut**

`components/shell/useCachedGet.ts:38-45`

```ts
fetch(url)
  .then((res) => (res.ok ? res.json() : null))
  .then((body) => { if (cancelled || body === null) return; … })
  .catch(() => {});
```

Trois situations produisent exactement le même état final :

| Situation | `data` | Ce que voit la personne |
|---|---|---|
| Chargement en cours | `null` | « Chargement… » |
| Réponse 403 / 500 | `null` | « Chargement… » |
| Panne réseau | `null` | « Chargement… » |

Le hook est utilisé par plusieurs panneaux de la coquille (`GmJournalPanel`, `CampaignDetail`, `InviteLinkPanel`). Une erreur de droits ou une coupure y produit un panneau bloqué sur « Chargement… », indéfiniment, sans aucun moyen de comprendre ni de réessayer.

C'est aussi le seul endroit du projet où la règle « n'écris pas de `catch` silencieux » (`CLAUDE.md`) est enfreinte — et c'est celui où elle comptait le plus.

Ce que ça vaut de faire : renvoyer trois états distincts au lieu d'un (`data`, `error`, `loading`), et donner à chacun un rendu propre — la donnée, un message d'erreur avec un bouton « Réessayer » (le `reload()` existe déjà), ou l'indicateur de chargement. Le cache reste utile tel quel : il évite le clignotement au remontage, ce qui est son objet et ce qu'il fait bien.

### F‑04 · La majorité des `fetch` ne vérifient pas la réponse — **Moyen · Défaut**

Environ 130 appels `await fetch(...)` dans `components/**`, dont une trentaine seulement testent `res.ok`. Les autres considèrent qu'un appel qui n'a pas levé d'exception a réussi.

Concrètement : un `PATCH` refusé par la RLS renvoie une erreur HTTP, `fetch` ne lève rien, le composant continue comme si de rien n'était. L'utilisateur voit sa modification affichée à l'écran ; elle n'est pas en base. Il s'en apercevra au prochain rechargement, sans comprendre pourquoi.

C'est le pire type de défaut : silencieux, et qui donne l'impression que l'application perd des données au hasard.

### F‑05 · Pas de retour d'action global — **Moyen · Dette**

Un seul mécanisme de notification dans tout le projet (`DiceRollPanel.tsx`, pour les jets). Zéro `useOptimistic`, zéro `useTransition`.

Il n'existe donc aucun endroit commun pour dire « enregistré », « échec de l'enregistrement », « lien copié », « fiche supprimée — annuler ». Chaque composant improvise, ou ne dit rien.

C'est développé plus loin dans la partie II (« Toute action mérite un accusé de réception »), parce que c'est autant une question de conception qu'une question de code.

### F‑06 · `EmptyState` existe mais n'est presque pas utilisé — **Faible · Dette**

`components/shell/EmptyState.tsx` porte en commentaire la bonne idée : *« un écran vide est une invitation à agir, pas un message d'erreur »*. Il est utilisé dans **2 fichiers** sur 179.

Ailleurs, le vide est traité par une ligne de texte grise : `EntityBlocks.tsx:715` — *« Aucun bloc. Utilisez la barre ci-dessous pour en ajouter. »* en `text-xs italic text-ink-muted`, c'est-à-dire dans le style le moins visible du système. Le premier écran qu'une personne voit en créant un monde est un écran vide ; c'est le moment où elle a le plus besoin d'être guidée, et c'est celui où l'application en dit le moins.

### F‑07 · Trois `confirm()` natifs subsistent, sur des actions destructives — **Faible · Défaut**

`ConfirmDialog.tsx` a été écrit précisément pour les remplacer, avec la bonne justification en commentaire (la boîte native est facile à manquer, sans cohérence visuelle, variable selon le navigateur). Trois appels natifs restent — et ce sont précisément les plus destructifs : suppression définitive d'un combat (`InitiativeTracker.tsx:139`), suppression définitive du compte d'un ami (`AdminPanel.tsx:88`), export volumineux (`WorldCardActions.tsx:250`). Remplacement mécanique par `ConfirmDialog`, qui prend déjà une variante `danger`.

---

## 3. Accessibilité

Le socle est excellent. C'est l'usage qui manque.

### F‑08 · Rien n'est annoncé — **Élevé · Défaut**

**Zéro** `aria-live`, **zéro** `role="status"`, **zéro** `role="alert"` dans tout le projet.

Tout ce qui apparaît sans changement de page est donc invisible pour un lecteur d'écran : le résultat d'un jet de dés, un message d'erreur de formulaire, la confirmation d'un enregistrement, l'arrivée d'un message de chat, le passage au tour suivant en initiative.

Ce n'est pas seulement une question de conformité. Une région `aria-live="polite"` est aussi ce qui permet à quelqu'un qui a détourné le regard de savoir que quelque chose s'est passé. Sur une application qu'on utilise en parlant à cinq personnes autour d'une table, ce n'est pas un détail théorique.

Le minimum utile : une région polie unique dans `AppShell`, alimentée par le même mécanisme que les notifications de F‑05 — un seul point, réutilisé partout, plutôt qu'un attribut ajouté au cas par cas.

### F‑09 · Les modales ne piègent pas le focus — **Élevé · Défaut**

`components/shared/ConfirmDialog.tsx`, qui sert de modèle aux autres, illustre les cinq manques :

1. **Pas de piège de focus** — `Tab` sort de la modale et parcourt la page derrière, qui reste atteignable.
2. **Pas de fermeture par `Échap`** — seul le clic sur le fond ferme.
3. **Pas de focus initial** — après ouverture, le focus reste où il était ; au clavier, il faut tabuler jusqu'à la modale sans savoir combien de fois.
4. **Pas de restauration du focus** — à la fermeture, le focus est perdu ; on repart du début du document.
5. **`role="dialog"` posé sur le scrim** (`fixed inset-0`), pas sur le panneau. La boîte de dialogue déclarée aux technologies d'assistance est donc le voile plein écran, pas son contenu.

Le point 2 mérite d'être souligné même pour un usage à la souris : `Échap` pour annuler est un réflexe universel. Une modale qui ne réagit pas à `Échap` donne une impression de logiciel bricolé, indépendamment de toute considération d'accessibilité.

**Recommandation particulière :** l'élément `<dialog>` natif fait les points 1, 2 et 4 sans une ligne de JavaScript (`showModal()`, `::backdrop`, `close`). Il est pris en charge partout depuis 2022. `createPortal` vers `document.body` — ce que fait le code actuel — est exactement ce que `<dialog>` remplace. Ce serait moins de code, pas plus.

### F‑10 · Les fenêtres flottantes ne sont ni accessibles ni tactiles — **Moyen · Dette**

`components/shell/WindowFrame.tsx` (158 lignes) : aucun `role`, aucun attribut `aria-*`, aucun `onKeyDown`, aucun `tabIndex`. Les boutons Réduire / Agrandir / Fermer portent un `title=` (infobulle au survol) mais pas d'`aria-label`.

Et le déplacement repose sur `onMouseDown` (ligne 119), pas sur les Pointer Events. **Une fenêtre ne peut donc pas être déplacée au doigt** — sur une tablette posée sur la table de jeu, elle reste là où elle est apparue.

Le second point est probablement le plus concret des deux : le paradigme du bureau à fenêtres est un choix produit assumé (ADR 0006, 0011), et c'est un bon choix pour l'écran MJ. Mais un bureau à fenêtres qu'on ne peut pas manipuler au doigt exclut la tablette, qui est justement l'appareil qu'on pose au milieu d'une table.

Le passage de `onMouseDown` à `onPointerDown` + `setPointerCapture` est une modification locale — quelques lignes dans un seul fichier — et il apporte le tactile et le stylet d'un coup.

### F‑11 · La typographie est trop petite — **Moyen · Dette**

Distribution mesurée sur `components/**` et `app/**` :

| Classe | Taille | Occurrences |
|---|---|---|
| `text-[9px]` | 9 px | 22 |
| `text-[10px]` | 10 px | **170** |
| `text-[11px]` | 11 px | 17 |
| `text-xs` | 12 px | **646** |
| `text-sm` | 14 px | 491 |
| `text-base` | 16 px | **28** |
| `text-lg` et plus | ≥ 18 px | 37 |

**855 occurrences sous 13 px, contre 28 à la taille de lecture confortable.**

Douze pixels est la taille des mentions légales. C'est ici la taille par défaut du corps de texte de l'application. Sur un écran de 27 pouces à 70 cm, c'est déjà tendu ; sur un portable dans une pièce mal éclairée, après trois heures de partie, c'est fatigant ; à plus de quarante ans, avec ou sans lunettes, c'est un obstacle.

C'est d'autant plus dommage que tout le travail sur le contraste — vérifié par calcul, quatre modes, mode haut contraste — vise exactement le même objectif : rendre le texte lisible. Un contraste de 7:1 sur du 10 px ne rend pas le texte lisible.

Il y a aussi un écart de conformité : `tokens.css` déclare en tête *« aucune couleur ni taille de police en dur ailleurs dans le code »*. Les 209 tailles arbitraires (`text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[15px]`) sont des tailles en dur. La règle est tenue pour les couleurs, pas pour la typographie.

La direction est développée dans la partie II.

### F‑12 · Les cibles de clic sont sous le minimum — **Moyen · Dette**

Sur les éléments interactifs : 82 `py-0.5` (2 px de remplissage vertical) et 260 `py-1` (4 px). Avec du `text-xs`, cela donne des boutons de 20 à 24 px de haut.

Le seuil WCAG 2.5.8 (niveau AA) est de 24 × 24 px. Le seuil confortable, celui que les recommandations d'Apple et de Google retiennent pour le tactile, est de 44 px. Une partie des boutons de l'application sont donc à la limite basse de la norme, et loin du confort réel — y compris à la souris, sur un écran dense où les cibles voisines sont à quelques pixels.

Le remède ne demande pas d'agrandir visuellement les boutons : une zone cliquable étendue (remplissage transparent, ou `::before` étendu) conserve la densité visuelle tout en donnant une cible confortable. C'est ce que font les barres d'icônes bien faites.

### F‑13 · Les onglets ne sont pas sémantiques — **Faible · Dette**

Un seul `role="tablist"` et un seul `role="tab"` dans tout le projet, alors que le motif d'onglets est partout (fiche de personnage jouable, `ActionsTab`, `Tabs.tsx` partagé, sections de la coquille). Les autres sont des `<button>` sans rôle : les flèches gauche/droite ne circulent pas entre les onglets, et un lecteur d'écran n'annonce ni « onglet 2 sur 5 », ni lequel est actif.

`Tabs.tsx` étant déjà un composant partagé, la correction est centralisée : les rôles, `aria-selected`, et la navigation aux flèches s'ajoutent une fois et bénéficient à tous les appels.

---

## 4. Performance et volume de code

### F‑14 · Tout est client, et rien n'est découpé — **Élevé · Dette**

**159 des 179 composants** de `components/**` portent `"use client"`. **Zéro** `next/dynamic`, **zéro** `React.lazy` dans tout le projet.

À nuancer d'emblée : `app/**` est majoritairement serveur (12 fichiers clients sur 62), ce qui est le bon découpage — les pages chargent leurs données côté serveur et passent la main à des composants clients pour l'interaction. Le problème n'est donc pas « tout est client » au niveau des pages, il est dans la **taille et le découpage du sous-arbre client** une fois qu'on y entre.

Le cas le plus net est `components/blocks/EntityBlocks.tsx` (977 lignes) : il importe **statiquement les 21 éditeurs de blocs** — texte, encadré, image, tableau, table aléatoire, générateur, inventaire, incantation, ressources, musique, généalogie, quête, journal de séance, personnalité, relation, convictions, réseau, chronologie, carte, fiche de créature, personnage jouable.

Conséquence : ouvrir n'importe quelle fiche télécharge et analyse le code de **tous** les éditeurs, y compris ceux des types de blocs que cette fiche n'utilise pas. Et par ricochet leurs dépendances : Tiptap (l'éditeur de texte enrichi, sept paquets), `@dnd-kit` (trois paquets), `d3-force` (le graphe de relations). Une fiche qui ne contient qu'un bloc texte paie le coût du canevas de carte et du moteur de graphe.

Ce n'est pas un problème aujourd'hui — en développement local tout est instantané, et l'auteur a une bonne machine. Ça le devient de deux façons : quand un ami ouvre l'application sur un téléphone en 4G, et de manière continue, parce que **le coût augmente à chaque nouveau type de bloc**. Le vingt-deuxième s'ajoutera au paquet initial comme les vingt et un précédents.

`next/dynamic` sur la table de correspondance des éditeurs — un seul endroit, `BlockDataEditor` — suffirait : chaque éditeur devient un morceau séparé, chargé au moment où un bloc de ce type apparaît réellement. C'est une des rares optimisations dont le gain est proportionnel à la croissance du projet.

### F‑15 · Les images ne passent pas par `next/image` — **Moyen · Dette**

Un seul usage de `next/image`, contre 11 balises `<img>` brutes (avec un `eslint-disable` chacune).

La justification écrite est correcte : ce sont des images dynamiques servies par `/api/assets/[id]`, dont Next ne connaît pas l'URL à la compilation. Mais `next/image` accepte parfaitement une URL dynamique — ce qui manque, c'est la déclaration du domaine dans `next.config.ts`, plus `width`/`height` (ou `fill`).

Ce qu'on perd en attendant : le redimensionnement automatique (une carte de 4096 px est envoyée en pleine résolution à un téléphone), le format moderne selon le navigateur, le chargement différé, et surtout la réservation de l'espace — sans dimensions, la page saute quand l'image arrive. Ce dernier point (*Cumulative Layout Shift*) est le plus visible : c'est ce qui fait qu'on clique à côté parce que le contenu a bougé sous le curseur.

Le cas des cartes mérite un traitement propre de toute façon : `MapCanvas` affiche des images de plusieurs milliers de pixels, et c'est le seul endroit de l'application où le poids des images est structurellement élevé.

### F‑16 · Chargement en cascade — **Moyen · Dette**

40 composants font un `fetch` dans un `useEffect`. Le déroulement est toujours le même : le serveur rend la page → le navigateur télécharge le JavaScript → React monte le composant → l'effet part → la requête voyage → le contenu apparaît.

Chaque étape est séquentielle, et rien ne commence avant la fin de la précédente. Une donnée qui aurait pu être rendue côté serveur en un aller-retour en demande quatre.

C'est le corollaire direct de F‑14 : quand tout est composant client, toute donnée doit être cherchée depuis le client. Les deux se traitent ensemble, et pas en une fois — page par page, en commençant par celles qu'on ouvre le plus souvent (la fiche d'entité, l'accueil du monde).

### F‑17 · Le cache de `useCachedGet` survit au changement de compte — **Faible · Défaut**

Le `Map` de `useCachedGet` vit au niveau du module, indexé uniquement par une clé applicative. Il n'est jamais vidé.

Avec la fonction « voir comme » (`viewAs`, ADR 0016), qui remplace réellement la session par celle d'un autre compte, le cache peint donc les données du compte *précédent* au premier rendu du panneau, avant que la requête fraîche ne les remplace. C'est fugace, mais c'est visuellement une fuite de données entre comptes — précisément dans la fonctionnalité où le superadmin vérifie ce qu'un joueur voit.

Correction : inclure l'identifiant de l'utilisateur dans la clé de cache, ou vider le cache au retour de `viewAs`.

---

## 5. Cohérence

### F‑18 · Trois mécanismes de libellés coexistent — **Moyen · Dette**

| Mécanisme | Volume | Usage |
|---|---|---|
| `messages/fr.json` + `en.json` (next-intl) | 260 lignes | **27** fichiers |
| `src/i18n/fr.ts` (constantes) | 616 lignes | libellés de domaine (relations, écoles de magie…) |
| Français en dur dans le JSX | ~155 occurrences repérées | partout ailleurs |

`CLAUDE.md` dit : *« les libellés français vivent dans `messages/` et `src/i18n/` »*. Sur environ 215 fichiers d'interface, 27 utilisent `next-intl`.

Il y a aussi un `messages/en.json` maintenu structurellement identique à `fr.json` (avec une vérification par le typage global, `global.d.ts` — belle idée), qui couvre donc 12 % de l'interface. Un catalogue anglais partiel entretenu à côté d'une interface française codée en dur est le pire des deux mondes : le coût de la maintenance sans le bénéfice de la traduction.

Il n'y a pas de bonne réponse universelle ici, il y a une décision à prendre et à écrire :

- **Soit l'application est francophone et le restera** — alors le français en dur est légitime, `messages/en.json` peut disparaître, et `next-intl` se réduit à ce qui en a vraiment besoin (les pluriels, les dates). C'est cohérent avec « CreaDonjon est un outil personnel ».
- **Soit l'anglais est un objectif réel** — alors le français en dur est de la dette qui grossit à chaque composant, et il faut arrêter d'en ajouter avant de rattraper l'existant.

Le coût de l'indécision est de payer les deux. Un ADR de dix lignes règle la question définitivement.

### F‑19 · Un seul titre de page pour toute l'application — **Faible · Défaut**

Un seul `export const metadata` sur 44 pages, aucun `generateMetadata`.

Tous les onglets du navigateur portent donc le même titre. Avec une application qu'on utilise en ouvrant plusieurs onglets — la fiche d'un PNJ, les règles, la carte — c'est un vrai inconfort quotidien : impossible de distinguer les onglets autrement qu'en cliquant dessus. L'historique du navigateur devient inutilisable pour la même raison.

Un `generateMetadata` sur les pages dynamiques (`Nom de la fiche · Nom du monde`) est une dizaine de lignes et se remarque tous les jours.

### F‑20 · Aucune indication de sauvegarde sur l'édition au flou — **Moyen · Dette**

L'édition des blocs enregistre à la perte du focus (`EntityBlocks.tsx:707`, `handleBlockBlur`), avec par endroits un délai (`GeneratorToolPanel`, 800 ms ; `NotesEditor`, un `SAVE_DEBOUNCE_MS`).

C'est un bon choix — l'édition en ligne sans bouton « Enregistrer » est fluide et convient à un wiki. Mais il repose sur une confiance implicite : **rien à l'écran ne dit que l'enregistrement a eu lieu.** Combiné à F‑04 (les réponses en erreur ne sont pas vérifiées), le scénario réaliste est : on écrit un paragraphe, on clique ailleurs, l'enregistrement échoue silencieusement, on ferme l'onglet, le texte est perdu.

Une sauvegarde implicite doit être visible. C'est développé dans la partie II.

Un commentaire du code signale d'ailleurs déjà la fragilité du mécanisme : *« la sauvegarde habituelle (perte de focus du conteneur du bloc) ne se déclenche pas de manière fiable depuis une fenêtre modale imbriquée dans ce même conteneur »* — d'où un `onSaveNow` de contournement pour le bloc carte. Un mécanisme qui a déjà besoin d'une exception en aura d'autres.

---

# Partie II — Recommandations de conception

Ce qui suit n'est pas une liste de correctifs. Ce sont des avis sur des choix de conception, avec le raisonnement qui les motive. À prendre ou à laisser — mais si on les laisse, autant que ce soit en connaissance de cause.

---

## 1. Choisir une échelle typographique, et s'y tenir

C'est la recommandation qui changerait le plus l'impression générale de l'application, et c'est celle qu'il vaut mieux traiter tôt : 855 occurrences aujourd'hui, davantage demain.

Le problème n'est pas que le texte soit petit — c'est qu'il n'y a pas d'échelle du tout. Neuf tailles différentes se répartissent sur trois pixels d'écart (9, 10, 11, 12), ce qui veut dire que la distinction entre elles n'est pas perceptible. Une différence typographique qui ne se voit pas ne hiérarchise rien : elle produit juste du texte plus ou moins pénible à lire.

**Une échelle utilisable a peu de niveaux, franchement distincts.** Cinq suffisent :

| Rôle | Taille | Usage |
|---|---|---|
| Corps de texte | 16 px | Tout ce qui se lit : contenu des blocs, descriptions, wiki |
| Interface | 14 px | Étiquettes, boutons, menus, barres latérales |
| Secondaire | 13 px | Métadonnées, horodatages, mentions |
| Titre de section | 20 px | En-têtes de blocs et de panneaux |
| Titre de page | 28 px | Nom de la fiche, nom du monde |

Le point important n'est pas ces valeurs précises — c'est **qu'il n'y ait rien en dessous de 13 px, et rien qui ne soit pas dans la liste**. Et que ces valeurs vivent dans `tokens.css` comme les couleurs, pour que la règle déjà écrite (« aucune taille de police en dur ») devienne vraie.

**Deux objections à traiter d'avance :**

*« L'application est dense, il y a beaucoup à afficher. »* — La densité se gagne par l'espacement et la mise en page, pas par la taille du texte. Un tableau à 14 px avec des lignes serrées est plus dense *et* plus lisible qu'un tableau à 10 px avec des lignes aérées, parce que l'œil scanne plus vite ce qu'il déchiffre sans effort. Réduire la police est le levier de densité le plus facile et le plus mauvais.

*« Tout changer d'un coup est risqué. »* — Oui. Mais ce n'est pas nécessaire. La méthode qui marche : figer l'échelle dans `tokens.css`, l'appliquer aux nouveaux écrans, et convertir les anciens quand on les rouvre pour autre chose. En six mois de travail normal, la majorité de l'application y passe sans qu'aucune session n'ait été consacrée à ça.

## 2. Toute action mérite un accusé de réception

C'est le manque le plus visible à l'usage, et il recoupe F‑03, F‑04, F‑05 et F‑20.

Aujourd'hui, la réponse à « qu'est-ce qui s'est passé quand j'ai cliqué ? » dépend du composant. Parfois un état de chargement, parfois rien, parfois une modification affichée qui n'est pas enregistrée.

**La règle à adopter : toute action déclenchée par une personne produit un signal visible, dans les 100 ms, et un état final explicite.** Sans exception, y compris quand ça marche.

Ce que ça demande, concrètement :

**Un mécanisme de notification unique**, monté dans `AppShell`, avec quatre variantes — succès, erreur, information, et action réversible (« Fiche supprimée · Annuler »). Un seul point d'entrée, appelé partout. Cette même région porte l'`aria-live` de F‑08 : un composant, deux problèmes résolus.

**Un indicateur d'enregistrement pour l'édition au flou.** Trois états sur le bloc en cours : *modifié* (un point discret dans le coin), *enregistrement…*, *enregistré* (qui s'efface après deux secondes). C'est ce que fait Notion, et c'est pour ça qu'on fait confiance à Notion pour ne pas perdre ce qu'on écrit. Sans cet indicateur, la sauvegarde implicite est une promesse invérifiable.

**Un état d'échec récupérable.** Si l'enregistrement échoue : le bloc reste en état modifié, un message le dit, un bouton « Réessayer » est offert, et surtout **le texte saisi n'est pas perdu**. C'est le point qui compte le plus : une erreur qu'on peut réessayer est un contretemps, une erreur qui efface le travail est une raison d'arrêter d'utiliser l'application.

**Un retour optimiste sur les actions rapides.** Cocher un objectif de quête, changer un PV, réordonner un bloc : afficher immédiatement, envoyer en arrière-plan, revenir en arrière avec un message si ça échoue. `useOptimistic` de React est fait pour ça et n'est utilisé nulle part. Sur une application manipulée pendant qu'on parle à cinq personnes, l'attente de l'aller-retour réseau à chaque clic se paie cher.

## 3. Les écrans vides sont le seul moment où on lit l'aide

Personne ne lit la documentation d'un outil personnel. Le seul moment où quelqu'un lit du texte explicatif dans une application, c'est quand il n'y a rien d'autre à regarder.

`EmptyState` existe et son commentaire dit exactement la bonne chose. Il est utilisé deux fois. Les cinq endroits où il changerait quelque chose :

**Un monde sans fiche.** C'est le premier écran après la création d'un monde. Il devrait proposer les trois premiers gestes — créer un lieu, créer un PNJ, importer un monde existant — pas afficher une liste vide.

**Une fiche sans bloc.** Aujourd'hui : *« Aucun bloc. Utilisez la barre ci-dessous pour en ajouter. »*, en 12 px, gris, italique. C'est le moment où l'on découvre qu'il existe 21 types de blocs ; c'est le moment de le montrer, pas de le mentionner en petit.

**Une campagne sans joueur.** Devrait mener directement au lien d'invitation, qui est l'action suivante dans tous les cas.

**Une recherche sans résultat.** Doit distinguer « rien ne correspond » de « rien n'est encore indexé » — ce sont deux problèmes différents et deux gestes différents.

**Un espace joueur avant l'attribution d'un personnage.** C'est le tout premier écran qu'un ami invité voit. S'il est vide, la première impression de l'application est qu'elle ne fait rien.

## 4. Ce que le bureau à fenêtres coûte, et où il ne faut pas le payer

Le paradigme du bureau à fenêtres flottantes est un choix assumé, documenté par deux ADR (0006, 0011). Pour l'écran MJ, c'est le bon choix : consulter une fiche de monstre en gardant l'initiative visible et la carte ouverte, c'est exactement ce qu'un MJ fait, et aucune navigation par pages ne le permet.

Mais il faut être lucide sur ce qu'il coûte :

**Il ne survit pas au tactile** (F‑10) — et l'appareil qu'on pose au milieu d'une table de jeu est une tablette.

**Il ne survit pas à l'écran étroit.** Une fenêtre flottante sur 390 px de large est une page en moins bien : elle occupe tout l'écran, avec une barre de titre en plus et le glisser-déposer en moins.

**Il déplace la charge mentale vers l'utilisateur.** Gérer l'empilement, le positionnement, ce qui est ouvert : c'est du travail. Sur l'écran MJ c'est un travail rentable, parce que la disposition est justement ce qu'on veut contrôler. Ailleurs, c'est du travail sans contrepartie.

La bonne nouvelle : la coquille joueur (`PlayerShell`) a déjà tranché dans le bon sens — six destinations fixes, barre d'onglets en bas, pas de fenêtres. C'est le bon arbitrage et il est bien fait. La recommandation est simplement de **le maintenir explicitement** : le bureau à fenêtres est un outil de MJ sur grand écran, et rien d'autre. Chaque fois qu'un nouvel écran est conçu, la question à poser est « est-ce un poste de pilotage, ou une chose qu'on consulte ? » — et de ne mettre en fenêtres que les premiers.

Et dans tous les cas, passer `WindowFrame` aux Pointer Events : le MJ aussi peut avoir une tablette.

## 5. Concevoir pour les conditions réelles de la table

C'est le conseil le plus spécifique à ce projet, et le plus facile à oublier en développant seul devant un écran bien réglé.

Cette application ne s'utilise pas comme un outil de bureau. Elle s'utilise :

**Dans une pièce sombre.** Le mode sombre par défaut est le bon choix. Mais il implique de faire attention aux surfaces blanches qui subsistent : une modale claire dans une pièce sombre éblouit pendant plusieurs secondes. À vérifier écran par écran, lumière éteinte.

**En parlant à d'autres personnes.** L'attention sur l'écran est fragmentée en tranches de deux ou trois secondes. Tout ce qui demande de lire une phrase pour comprendre où on en est est trop coûteux. C'est ce qui rend F‑11 (la typographie) et F‑12 (les cibles de clic) plus importants ici que dans une application de bureau ordinaire : on ne se penche pas vers l'écran, on jette un coup d'œil.

**À plusieurs mètres de l'écran, parfois.** Si l'écran MJ est projeté, ou juste posé à distance. Le mode contraste élevé existe déjà — un mode « grande police » (une seule variable dans `tokens.css`, appliquée à toute l'échelle) serait le complément naturel, et ne coûterait presque rien une fois l'échelle de la recommandation 1 en place.

**Sur un appareil qui n'est pas celui du développement.** Le vrai test de F‑14 (le poids du paquet client) et de F‑15 (les images non optimisées) est d'ouvrir l'application sur un téléphone en 4G. Une fois. Ça donne une idée bien plus juste que n'importe quelle mesure.

**Avec des personnes qui n'ont pas conçu l'application.** C'est ce qui rend les écrans vides (recommandation 3) et les messages d'erreur (F‑01) déterminants. L'auteur sait ce que fait chaque bouton ; ses amis découvrent, et ce qu'ils découvriront en premier, c'est ce qui ne marche pas.

## 6. Sur la densité — ce qui est bien tel quel

Une remarque pour équilibrer : tout n'est pas à changer, et certaines choses seraient abîmées par une refonte « moderne » mal ciblée.

**La densité d'information est une qualité ici.** Une fiche de créature D&D *doit* montrer beaucoup de chiffres d'un coup — c'est le principe même d'un bloc de statistiques. Un tableau de sorts *doit* pouvoir afficher trente lignes. Les interfaces aérées à la mode conviennent aux applications où l'on fait une chose à la fois ; elles seraient une régression pour un outil de MJ. Le problème diagnostiqué en F‑11 n'est pas la densité, c'est d'avoir cherché la densité par le mauvais levier.

**Le vocabulaire du domaine est bien respecté.** Les libellés parlent d'entités, de blocs, de rulesets — pas de « pages » et de « widgets ». Une interface qui emprunte le vocabulaire de son domaine est une interface qu'on n'a pas besoin d'apprendre.

**Les décisions produit sont documentées avec leur raison.** `PlayerShell.tsx` cite les retours d'utilisation qui ont motivé chaque choix, avec les dates. `AppShell.tsx` explique pourquoi `flex-1 min-h-0` plutôt que `h-dvh`, avec le bug que ça corrige. C'est la meilleure documentation d'interface qui soit : celle qui empêche quelqu'un — y compris soi-même dans six mois — de « corriger » un choix délibéré.

---

## Récapitulatif

| Id | Niveau | Nature | Constat |
|---|---|---|---|
| F‑01 | Élevé | Défaut | Aucun `error.tsx` / `global-error.tsx` / `not-found.tsx` |
| F‑02 | Élevé | Dette | Aucun `loading.tsx`, 2 `<Suspense>` |
| F‑03 | Élevé | Défaut | `useCachedGet` : échec réseau indistinguable d'un chargement |
| F‑08 | Élevé | Défaut | Zéro `aria-live` : rien n'est annoncé |
| F‑09 | Élevé | Défaut | Modales sans piège de focus, sans `Échap`, sans restauration |
| F‑14 | Élevé | Dette | 159/179 composants clients, zéro découpage dynamique |
| F‑04 | Moyen | Défaut | ~100 `fetch` sans vérification de `res.ok` |
| F‑05 | Moyen | Dette | Aucun retour d'action global |
| F‑10 | Moyen | Dette | Fenêtres non accessibles et non tactiles (`onMouseDown`) |
| F‑11 | Moyen | Dette | 855 occurrences de texte sous 13 px |
| F‑12 | Moyen | Dette | Cibles de clic à 20–24 px |
| F‑15 | Moyen | Dette | Images hors `next/image` |
| F‑16 | Moyen | Dette | Chargement en cascade dans 40 composants |
| F‑18 | Moyen | Dette | Trois mécanismes de libellés concurrents |
| F‑20 | Moyen | Dette | Sauvegarde implicite sans indication visible |
| F‑06 | Faible | Dette | `EmptyState` utilisé 2 fois sur 179 composants |
| F‑07 | Faible | Défaut | 3 `confirm()` natifs sur des actions destructives |
| F‑13 | Faible | Dette | Onglets non sémantiques |
| F‑17 | Faible | Défaut | Cache client non cloisonné par compte (`viewAs`) |
| F‑19 | Faible | Défaut | Un seul titre de page pour 44 pages |
