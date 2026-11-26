# ADR 0106 — Un ruleset personnel choisi pour un monde en devient une copie

Date : 2026-11-24 · Ticket : AG-18 · Statut : accepté

## Contexte

Le formulaire « Nouveau monde » ne proposait que les bases officielles. Les
rulesets de la personne (variantes, références personnelles) n'arrivaient
dans un monde qu'après coup, depuis Règles actives, et y étaient **partagés** :
retoucher sa variante dans un monde changeait les règles de tous les autres.

L'auteur a tranché le 23 novembre : choisir un de ses rulesets à la création
en fait une **copie propre au monde**, qui retient sa source. Quand la source
change, le monde affiche « mise à jour disponible » et la personne choisit
règle par règle. Rien ne change dans un monde sans qu'elle le voie.

## Options

1. Partager la variante (l'existant) : simple, mais une retouche touche tous
   les mondes.
2. Copier sans lien : chaque monde dérive seul, aucune mise à jour possible.
3. **Copier en gardant la source et une référence par règle** (retenu).

## Décision

- `rulesets.copied_from_ruleset_id` (source, `on delete set null`) et
  `rulesets.copy_baseline` (jsonb, `entry_key` → empreinte).
- Une variante ne stocke que ses surcharges (SCHEMA.md §9.4) : la copie est un
  nouveau ruleset **de même parent** qui reçoit une copie de ses lignes de
  `ruleset_overrides`. RPC `copy_ruleset_for_world`, d'un seul tenant, security
  invoker : la RLS existante (`created_by = auth.uid()`) suffit, et la fonction
  refuse en plus une base officielle et le ruleset d'un autre compte.
- L'**empreinte** d'une règle est un md5, calculé par la base
  (`ruleset_override_digests`), de toutes ses surcharges dans un ordre fixe.
  La référence garde l'empreinte de la source au moment de la copie ou du
  dernier choix. Une seule implémentation du condensé, en SQL ; la
  comparaison (modifiée, nouvelle, retirée) est pure, dans
  `src/core/rules/copieRuleset.ts`.
- Choisir une règle (`sync_ruleset_copy_entry`) : « Reprendre » remplace les
  surcharges de cette clé dans la copie par celles de la source ; « Garder la
  mienne » ne touche à rien. Dans les deux cas la référence prend l'empreinte
  actuelle de la source. L'écran envoie l'empreinte qu'il a montrée ; si la
  source a encore changé, rien n'est appliqué (409).
- Les retouches faites dans la copie ne sont pas des mises à jour : elles
  n'entrent pas dans la comparaison. « Reprendre » les écrase pour cette
  règle seulement, c'est le sens du bouton.
- Une base officielle choisie à la création reste partagée, comme avant.

## Conséquences

- Coût : deux lectures de plus sur Règles actives, seulement quand le ruleset
  actif est une copie (référence de la copie, empreintes de la source). La
  création d'un monde avec un ruleset personnel fait une requête de plus.
- La chaîne au-dessus de la copie reste partagée : une copie d'une variante
  de variante dépend toujours de la variante parente. Limite déjà présente :
  une joueuse ne lit pas la variante parente (`can_read_ruleset` ne regarde
  que le ruleset du monde), la copie ne l'aggrave ni ne la corrige.
- Un ruleset publié (`published_at`, jamais posé par l'interface aujourd'hui)
  n'est pas suivi : une copie suit l'identifiant de sa source, pas sa lignée.
- Supprimer un monde laisse sa copie dans la liste « Mes rulesets » des
  autres mondes (marquée « Copie »), à supprimer à la main, comme une variante.
- Le formulaire de création ne propose jamais une copie comme source.
- Choisir une variante plus tard, depuis Règles actives, la partage toujours
  (comportement existant, hors du ticket).
