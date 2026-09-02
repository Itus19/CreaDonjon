-- V2-I2 (brouillard de guerre) — une zone n'est soumise au brouillard que si
-- son auteur l'a explicitement marquee ainsi (retour utilisateur : rendre ca
-- retroactif aurait cache aux joueurs, sans avertissement, toutes les zones
-- deja tracees et publiques dans les mondes existants — la zone "Amn" sur
-- Faerun, par exemple). Par defaut `false` : une zone existante ou nouvelle
-- reste visible exactement comme avant ce ticket, sauf choix contraire.

alter table map_regions
  add column fog_gated boolean not null default false;

comment on column map_regions.fog_gated is 'Si vrai, la zone est en plus filtree par map_region_reveals (par campagne) avant d''etre visible a un joueur — le MJ la voit toujours, brouillard ou pas.';
