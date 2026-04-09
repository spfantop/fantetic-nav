ALTER TABLE nav_setting ADD COLUMN adminBackgroundUrl TEXT NOT NULL DEFAULT '';
UPDATE nav_setting SET adminBackgroundUrl = '' WHERE adminBackgroundUrl IS NULL;
