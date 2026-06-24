-- Migration : extension du workflow de demandes d'achat
-- A exécuter UNE SEULE FOIS contre la base PostgreSQL BIASA
-- Commande : psql -U postgres -d biasa_db -f migration_workflow.sql

-- Nouveaux statuts
ALTER TYPE statutda ADD VALUE IF NOT EXISTS 'en_commande';
ALTER TYPE statutda ADD VALUE IF NOT EXISTS 'livree';
ALTER TYPE statutda ADD VALUE IF NOT EXISTS 'recue';

-- Nouvelles actions historique
ALTER TYPE actionhistorique ADD VALUE IF NOT EXISTS 'prise_en_charge';
ALTER TYPE actionhistorique ADD VALUE IF NOT EXISTS 'livraison_confirmee';
ALTER TYPE actionhistorique ADD VALUE IF NOT EXISTS 'reception_confirmee';
