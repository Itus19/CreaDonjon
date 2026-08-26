# Backlog V2 — Le monde vivant

**Version :** 1.0 — 2 septembre 2026
**Établi sur :** l'état documenté de la V1. Le dépôt étant privé, les écarts éventuels sont à signaler.
**Documents liés :** `psyche-pnj.md` · `wiki-blocs.md` · `outils-mj.md` · `cible-locale-et-ia.md` · `module-joueur-et-solo.md`

---

## 0. Comment me montrer l'état du projet

Le dépôt est privé, je ne peux plus le lire. Le plus léger :

```bash
git log --oneline -20
```

Vos messages de commit sont assez descriptifs pour que ça suffise dans la plupart des cas. Pour une revue de code, téléversez les fichiers concernés.

---

## 1. Point de contrôle — vérifié sur le dépôt au commit `5f74b9a`

Inspection faite le 2 septembre. Cinq points sur six sont acquis.

| Point | État |
|---|---|
| Pureté de `src/core` | **acquis** — zéro import interdit, règle ESLint effective |
| Confinement du client `service_role` | **acquis** — un seul importateur, règle ESLint, test de fuite |
| Six cas dorés de `characterSheet()` | **acquis** — présents, plus deux cas d'encombrement |
| `AiProvider` + adaptateur local | **acquis** — `openAiCompatible.ts`, prêt pour Ollama et LM Studio |
| `ai_usage_log` à chaque appel | **acquis** — écrit même quand l'appel échoue |
| **Thème dérivé de l'image** | **incomplet** — voir V2-G4 |

### Restent à confirmer par vous (invisibles depuis le dépôt)

- [ ] **Couverture de traduction** par type d'entrée. Les scripts existent ; seul l'état de la base le dira.
- [ ] `npm run test:coverage` sur `src/core/rules` et `src/core/visibility` : au-dessus de 90 % ?
- [ ] La migration `restore_entity_blocks` suivant immédiatement `entity_blocks_full` : incident réglé ou correctif partiel ?

## 2. Principe de séquencement

> **Lever l'incertitude la plus grande d'abord, enrichir ensuite.**

La V1 suivait « le moteur avant l'écran ». La V2 a une contrainte différente : **une grande inconnue pèse sur la V3**, et elle est bon marché à lever maintenant que le moteur et le fournisseur d'IA existent.

D'où l'ordre :

```
S1        spike de viabilité du solo        2 à 4 jours, avant tout
Lot G     finitions et dette de V1
Lot H     le monde vivant                   psyché, généalogie, chronologie, quêtes
Lot I     les cartes
Lot J     génération assistée et confort
```

**H, I et J sont indépendants entre eux.** Vous pouvez les réordonner selon l'envie — c'est même recommandé, la motivation compte (risque R9). S1 et G, eux, viennent d'abord.

---

## S1 — Spike : le mode solo est-il viable sur votre machine ? · `M` — fait

**Ce n'est pas un ticket de fonctionnalité. C'est une expérience, avec un verdict.**

### Pourquoi maintenant

Votre essai avec SillyTavern a été décevant. Mais il testait l'approche que votre architecture remplace : tout empiler dans le prompt et laisser le modèle se souvenir, arbitrer, calculer et écrire simultanément.

Chez vous, le moteur calcule et le modèle reçoit *« boule de feu, trois gobelins touchés, 24 dégâts, deux morts, un baril d'huile dans la zone »* — environ 140 tokens, une seule tâche : raconter.

**Cette thèse n'a jamais été testée.** Elle détermine la forme de toute la V3. Elle coûte quelques jours à vérifier maintenant, contre plusieurs semaines à découvrir trop tard.

### Périmètre — délibérément minuscule

Pas d'interface à trois colonnes. Un écran jetable suffit.

- **Un** lieu préparé, avec sa description.
- **Trois** PNJ avec blocs `personality` et une relation chacun envers le groupe.
- **Un** combat préparé via le générateur de rencontres du lot E.
- Contexte assemblé de façon déterministe : lieu, PNJ présents, personnage du joueur, cinq derniers événements.
- `resolveAction` pour toute mécanique. Le modèle ne calcule rien, ne lance rien.
- Sorties structurées pour les propositions, validées par Zod.

### Ce qu'on mesure — vingt tours minimum

| Mesure | Seuil acceptable |
|---|---|
| Latence par tour | < 15 s, sinon injouable |
| Tokens d'entrée par tour | < 3 000 avec le contexte déterministe |
| Appels d'outils malformés | < 10 % des tours |
| Identifiants inventés | **0** — la validation doit tous les rejeter |
| Cohérence des PNJ sur 20 tours | jugement subjectif, noté honnêtement |
| Qualité de la prose | jugement subjectif, noté honnêtement |

Les deux dernières lignes sont subjectives et c'est assumé. **Notez-les au fil de l'eau, pas à la fin** — le souvenir global est toujours plus indulgent que l'expérience réelle.

### Le verdict, et ses trois issues

C'est le cœur du spike : **aucune issue n'est un échec du projet.**

| Constat | Décision |
|---|---|
| Mécanique solide, prose acceptable | La V3 se construit comme prévu |
| Mécanique solide, **prose faible** | → **repli sur le MJ assisté**, voir ci-dessous |
| Mécanique instable (outils, identifiants) | Changer de modèle avant de conclure ; c'est un symptôme de modèle, pas d'architecture |

### Le repli qui n'en est pas un : le MJ assisté

Si la narration autonome déçoit à la taille de modèle dont vous disposez, la V3 change de forme sans perdre sa valeur.

**MJ IA :** le modèle mène, vous jouez. Exige une bonne prose en continu.
**MJ assisté :** vous menez, le modèle propose. Il suggère une réaction de PNJ, une complication, une description que vous acceptez, modifiez ou ignorez.

Le second demande beaucoup moins au modèle : des propositions courtes, ponctuelles, que vous filtrez. Un modèle de 14 milliards de paramètres y est très correct là où il peine à porter une narration continue.

Et c'est **la même infrastructure** : contexte déterministe, propositions validées, outils du moteur. Seule l'interface change — des suggestions plutôt qu'un flux.

**Cette option devrait probablement exister de toute façon**, y compris si le solo fonctionne : c'est ce qui sert un MJ humain en séance, et c'est cohérent avec le principe 3.1 du PDD — l'IA assiste, elle ne confisque pas le contrôle.

### Critères

- [x] Vingt tours joués, mesures relevées au fil de l'eau.
- [x] Zéro identifiant inventé accepté par la validation.
- [x] Verdict écrit dans un ADR : `docs/adr/0009-viabilite-solo.md`.
- [ ] Si repli : la V3 est réécrite en conséquence **avant** d'ouvrir le lot G — **prochaine étape, pas encore faite** : le verdict recommande le repli (MJ assisté), mais aucune V3 formelle n'existe encore à réécrire (seulement le tableau §4 ci-dessous). À faire avant le lot G.

**Verdict (ADR 0009, 22 août 2026) : repli sur le MJ assisté.** Mesures objectives dans le budget (latence ~10 s, tokens ~1400, 0 identifiant inventé, 5 % d'appels malformés une fois l'incident d'infrastructure retiré) — c'est la cohérence narrative dans la durée qui déçoit à cette taille de modèle (répétitions verbatim, dérive de personnage, PNJ omniprésent hors de sa scène). Point ouvert : le lien fait-mécanique → narration n'a en réalité jamais été observé de bout en bout (panne réseau sur l'unique tentative) — à reboucler avant conclusion définitive. Détail complet et enseignements de conception (suivi de scène, contexte de personnage vivant, voix des PNJ incidents) dans l'ADR.

---

## Lot G — Finitions et dette de V1

*Tout ce qui a été reporté « à plus tard » pendant la V1. Une session, deux au plus.*

### V2-G1 — Reports assumés de la V1 · `M`

- [x] **Montée de niveau accompagnée.** Le bouton « +XP » devient « Monter de niveau » au seuil, et rejoue la partie utile du parcours de création (`wiki-liens-et-personnages.md` §B8).
- [x] **Application des dégâts à une cible** depuis l'écran de combat — la V1 ne permettait que de les subir manuellement.
- [ ] **Réorganisation par glisser-déposer** des blocs. Le `display_order` en `numeric` est prêt depuis la Phase 0.
- [ ] **Panneaux multiples** : deux fiches côte à côte, via `?avec=[slug]`. Le composant `<Panel>` a été isolé pour ça.
- [ ] **Export et import de monde** en JSON. L'export omet le contenu `personal_reference` (`ruleset-personnel.md` §3.2).

**Périmètre étendu sur demande explicite** : l'assistant de création de personnage (§B8) devient un outil partagé par trois points d'entrée, dans cet ordre — 1) outil complet dans l'écran MJ (`/mj/creation-personnage`), 2) bloc distinct sur une entité (édition actuelle de `PlayableCharacterSheet` conservée telle quelle), 3) onglet de montée de niveau sur la fiche jouable, activé au franchissement d'un seuil de PX. Le point 1 est fait et enrichi sur deux passes de retour utilisateur :

- Huit étapes au lieu de sept : espèce (boutons, lignées gérées comme les sous-classes), classe (boutons, niveau et multiclassage complets, sous-classe gatée par niveau), caractéristiques (tableau standard/achat de points/tirage, stats dérivées en direct), historique (boutons, vrai choix d'équipement contre or), équipement, compétences (liste + acquis fixes), **sorts** (budget par classe incantatrice, lu dans `class_progression`), aperçu.
- L'aperçu réutilise les vrais composants de la fiche jouable (en-tête + onglets Actions/Magie/Inventaire/Traits), pas une mini-fiche à part.
- **Bug racine corrigé (deuxième passe)** : `listRuleEntryBlocksByKeys` (l'endpoint batché de l'assistant) ne résolvait jamais les références internes d'un bloc (don d'un historique, traits d'une espèce, options d'une sous-classe) — `blockContentRenderer.tsx` affichait alors "undefined" ou du texte anglais non traduit. Corrigé par une deuxième passe de résolution batchée dans `listRuleEntryBlocksByKeys` (`src/server/services/rules.ts`), miroir de ce que fait déjà `getRuleEntryForWorld` mais sans le N+1.
- Bug de données trouvé au passage : les sous-espèces du SRD 2014 (`Subraces`, ex. Nain des collines) ne portent jamais `parentSpeciesKey` — `speciesParentKey()` ne lisait que la forme 2024 (`source_raw.species`), jamais 2014 (`source_raw.race`). Corrigé dans `src/server/services/rules.ts`.
- Espèce et classe : la fiche de l'élément choisi (espèce/classe) s'affiche désormais **avant** les boutons de lignée/sous-classe, qui ajoutent leur propre fiche en dessous plutôt que de remplacer la première — les deux restent visibles en même temps.
- Caractéristiques : CA (bouclier)/Initiative/Perception passive réutilisent maintenant `StatBadge`/le même bouclier que `CharacterSheetHeader` (jamais une deuxième présentation) ; les jets de sauvegarde sont montés dans l'encadré de chaque caractéristique, sous le modificateur.
- Historique : titre "Don : <nom>" plutôt qu'une paire étiquette/valeur séparée (`Background()`, `blockContentRenderer.tsx`) ; le double affichage de l'équipement (fiche détaillée + résumé texte) est réduit à la fiche détaillée + de simples boutons "Choisir A/B".
- Traductions manquantes ajoutées : `WEAPON_ARMOR_PROFICIENCY_LABELS_FR` (`src/i18n/fr.ts`) pour les maîtrises d'arme/armure par catégorie (ex. "Daggers"), qui n'ont pas de fiche de règle propre (`Proficiencies` est exclue de l'import) ; les langues déjà acquises passent maintenant par `LANGUAGE_LABELS_FR` dans `RemainingChoicesStep.tsx`.
- Sorts : présentation en encadrés dépliables (`SpellCard`, même langage visuel que `ItemCard` de l'onglet Inventaire) plutôt qu'en pastilles — sélection et dépliage de la description sont deux interactions séparées.
- Reste signalé, non corrigé : les résumés de chip (`ai_digest`) sont en anglais et en pieds — généré par `scripts/ingest-srd.ts`, hors périmètre de ce ticket. Idem pour le `\n` isolé au milieu d'une phrase dans au moins une traduction française existante (don "Initié à la magie") — probablement pas un cas isolé, pas encore quantifié.

**Troisième passe de retour utilisateur** :

- **Bug de performance racine corrigé** : `assembleResolvedRuleset` (endpoint `resolved-ruleset`, appelé à chaque changement d'espèce/historique/classe/équipement/sort) refaisait sa propre remontée de chaîne de rulesets pour CHAQUE entrée (espèce, historique, chaque classe), jamais partagée — mesuré à ~1.3s pour un seul personnage simple. Ajout de `fetchEntriesBatch` (même lot que `listRuleEntryBlocksByKeys`) : un seul parcours de chaîne pour tout le lot. Les 4 fonctions `resolveEquipment*` (armure/arme/poids/coût) refaisaient aussi chacune `fetchEquipmentBlocks` sur les mêmes clés — fusionnées en `resolveEquipmentData`, une seule résolution par objet, en parallèle. Résultat mesuré : ~600ms (encore perceptible, mais divisé par plus de deux) — le reste vient du nombre de allers-retours réseau vers Supabase local, pas d'un travail redondant restant.
- Sorts : regroupés par niveau (Sorts mineurs, puis Niveau 1, Niveau 2...) plutôt qu'un seul bloc plat ; bug réel corrigé au passage — un lanceur "préparant" (Magicien, Clerc, Druide...) n'a jamais de nombre de sorts tabulé par niveau dans le SRD (ça dépend du modificateur de caractéristique), `computeBudget` ne proposait donc jamais de sorts de niveau 1+ pour ces classes, seulement les sorts mineurs. Repli sur la formule officielle (modificateur + niveau, minimum 1). `SpellCard` reprend maintenant le chrome exact de `ItemCard` (bandeau de pliage + bande verticale de sélection).
- **Équipement de départ des classes (point 9 comblé)** : nouveau bloc de règle `class_equipment` (`fixed` + `choices[]`, réutilise les types `BackgroundEquipmentItem/Option` — un choix de classe n'est qu'un choix d'historique avec plusieurs choix indépendants). Ingestion étendue (`scripts/ingest-srd.ts`), ré-exécutée contre la base locale (idempotente, additive — voir `app.import_srd_entries`). Piège réel rencontré : la ré-ingestion retire les fiches qui ne viennent pas du SRD JSON, dont `encounter-budget` (écrite à part par `scripts/write-encounter-budget-2024.ts`) — **toujours relancer ce script après une ré-ingestion**. Seule la première classe du personnage accorde de l'équipement (comme en jeu — le multiclassage n'en redonne jamais) ; objets fixes appliqués automatiquement, chaque choix indépendant via des boutons "Choisir A/B" dans `LevelClassesStep.tsx`.
- Signalé, pas résolu : un clic très rapproché entre deux boutons de choix (beaucoup plus rapide qu'un humain) a fait planter le rendu une fois pendant les tests et revenir au tableau de bord — non reproduit avec un rythme de clic normal malgré plusieurs essais ; à surveiller si ça revient en usage réel.

**Quatrième passe de retour utilisateur** :

- **Deuxième bug de performance racine corrigé** : `/api/worlds/[worldSlug]/rule-entries` (la liste complète des règles d'un monde, chargée par chaque étape du wizard via `useWorldRuleEntries`) prenait ~4.2s sous le SRD 2024 (1905 entrées) — `listRulesetEntries`/`listRulesetEntriesByKeys`/`listTranslationsForEntries`/`listEntryTranslationsWithBlocks`/`listBlocksForRulesetEntries` (`src/server/repos/rules.ts`) paginaient/lotaient toutes en boucle SEQUENTIELLE (un lot attend le precedent), jusqu'à dix allers-retours d'affilée pour les traductions seules. Toutes batchées en parallèle via un nouveau `fetchBatched` partagé. Résultat mesuré : ~1.4-1.8s (environ 2.5x plus rapide) — le reste est du temps de transfert reseau reel (1905 lignes), pas du travail redondant.
- Langues manquantes sous le SRD 2024 (point 3) : corrigé. Le SRD 5.2.1 ne rattache plus aucune langue à l'espèce ni à l'historique (contrairement à 2014) — la règle générale du personnage s'applique alors ("Choisissez vos langues", data/srd/fr-source/srd-5.2.1-fr.txt : "Le commun, plus deux langues déterminées au hasard ou choisies"), codée en repli explicite dans `assembleResolvedRuleset` quand aucune langue n'a été trouvée ailleurs. Le Commun est acquis d'office, jamais proposé une deuxième fois dans le choix des 2 langues libres.
- Historiques manquants sous le SRD 2024 (point 2) : non reproduit sous le ruleset **officiel** `SRD 5.2.1 (2024)` — les 4 historiques du SRD (Acolyte, Criminel, Sage, Soldat, la totalité de ce que la licence libre republie) y sont bien présents et traduits. Le monde de test avait pour ruleset actif une variante ("Guide du MJ maison", parentée sur le SRD 2014 — qui ne republie qu'Acolyte), pas l'officiel 2024 : la variante n'hérite jamais des historiques 2024. Ces rulesets variantes/personal_reference préexistent (fonctionnalité V1-D4/V1-D5, pas créée pendant cette passe).
- Espèces en double à l'écran + retour inopiné au tableau de bord (point 1) : les données elles-mêmes ne portent aucun doublon (vérifié par requête directe, plusieurs fois) — un onglet de navigateur neuf ne reproduit ni les espèces en double ni aucune erreur console, alors qu'un onglet réutilisé depuis le début de la session (des dizaines de rechargements à chaud pendant l'édition) en accumule. Piste retenue : artefact du rechargement à chaud (HMR) du serveur de développement pendant une édition de code active, pas un bug du code livré — non reproduit sur un chargement propre malgré plusieurs tentatives. Reste à surveiller si ça se produit en dehors d'une session d'édition active.

Points 2 et 3 restent à faire ; le pré-remplissage par IA (§B8 « en surcouche ») est délibérément reporté au lot J.

**Cinquième passe de retour utilisateur** :

- Boutons d'historique enrichis (don lié, valeurs de caractéristique, maîtrise d'outil, maîtrises de compétence), même motif que les boutons d'espèce (`BackgroundStep.tsx`).
- Étape « Sorts » masquée (jamais un onglet adaptatif) pour toute classe sans progression d'incantation dans le ruleset actif — `CharacterCreatorWizard.tsx`, présence du bloc `spellcasting_progression`.
- **Maîtrise d'armes** (SRD 2024 — Barbare, Guerrier, Paladin, Rôdeur, Roublard) : choix en étape 6, résolu côté serveur (`assembleResolvedRuleset`) au même titre que compétences/langues. Les armes éligibles se lisent dans les vraies maîtrises d'armes de la classe (jamais une liste recopiée à la main). **Plus aucune règle codée en dur côté serveur** (retour utilisateur explicite, deux passes) : le nombre par classe (colonne `class_specific_weapon_mastery`) et la restriction « corps à corps seulement » du Barbare (`class_specific_weapon_mastery_melee_only` — un fait sur sa capacité, jamais sur l'arme elle-même, que `is_ranged` par arme ne suffit pas à exprimer) sont tous deux lus dans `class_progression`, cinq classes par le même chemin. Les deux valeurs sont injectées à l'import (`scripts/ingest-srd.ts`, `classProgressionBlock`), strictement gardées à `sourceAttribution === "SRD 5.2.1"` — la maîtrise d'armes n'existe pas sous 2014, même `classIndex`. Un booléen dans une table de progression s'affiche désormais « Oui »/« Non » (`cellValue`, `blockContentRenderer.tsx`), jamais « true »/« false ». Onglet dédié sur la fiche jouable, remis à zéro à chaque repos long (`characterActions.ts`, `takeLongRest`), avec un badge « Botte disponible » sur une arme équipée actuellement maîtrisée — l'effet de la botte reste à résoudre à la main (hors périmètre : modéliser les huit propriétés de maîtrise comme de vraies mécaniques de combat est un chantier à part).
- Régression de performance détectée et corrigée en cours de route : le catalogue d'armes se chargeait même pour une classe qui n'accorde pas la maîtrise dans le ruleset actif (ex. Guerrier sous 2014) — repéré par un test d'intégration qui a commencé à expirer.

**Montée de niveau accompagnée (point 1 du ticket)** : nouvel assistant séparé `LevelUpWizard.tsx`, pas un troisième mode de `CharacterCreatorWizard` — la sauvegarde chirurgicale (aucun renommage, aucun contact avec l'inventaire) l'exigeait de toute façon. Réutilise sans modification `LevelClassesStep`/`RemainingChoicesStep`/`SpellSelectionStep` (déjà écrits en « budget total moins déjà choisi », donc naturellement delta-aware au changement de niveau). Amélioration de caractéristique (ASI) incluse dans le périmètre, sur décision explicite : `src/core/rules/abilityScoreImprovement.ts` (choix +2/une ou +1/deux, plafond 20) monte comme modificateur couche 5, exactement le mécanisme déjà en place pour les bonus d'espèce (couche 2) — `sheet.ts` n'a nécessité aucun changement. Les niveaux qui accordent une ASI ne sont jamais codés en dur : lus dans `progressionRows` (`extractAsiGrantedLevels`, `srdMapping.ts`), exposés par `assembleResolvedRuleset` (`asiGrantedLevels`). Sauvegarde via une nouvelle action serveur `applyLevelUp` (`characterActions.ts` + `app/api/entities/[id]/actions/level-up/`), qui recalcule la fiche CANDIDATE côté serveur pour vérifier le plafond de 20 et la légitimité de chaque choix d'ASI, jamais la fiche envoyée par le client. Trou de données documenté et accepté : sous le SRD 2014, la fusion de textes identiques à l'import confond les ASI supplémentaires du Guerrier et du Roublard (propres à leur classe) avec des clés sans marqueur — fonctionne correctement sous le SRD 2024 (ruleset actif de Valdoria).

Deux bugs réels trouvés en testant la soumission dans le navigateur, tous deux corrigés :

- **Comparaison espèce/historique invalide** : `applyLevelUp` comparait `species`/`background` (avant/après) par `JSON.stringify`, qui casse après un aller-retour par une colonne `jsonb` — Postgres ne garantit pas l'ordre des clés d'un objet. Toute montée de niveau était rejetée à tort (« ne peut pas changer l'espèce... ») dès que l'ordre des clés différait par hasard. Remplacé par une comparaison structurelle (`sameBlockReference`).
- **ASI invisible aux calculs serveur** : `resolveCharacterActionContext` — utilisé par les jets d'attaque, de dégâts, de sort, et par la route `/sheet` — ne construisait jamais les features synthétiques d'ASI, contrairement à `applyLevelUp`. Un bonus d'ASI déjà appliqué et enregistré ne comptait donc dans AUCUN jet de dé réel, en contradiction directe avec la règle 6 de `CLAUDE.md` (« l'IA narre, le code arbitre »). Extrait en fonction partagée `buildAsiChoiceFeatures`, appelée maintenant aux deux endroits.

**Retour utilisateur après livraison** : deux points corrigés/ajoutés.

- **Bug d'affichage** : l'assistant s'ouvrait sur un écran « niveau 12 → 12 » (le niveau n'était pas pré-incrémenté), obligeant à corriger le chiffre soi-même avant de pouvoir continuer. `LevelUpWizard` applique maintenant +1 sur la première classe dès l'ouverture — l'étape Classe reste l'endroit pour rediriger ce niveau vers une autre classe (multiclassage) si besoin.
- **Jet de dé de vie réel (absent jusqu'ici)** : `computeHitPoints` (`sheet.ts`) prenait systématiquement la moyenne pour tout niveau après le premier — décision documentée dès la V1 (`BACKLOG_V1.md` V1-B1), mais le champ `hp_method` (« Valeur fixe »/« Jetés ») affiché sur la fiche n'a jamais été branché à quoi que ce soit. Corrigé en ajoutant une vraie mémoire de jet : `ClassLevel.hpRolls`/`character.classes[].hp_rolls`, un historique de PV gagnés niveau par niveau, jamais recalculé (un jet est un fait, pas une valeur dérivable) — absent ou plus court que prévu = personnage antérieur à cette fonctionnalité, `computeHitPoints` comble alors avec la moyenne, aucun changement pour l'existant. Nouvelle étape « Points de vie » dans `LevelUpWizard` (composant `HpRollStep.tsx`) : un choix moyenne/jet par niveau nouvellement gagné, par classe — jamais un choix global. Le client ne transmet qu'une INTENTION (`hpChoices`, moyenne ou jet) ; `applyLevelUp` exécute le jet lui-même via `serverRng` (régle 6) et rejette (`invalid_hp_choice`) tout choix manquant ou dont le compte ne correspond pas exactement aux niveaux gagnés. L'aperçu affiche une estimation (« ≈ ») tant qu'un jet est en attente, la vraie valeur n'existant qu'après confirmation.

**Application des dégâts à une cible (point 2 du ticket)** : `InitiativeTracker.tsx` gagne un contrôle unique « Appliquer des dégâts » (montant tapé + participant choisi dans une liste), plutôt qu'un jet automatisé par arme — les participants `custom` (piège) et `statblock` (monstre) n'ont pas forcément d'arme ni de fiche de personnage à interroger, ce contrôle fonctionne identiquement pour les trois `source_kind`. Les PV temporaires absorbent en premier (règle 5e), le reste retombe sur les PV réels sans jamais descendre sous 0 ; réutilise `patchCombatParticipant` (déjà en place pour le stepper PV manuel), donc le bouton « Annuler » de l'écran existant défait aussi cette action sans code supplémentaire. Corrigé au passage : le stepper PV de chaque ligne avait été oublié lors du remplacement des anciens ronds +/- par la case à bandes pleine largeur (retour utilisateur antérieur) — même composant partagé `Stepper.tsx` que partout ailleurs désormais.

### V2-G4 — Thème dérivé de l'image · `M` · *issu de la revue de code*

Le socle est là — `tokens.css` en OKLCH, `data-mode` sur `<html>`, les quatre modes. **Il manque toute la chaîne d'extraction.**

- [ ] Téléversement d'une image de fond par monde.
- [ ] Extraction de palette **côté serveur, au téléversement** — jamais dans le navigateur au chargement.
- [ ] Vignette 32×32 floutée en base64, stockée dans `worlds.theme` ; l'image pleine résolution n'est jamais chargée en fond.
- [ ] Contrôle de contraste sur les quatre modes ; un mode qui échoue n'est pas proposé, et on le dit.
- [ ] Variables injectées dans le HTML rendu côté serveur — aucun scintillement au premier rendu.

Spécification : `coquille-et-design.md` §2b.

### V2-G5 — Découper `PlayableCharacterSheet.tsx` · `M` · *issu de la revue de code*

1255 lignes pour six fonctions de premier niveau. C'est la principale dette du dépôt, et **V2-G1 va y toucher** (montée de niveau, application des dégâts).

- [x] Un composant par onglet : `ActionsTab`, `MagicTab`, `InventoryTab`, `TraitsTab`.
- [x] L'en-tête (identité, PV, XP, repos) extrait à part.
- [x] Aucun changement de comportement : découpage pur, vérifié par les tests existants.

**À faire avant G1, pas pendant.** Découper et modifier dans le même commit rend la relecture impossible.

Fait. `PlayableCharacterSheet.tsx` reste l'orchestrateur (état, appels serveur) ; les quatre onglets et l'en-tête sont des composants purs recevant des props déjà prêtes à afficher. Aucun test automatisé ne couvrait ce composant avant (aucun fichier `*.test.tsx` ne le référence) — vérification manuelle en navigateur sur les trois onglets (actions, inventaire, traits), `typecheck`/`lint`/`test` verts (seul échec : le flake connu de l'intégration LM Studio, pré-existant, sans rapport).

### V2-G6 — `characterSheet()` côté client · `S` · *issu de la revue de code*

`characterSheet()` n'est appelée que côté serveur. La fonction étant pure et sans dépendance, elle peut tourner dans le navigateur — c'était l'intérêt de la contrainte `src/core`.

- [ ] Décocher « équipé » recalcule la CA **sans aller-retour serveur**.
- [ ] Le serveur reste l'autorité pour tout ce qui engage la partie ; le client ne recalcule que l'affichage.
- [ ] Même fonction des deux côtés — aucune divergence possible.

À faire seulement si la latence actuelle gêne réellement. Mesurez avant.

### V2-G2 — Wiki public en présentation « livre » · `M`

Seconde peau de la coquille, pas une refonte. Mêmes composants, jetons différents.

- [ ] Colonne de gauche en sommaire hiérarchique plutôt qu'en arborescence d'édition.
- [ ] Corps de texte à largeur mesurée, **65 à 75 caractères par ligne**.
- [ ] Aucune commande d'édition visible.
- [ ] Le thème dérivé de l'image s'applique aussi à cette peau.

À faire quand le wiki public a du contenu à montrer. Habiller trois fiches de test n'apprend rien.

### V2-G3 — Bloc musique · `S`

- [ ] Bloc `music` : un lien Spotify, SoundCloud ou YouTube, avec lecteur.
- [ ] **Le lecteur ne se charge qu'au clic.** Une intégration tierce chargée automatiquement dépose des traceurs sur toute fiche qui en contient une.
- [ ] URL validée contre une liste de domaines autorisés — sinon c'est un vecteur d'injection.

---

## Lot H — Le monde vivant

*Ce qui donne de la mémoire et de la profondeur au monde. Le lot le plus utile pour la V3.*

### V2-H1 — Psyché des PNJ · `L`

Spécification complète : `specs/psyche-pnj.md`.

- Blocs `personality`, `worldview`, `relationship` (un par relation).
- Table `entity_attitudes` (valeurs courantes, portée campagne) et `attitude_events` (ajout seul).
- `applyDelta` dans `src/core/psyche/` — fonction pure.

**Critères**
- [ ] Valeurs stockées de −100 à +100 ; l'écran et le contexte IA affichent la **bande nommée**, jamais le nombre.
- [ ] Rendements décroissants : s'éloigner du centre s'amortit, y revenir garde son plein effet.
- [ ] `deltas` stocke le **brut** ; rejouer le journal reproduit exactement la valeur courante.
- [ ] Après 50 événements simulés d'ampleur « notable », aucun axe n'est saturé.
- [ ] Un delta brut supérieur à 40 exige confirmation.
- [ ] `known_as` respecté : le contexte IA ne révèle pas une identité que le PNJ ignore.
- [ ] Comparaison automatique entre les convictions d'un PNJ et celles de sa faction, avec signalement des divergences fortes.

### V2-H2 — Chronologie et calendrier · `L`

`wiki-blocs.md` §3.

- Calendrier par monde, en JSON dans `worlds.calendar`.
- Bloc `timeline` : entrées en ligne **et** entités de type `event`.
- `sort_key` entier calculé, stocké à côté de chaque date.

**Critères**
- [ ] Le tri et le filtrage fonctionnent avec un calendrier à treize mois de vingt-huit jours.
- [ ] `precision` gère l'imprécision : « vers 1200 » est une date valide.
- [ ] `end` permet les périodes ; une guerre dure.
- [ ] `label` prime à l'affichage : « le Troisième Hiver Noir » plutôt qu'une date.
- [ ] Une entrée en ligne se promeut en entité d'un clic, sans rien perdre.

### V2-H3 — Généalogie et relations · `M`

- Bloc `relationships` (liste simple) **avant** `genealogy` (arbre visuel).
- `genealogy` ne stocke que la configuration d'affichage ; les liens vivent dans `relations`.

**Critères**
- [ ] Ajouter un parent se fait en créant une relation ; tous les arbres qui incluent la personne se mettent à jour.
- [ ] **Le graphe est construit côté serveur, après filtrage.** Une parenté en visibilité `gm` n'est pas dans la réponse HTTP.
- [ ] Un nœud dont la relation est cachée **disparaît**, il ne s'affiche pas grisé.
- [ ] Cycles sur `part_of` et sur `parent_of` refusés par déclencheur.

> Construisez `relationships` d'abord et servez-vous-en une semaine. Vous découvrirez peut-être que l'arbre visuel n'est pas nécessaire.

### V2-H4 — Quêtes et journal de séance · `M`

- Bloc `quest` : objectifs, état, récompenses, commanditaire, prérequis.
- Bloc `session_log` relié aux `session_events`.

**Critères**
- [ ] États : non commencée, en cours, réussie, échouée, abandonnée.
- [ ] Un objectif référence des entités ; les cocher est journalisé.
- [ ] Les quêtes actives entrent dans le contexte déterministe de la V3.

---

## Lot I — Les cartes

*Le plus gros morceau visuel de la V2, et le moins spécifié jusqu'ici.*

### Décisions de conception, à prendre avant d'écrire

**Image d'abord, procédural jamais — ou beaucoup plus tard.** Le PDD évoque la génération procédurale (simplex-noise, Voronoï). C'est un projet en soi, et une carte téléversée couvre 95 % du besoin réel : la plupart des MJ ont déjà leur carte. Le procédural reste une idée future, pas un ticket.

**Coordonnées normalisées, jamais des pixels.** Une punaise se stocke en 0–1 relatif à l'image. Des pixels casseraient à chaque redimensionnement, zoom ou remplacement d'image.

**Une punaise est une référence**, réutilisant la primitive `Reference` : elle pointe vers une entité, et hérite de sa visibilité.

**Cartes imbriquées via `part_of`.** Une punaise « Porte de Baldur » sur la carte du continent ouvre la carte de la ville. Aucun nouveau concept : c'est la hiérarchie des lieux, rendue visuellement.

**Le brouillard est une découverte, pas un calque de dessin.** Des régions nommées, révélées ou non par campagne — même modèle que `entity_discoveries`. Un brouillard dessiné à la main serait un second système à maintenir.

### V2-I1 — Carte et punaises · `L`

```sql
create table map_regions (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references entities(id) on delete cascade,  -- le lieu portant la carte
  name       text not null,
  shape      jsonb not null,   -- polygone en coordonnées normalisées
  created_at timestamptz not null default now()
);

create table map_region_reveals (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  region_id   uuid not null references map_regions(id) on delete cascade,
  revealed_at timestamptz not null default now(),
  primary key (campaign_id, region_id)
);
```

- Bloc `map` sur une entité `location` : un asset image, une liste de punaises.
- Zoom et déplacement, sans dépendance lourde.

**Critères**
- [ ] Les punaises sont en coordonnées normalisées ; remplacer l'image par une version plus grande ne les décale pas.
- [ ] Une punaise vers une entité `gm` est absente de la réponse pour un joueur.
- [ ] Une punaise vers un lieu portant lui-même une carte ouvre cette carte.
- [ ] Une carte de 4000 px s'affiche sans bloquer l'interface — vignette d'abord, pleine résolution ensuite.

### V2-I2 — Brouillard par campagne · `M`

- [ ] Le MJ trace des régions ; il les révèle en cours de partie.
- [ ] Une région non révélée est **absente de la réponse serveur**, pas masquée en CSS.
- [ ] Révéler écrit un `session_event`.

---

## Lot J — Génération assistée et confort

*Nécessite le lot F de la V1. Le contenu de ce lot dépend du verdict de S1.*

### V2-J1 — Les emplacements en prose des générateurs · `M`

Le lot E de la V1 a écrit les générateurs avec leurs emplacements de prose **laissés vides**. Ce ticket les remplit.

- [ ] Description de taverne, d'échoppe, de PNJ — les longueurs demandées dans vos notes.
- [ ] La prose est **cohérente avec les valeurs déjà tirées**, jamais contradictoire.
- [ ] Sans fournisseur d'IA actif, le générateur fonctionne toujours : les emplacements de prose restent vides, le reste est complet.
- [ ] Les noms à jeu de mots viennent de **tables écrites à la main**, jamais d'une génération libre.

### V2-J2 — Création d'une fiche par générateur · `M`

- [ ] Le bouton « nouvelle entité » propose : fiche vierge, modèle, ou générateur.
- [ ] Le résultat crée une entité avec ses blocs pré-remplis, secrets en visibilité `gm`, références déjà liées.
- [ ] **Un seul mécanisme de promotion**, partagé avec la chronologie, l'inventaire et les tables (V1-E6).

### V2-J3 — Assistant de préparation de séance · `M`

- [ ] Une entité de type `session_prep` avec des blocs. **Pas un second système de documents.**
- [ ] Boutons d'insertion de générateur dans l'éditeur.
- [ ] Feuille de style d'impression.

### V2-J4 — Import de règles au format JSON · `M`

`arbitrage-modifications.md` §1.2.

- [ ] Import à notre format documenté, miroir exact de l'export.
- [ ] Assistant de correspondance pour un format tiers — l'utilisateur associe les champs, on n'écrit pas trente convertisseurs.
- [ ] Un ruleset importé est marqué `personal_reference` par défaut, avec ses verrous.
- [ ] **Aucune analyse automatique de PDF.** Position inchangée.

---

## Lot K — Refonte de la coquille : sidebar unifiée et fenêtres

*Née d'une demande explicite de restructuration de l'interface (2026-08-25). Indépendant de H/I/J — peut se glisser n'importe quand, mais mieux vaut finir le lot avant d'en ouvrir un autre : rouvrir la coquille deux fois coûte plus cher que de la faire d'un bloc.*

### Décisions de conception, à prendre avant d'écrire

**Adressage mixte d'une fenêtre.** `?avec=` ne portait jusqu'ici que des slugs d'entité. Afficher une fiche de règle et une fiche de monde dans le même espace de travail oblige à distinguer les deux types sans ambiguïté — préfixer (`?avec=entite:pont-de-pierre,regle:boule-de-feu`) plutôt que deviner le type en cherchant le slug dans les deux tables (plus lent, et ambigu si le même slug existe des deux côtés).

**Taille fixe des fenêtres : la valeur se choisit en la voyant, pas a priori.** Tester contre les blocs les plus denses (fiche de personnage jouable, inventaire, tableau de compétences) avant de figer un nombre dans le code.

### V2-K1 — Fenêtres partagées entre Monde et Règles · `L` — fait

Aujourd'hui `DesktopWindows`/`WindowFrame` (`components/shell/DesktopWindows.tsx`, `components/shell/WindowFrame.tsx`) ne vivent que sous la route `(monde)` : une fiche de règle (`/m/[worldSlug]/regles/[cle]`) s'affiche toujours en page pleine, jamais en fenêtre. C'est le verrou qui empêche d'afficher monde et règles en même temps — pas un manque de fonctionnalité de fenêtre, qui existe déjà (ADR-0006).

- [x] Remonter le gestionnaire de fenêtres au niveau de `app/m/[worldSlug]/layout.tsx`, partagé par Monde/Règles/MJ.
- [x] `?avec=` accepte des références mixtes (entité et entrée de règle — voir décision ci-dessus), chacune résolue par sa route API existante.
- [x] Ouvrir une fiche de règle depuis la vue Règles l'ajoute comme fenêtre, sans quitter la vue courante.
- [x] Changer de vue (Monde/Règles/MJ) ne ferme plus les fenêtres ouvertes.

**Préalable à K2 et K4** — ils supposent que les fenêtres survivent au changement de vue.

Fait — décision d'architecture (état partagé + rendu dupliqué par section, MJ non concerné) dans `docs/adr/0011-fenetres-partagees-monde-regles.md`. `DesktopWindows.tsx` scindé en `DesktopWindowsProvider.tsx` (état, monté une fois) et `WindowsDesktop.tsx` (rendu, monté par Monde et par Règles). Adressage mixte dans `components/shell/windowRefs.ts`. `RegisterPrimaryWindow`, `useOpenEntityLink`/`useOpenRuleLink` généralisés sur un `WindowRef`. Une fiche de règle partage désormais `RuleEntryView` entre son rendu serveur (fenêtre primaire) et sa récupération client (`/api/worlds/[worldSlug]/regles/[cle]/window`, fenêtre secondaire), même motif que `EditEntityForm`. `RulesSidebar` récupère désormais sa liste côté client (`useWorldRuleEntries`, déjà utilisé ailleurs) plutôt que par props serveur, pour ne pas payer ce coût sur les pages Monde. Piège trouvé et corrigé : la clé d'effet déclenchant la récupération d'une fenêtre secondaire dépendait à tort de primaire+avec combinés — une référence passant de primaire à secondaire pouvait laisser cette clé combinée inchangée et l'effet ne se redéclenchait pas ; corrigé en la faisant dépendre de `avec` seul. Vérifié en navigateur : ouverture d'une fiche de règle et d'une fiche d'entité simultanément, aller-retour Monde → Règles → MJ → Monde sans perte de fenêtre, fermeture d'une fenêtre individuelle. `typecheck`/`lint` verts ; `test` vert sur les tests unitaires (595/606, le reste exige une base Supabase locale indisponible dans cet environnement, sans rapport avec ce ticket).

### V2-K2 — Sidebar unifiée comme sélecteur de vue · `M` — fait

*Dépend de K1.*

- [x] Le bandeau `Monde / Règles / MJ` (`components/shell/SectionToggle.tsx`) quitte la barre supérieure, remonte dans la sidebar, au-dessus du champ de recherche.
- [x] Choisir une vue change le contenu de l'arborescence (`EntityTree`, liste de `RulesSidebar`, navigation de `MjSidebar`) **sans perdre l'espace de travail** — les fenêtres ouvertes survivent (garanti par K1).
- [x] L'URL continue de refléter la vue active (lien partageable, bouton retour), sans démonter le gestionnaire de fenêtres.
- [x] Les boutons propres à chaque vue (bas de sidebar) restent inchangés, sauf ce que déplacent K6 et K7.

Fait — décision prise avec l'utilisateur avant d'écrire : Monde/Règles/MJ restent de vraies routes Next.js (pas un état client décroché de l'URL), option la moins invasive puisque K1 garantit déjà la survie des fenêtres à travers une navigation. `SectionToggle` quitte `AppShell.tsx` (l'en-tête redevient juste nom du monde + horloge + « Mes mondes ») et se monte désormais en haut de chacune des trois barres latérales (`Sidebar.tsx`, `RulesSidebar.tsx`, `MjSidebar.tsx`), au-dessus de leur champ de recherche respectif (MJ n'en a pas, le bandeau y est simplement en tête de liste). Le composant passe d'une pastille centrée (pensée pour une barre de 56px) à trois segments `flex-1` pleine largeur, pensés pour une colonne de 280px. Aucun changement de comportement de navigation au-delà de ça — le fond du travail (état partagé, repli de la primaire dans `avec`) était déjà celui de K1. Vérifié en navigateur sur les trois sections ; `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K3 — Taille fixe des fenêtres · `S` — fait

- [x] Poignées de redimensionnement retirées de `WindowFrame.tsx`.
- [x] Une seule taille à l'ouverture, quel que soit le contenu (voir décision ci-dessus).
- [x] Déplacement (drag) et agrandissement/restauration (maximiser) inchangés.

Fait — taille choisie en la voyant (comme décidé) : 860×760, testée contre la fiche de personnage jouable (grille de caractéristiques, compétences, cartes de sorts) et la table de progression de classe la plus large du dépôt (Magicien), aucune des deux ne déborde ni ne semble à l'étroit. 860px reprend d'ailleurs la largeur déjà validée de `Panel.tsx` pour le même contenu. Poignée de redimensionnement (coin bas-droit) et sa logique retirées de `WindowFrame.tsx` ; l'aimantation sur les bords (glisser près d'un bord tuile la fenêtre à moitié écran) reste inchangée, ce n'est pas une poignée de redimensionnement et le ticket ne demandait pas de la retirer. Déplacement et agrandir/restaurer vérifiés en navigateur. `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K4 — Réduction de fenêtre en onglet de bas d'écran · `M` — fait

*Dépend de K1.*

- [x] Un bouton « réduire » sur chaque fenêtre, à côté de fermer/agrandir.
- [x] Fenêtre réduite → un onglet compact en bas de l'espace de travail (nom de la fiche) ; la fenêtre elle-même se masque.
- [x] Cliquer l'onglet restaure la fenêtre à sa position précédente.
- [x] L'état réduit est un état d'affichage local, **jamais dans `?avec=`** ni dans l'URL — même logique que l'ordre d'empilement, déjà non persisté (`docs/adr/0006-fenetres-flottantes.md`).

Fait — `minimizedIds` (nouvel état local dans `DesktopWindowsProvider.tsx`, jamais lu ni écrit depuis `?avec=`) et une barre d'onglets (`WindowsDesktop.tsx`) listant toute fenêtre réduite, primaire comme secondaire. Piège réel : réduire la fenêtre PRIMAIRE ne doit jamais retirer `children` de l'arbre React — c'est elle qui porte `RegisterPrimaryWindow`, la démonter aurait désenregistré la primaire et fait disparaître son propre onglet réduit. Corrigé en la gardant montée mais masquée (`className="hidden"`) plutôt qu'omise du rendu. `windowContentLabel` (nouveau, `windowRefs.ts`) factorise le calcul nom/badge d'une fenêtre secondaire, déjà dupliqué avant ce ticket. Vérifié : réduire/restaurer la primaire et une secondaire (bouton et via le DOM), position restaurée à l'identique, `?avec=`/URL inchangés pendant toute l'opération (confirmé par `window.location.href`), le bouton "Restaurer" est bien présent et accessible (arbre d'accessibilité) même quand la capture d'écran de cet environnement ne le compose pas visiblement (flou d'arrière-plan). `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K5 — Réglages à onglets · `S` — fait

`components/shell/SettingsMenu.tsx` est aujourd'hui une seule modale à sections empilées (Langue, Thème, Compte, liens de partage, Collaboration, Suppression). Premier composant d'onglets du dépôt — un `<Tabs>` générique, pas un cas particulier à cet écran.

- [x] `<Tabs>` générique (`components/shared/`, même famille que `Dropdown`).
- [x] Sections existantes réparties en onglets (Général + les deux onglets neufs ci-dessous).
- [x] Aucun changement de comportement sur les sections déplacées — pur découpage, comme V2-G5.

Fait — `<Tabs>` (`components/shared/Tabs.tsx`) est un primitif controlé (`value`/`items`/`onChange`), reprenant le style déjà établi par `SectionToggle.tsx` (segments égaux dans un conteneur arrondi) plutôt qu'une deuxième présentation d'onglets. Deux onglets aujourd'hui : **Général** (Langue, Thème, Compte, liens de partage, Suppression — tout ce qui existait déjà) et **Collaboration** (le bouton désactivé « Inviter un MJ », déplacé tel quel). Le troisième onglet (Règles) n'est pas créé ici : K6 l'introduira avec son vrai contenu plutôt que de poser un onglet vide en attendant. Nouvelle clé de traduction `settings.general` (fr/en). Aucune section déplacée n'a changé de comportement. Vérifié en navigateur : bascule entre les deux onglets, contenu identique à avant. `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K6 — Ruleset actif déplacé dans les Réglages · `S` — fait

*Dépend de K5.*

- [x] `RulesetSelector` (`components/rules/RulesetSelector.tsx`) quitte le bas de `RulesSidebar` pour un onglet des Réglages généraux.
- [x] Même comportement (choix du ruleset actif, création de variante, suppression) — seul l'emplacement change.
- [x] Cohérent avec K2 : la sidebar Règles redevient une simple liste, sans réglage mélangé dedans.

Fait — `RulesetSelector` n'a pas bougé lui-même (déjà autonome, déjà en portail) : seul son point de montage change, de `RulesSidebar.tsx` vers un nouvel onglet « Règles » de `SettingsMenu.tsx`, visible uniquement dans le contexte d'un monde (`worldSlug` détecté depuis l'URL, même mécanisme que le panneau de partage). Aucune ligne de `RulesetSelector.tsx` modifiée. Vérifié en navigateur : le bouton « Règles actives » et sa boîte de dialogue (choisir/créer une variante/supprimer) fonctionnent à l'identique depuis les Réglages ; la sidebar Règles est redevenue une simple liste + les deux boutons de création. `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

### V2-K7 — Onglet Collaboration dans les Réglages · `S` — fait

*Dépend de K5.*

- [x] Le bouton désactivé « Inviter un MJ (bientôt) » (`SettingsMenu.tsx`) devient un onglet Collaboration fonctionnel.
- [x] Reprend le flux d'invitation par e-mail déjà existant au niveau campagne (`CampaignDetail.tsx`) plutôt que d'en écrire un second.
- [x] Liste les invitations actives, quel que soit le monde ou la campagne concernée.

**Divergence trouvée avant d'écrire, tranchée avec l'utilisateur** : il n'existe aucune invitation « en attente » dans ce dépôt — inviter (`inviteCampaignMember`, `src/server/services/campaigns.ts`) ajoute la personne IMMÉDIATEMENT comme membre si un compte existe déjà pour son e-mail (404 sinon), sans statut ni étape d'acceptation. Construire un vrai système d'invitation en attente aurait exigé une migration de schéma (table nouvelle, RLS, flux d'acceptation) — hors de portée d'un ticket `S`. Décision : reprendre le flux existant tel quel, transversalement.

Fait — nouvelle vue transversale : `listGmCampaignsForUser` (`src/server/repos/campaigns.ts`, jointure `campaign_members → campaigns → worlds`, RLS déjà filtrante) + `listMyGmCampaignsWithMembers` (`src/server/services/campaigns.ts`) + route `GET /api/campaigns/mine`. `SettingsMenu.tsx` : nouveau `CollaborationTab`, un sélecteur parmi les campagnes dont l'utilisateur est MJ (tous mondes confondus) + un formulaire d'invitation (e-mail + rôle MJ/joueur) qui appelle la MÊME route `POST /api/campaigns/[campaignId]/members` que `CampaignDetail.tsx` — aucune deuxième implémentation du flux d'invitation. En dessous, la liste de toutes les campagnes MJ avec leurs membres actuels. Vérifié en navigateur : campagne existante listée avec son membre, invitation vers un e-mail sans compte renvoie bien « Aucun compte n'existe pour cette adresse » (même message que le flux d'origine). `typecheck`/`lint`/`test` verts (605/606, 1 ignoré).

**Lot K terminé** (K1 à K7).

---

## 3. Critère de fin de V2

> Mener une séance complète avec votre table — préparation, PNJ cohérents, carte, combat, notes — sans ouvrir aucun autre outil.

À vérifier en jouant réellement, pas en cochant des cases.

Et un critère technique : **le verdict de S1 est écrit et la V3 est cadrée en conséquence.**

---

## 4. Ce qui reste pour la V3

| Contenu | Note |
|---|---|
| Compagnon joueur | `module-joueur-et-solo.md` partie A — la vraie nouveauté est le modèle de permissions |
| Mode solo ou MJ assisté | forme déterminée par S1 |
| RAG sur le wiki | `SCHEMA.md` §17 — la dimension d'embedding doit être figée avant la première indexation |
| Édition élargie par les joueurs | `canEditEntity` est déjà le point d'extension |
| Passage à l'application locale | `cible-locale-et-ia.md` §6 — la question « local seul ou local d'abord » reste ouverte |
| Génération procédurale de cartes | idée future, jamais un ticket tant que le reste n'est pas solide |

---

## 5. Rappel de méthode

**Un ticket, un commit, une relecture.** Après un an de projet, c'est la discipline la plus facile à relâcher et la plus coûteuse à perdre.

**Ne parallélisez pas H, I et J** — non pour des dépendances techniques, il n'y en a pas, mais parce que trois chantiers ouverts finissent tous à 80 %.

**Et si l'envie manque un jour, prenez le lot qui vous fait plaisir plutôt que le suivant dans la liste.** Le risque R9 — perte de motivation — reste le premier risque de ce projet, devant tous les risques techniques.
