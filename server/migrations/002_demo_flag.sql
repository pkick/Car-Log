-- P4-G: vehicles loaded as demo data are flagged, so "Clear demo data" (DELETE /api/demo) removes exactly those.
-- Their records go with them through ON DELETE CASCADE. Every existing vehicle is real data.

ALTER TABLE vehicles ADD COLUMN isDemo INTEGER NOT NULL DEFAULT 0;
