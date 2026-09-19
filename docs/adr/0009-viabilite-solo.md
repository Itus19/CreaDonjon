# 0009 — Verdict du spike de viabilité du solo (V2-S1)

**Date :** 2026-08-22
**Statut :** acceptée

## Contexte

V2-S1 testait la thèse centrale de toute la conception de la V3 : un modèle local peut-il narrer un tour de jeu solo de façon satisfaisante quand le moteur calcule tout le déterministe (dés, dégâts, résolution) et que le modèle n'a plus qu'à raconter ? Vingt tours joués sur un écran jetable (`/spike-solo`, jamais persisté) : un lieu préparé (L'Ancre Rouillée), trois PNJ à personnalité codée en dur (pas le vrai bloc `personality` de V2-H1), un combat préparé via le générateur de rencontres (V1-E3), le fournisseur `gemma-4-e4b-uncensored-hauhaucs-aggressive` en local via LM Studio.

## Mesures objectives

| Mesure | Seuil | Résultat |
|---|---|---|
| Latence par tour | < 15 s | ~10 s en moyenne, max 14,4 s — dans le budget |
| Tokens d'entrée par tour | < 3 000 | ~1 400 en moyenne — dans le budget |
| Identifiants inventés acceptés | 0 | **0/20** — le garde-fou (enum fermé sur les trois PNJ réels) a tenu toute la session |
| Appels malformés | < 10 % | 2/20 au compteur brut ; **1/20 (5 %)** une fois retiré un échec d'infrastructure sans rapport avec la sortie du modèle (serveur LM Studio injoignable au tour 1) — dans le budget une fois cette distinction faite |

## Constats qualitatifs

- **Répétition verbatim.** La même réplique de PNJ ressort mot pour mot à deux reprises distinctes (tours 5-6, puis 14-15-16 trois fois de suite) — un signe net de bouclage du modèle, pas une impression subjective.
- **Dérive de personnage.** Un PNJ nomme Bram « ce chevalier », contredisant son identité établie (tavernier). Sœur Aude, prêtresse dévote dont la seule caractérisation écrite est la reconnaissance envers Bram, accepte une avance romantique puis un rendez-vous en chambre en quelques tours sans la moindre hésitation liée à ses vœux.
- **PNJ omniprésent, point de vue du joueur dilué.** Ktar continue de commenter la scène après que Bram a physiquement quitté la taverne pour le marché. Cause directe : le contexte ne suit aucun déplacement de scène, les PNJ « présents » restent une liste figée toute la session — un choix de portée délibérément minuscule du spike, mais qui pousse le modèle à faire vivre le même PNJ hors de propos plutôt que de rester silencieux.
- **Schéma de réaction trop rigide pour un PNJ incident.** `npc_reaction` ne peut référencer qu'un des trois identifiants fermés — aucune voie pour faire parler un personnage ponctuel (le marchand du marché) sans lui donner un identifiant. Le modèle a préféré recycler un PNJ déjà autorisé (Ktar) plutôt que de voix le marchand en prose libre (ce que le champ `narration` aurait pourtant permis sans risque d'hallucination).
- **Le lien fait-mécanique → narration n'a en réalité jamais été observé de bout en bout.** La seule tentative d'injection d'un fait mécanique réel (tour 1, une attaque de monstre) a échoué avant d'atteindre le modèle (panne du serveur LM Studio, sans rapport avec la validation). Le joueur n'a pas recoché la case ensuite — le combat des tours 2 à 4 (jusqu'à la mise à mort du monstre) a donc été entièrement narré par le modèle sans qu'aucun dé réel ne soit lancé. La résolution mécanique elle-même fonctionne (vérifiée isolément avant le playtest), mais rien dans l'écran ne force son usage : la garantie « le modèle ne calcule rien » ne tient que si l'humain pense à toujours fournir le fait.

## Décision

**Repli sur le MJ assisté**, pas le MJ IA autonome — la ligne du tableau de S1 « mécanique solide, prose faible ». Les mesures objectives (identifiants, latence, tokens, taux de malformation) sont toutes dans le budget ; c'est la cohérence narrative dans la durée qui déçoit, à la taille de modèle disponible sur ce poste (7,5 milliards de paramètres, sans raisonnement). Le MJ assisté ne demande que des propositions courtes et ponctuelles, filtrées par un humain à chaque fois — un usage pour lequel un modèle de cette taille est nettement plus fiable qu'une narration continue livrée sans filet.

## Conséquences

- La V3 se conçoit comme un MJ assisté (propositions courtes que l'humain accepte, modifie ou ignore), pas une narration autonome continue.
- **Avant toute conclusion définitive** : reboucler spécifiquement le lien fait-mécanique → narration, jamais réellement exercé dans ce spike (panne d'infrastructure sur l'unique tentative). Un second passage court, ciblé sur ce seul point, est nécessaire.
- Points de conception à reporter dans V2-H1 / la vraie V3, indépendamment du choix solo/assisté :
  - un vrai suivi de scène (qui est présent recalculé selon le lieu réel du joueur, pas une liste figée) ;
  - un contexte de personnage qui se met à jour (PV, état), pas un instantané pris une fois au début ;
  - un mécanisme pour voix les PNJ incidents en prose libre sans leur donner un identifiant à risque d'hallucination ;
  - une consigne ou une contrainte d'interface qui force le passage par la résolution mécanique avant toute narration de combat, plutôt qu'une case à cocher facultative.
- Un modèle plus grand ou un fournisseur distant pourrait améliorer la prose seule — mais pas combler les trous d'intégration ci-dessus (scène, fait mécanique non forcé), qui sont indépendants du modèle utilisé.

---

## Amendement du 19 septembre 2026 — S2 : le lien fait-mecanique → narration, enfin observe

Cet amendement ne reecrit rien de ce qui precede. Il repond a la seule
reserve que la decision avait laissee ouverte : *« reboucler specifiquement
le lien fait-mecanique → narration, jamais reellement exerce dans ce spike »*.

**Protocole.** Dix tours de combat sur `/spike-solo`, meme fournisseur qu'en
S1 (`gemma-4-e4b-uncensored-hauhaucs-aggressive`, LM Studio en local), meme
decor (L'Ancre Rouillee, les trois memes PNJ). Difference essentielle : la
case a cocher facultative a ete SUPPRIMEE. Chaque tour resout d'abord une
attaque reelle (`resolveMonsterAttackOnBram`), et si cette resolution echoue
le tour s'arrete sans appeler le modele. C'est precisement ce garde-fou qui
manquait a S1, ou une panne de resolution avait laisse la narration partir
seule. Les PV de Bram descendent desormais d'un tour a l'autre au lieu de
rester l'instantane du depart, sans quoi « PV restants » n'aurait ete aucun
nombre a contredire.

| Mesure | Seuil | Resultat |
|---|---|---|
| Nombres fournis contredits | ≤ 1 sur 10 | **0 / 10** |
| Faits mecaniques inventes | 0 | **0 / 10** |
| Appels malformes | < 10 % | 0 / 10 |
| Latence par tour | < 15 s | 12,2 s en moyenne |
| Tokens d'entree par tour | (budget V3 : < 600) | **1 364 en moyenne — hors budget** |

**Verdict : le lien tient.** Le modele reprend fidelement les degats, les PV
restants et l'issue reussite/echec, y compris quand il n'y a rien a perdre
(un coup rate laisse les PV inchanges, et il le dit). Il cite meme les
valeurs exactes — « un jet a 7 contre la CA de 11 » (tour 9) — sans jamais
en produire une seule de lui-meme. Le lot B peut donc s'ecrire avec de la
prose libre : les gabarits a trous, prevus en cas d'echec, ne sont pas
necessaires.

**Ce que cette mesure ne dit PAS, et qu'il faut lire avec elle :**

- **Dix tours, c'est peu**, et le fait fourni est court et formulaire — le
  modele avait deux ou trois nombres a recopier, pas une situation
  mecanique complexe a tenir.
- **Six tours sur dix ont mesure un PV constant.** Bram est tombe a 0 des le
  tour 4 et y est reste (le spike ignore les jets de mort). La fidelite aux
  « PV restants » n'a donc ete reellement eprouvee que sur trois
  transitions : 9 → 5 → 2 → 0.
- **Les defauts qualitatifs de S1 sont tous revenus**, ce qui confirme le
  repli sur le MJ assiste plutot que de l'infirmer : une replique de Bram
  attribuee a Ktar (tour 4), une phrase reprise quasi mot pour mot d'un tour
  a l'autre (tours 7 et 8), et des PNJ qui commentent sans raison. Le lien
  mecanique tient ; la coherence narrative dans la duree, non.
- **Le budget de tokens est depasse d'un facteur deux.** 1 364 tokens
  d'entree par tour contre les 600 vises par les criteres transverses de la
  V3 — a traiter dans le lot B, pas ici.

**Defaut releve en passant :** le fait transmis au modele contient un texte a
trou non resolu — `L'attaque de Bandit (1d20 + {mod} = 10) rate Bram`. Le
modele ne l'a jamais recopie, mais on lui envoie une expression malformee a
chaque coup rate. A corriger dans `resolveAttackRoll`.

**Le banc d'essai etait casse, et le reparer a revele six defauts reels.**
Rejouer S2 supposait `/spike-solo` fonctionnel : il ne l'etait plus depuis un
mois, sans que rien ne le signale. Voir le ticket S2 de `docs/BACKLOG_V3.md`
pour le detail — dont `npm run ingest:srd`, casse sur toute base neuve depuis
le 17 aout, c'est-a-dire le chemin d'amorcage documente du projet.
