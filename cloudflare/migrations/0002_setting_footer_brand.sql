ALTER TABLE nav_setting ADD COLUMN footerText TEXT;
ALTER TABLE nav_setting ADD COLUMN footerLink TEXT;
UPDATE nav_setting SET footerText = '笔尖码动' WHERE footerText IS NULL;
UPDATE nav_setting SET footerLink = 'https://henniubi.com' WHERE footerLink IS NULL;
