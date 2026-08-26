-- Un monde = une campagne (decision produit explicite, prepa avant V2-G1
-- export/import) : jusqu'ici `campaigns.world_id` n'avait aucune contrainte
-- d'unicite -- un monde pouvait avoir 0, 1 ou N campagnes, et c'etait un
-- chemin construit et fonctionnel (CampaignsPanel.tsx permettait deja d'en
-- creer une seconde, les ecrans MJ avaient deja un selecteur multi-campagne).
-- Cet index partiel (jamais une contrainte simple : une campagne
-- soft-supprimee ne doit pas bloquer la creation de la suivante) impose
-- desormais au plus une campagne vivante par monde, applique cote base
-- plutot que cote application seule.
create unique index campaigns_world_id_unique on campaigns (world_id) where deleted_at is null;
