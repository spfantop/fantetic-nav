-- 初始化 Cloudflare D1 表结构。
-- 字段命名尽量保持与旧版 SQLite 一致，减少接口兼容改造成本。

CREATE TABLE IF NOT EXISTS nav_user (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nav_setting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  favicon TEXT,
  title TEXT,
  govRecord TEXT,
  logo192 TEXT,
  logo512 TEXT,
  hideAdmin INTEGER NOT NULL DEFAULT 0,
  hideGithub INTEGER NOT NULL DEFAULT 0,
  hideToggleJumpTarget INTEGER NOT NULL DEFAULT 0,
  jumpTargetBlank INTEGER NOT NULL DEFAULT 1,
  showClock INTEGER NOT NULL DEFAULT 1,
  showWeather INTEGER NOT NULL DEFAULT 1,
  showMemo INTEGER NOT NULL DEFAULT 0,
  memoContent TEXT NOT NULL DEFAULT '',
  fontFamily TEXT NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS nav_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  url TEXT,
  logo TEXT,
  catelog TEXT,
  desc TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  hide INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nav_catelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  hide INTEGER NOT NULL DEFAULT 0,
  accessPasswordHash TEXT
);

CREATE TABLE IF NOT EXISTS nav_api_token (
  id INTEGER PRIMARY KEY,
  name TEXT,
  value TEXT,
  disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nav_img (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  value TEXT,
  contentType TEXT,
  sourceUrl TEXT,
  updatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS nav_search_engine (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  baseUrl TEXT NOT NULL,
  queryParam TEXT NOT NULL,
  logo TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS nav_site_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  noImageMode INTEGER NOT NULL DEFAULT 0,
  compactMode INTEGER NOT NULL DEFAULT 0,
  layoutScale TEXT NOT NULL DEFAULT 'default'
);

CREATE INDEX IF NOT EXISTS idx_nav_table_sort ON nav_table(sort);
CREATE INDEX IF NOT EXISTS idx_nav_catelog_sort ON nav_catelog(sort);
CREATE INDEX IF NOT EXISTS idx_nav_search_engine_sort ON nav_search_engine(sort);
CREATE INDEX IF NOT EXISTS idx_nav_api_token_disabled ON nav_api_token(disabled);
