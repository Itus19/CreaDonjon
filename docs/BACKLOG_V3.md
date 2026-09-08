# Backlog — V3

**Version :** 0.1 — 8 septembre 2026
**Documents liés :** `docs/PDD.md` · `docs/SCHEMA.md` · `ROADMAP.md` · `docs/analyse-prompt-origine.md` · `specs/moteur-de-jeu.md` · `specs/module-joueur-et-solo.md` · `docs/adr/0009-viabilite-solo.md`

---

## 0. Comment lire ce document

Un ticket = une session. On en donne **un seul à la fois**, on vérifie les critères, on committe, on passe au suivant. La tentation de grouper trois tickets qui se ressemblent reste la même qu'en V0 ; la raison de ne pas y céder aussi.

**Légende :** `S` ≈ une session courte · `M` ≈ une session · `L` ≈ deux sessions ou plus, à découper en phases si ça dépasse.

**Règle de blocage :** un ticket dont les critères ne passent pas n'est pas terminé. On ne passe pas au suivant « en revenant dessus plus tard ».

---

## 1. D'où vient ce backlog

Il rassemble cinq sources qui vivaient jusqu'ici dans cinq endroits différents. C'est sa raison d'être : **plus rien à retrouver de mémoire.**

| Source | Ce qu'elle apporte | Lot |
|---|---|---|
| `specs/moteur-de-jeu.md` §8 | six tickets déjà nommés et dimensionnés | P |
| `docs/analyse-prompt-origine.md` §11 | le tri du prompt d'origine, trois vagues | O, Q, S |
| Audit du 8 septembre (`ROADMAP.md`) | deux trous que personne n'avait notés | N |
| Reliquats des lots V1 et V2 | critères en suspens, bugs signalés non corrigés | N |
| `docs/BACKLOG_V2.md` §4 | ce qui était étiqueté « reste pour la V3 » | P, R |

Une fois ce document ouvert, `docs/analyse-prompt-origine.md` devient une pièce d'archive : les décisions qu'il porte sont reprises ici sous forme de tickets. Il reste utile pour le **pourquoi** d'une décision, jamais pour savoir quoi faire ensuite.

---

## 2. Point de départ — état vérifié au 8 septembre

La V2 est close en pratique : tous ses lots sont livrés. Ce qui n'a pas été repassé remonte ici (V3-N3), plutôt que de laisser la V2 formellement ouverte pour trois cases.

| Fait, et sur quoi la V3 s'appuie | Où |
|---|---|
| Formules AST, RNG serveur, fiche dérivée à sept couches | `src/core/formula`, `src/core/rules` |
| Psyché : personnalité, convictions, relations, attitudes journalisées | V2-H1 |
| Quêtes, journal de séance, chronologie, cartes, générateurs | lots H, I, J |
| `AiProvider`, `ai_proposals`, `ai_usage_log`, encadrement du contenu comme donnée | V1-F, V2 |
| Spike solo joué, verdict rendu | ADR 0009 |

**Le verdict du spike commande tout le reste :** la V3 se conçoit comme un **MJ assisté** — des propositions courtes qu'un humain accepte, modifie ou ignore — jamais comme une narration autonome continue. C'est le point que le lot R applique.

---

## 3. Principe de séquencement

Les lots N et O sont indépendants de tout le reste et de tout le monde : on peut en prendre un ticket un soir sans rien ouvrir d'autre. Ils sont volontairement placés en premier pour cette raison.

Le lot P (le moteur) est le **verrou** : les lots R et S en dépendent entièrement. Q dépend de son propre préalable (V3-Q1), pas de P.

```
N ──┐
O ──┤ (indépendants, à tout moment)
    │
P ──┴──> R ──> S
Q (indépendant, après V3-Q1)
```

**Ne pas ouvrir P, Q et R en même temps.** La leçon de la V2 vaut encore : trois chantiers ouverts finissent tous à 80 %.

---

# Lot N — Dette et trous d'intégration

Court, ingrat, et il vaut mieux le passer avant d'empiler du neuf dessus. Deux de ces tickets viennent d'un audit du dépôt, pas d'un backlog : personne ne les avait notés.

### V3-N1 — Brancher la détection de liens · `L`

Le noyau est fait et testé depuis V0-05 : `detectEntityReferences` (`src/core/linker/detect.ts`) gère la correspondance la plus longue, les frontières de mots et signale les ambiguïtés sans jamais les résoudre au hasard. **Rien ne l'appelle.** Le ticket V0-05 le disait déjà : *« l'UI de proposition viendra avec l'éditeur de texte riche »*. L'éditeur est arrivé, la proposition non. `entity_mentions` (Phase 0) n'est écrite nulle part.

C'est le chantier ouvert le plus avancé du projet, et le seul dont il ne reste que la moitié visible à faire.

**Critères**
- [ ] Pendant la saisie d'un bloc de texte, une mention détectée est **proposée**, jamais liée en silence.
- [ ] Une ambiguïté (deux entités partageant un alias) offre le choix ; aucun tirage automatique.
- [ ] Accepter une proposition écrit une ligne dans `entity_mentions`.
- [ ] Un alias inclus dans un mot plus long ne déclenche rien — vérifié de bout en bout, pas seulement en test unitaire.
- [ ] La détection ne s'exécute jamais sur le chemin de frappe : un bloc de 5 000 mots ne fait pas ramer l'éditeur.
- [ ] Refuser une proposition ne la repropose pas en boucle sur la même occurrence.

### V3-N2 — Les révisions mécaniques réellement écrites · `M`

`entity_mechanical_revisions` existe depuis la Phase 0 et n'est touchée que par l'export/import de monde. **Rien n'en crée en usage normal, rien ne les consulte** — alors que `campaign_entity_snapshots` est bâtie dessus et que la règle absolue 17 les traite comme immuables.

Soit on les branche, soit on assume qu'elles ne servent qu'à l'export et on l'écrit. Ne pas laisser une table de la Phase 0 en suspens sans décision.

**Critères**
- [ ] Une modification de build (niveau, classe, choix) crée une révision.
- [ ] Une mutation de jeu (PV, or, emplacement dépensé) n'en crée pas — même frontière que `entity_revisions` (`specs/wiki-blocs.md` §4.5).
- [ ] Insertion seule, jamais de mise à jour (règle absolue 17), vérifié par test.
- [ ] Un instantané de campagne pointe vers une révision réellement existante.

### V3-N3 — Repasser les critères en suspens de la V2 · `S`

Aucun code attendu dans le cas général : de la vérification.

**Critères**
- [ ] Les quatre critères finaux de V2-I1 (coordonnées normalisées, punaise/zone `gm` absente de la réponse, punaise vers un lieu portant une carte, carte de 4000 px sans blocage).
- [ ] La vignette servie avant la pleine résolution (V2-I1 phase A, laissée à la phase B).
- [ ] Le bloc généalogie se resynchronise quand une relation est ajoutée depuis l'en-tête de la même page (limite connue de V2-H3).
- [ ] Le glisser-déposer des blocs essayé à la main (jamais vérifié en direct, l'environnement de test ne simule pas les évènements de `dnd-kit`).
- [ ] Le filtrage de chronologie : construit, ou le critère V2-H2 reformulé pour dire ce qui a vraiment été livré.

### V3-N4 — Les bandes nommées à l'écran · `M`

`specs/psyche-pnj.md` §1.5 est formel : **le nombre ne sort jamais du moteur.** Aujourd'hui les bandes des sept axes de relation sont définies (`bands.ts`) mais l'écran montre la valeur exacte, et les bandes de `personality` ne sont pas définies du tout.

**Critères**
- [ ] Le radar et les curseurs affichent la bande nommée ; la valeur exacte reste au survol et à la saisie fine du MJ.
- [ ] Les bandes de `personality` sont définies, sur le même barème que celles de relation.
- [ ] Aucun pourcentage nu dans une vue de lecture.

*`known_as` réellement appliqué relève du lot R : il n'existe aucun contexte IA où le vérifier.*

### V3-N5 — Petites dettes signalées · `S`

Chacune tient en quelques lignes ; groupées parce qu'aucune ne mérite une session.

**Critères**
- [ ] `ai_digest` régénéré en français et en mètres (généré par `scripts/ingest-srd.ts`, signalé en V2-G1).
- [ ] Le `\n` isolé au milieu d'une phrase dans les traductions françaises quantifié puis corrigé (repéré sur « Initié à la magie », probablement pas isolé).
- [ ] Supprimer un compte invité ayant téléversé un fond ne laisse pas son asset orphelin dans le bucket (`background_images.owner_id`, cascade signalée en V2-L1).
- [ ] Les deux points du point de contrôle V2 tranchés : couverture de traduction par type d'entrée, et le statut de la migration `restore_entity_blocks`.

---

# Lot O — Récit, psyché, quêtes

La vague 1 de `docs/analyse-prompt-origine.md`. Sept tickets courts, indépendants entre eux et du reste du backlog. C'est le lot à prendre quand l'envie de gros chantier manque.

### V3-O1 — Onglet « Récit » dans les Réglages · `M`

`worlds.narration_profile jsonb`, sur le modèle exact de `worlds.calendar` et de `CalendarSettingsPanel.tsx`. Curseurs nommés (registre, rythme, longueur, humour, mortalité, crudité), plus deux zones libres : les influences et des consignes en clair. Détail en `analyse-prompt-origine.md` §4.

**Critères**
- [ ] Le profil vit sur le monde, se règle depuis les Réglages, et n'est jamais un bloc de wiki.
- [ ] `agency: "strict"` est une **validation**, pas une consigne : une proposition de tour faisant agir le personnage joueur est rejetée par le code.
- [ ] Le profil entre dans le contexte du modèle par le même chemin que le reste, borné par l'audience (règle absolue 11).
- [ ] Un monde sans profil réglé se comporte comme aujourd'hui, sans valeur inventée.

### V3-O2 — Verrou de partage d'un monde à contenu tiers · `S`

Le verrou existe pour un *ruleset* `personal_reference` ; il n'existe pas pour un *monde* dont le contenu est une œuvre protégée. **À poser avant de saisir un tel monde, pas après.**

**Critères**
- [ ] Un drapeau sur `worlds` interdit la création d'un `share_link`, par déclencheur en base — jamais seulement en masquant le bouton.
- [ ] Le message dit pourquoi, en renvoyant à `specs/ruleset-personnel.md` §1.
- [ ] Un monde ordinaire n'est pas affecté.

### V3-O3 — Pôles de relation configurables par monde · `M`

Tranché dans `specs/psyche-pnj.md` §8. Débloque « amour ↔ haine » (le seul axe du prompt d'origine sans équivalent) **et** la jauge de loyauté d'une recrue, sans ajouter d'axe codé en dur.

**Critères**
- [ ] Un monde ajoute un pôle de relation ou de personnalité ; les sept axes existants restent le défaut.
- [ ] Un pôle ajouté porte sa bande nommée, comme les autres (dépend de V3-N4).
- [ ] Retirer un pôle d'un monde ne détruit pas les valeurs déjà saisies.

### V3-O4 — « Ce qui le frappe » · `S`

Champ `striking` sur `personality`, et usage enfin fait de `entity_discoveries.detail_level` pour moduler la description. Voir `analyse-prompt-origine.md` §6.3.

**Critères**
- [ ] Une liste de phrases, chacune avec sa visibilité, sur le bloc `personality`.
- [ ] Le contexte transmis au modèle distingue le familier de l'inhabituel.
- [ ] Une entité sans ce champ ne change pas de comportement.

### V3-O5 — Orientations et rapport à l'intimité · `S`

Trois champs distincts (relationnelle, romantique, sexuelle) plus le rapport à l'intimité, **dans `personality`, jamais dans `worldview`** — une faction a des convictions, pas une orientation. Voir `analyse-prompt-origine.md` §6.4.

**Critères**
- [ ] Liste suggérée, saisie libre — jamais un enum fermé.
- [ ] Visibilité par champ, `gm` par défaut.
- [ ] Un seul interrupteur de monde, **partagé avec l'axe `attraction_repulsion`**, jamais un second réglage.
- [ ] La résolution est serveur : un champ non visible n'est pas envoyé au client (règle absolue 5, jamais un masquage CSS).

### V3-O6 — Rang, temporalité et délai sur le bloc `quest` · `S`

**Critères**
- [ ] Trois champs ajoutés, aucun obligatoire.
- [ ] Une quête existante reste valide sans eux.

### V3-O7 — Générateur de quêtes · `S`, contenu

Du contenu, pas du code : les générateurs composés et le tirage filtré par palier existent (V2-J9quater). Le barème de récompense par rang **est** un axe de palier.

**Critères**
- [ ] Emplacements : commanditaire et sa motivation (visibilité `gm`), objectif, lieu, complication, récompense, délai.
- [ ] La récompense suit le rang tiré, par palier — jamais une table plate.
- [ ] « Créer la fiche » produit une entité avec son bloc `quest` prérempli (mécanisme de promotion existant, V2-J2).

---

# Lot P — Le moteur de jeu

Les six tickets de `specs/moteur-de-jeu.md` §8. **Identifiants conservés tels quels** : la spec les nomme et les dimensionne déjà, les renuméroter casserait la seule référence existante.

C'est le verrou du reste de la V3. `A1` est le cœur : fonction pure, sans base ni réseau, **tests d'abord** — les cas dorés sont les règles réelles des parties jouées.

| Ticket | Contenu | Taille |
|---|---|---|
| **V3-A1** | Schéma des déclencheurs, évaluateur, bornes — `src/core/rules/triggers.ts` | `L` |
| **V3-A2** | Vocabulaire d'événements branché sur `resolveAction` et le combat | `M` |
| **V3-A3** | Économie d'action | `M` |
| **V3-A4** | État de scène et zones abstraites | `M` |
| **V3-A5** | Éditeur de déclencheurs au formulaire, avec bac à sable | `L` |
| **V3-A6** | Conversion des règles SRD 2024 qui ont des déclencheurs | `L` |

Critères d'acceptation détaillés en `specs/moteur-de-jeu.md` §9. Les trois qui commandent :

- [ ] Les déclencheurs sont des **données validées par Zod**, jamais du code exécuté.
- [ ] La concentration rompue par les dégâts s'exprime entièrement en données, sans code spécifique.
- [ ] Deux déclencheurs qui se répondent s'arrêtent à la profondeur 4, avec une erreur explicite.

**La règle des trois s'applique ici** : si, après ce lot, trois règles des livres utilisés restent inexprimables, la question d'une échappatoire se rouvre. Pas avant.

---

# Lot Q — Ruleset personnel

Les règles maison du prompt d'origine. Indépendant du lot P, mais **son premier ticket bloque les trois autres.**

### V3-Q1 — ADR : quelles constantes du moteur deviennent de la donnée · `S`

**Le seul ticket réellement bloquant de tout ce backlog.**

`CLAUDE.md` règle 18 promet qu'une variante est un ruleset de plus. C'est vrai pour tout ce qui est saisi comme fiche — ce ne l'est pas pour les constantes du moteur. Vérifié : `COIN_VALUE_CP` (`src/core/rules/currency.ts`), les dénominations pp/po/pe/pa/pc (enum Zod de `inventory`), et les multiplicateurs d'encombrement (`src/core/rules/encumbrance.ts`) sont tous en dur.

Deux cas concrets existent (monnaie, encombrement), un troisième s'annonce (échelle de rang). La règle des trois est atteinte.

**Critères**
- [ ] Un ADR dans `docs/adr/` : contexte, options, décision, conséquences. Dix lignes suffisent.
- [ ] Il dit **où** vit cette donnée et **quelles** constantes migrent — pas « toutes », pas « on verra ».

### V3-Q2 — Monnaie et encombrement en donnée de ruleset · `M`

Applique V3-Q1. La variante du prompt : 1 po = 100 pa = 10 000 pb, trois dénominations ; capacité = FOR × 2,5 kg, paliers 100 % et 120 %.

**Critères**
- [ ] Un ruleset définit ses dénominations et leurs taux ; le porte-monnaie et la conversion automatique suivent.
- [ ] Un ruleset définit sa capacité de charge et ses paliers.
- [ ] Le SRD garde exactement son comportement actuel — aucune régression sur les cas dorés existants.

### V3-Q3 — Le ruleset mana · `L`

Remplace les emplacements de sorts. Détail et pièges en `analyse-prompt-origine.md` §5.2.

**À vérifier avant de s'engager :** le mécanisme de surcharge sait ajouter et modifier une règle — **sait-il en retirer une ?** Le mana suppose de désactiver la progression d'incantation officielle. Si la réponse est non, ce ticket commence par là.

**Critères**
- [ ] Réserve de PM comme ressource, avec **fraction** de recharge (50 % au repos court) — aujourd'hui `recharge` est un enum qui ne sait dire que « entièrement ».
- [ ] Coût en PM par sort, deux classes de cantrips, sorts théorisés visibles sur la fiche.
- [ ] Évolution d'un sort : coût réduit **ou** effet amplifié, exclusifs — primitive `Choice` existante.
- [ ] Un personnage utilise les emplacements **ou** le mana, jamais les deux.
- [ ] Le ruleset a `parent_ruleset_id` vers une base officielle, jamais modifiée (règle absolue 18).

### V3-Q4 — Objets : qualité, niveau, identification · `M`

**Critères**
- [ ] Le **vocabulaire** (six qualités, échelle d'iLvl, table de risque, paliers d'identification) vit dans le ruleset.
- [ ] L'**instance** (`item_level`, `quality`, `identified`) vit sur le bloc `inventory`.
- [ ] Le tirage d'effet aléatoire d'un objet non identifié est fait par le serveur, journalisé.
- [ ] Aucune simulation de valeur marchande : le prix vient des paliers des générateurs.

---

# Lot R — Le MJ assisté

Ce que le verdict de l'ADR 0009 autorise : des propositions courtes, filtrées par un humain. Dépend entièrement du lot P.

### V3-R1 — Contexte déterministe d'un tour · `L`

L'essentiel du gain est ici, pas dans le modèle. `listActiveQuestsForWorld` est déjà écrite, filtrée par visibilité, et **n'a aucun appelant** — le crochet attend depuis V2-H4.

**Critères**
- [ ] Le contexte se récupère par identifiant : personnage, lieu, PNJ présents, quêtes actives, N derniers événements, résumé glissant. Le RAG ne sert qu'à la mémoire longue.
- [ ] Un PNJ présent tient en ~60 tokens : bande nommée, aspiration de séance, lignes rouges, `speech`.
- [ ] **`known_as` est appliqué** : le contexte ne révèle jamais l'identité réelle d'une cible que le PNJ ne connaît pas.
- [ ] Un tour complet envoie moins de 600 tokens au modèle.
- [ ] Le contexte est borné par l'audience de la sortie (règle absolue 11).

### V3-R2 — Le tour de jeu, avec le jet forcé · `M`

Le trou n° 1 de l'ADR 0009 : *« une contrainte d'interface qui force le passage par la résolution mécanique avant toute narration de combat, plutôt qu'une case à cocher facultative »*. Le prompt d'origine le demandait déjà, et une consigne ne l'a jamais tenu.

**Critères**
- [ ] Aucune narration d'action à issue incertaine sans que le moteur ait résolu d'abord — vérifié par une contrainte, pas par une consigne.
- [ ] Aucun nombre ne provient du modèle ; tout jet est journalisé dans `dice_rolls`.
- [ ] Une proposition référençant un identifiant non fourni est rejetée.
- [ ] Un PNJ incident peut avoir une voix en prose libre, sans identifiant à halluciner (constat de l'ADR 0009).
- [ ] Les trois options « Que fais-tu ? » sont un champ de la sortie structurée, pas une consigne de mise en page.

### V3-R3 — Wiki progressif · `M`

`entity_discoveries` existe depuis la Phase 0 et n'est écrite nulle part. Sans elle, un wiki solo montre tout dès le départ et détruit le jeu.

**Critères**
- [ ] La colonne wiki du mode solo n'affiche que les entités découvertes.
- [ ] `detail_level` distingue « a entendu ce nom » de « a lu la fiche ».
- [ ] Une découverte s'écrit depuis un événement de session, jamais à la main du modèle.

### V3-R4 — L'interface solo · `L`

Trois colonnes, conforme à `specs/module-joueur-et-solo.md` partie B. Le flux central est le **journal de session rendu**, pas un fil de discussion séparé.

**Critères**
- [ ] Recharger la page reconstruit le fil à l'identique (journal en ajout seul depuis la Phase 0).
- [ ] Lieu et heure viennent du moteur, jamais d'une sortie du modèle.
- [ ] La fiche de droite est celle de la V1, sans code dupliqué.

### V3-R5 — Canaux « GM : » et « RP : » · `S`

Deux canaux dans une seule saisie : hors-jeu (réponse méta, l'horloge ne bouge pas, rien ne s'écrit dans le monde) et en-jeu (le tour complet).

**Critères**
- [ ] Un message hors-jeu ne crée aucun événement de session et n'avance pas l'heure.
- [ ] Les deux peuvent coexister dans un même message.

### V3-R6 — Mode dés physiques · `S`

**Critères**
- [ ] Le joueur saisit un résultat brut ; le serveur applique modificateurs, comparaison à la CA et critique.
- [ ] `dice_rolls` porte l'origine (`server` / `physical`) — un jet physique reste un jet journalisé.
- [ ] Se règle par campagne, avec dérogation ponctuelle.

### V3-R7 — RAG et mémoire longue · `L`

**La dimension d'embedding doit être figée avant la première indexation** — la changer ensuite est une migration lourde.

**Critères**
- [ ] Un chunk = un segment, un bloc ou une entrée de règle. Aucun découpage aveugle.
- [ ] La visibilité est **héritée de la source** : un RAG qui ignore les permissions est un moteur de fuite.
- [ ] Recherche hybride, lexical et vectoriel fusionnés — le vectoriel seul rate les noms propres.
- [ ] Aucun appel d'embedding dans une transaction d'écriture ; `content_hash` pour ne jamais refacturer un texte inchangé.

### V3-R8 — Compagnon joueur en direct · `L`

Largement avancé par le lot M de la V2 (`canEditEntity`, invitations, coquille joueur). Reste le suivi en direct et le combat partagé — `specs/module-joueur-et-solo.md` partie A.

**Critères**
- [ ] Le fil d'activité du MJ fusionne `entity_revisions` et `session_events`, chaque ligne indiquant sa source.
- [ ] Un combat fonctionne avec zéro joueur connecté.
- [ ] Les PV adverses ont trois niveaux de visibilité, réglables en cours de combat.

---

# Lot S — Le monde vivant

Après le moteur, jamais avant : tout ceci se pose sur les déclencheurs.

### V3-S1 — La première impression donne la teinte · `M`

Fonction pure : `personality.baseline` (déjà là) + attitude de la faction envers le groupe + rang + circonstances. Plafonnée à ±50. **Amorçage unique, pas une simulation.**

**Critères**
- [ ] Le calcul est une fonction pure, testée aux bornes.
- [ ] Il s'écrit comme un `attitude_event` d'origine `system` — visible dans l'historique, rejouable, corrigeable au curseur.
- [ ] Aucune valeur initiale au-delà de ±50 sans réputation établie et connue du PNJ.

### V3-S2 — Horloges de faction et de propriété · `L`

Une horloge portée par une faction : un objectif, des crans, ce qui se produit quand elle se remplit, ce qui la fait avancer. **Elle n'avance que sur événement** — jamais de tâche de fond, pour la raison déjà posée en `specs/psyche-pnj.md` §1.

**Critères**
- [ ] Déclaratif, posé sur le vocabulaire d'événements du lot P, sans mécanisme nouveau.
- [ ] Une horloge ne coûte rien quand personne ne la regarde.
- [ ] Le joueur en ressent les effets, jamais l'exposé.

### V3-S3 — Propagation de réputation · `M`

Un fait connu d'une faction devient connu d'une autre, fidèlement ou déformé.

**Critères**
- [ ] La propagation passe par `entity_attitudes` entre factions — aucun concept nouveau.
- [ ] Une rumeur déformée reste traçable jusqu'au fait d'origine.

### V3-S4 — Rang d'aventurier · `M`

Échelle E→SS. L'échelle et les paliers sont de la **donnée de ruleset** ; le rang atteint est de l'**état de campagne**.

**Critères**
- [ ] Un `custom_table` d'abord ; un vrai bloc seulement à la troisième insuffisance.
- [ ] Le verrou d'acceptation d'une quête au-dessus du rang est appliqué côté serveur.
- [ ] Le rang influence l'attitude initiale (V3-S1), sans code dédié.

---

# Contenu — permanent, jamais un lot

Ce travail avance par petites touches et ne se ferme pas. Il n'entre dans aucun lot et ne bloque rien.

- Extraction de prose SRD étendue à Règle et Aptitude (seul Sort en a une aujourd'hui).
- Les ~471 fiches Objet : la structure est posée, le contenu non.
- Traduction française des noms de classes et sous-classes (38 sur 428 au dernier point).
- Le monde et le personnage du prompt d'origine, saisis dans `data/personnel/` puis dans l'app — **après V3-O2**, jamais avant.

---

## Critère de fin de V3

> Jouer seul une séance entière, la reprendre trois semaines plus tard, et retrouver un monde qui n'a rien oublié — sans qu'aucun nombre ni aucune règle ne soit venu du modèle.

À vérifier en jouant, pas en cochant des cases. C'est le même critère que celui qui a fait naître ce projet, posé cette fois à l'application plutôt qu'à un prompt.

Et un critère technique : **`entity_discoveries`, `entity_mentions` et `entity_mechanical_revisions` sont écrites en usage normal.** Les trois tables de la Phase 0 qui n'ont jamais servi.

---

## Questions à trancher

Aucune n'est urgente ; toutes changent le résultat si on y répond après coup. Le détail et le raisonnement sont en `docs/analyse-prompt-origine.md` §12.

| Question | Recommandation | Bloque |
|---|---|---|
| Quelles constantes du moteur deviennent de la donnée ? | monnaie et encombrement, puis on observe | **V3-Q2 à Q4** |
| La surcharge de ruleset sait-elle *retirer* une règle ? | à vérifier avant de commencer V3-Q3 | V3-Q3 |
| Pourcentages ou bandes nommées ? | les bandes ; un curseur sans chiffre si le besoin persiste | V3-N4 |
| Les jauges des PNJ absents évoluent-elles en arrière-plan ? | maintenir le refus — choix de jeu, pas d'architecture | V3-S2 |
| « Système implicite » ou fiche qui montre sa trace ? | un réglage d'affichage, pas une doctrine | V3-R4 |
| Réglages de contenu : par monde ou par compte ? | par monde, plafonné au compte, défaut restrictif | V3-O1 |
| Propriétés et gouvernance : « jamais » ou « un jour » ? | si « un jour », la jauge de loyauté devient un préalable | V3-O3 |
| Passage à l'application locale | `specs/cible-locale-et-ia.md` §6 — « local seul » ou « local d'abord » reste ouvert | — |

---

## Hors périmètre, explicitement

Pour que la question ne se repose pas à chaque session :

- **Gouvernance politique** (villages, territoires, effets en cascade) — cohérent, désirable, très loin.
- **Simulation économique** des valeurs marchandes — les paliers des générateurs couvrent 90 % de l'effet.
- **Dérive de fond** des attitudes hors événement — refusée en connaissance de cause.
- **Grille tactique** — trois zones abstraites suffisent ; on y revient seulement si ça manque vraiment.
- **Génération procédurale de cartes** — idée future, jamais un ticket tant que le reste n'est pas solide.

---

## Rappel de méthode

**Un ticket, un commit, une relecture.** Après plus d'un an de projet, c'est la discipline la plus facile à relâcher et la plus coûteuse à perdre.

**Et si l'envie manque un jour, prenez le lot qui fait plaisir plutôt que le suivant dans la liste.** Les lots N et O sont faits pour ça. Le risque R9 — perte de motivation — reste le premier risque de ce projet, devant tous les risques techniques.
