import type {
  Catelog,
  Env,
  ImageCache,
  PublicUser,
  SearchEngine,
  Setting,
  SiteConfig,
  Token,
  Tool,
  User,
} from "./types";
import { hashPassword, verifyPassword } from "./auth";

// 将 D1 中的整型布尔值还原成前端需要的 boolean。
const toBool = (value: unknown, fallback = false) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  return Number(value) !== 0;
};

const normalizeToolField = (value: unknown) => String(value ?? "").trim();

// 旧版默认数据需要保留，否则前端首次打开会出现空白或后台异常。
const DEFAULT_SEARCH_ENGINES = [
  { name: "百度", baseUrl: "https://www.baidu.com/s", queryParam: "wd", logo: "baidu.ico", sort: 1 },
  { name: "Bing", baseUrl: "https://cn.bing.com/search", queryParam: "q", logo: "bing.ico", sort: 2 },
  { name: "Google", baseUrl: "https://www.google.com/search", queryParam: "q", logo: "google.ico", sort: 3 },
];

const DEFAULT_LIGHT_THEME_CONFIG = JSON.stringify({
  // 数据库默认值与前端默认调色盘保持一致，保证首次初始化时后台亮色风格统一。
  pageBackground: "#f6f2e8",
  panelBackground: "rgba(255, 250, 242, 0.86)",
  cardBackground: "rgba(255, 252, 247, 0.92)",
  cardBorder: "rgba(169, 137, 96, 0.18)",
  textPrimary: "#322417",
  textSecondary: "#78644d",
  tagBackground: "#efe3d1",
  tagActiveBackground: "#9b7247",
  inputBackground: "rgba(255, 255, 255, 0.76)",
  inputBorder: "rgba(176, 144, 105, 0.2)",
  inputFocus: "#d8a45c",
  primaryColor: "#a36a2f",
  primaryText: "#fffaf4",
  adminHeaderBackground: "rgba(255, 248, 239, 0.88)",
  adminSidebarBackground: "rgba(247, 237, 221, 0.9)",
});

const DEFAULT_DARK_THEME_CONFIG = JSON.stringify({
  pageBackground: "#121212",
  panelBackground: "rgba(25, 23, 20, 0.86)",
  cardBackground: "#222222",
  cardBorder: "rgba(123, 109, 88, 0.24)",
  textPrimary: "#eee5d8",
  textSecondary: "#bcad99",
  tagBackground: "#383838",
  tagActiveBackground: "#5e503f",
  inputBackground: "rgba(25, 23, 20, 0.68)",
  inputBorder: "rgba(135, 114, 84, 0.2)",
  inputFocus: "#e1bb6f",
  primaryColor: "#d4b483",
  primaryText: "#181512",
  adminHeaderBackground: "rgba(19, 17, 15, 0.88)",
  adminSidebarBackground: "rgba(19, 17, 15, 0.86)",
});

const INIT_SQL = `
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
  footerText TEXT,
  footerLink TEXT,
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
  fontFamily TEXT NOT NULL DEFAULT 'system',
  adminBackgroundUrl TEXT NOT NULL DEFAULT '',
  adminBackgroundLightUrl TEXT NOT NULL DEFAULT '',
  adminBackgroundDarkUrl TEXT NOT NULL DEFAULT '',
  lightThemeConfig TEXT NOT NULL DEFAULT '${DEFAULT_LIGHT_THEME_CONFIG.replace(/'/g, "''")}',
  darkThemeConfig TEXT NOT NULL DEFAULT '${DEFAULT_DARK_THEME_CONFIG.replace(/'/g, "''")}'
);
CREATE TABLE IF NOT EXISTS nav_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  url TEXT,
  logo TEXT,
  catelog TEXT,
  desc TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  hide INTEGER NOT NULL DEFAULT 0,
  accessPasswordHash TEXT
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
  layoutScale TEXT NOT NULL DEFAULT 'default',
  showPerformancePanel INTEGER NOT NULL DEFAULT 0,
  weatherMode TEXT NOT NULL DEFAULT 'city',
  weatherCity TEXT NOT NULL DEFAULT 'Shanghai'
);
`;

let initPromise: Promise<void> | null = null;

// 迁移老库时需要按列补齐字段，这里统一做成工具函数避免每次重复写 PRAGMA 判断。
const ensureTableColumn = async (env: Env, table: string, column: string, definition: string) => {
  const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name?: string }>();
  const columnNames = new Set((result.results ?? []).map((item) => item.name));
  if (!columnNames.has(column)) {
    await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
};

// 本地 wrangler + D1 调试时，对多语句字符串执行 exec 的兼容性不稳定。
// 这里显式拆成单条 SQL 顺序执行，避免首条 CREATE TABLE 被当成不完整输入。
const runInitStatements = async (env: Env) => {
  const statements = INIT_SQL
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
};

export const ensureDatabase = async (env: Env) => {
  if (!initPromise) {
    initPromise = (async () => {
      await runInitStatements(env);

      // 老库可能缺少后续新增字段，这里在初始化阶段做一次幂等补齐。
      await ensureTableColumn(env, "nav_setting", "showClock", "INTEGER NOT NULL DEFAULT 1");
      await ensureTableColumn(env, "nav_setting", "showWeather", "INTEGER NOT NULL DEFAULT 1");
      await ensureTableColumn(env, "nav_setting", "showMemo", "INTEGER NOT NULL DEFAULT 0");
      await ensureTableColumn(env, "nav_setting", "memoContent", "TEXT NOT NULL DEFAULT ''");
      await ensureTableColumn(env, "nav_setting", "fontFamily", "TEXT NOT NULL DEFAULT 'system'");
      await ensureTableColumn(env, "nav_setting", "footerText", "TEXT");
      await ensureTableColumn(env, "nav_setting", "footerLink", "TEXT");
      await ensureTableColumn(env, "nav_setting", "adminBackgroundUrl", "TEXT NOT NULL DEFAULT ''");
      await ensureTableColumn(env, "nav_setting", "adminBackgroundLightUrl", "TEXT NOT NULL DEFAULT ''");
      await ensureTableColumn(env, "nav_setting", "adminBackgroundDarkUrl", "TEXT NOT NULL DEFAULT ''");
      await ensureTableColumn(env, "nav_setting", "lightThemeConfig", `TEXT NOT NULL DEFAULT '${DEFAULT_LIGHT_THEME_CONFIG.replace(/'/g, "''")}'`);
      await ensureTableColumn(env, "nav_setting", "darkThemeConfig", `TEXT NOT NULL DEFAULT '${DEFAULT_DARK_THEME_CONFIG.replace(/'/g, "''")}'`);
      await ensureTableColumn(env, "nav_catelog", "accessPasswordHash", "TEXT");
      await ensureTableColumn(env, "nav_table", "accessPasswordHash", "TEXT");
      await ensureTableColumn(env, "nav_site_config", "showPerformancePanel", "INTEGER NOT NULL DEFAULT 0");
      await ensureTableColumn(env, "nav_site_config", "layoutScale", "TEXT NOT NULL DEFAULT 'default'");
      await ensureTableColumn(env, "nav_site_config", "weatherMode", "TEXT NOT NULL DEFAULT 'city'");
      await ensureTableColumn(env, "nav_site_config", "weatherCity", "TEXT NOT NULL DEFAULT 'Shanghai'");

      // 这些默认记录与旧版初始化一致，保证前端首次请求就能拿到完整配置。
      await env.DB.prepare(
        "INSERT OR IGNORE INTO nav_user (id, name, password) VALUES (1, 'admin', 'admin')"
      ).run();

      await env.DB.prepare(
        `INSERT OR IGNORE INTO nav_setting
         (id, favicon, title, govRecord, footerText, footerLink, logo192, logo512, hideAdmin, hideGithub, hideToggleJumpTarget, jumpTargetBlank, showClock, showWeather, showMemo, memoContent, fontFamily, adminBackgroundUrl, adminBackgroundLightUrl, adminBackgroundDarkUrl, lightThemeConfig, darkThemeConfig)
         VALUES (1, 'favicon.ico', 'Fantetic Nav', '', '笔尖码动', 'https://henniubi.com', 'logo192.png', 'logo512.png', 0, 0, 0, 1, 1, 1, 0, '', 'system', '', '', '', '${DEFAULT_LIGHT_THEME_CONFIG.replace(/'/g, "''")}', '${DEFAULT_DARK_THEME_CONFIG.replace(/'/g, "''")}')`
      ).run();

      // 老库补列后，已有记录的空值也需要回填默认字体，避免前端拿到空字符串。
      await env.DB.prepare("UPDATE nav_setting SET memoContent = '' WHERE memoContent IS NULL").run();
      await env.DB.prepare("UPDATE nav_setting SET fontFamily = 'system' WHERE fontFamily IS NULL OR TRIM(fontFamily) = ''").run();
      await env.DB.prepare("UPDATE nav_setting SET footerText = '笔尖码动' WHERE footerText IS NULL").run();
      await env.DB.prepare("UPDATE nav_setting SET footerLink = 'https://henniubi.com' WHERE footerLink IS NULL").run();
      await env.DB.prepare("UPDATE nav_setting SET adminBackgroundUrl = '' WHERE adminBackgroundUrl IS NULL").run();
      await env.DB.prepare("UPDATE nav_setting SET adminBackgroundLightUrl = '' WHERE adminBackgroundLightUrl IS NULL").run();
      await env.DB.prepare("UPDATE nav_setting SET adminBackgroundDarkUrl = '' WHERE adminBackgroundDarkUrl IS NULL").run();
      await env.DB.prepare(`UPDATE nav_setting SET lightThemeConfig = '${DEFAULT_LIGHT_THEME_CONFIG.replace(/'/g, "''")}' WHERE lightThemeConfig IS NULL OR TRIM(lightThemeConfig) = ''`).run();
      await env.DB.prepare(`UPDATE nav_setting SET darkThemeConfig = '${DEFAULT_DARK_THEME_CONFIG.replace(/'/g, "''")}' WHERE darkThemeConfig IS NULL OR TRIM(darkThemeConfig) = ''`).run();

      await env.DB.prepare(
        "INSERT OR IGNORE INTO nav_site_config (id, noImageMode, compactMode, layoutScale, showPerformancePanel, weatherMode, weatherCity) VALUES (1, 0, 0, 'default', 0, 'city', 'Shanghai')"
      ).run();

      const countResult = await env.DB.prepare("SELECT COUNT(*) AS count FROM nav_search_engine").first<{ count: number }>();
      if (!countResult || Number(countResult.count) === 0) {
        await env.DB.batch(
          DEFAULT_SEARCH_ENGINES.map((engine) =>
            env.DB.prepare(
              "INSERT INTO nav_search_engine (name, baseUrl, queryParam, logo, sort, enabled) VALUES (?, ?, ?, ?, ?, 1)"
            ).bind(engine.name, engine.baseUrl, engine.queryParam, engine.logo, engine.sort)
          )
        );
      }
    })();
  }
  await initPromise;
};

export const getUserByName = async (env: Env, name: string) => {
  await ensureDatabase(env);
  const row = await env.DB.prepare("SELECT id, name, password FROM nav_user WHERE name = ?").bind(name).first<User>();
  return row ?? null;
};

export const upgradeUserPassword = async (env: Env, userId: number, hashedPassword: string) => {
  await ensureDatabase(env);
  await env.DB.prepare("UPDATE nav_user SET password = ? WHERE id = ?").bind(hashedPassword, userId).run();
};

export const getSetting = async (env: Env): Promise<Setting> => {
  await ensureDatabase(env);
  const row = await env.DB.prepare(
    "SELECT id, favicon, title, govRecord, footerText, footerLink, logo192, logo512, hideAdmin, hideGithub, hideToggleJumpTarget, jumpTargetBlank, showClock, showWeather, showMemo, memoContent, fontFamily, adminBackgroundUrl, adminBackgroundLightUrl, adminBackgroundDarkUrl, lightThemeConfig, darkThemeConfig FROM nav_setting ORDER BY id ASC LIMIT 1"
  ).first<Record<string, unknown>>();

  return {
    id: Number(row?.id ?? 1),
    favicon: String(row?.favicon ?? "favicon.ico"),
    title: String(row?.title ?? "Fantetic Nav"),
    govRecord: String(row?.govRecord ?? ""),
    footerText: String(row?.footerText ?? "笔尖码动"),
    footerLink: String(row?.footerLink ?? "https://henniubi.com"),
    logo192: String(row?.logo192 ?? "logo192.png"),
    logo512: String(row?.logo512 ?? "logo512.png"),
    hideAdmin: toBool(row?.hideAdmin, false),
    hideGithub: toBool(row?.hideGithub, false),
    hideToggleJumpTarget: toBool(row?.hideToggleJumpTarget, false),
    jumpTargetBlank: toBool(row?.jumpTargetBlank, true),
    showClock: toBool(row?.showClock, true),
    showWeather: toBool(row?.showWeather, true),
    showMemo: toBool(row?.showMemo, false),
    memoContent: String(row?.memoContent ?? ""),
    fontFamily: String(row?.fontFamily ?? "system"),
    adminBackgroundUrl: String(row?.adminBackgroundUrl ?? ""),
    adminBackgroundLightUrl: String(row?.adminBackgroundLightUrl ?? ""),
    adminBackgroundDarkUrl: String(row?.adminBackgroundDarkUrl ?? ""),
    lightThemeConfig: String(row?.lightThemeConfig ?? DEFAULT_LIGHT_THEME_CONFIG),
    darkThemeConfig: String(row?.darkThemeConfig ?? DEFAULT_DARK_THEME_CONFIG),
  };
};

export const updateSetting = async (env: Env, payload: Setting) => {
  await ensureDatabase(env);
  await env.DB.prepare(
    `UPDATE nav_setting
     SET favicon = ?, title = ?, govRecord = ?, footerText = ?, footerLink = ?, logo192 = ?, logo512 = ?, hideAdmin = ?, hideGithub = ?, hideToggleJumpTarget = ?, jumpTargetBlank = ?, showClock = ?, showWeather = ?, showMemo = ?, memoContent = ?, fontFamily = ?, adminBackgroundUrl = ?, adminBackgroundLightUrl = ?, adminBackgroundDarkUrl = ?, lightThemeConfig = ?, darkThemeConfig = ?
     WHERE id = 1`
  ).bind(
    payload.favicon,
    payload.title,
    payload.govRecord,
    payload.footerText,
    payload.footerLink,
    payload.logo192,
    payload.logo512,
    Number(payload.hideAdmin),
    Number(payload.hideGithub),
    Number(payload.hideToggleJumpTarget),
    Number(payload.jumpTargetBlank),
    Number(payload.showClock),
    Number(payload.showWeather),
    Number(payload.showMemo),
    (payload.memoContent || "").trim(),
    payload.fontFamily || "system",
    (payload.adminBackgroundUrl || "").trim(),
    (payload.adminBackgroundLightUrl || "").trim(),
    (payload.adminBackgroundDarkUrl || "").trim(),
    (payload.lightThemeConfig || DEFAULT_LIGHT_THEME_CONFIG).trim() || DEFAULT_LIGHT_THEME_CONFIG,
    (payload.darkThemeConfig || DEFAULT_DARK_THEME_CONFIG).trim() || DEFAULT_DARK_THEME_CONFIG
  ).run();
};

export const getSiteConfig = async (env: Env): Promise<SiteConfig> => {
  await ensureDatabase(env);
  const row = await env.DB.prepare(
    "SELECT id, noImageMode, compactMode, layoutScale, showPerformancePanel, weatherMode, weatherCity FROM nav_site_config ORDER BY id ASC LIMIT 1"
  ).first<Record<string, unknown>>();

  return {
    id: Number(row?.id ?? 1),
    noImageMode: toBool(row?.noImageMode, false),
    compactMode: toBool(row?.compactMode, false),
    layoutScale:
      String(row?.layoutScale ?? "default") === "large"
        ? "large"
        : String(row?.layoutScale ?? "default") === "small"
          ? "small"
          : "default",
    showPerformancePanel: toBool(row?.showPerformancePanel, false),
    weatherMode: String(row?.weatherMode ?? "city") === "auto" ? "auto" : "city",
    weatherCity: String(row?.weatherCity ?? "Shanghai"),
  };
};

export const updateSiteConfig = async (env: Env, payload: SiteConfig) => {
  await ensureDatabase(env);
  await env.DB.prepare(
    "UPDATE nav_site_config SET noImageMode = ?, compactMode = ?, layoutScale = ?, showPerformancePanel = ?, weatherMode = ?, weatherCity = ? WHERE id = 1"
  ).bind(
    Number(payload.noImageMode),
    Number(payload.compactMode),
    payload.layoutScale === "large" ? "large" : payload.layoutScale === "small" ? "small" : "default",
    Number(payload.showPerformancePanel),
    payload.weatherMode === "auto" ? "auto" : "city",
    (payload.weatherCity || "Shanghai").trim() || "Shanghai"
  ).run();
};

export const listTools = async (env: Env): Promise<Tool[]> => {
  await ensureDatabase(env);
  const result = await env.DB.prepare(
    "SELECT id, name, url, logo, catelog, desc, sort, hide, accessPasswordHash FROM nav_table ORDER BY sort ASC, id ASC"
  ).all<Record<string, unknown>>();
  const rows = result.results ?? [];
  const resolvedLogos = await buildResolvedLogoMap(
    env,
    rows.map((row) => String(row.logo ?? ""))
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: normalizeToolField(row.name),
    // 公开列表里对加密书签只暴露占位信息，真实地址必须走单独解锁接口获取。
    url: row.accessPasswordHash ? "" : normalizeToolField(row.url),
    logo: normalizeToolField(row.logo),
    resolvedLogo: resolvedLogos.get(normalizeToolField(row.logo)),
    catelog: normalizeToolField(row.catelog),
    desc: normalizeToolField(row.desc),
    sort: Number(row.sort ?? 0),
    hide: toBool(row.hide, false),
    passwordProtected: Boolean(row.accessPasswordHash),
    locked: Boolean(row.accessPasswordHash),
  }));
};

export const listAdminTools = async (env: Env): Promise<Tool[]> => {
  await ensureDatabase(env);
  const result = await env.DB.prepare(
    "SELECT id, name, url, logo, catelog, desc, sort, hide, accessPasswordHash FROM nav_table ORDER BY sort ASC, id ASC"
  ).all<Record<string, unknown>>();
  const rows = result.results ?? [];
  const resolvedLogos = await buildResolvedLogoMap(
    env,
    rows.map((row) => String(row.logo ?? ""))
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: normalizeToolField(row.name),
    url: normalizeToolField(row.url),
    logo: normalizeToolField(row.logo),
    resolvedLogo: resolvedLogos.get(normalizeToolField(row.logo)),
    catelog: normalizeToolField(row.catelog),
    desc: normalizeToolField(row.desc),
    sort: Number(row.sort ?? 0),
    hide: toBool(row.hide, false),
    passwordProtected: Boolean(row.accessPasswordHash),
    locked: Boolean(row.accessPasswordHash),
  }));
};

export const addTool = async (env: Env, payload: Omit<Tool, "id">) => {
  await ensureDatabase(env);
  const accessPasswordHash =
    payload.accessPassword && payload.accessPassword.trim()
      ? await hashPassword(payload.accessPassword.trim())
      : null;
  const result = await env.DB.prepare(
    "INSERT INTO nav_table (name, url, logo, catelog, desc, sort, hide, accessPasswordHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    payload.name,
    payload.url,
    payload.logo,
    payload.catelog,
    payload.desc,
    payload.sort,
    Number(payload.hide),
    accessPasswordHash
  ).run();
  return Number(result.meta.last_row_id);
};

export const updateTool = async (env: Env, payload: Tool) => {
  await ensureDatabase(env);
  const oldRecord = await env.DB.prepare("SELECT accessPasswordHash FROM nav_table WHERE id = ?").bind(payload.id).first<{ accessPasswordHash?: string | null }>();
  let nextAccessPasswordHash = oldRecord?.accessPasswordHash ?? null;

  // 书签密码同样支持保留、覆盖、清空三种行为，避免后台编辑误删已有密码。
  if (payload.clearAccessPassword) {
    nextAccessPasswordHash = null;
  } else if (payload.accessPassword && payload.accessPassword.trim()) {
    nextAccessPasswordHash = await hashPassword(payload.accessPassword.trim());
  }

  await env.DB.prepare(
    "UPDATE nav_table SET name = ?, url = ?, logo = ?, catelog = ?, desc = ?, sort = ?, hide = ?, accessPasswordHash = ? WHERE id = ?"
  ).bind(
    payload.name,
    payload.url,
    payload.logo,
    payload.catelog,
    payload.desc,
    payload.sort,
    Number(payload.hide),
    nextAccessPasswordHash,
    payload.id
  ).run();
};

export const deleteTool = async (env: Env, id: number) => {
  await ensureDatabase(env);
  await env.DB.prepare("DELETE FROM nav_table WHERE id = ?").bind(id).run();
};

export const updateToolLogo = async (env: Env, id: number, logo: string) => {
  await ensureDatabase(env);
  await env.DB.prepare("UPDATE nav_table SET logo = ? WHERE id = ?").bind(logo, id).run();
};

export const verifyToolPassword = async (env: Env, id: number, password: string) => {
  await ensureDatabase(env);
  const row = await env.DB.prepare(
    "SELECT accessPasswordHash FROM nav_table WHERE id = ?"
  ).bind(id).first<{ accessPasswordHash?: string | null }>();
  if (!row) {
    return false;
  }
  if (!row.accessPasswordHash) {
    return true;
  }
  return verifyPassword(password, row.accessPasswordHash);
};

export const getToolUrlById = async (env: Env, id: number) => {
  await ensureDatabase(env);
  const row = await env.DB.prepare(
    "SELECT id, url FROM nav_table WHERE id = ?"
  ).bind(id).first<{ id: number; url: string }>();
  return row ?? null;
};

export const updateToolsSort = async (env: Env, updates: Array<{ id: number; sort: number }>) => {
  await ensureDatabase(env);
  await env.DB.batch(
    updates.map((item) =>
      env.DB.prepare("UPDATE nav_table SET sort = ? WHERE id = ?").bind(item.sort, item.id)
    )
  );
};

export const listCatelogs = async (env: Env): Promise<Catelog[]> => {
  await ensureDatabase(env);
  const result = await env.DB.prepare(
    "SELECT id, name, sort, hide, accessPasswordHash FROM nav_catelog WHERE name IS NOT NULL AND TRIM(name) != '' ORDER BY sort ASC, id ASC"
  ).all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    id: Number(row.id),
    name: String(row.name ?? ""),
    sort: Number(row.sort ?? 0),
    hide: toBool(row.hide, false),
    passwordProtected: Boolean(row.accessPasswordHash),
  }));
};

export const addCatelog = async (env: Env, payload: Omit<Catelog, "id">) => {
  await ensureDatabase(env);
  const exists = await env.DB.prepare("SELECT id FROM nav_catelog WHERE name = ?").bind(payload.name).first();
  if (exists || !payload.name.trim()) {
    return;
  }
  const accessPasswordHash =
    payload.accessPassword && payload.accessPassword.trim()
      ? await hashPassword(payload.accessPassword.trim())
      : null;
  await env.DB.prepare(
    "INSERT INTO nav_catelog (name, sort, hide, accessPasswordHash) VALUES (?, ?, ?, ?)"
  ).bind(payload.name, payload.sort, Number(payload.hide), accessPasswordHash).run();
};

export const updateCatelog = async (env: Env, payload: Catelog) => {
  await ensureDatabase(env);
  const oldRecord = await env.DB.prepare("SELECT name, accessPasswordHash FROM nav_catelog WHERE id = ?").bind(payload.id).first<{ name: string; accessPasswordHash?: string | null }>();
  let nextAccessPasswordHash = oldRecord?.accessPasswordHash ?? null;

  // 分类密码允许三种行为：保留现状、改成新密码、显式清空。
  if (payload.clearAccessPassword) {
    nextAccessPasswordHash = null;
  } else if (payload.accessPassword && payload.accessPassword.trim()) {
    nextAccessPasswordHash = await hashPassword(payload.accessPassword.trim());
  }

  await env.DB.prepare(
    "UPDATE nav_catelog SET name = ?, sort = ?, hide = ?, accessPasswordHash = ? WHERE id = ?"
  ).bind(payload.name, payload.sort, Number(payload.hide), nextAccessPasswordHash, payload.id).run();

  // 分类改名后需要同步工具记录，保持旧版后台行为一致。
  if (oldRecord && oldRecord.name !== payload.name) {
    await env.DB.prepare("UPDATE nav_table SET catelog = ? WHERE catelog = ?").bind(payload.name, oldRecord.name).run();
  }
};

export const deleteCatelog = async (env: Env, id: number) => {
  await ensureDatabase(env);
  await env.DB.prepare("DELETE FROM nav_catelog WHERE id = ?").bind(id).run();
};

export const verifyCatelogPassword = async (env: Env, id: number, password: string) => {
  await ensureDatabase(env);
  const row = await env.DB.prepare("SELECT accessPasswordHash FROM nav_catelog WHERE id = ?").bind(id).first<{ accessPasswordHash?: string | null }>();
  if (!row) {
    return false;
  }
  if (!row.accessPasswordHash) {
    return true;
  }
  return verifyPassword(password, row.accessPasswordHash);
};

export const listApiTokens = async (env: Env): Promise<Token[]> => {
  await ensureDatabase(env);
  const result = await env.DB.prepare(
    "SELECT id, name, value, disabled FROM nav_api_token WHERE disabled = 0 ORDER BY id ASC"
  ).all<Token>();
  return result.results ?? [];
};

export const addApiTokenRecord = async (env: Env, payload: Token) => {
  await ensureDatabase(env);
  await env.DB.prepare(
    "INSERT INTO nav_api_token (id, name, value, disabled) VALUES (?, ?, ?, ?)"
  ).bind(payload.id, payload.name, payload.value, payload.disabled).run();
};

export const disableApiToken = async (env: Env, id: number) => {
  await ensureDatabase(env);
  await env.DB.prepare("UPDATE nav_api_token SET disabled = 1 WHERE id = ?").bind(id).run();
};

export const hasApiToken = async (env: Env, value: string) => {
  await ensureDatabase(env);
  const row = await env.DB.prepare(
    "SELECT id FROM nav_api_token WHERE value = ? AND disabled = 0 LIMIT 1"
  ).bind(value).first();
  return Boolean(row);
};

export const updateUser = async (env: Env, payload: User) => {
  await ensureDatabase(env);
  await env.DB.prepare("UPDATE nav_user SET name = ?, password = ? WHERE id = ?").bind(
    payload.name,
    payload.password,
    payload.id
  ).run();
};

export const getPublicUserById = async (env: Env, id: number): Promise<PublicUser | null> => {
  await ensureDatabase(env);
  const row = await env.DB.prepare("SELECT id, name FROM nav_user WHERE id = ?").bind(id).first<PublicUser>();
  return row ?? null;
};

export const listSearchEngines = async (env: Env, enabledOnly = false): Promise<SearchEngine[]> => {
  await ensureDatabase(env);
  const sql = enabledOnly
    ? "SELECT id, name, baseUrl, queryParam, logo, sort, enabled FROM nav_search_engine WHERE enabled = 1 ORDER BY sort ASC, id ASC"
    : "SELECT id, name, baseUrl, queryParam, logo, sort, enabled FROM nav_search_engine ORDER BY sort ASC, id ASC";
  const result = await env.DB.prepare(sql).all<Record<string, unknown>>();
  return (result.results ?? []).map((row) => ({
    id: Number(row.id),
    name: String(row.name ?? ""),
    baseUrl: String(row.baseUrl ?? ""),
    queryParam: String(row.queryParam ?? ""),
    logo: String(row.logo ?? ""),
    sort: Number(row.sort ?? 0),
    enabled: toBool(row.enabled, true),
  }));
};

export const addSearchEngine = async (env: Env, payload: Omit<SearchEngine, "id" | "sort">) => {
  await ensureDatabase(env);
  const row = await env.DB.prepare("SELECT COALESCE(MAX(sort), 0) AS maxSort FROM nav_search_engine").first<{ maxSort: number }>();
  const result = await env.DB.prepare(
    "INSERT INTO nav_search_engine (name, baseUrl, queryParam, logo, sort, enabled) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(
    payload.name,
    payload.baseUrl,
    payload.queryParam,
    payload.logo,
    Number(row?.maxSort ?? 0) + 1,
    Number(payload.enabled)
  ).run();
  return Number(result.meta.last_row_id);
};

export const updateSearchEngine = async (env: Env, payload: SearchEngine) => {
  await ensureDatabase(env);
  await env.DB.prepare(
    "UPDATE nav_search_engine SET name = ?, baseUrl = ?, queryParam = ?, logo = ?, enabled = ? WHERE id = ?"
  ).bind(
    payload.name,
    payload.baseUrl,
    payload.queryParam,
    payload.logo,
    Number(payload.enabled),
    payload.id
  ).run();
};

export const deleteSearchEngine = async (env: Env, id: number) => {
  await ensureDatabase(env);
  await env.DB.prepare("DELETE FROM nav_search_engine WHERE id = ?").bind(id).run();
};

export const updateSearchEnginesSort = async (env: Env, updates: Array<{ id: number; sort: number }>) => {
  await ensureDatabase(env);
  await env.DB.batch(
    updates.map((item) =>
      env.DB.prepare("UPDATE nav_search_engine SET sort = ? WHERE id = ?").bind(item.sort, item.id)
    )
  );
};

export const getImageCache = async (env: Env, url: string): Promise<ImageCache | null> => {
  await ensureDatabase(env);
  const row = await env.DB.prepare(
    "SELECT id, url, value, contentType, sourceUrl, updatedAt FROM nav_img WHERE url = ? LIMIT 1"
  ).bind(url).first<ImageCache>();
  return row ?? null;
};

const IMAGE_CACHE_LOOKUP_CHUNK_SIZE = 64;

const buildResolvedLogoMap = async (env: Env, rawLogos: string[]) => {
  const logoMap = new Map<string, string>();
  const remoteLogos = Array.from(
    new Set(
      rawLogos
        .map((item) => item.trim())
        .filter((item) => item.startsWith("http://") || item.startsWith("https://"))
    )
  );

  rawLogos.forEach((logo) => {
    const normalizedLogo = String(logo ?? "").trim();
    if (!normalizedLogo || remoteLogos.includes(normalizedLogo)) {
      return;
    }
    // data URL 与站内静态路径可直接展示，不需要再走动态代理。
    logoMap.set(normalizedLogo, normalizedLogo);
  });

  if (remoteLogos.length === 0) {
    return logoMap;
  }

  for (let index = 0; index < remoteLogos.length; index += IMAGE_CACHE_LOOKUP_CHUNK_SIZE) {
    const chunk = remoteLogos.slice(index, index + IMAGE_CACHE_LOOKUP_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(", ");
    const result = await env.DB.prepare(
      `SELECT id, url, value, contentType, sourceUrl, updatedAt FROM nav_img WHERE url IN (${placeholders})`
    ).bind(...chunk).all<ImageCache>();

    (result.results ?? []).forEach((record) => {
      if (record.url && record.value) {
        // 缓存命中的远程图标直接切成本地资源地址，减少首页重复代理请求。
        logoMap.set(String(record.url), `/api/assets/${String(record.value)}`);
      }
    });
  }

  return logoMap;
};

export const upsertImageCache = async (
  env: Env,
  payload: { url: string; value: string; contentType: string; sourceUrl: string }
) => {
  await ensureDatabase(env);
  await env.DB.prepare(
    `INSERT INTO nav_img (url, value, contentType, sourceUrl, updatedAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       value = excluded.value,
       contentType = excluded.contentType,
       sourceUrl = excluded.sourceUrl,
       updatedAt = excluded.updatedAt`
  ).bind(payload.url, payload.value, payload.contentType, payload.sourceUrl, Date.now()).run();
};
