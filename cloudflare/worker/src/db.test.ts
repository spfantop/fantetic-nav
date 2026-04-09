import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./types";

type Row = Record<string, unknown>;

class FakeStatement {
  private readonly sql: string;
  private readonly db: FakeD1Database;
  private params: unknown[] = [];

  constructor(db: FakeD1Database, sql: string) {
    this.db = db;
    this.sql = sql.trim();
  }

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async run() {
    return this.db.executeRun(this.sql, this.params);
  }

  async first<T>() {
    return this.db.executeFirst<T>(this.sql);
  }

  async all<T>() {
    return this.db.executeAll<T>(this.sql, this.params);
  }
}

class FakeD1Database {
  private readonly columns = new Set([
    "id",
    "favicon",
    "title",
    "govRecord",
    "footerText",
    "footerLink",
    "logo192",
    "logo512",
    "hideAdmin",
    "hideGithub",
    "hideToggleJumpTarget",
    "jumpTargetBlank",
    "showMemo",
    "memoContent",
    "adminBackgroundUrl",
    "adminBackgroundLightUrl",
    "adminBackgroundDarkUrl",
    "lightThemeConfig",
    "darkThemeConfig",
  ]);
  private readonly catelogColumns = new Set(["id", "name", "sort", "hide"]);
  private readonly toolColumns = new Set(["id", "name", "url", "logo", "catelog", "desc", "sort", "hide"]);

  private settingRow: Row | null = null;
  private siteConfigColumns = new Set(["id", "noImageMode", "compactMode", "layoutScale"]);
  private siteConfigRow: Row | null = null;
  private searchEngineCount = 0;
  private catelogRows = new Map<number, Row>();
  private catelogId = 1;
  private toolRows = new Map<number, Row>();
  private toolId = 1;
  private imageCacheRows = new Map<string, Row>();

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }

  async batch(statements: FakeStatement[]) {
    for (const statement of statements) {
      await statement.run();
    }
    return [];
  }

  async executeRun(sql: string, params: unknown[]) {
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS") || sql.startsWith("CREATE INDEX IF NOT EXISTS")) {
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN showClock")) {
      this.columns.add("showClock");
      if (this.settingRow) {
        this.settingRow.showClock = 1;
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN showWeather")) {
      this.columns.add("showWeather");
      if (this.settingRow) {
        this.settingRow.showWeather = 1;
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN showMemo")) {
      this.columns.add("showMemo");
      if (this.settingRow) {
        this.settingRow.showMemo = 0;
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN memoContent")) {
      this.columns.add("memoContent");
      if (this.settingRow) {
        this.settingRow.memoContent = "";
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN fontFamily")) {
      this.columns.add("fontFamily");
      if (this.settingRow) {
        this.settingRow.fontFamily = "system";
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN footerText")) {
      this.columns.add("footerText");
      if (this.settingRow) {
        this.settingRow.footerText = "笔尖码动";
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN footerLink")) {
      this.columns.add("footerLink");
      if (this.settingRow) {
        this.settingRow.footerLink = "https://henniubi.com";
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN adminBackgroundUrl")) {
      this.columns.add("adminBackgroundUrl");
      if (this.settingRow) {
        this.settingRow.adminBackgroundUrl = "";
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN adminBackgroundLightUrl")) {
      this.columns.add("adminBackgroundLightUrl");
      if (this.settingRow) {
        this.settingRow.adminBackgroundLightUrl = "";
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN adminBackgroundDarkUrl")) {
      this.columns.add("adminBackgroundDarkUrl");
      if (this.settingRow) {
        this.settingRow.adminBackgroundDarkUrl = "";
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN lightThemeConfig")) {
      this.columns.add("lightThemeConfig");
      if (this.settingRow) {
        this.settingRow.lightThemeConfig = '{"pageBackground":"#f6f2e8"}';
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_setting ADD COLUMN darkThemeConfig")) {
      this.columns.add("darkThemeConfig");
      if (this.settingRow) {
        this.settingRow.darkThemeConfig = '{"pageBackground":"#121212"}';
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_catelog ADD COLUMN accessPasswordHash")) {
      this.catelogColumns.add("accessPasswordHash");
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_table ADD COLUMN accessPasswordHash")) {
      this.toolColumns.add("accessPasswordHash");
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_site_config ADD COLUMN showPerformancePanel")) {
      this.siteConfigColumns.add("showPerformancePanel");
      if (this.siteConfigRow) {
        this.siteConfigRow.showPerformancePanel = 0;
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_site_config ADD COLUMN layoutScale")) {
      this.siteConfigColumns.add("layoutScale");
      if (this.siteConfigRow) {
        this.siteConfigRow.layoutScale = "default";
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_site_config ADD COLUMN weatherMode")) {
      this.siteConfigColumns.add("weatherMode");
      if (this.siteConfigRow) {
        this.siteConfigRow.weatherMode = "city";
      }
      return { meta: {} };
    }

    if (sql.startsWith("ALTER TABLE nav_site_config ADD COLUMN weatherCity")) {
      this.siteConfigColumns.add("weatherCity");
      if (this.siteConfigRow) {
        this.siteConfigRow.weatherCity = "Shanghai";
      }
      return { meta: {} };
    }

    if (sql.includes("INSERT OR IGNORE INTO nav_setting")) {
      if (!this.settingRow) {
        this.settingRow = {
          id: 1,
          favicon: "favicon.ico",
          title: "Fantetic Nav",
          govRecord: "",
          footerText: "笔尖码动",
          footerLink: "https://henniubi.com",
          logo192: "logo192.png",
          logo512: "logo512.png",
          hideAdmin: 0,
          hideGithub: 0,
          hideToggleJumpTarget: 0,
          jumpTargetBlank: 1,
          showClock: 1,
          showWeather: 1,
          showMemo: 0,
          memoContent: "",
          fontFamily: "system",
          adminBackgroundUrl: "",
          adminBackgroundLightUrl: "",
          adminBackgroundDarkUrl: "",
          lightThemeConfig: '{"pageBackground":"#f6f2e8"}',
          darkThemeConfig: '{"pageBackground":"#121212"}',
        };
      }
      return { meta: {} };
    }

    if (sql.includes("INSERT OR IGNORE INTO nav_site_config")) {
      if (!this.siteConfigRow) {
        this.siteConfigRow = {
          id: 1,
          noImageMode: 0,
          compactMode: 0,
          layoutScale: "default",
          showPerformancePanel: 0,
          weatherMode: "city",
          weatherCity: "Shanghai",
        };
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_setting SET fontFamily = 'system'")) {
      if (this.settingRow) {
        this.settingRow.fontFamily = "system";
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_setting SET footerText = '笔尖码动'")) {
      if (this.settingRow) {
        this.settingRow.footerText = "笔尖码动";
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_setting SET footerLink = 'https://henniubi.com'")) {
      if (this.settingRow) {
        this.settingRow.footerLink = "https://henniubi.com";
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_setting SET memoContent = ''")) {
      if (this.settingRow) {
        this.settingRow.memoContent = "";
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_setting SET adminBackgroundUrl = ''")) {
      if (this.settingRow) {
        this.settingRow.adminBackgroundUrl = "";
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_setting SET adminBackgroundLightUrl = ''")) {
      if (this.settingRow) {
        this.settingRow.adminBackgroundLightUrl = "";
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_setting SET adminBackgroundDarkUrl = ''")) {
      if (this.settingRow) {
        this.settingRow.adminBackgroundDarkUrl = "";
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_setting SET lightThemeConfig =")) {
      if (this.settingRow) {
        this.settingRow.lightThemeConfig = '{"pageBackground":"#f6f2e8"}';
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_setting SET darkThemeConfig =")) {
      if (this.settingRow) {
        this.settingRow.darkThemeConfig = '{"pageBackground":"#121212"}';
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_setting")) {
      this.settingRow = {
        ...(this.settingRow ?? {}),
        favicon: params[0],
        title: params[1],
        govRecord: params[2],
        footerText: params[3],
        footerLink: params[4],
        logo192: params[5],
        logo512: params[6],
        hideAdmin: params[7],
        hideGithub: params[8],
        hideToggleJumpTarget: params[9],
        jumpTargetBlank: params[10],
        showClock: params[11],
        showWeather: params[12],
        showMemo: params[13],
        memoContent: params[14],
        fontFamily: params[15],
        adminBackgroundUrl: params[16],
        adminBackgroundLightUrl: params[17],
        adminBackgroundDarkUrl: params[18],
        lightThemeConfig: params[19],
        darkThemeConfig: params[20],
      };
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_site_config SET noImageMode = ?, compactMode = ?, layoutScale = ?, showPerformancePanel = ?, weatherMode = ?, weatherCity = ? WHERE id = 1")) {
      this.siteConfigRow = {
        ...(this.siteConfigRow ?? {}),
        noImageMode: params[0],
        compactMode: params[1],
        layoutScale: params[2],
        showPerformancePanel: params[3],
        weatherMode: params[4],
        weatherCity: params[5],
      };
      return { meta: {} };
    }

    if (sql.startsWith("INSERT INTO nav_catelog")) {
      this.catelogRows.set(this.catelogId, {
        id: this.catelogId,
        name: params[0],
        sort: params[1],
        hide: params[2],
        accessPasswordHash: params[3],
      });
      this.catelogId += 1;
      return { meta: { last_row_id: this.catelogId - 1 } };
    }

    if (sql.startsWith("INSERT INTO nav_table")) {
      this.toolRows.set(this.toolId, {
        id: this.toolId,
        name: params[0],
        url: params[1],
        logo: params[2],
        catelog: params[3],
        desc: params[4],
        sort: params[5],
        hide: params[6],
        accessPasswordHash: params[7],
      });
      this.toolId += 1;
      return { meta: { last_row_id: this.toolId - 1 } };
    }

    if (sql.startsWith("UPDATE nav_catelog SET name = ?, sort = ?, hide = ?, accessPasswordHash = ? WHERE id = ?")) {
      const current = this.catelogRows.get(Number(params[4]));
      if (current) {
        this.catelogRows.set(Number(params[4]), {
          ...current,
          name: params[0],
          sort: params[1],
          hide: params[2],
          accessPasswordHash: params[3],
        });
      }
      return { meta: {} };
    }

    if (sql.startsWith("UPDATE nav_table SET name = ?, url = ?, logo = ?, catelog = ?, desc = ?, sort = ?, hide = ?, accessPasswordHash = ? WHERE id = ?")) {
      const current = this.toolRows.get(Number(params[8]));
      if (current) {
        this.toolRows.set(Number(params[8]), {
          ...current,
          name: params[0],
          url: params[1],
          logo: params[2],
          catelog: params[3],
          desc: params[4],
          sort: params[5],
          hide: params[6],
          accessPasswordHash: params[7],
        });
      }
      return { meta: {} };
    }

    if (sql.startsWith("INSERT INTO nav_search_engine")) {
      this.searchEngineCount += 1;
      return { meta: { last_row_id: this.searchEngineCount } };
    }

    if (sql.startsWith("INSERT INTO nav_img")) {
      this.imageCacheRows.set(String(params[0]), {
        id: this.imageCacheRows.size + 1,
        url: params[0],
        value: params[1],
        contentType: params[2],
        sourceUrl: params[3],
        updatedAt: params[4],
      });
      return { meta: {} };
    }

    return { meta: {} };
  }

  async executeFirst<T>(sql: string) {
    if (sql.startsWith("SELECT COUNT(*) AS count FROM nav_search_engine")) {
      return { count: this.searchEngineCount } as T;
    }

    if (sql.startsWith("SELECT id, favicon, title, govRecord, footerText, footerLink, logo192, logo512, hideAdmin, hideGithub, hideToggleJumpTarget, jumpTargetBlank, showClock, showWeather, showMemo, memoContent, fontFamily, adminBackgroundUrl, adminBackgroundLightUrl, adminBackgroundDarkUrl, lightThemeConfig, darkThemeConfig FROM nav_setting")) {
      return this.settingRow as T;
    }

    if (sql.startsWith("SELECT id FROM nav_catelog WHERE name = ?")) {
      return null;
    }

    if (sql.startsWith("SELECT name, accessPasswordHash FROM nav_catelog WHERE id = ?")) {
      return this.catelogRows.get(1) as T;
    }

    if (sql.startsWith("SELECT accessPasswordHash FROM nav_catelog WHERE id = ?")) {
      return this.catelogRows.get(1) as T;
    }

    if (sql.startsWith("SELECT accessPasswordHash FROM nav_table WHERE id = ?")) {
      return this.toolRows.get(Number(this.toolRows.keys().next().value ?? 1)) as T;
    }

    if (sql.startsWith("SELECT id, url, value, contentType, sourceUrl, updatedAt FROM nav_img WHERE url = ? LIMIT 1")) {
      return this.imageCacheRows.values().next().value ?? null;
    }

    if (sql.startsWith("SELECT id, noImageMode, compactMode, layoutScale, showPerformancePanel, weatherMode, weatherCity FROM nav_site_config")) {
      return this.siteConfigRow as T;
    }

    return null;
  }

  async executeAll<T>(sql: string, params: unknown[] = []) {
    if (sql.startsWith("PRAGMA table_info(nav_setting)")) {
      return {
        results: Array.from(this.columns).map((name, index) => ({
          cid: index,
          name,
        })),
      } as T;
    }

    if (sql.startsWith("PRAGMA table_info(nav_catelog)")) {
      return {
        results: Array.from(this.catelogColumns).map((name, index) => ({
          cid: index,
          name,
        })),
      } as T;
    }

    if (sql.startsWith("PRAGMA table_info(nav_table)")) {
      return {
        results: Array.from(this.toolColumns).map((name, index) => ({
          cid: index,
          name,
        })),
      } as T;
    }

    if (sql.startsWith("PRAGMA table_info(nav_site_config)")) {
      return {
        results: Array.from(this.siteConfigColumns).map((name, index) => ({
          cid: index,
          name,
        })),
      } as T;
    }

    if (sql.startsWith("SELECT id, name, sort, hide, accessPasswordHash FROM nav_catelog")) {
      return {
        results: Array.from(this.catelogRows.values()),
      } as T;
    }

    if (sql.startsWith("SELECT id, name, url, logo, catelog, desc, sort, hide, accessPasswordHash FROM nav_table")) {
      return {
        results: Array.from(this.toolRows.values()),
      } as T;
    }

    if (sql.startsWith("SELECT id, url, value, contentType, sourceUrl, updatedAt FROM nav_img WHERE url IN (")) {
      return {
        results: params
          .map((item) => this.imageCacheRows.get(String(item)))
          .filter((item): item is Row => Boolean(item)),
      } as T;
    }

    return { results: [] } as T;
  }
}

const createEnv = () =>
  ({
    DB: new FakeD1Database(),
    LOGO_BUCKET: {} as Env["LOGO_BUCKET"],
    ASSETS: {} as Env["ASSETS"],
    JWT_SECRET: "test-secret",
  } as unknown as Env);

describe("db setting schema", () => {
  beforeEach(() => {
    // 每个测试都重载模块，避免 db.ts 顶层缓存的 initPromise 互相污染。
    vi.resetModules();
  });

  it("should expose showClock with default true after initialization", async () => {
    const env = createEnv();
    const { getSetting } = await import("./db");

    const setting = await getSetting(env);

    expect(setting.showClock).toBe(true);
    expect(setting.showWeather).toBe(true);
    expect(setting.fontFamily).toBe("system");
  });

  it("should persist showClock when updating settings", async () => {
    const env = createEnv();
    const { getSetting, updateSetting } = await import("./db");

    const initialSetting = await getSetting(env);
    await updateSetting(env, { ...initialSetting, showClock: false, showWeather: false, fontFamily: "serif" });
    const updatedSetting = await getSetting(env);

    expect(updatedSetting.showClock).toBe(false);
    expect(updatedSetting.showWeather).toBe(false);
    expect(updatedSetting.fontFamily).toBe("serif");
  });

  it("should expose footer config with defaults and persist changes", async () => {
    const env = createEnv();
    const { getSetting, updateSetting } = await import("./db");

    const initialSetting = await getSetting(env);
    expect(initialSetting.footerText).toBe("笔尖码动");
    expect(initialSetting.footerLink).toBe("https://henniubi.com");

    await updateSetting(env, { ...initialSetting, footerText: "我的站点", footerLink: "https://example.com" });
    const updatedSetting = await getSetting(env);

    expect(updatedSetting.footerText).toBe("我的站点");
    expect(updatedSetting.footerLink).toBe("https://example.com");
  });

  it("should expose memo config with defaults and persist changes", async () => {
    const env = createEnv();
    const { getSetting, updateSetting } = await import("./db");

    const initialSetting = await getSetting(env);
    expect(initialSetting["showMemo"]).toBe(false);
    expect(initialSetting["memoContent"]).toBe("");

    await updateSetting(env, {
      ...initialSetting,
      showMemo: true,
      memoContent: "记得更新图标",
    } as any);
    const updatedSetting = await getSetting(env);

    expect(updatedSetting["showMemo"]).toBe(true);
    expect(updatedSetting["memoContent"]).toBe("记得更新图标");
  });

  it("should expose admin background config with defaults and persist changes", async () => {
    const env = createEnv();
    const { getSetting, updateSetting } = await import("./db");

    const initialSetting = await getSetting(env);
    expect(initialSetting["adminBackgroundUrl"]).toBe("");

    await updateSetting(env, {
      ...initialSetting,
      adminBackgroundUrl: "/api/assets/admin/background/demo.webp",
    } as any);
    const updatedSetting = await getSetting(env);

    expect(updatedSetting["adminBackgroundUrl"]).toBe("/api/assets/admin/background/demo.webp");
  });

  it("should expose light and dark appearance config with defaults and persist changes", async () => {
    const env = createEnv();
    const { getSetting, updateSetting } = await import("./db");

    const initialSetting = await getSetting(env);
    expect(initialSetting["adminBackgroundLightUrl"]).toBe("");
    expect(initialSetting["adminBackgroundDarkUrl"]).toBe("");
    expect(initialSetting["lightThemeConfig"]).toContain("pageBackground");
    expect(initialSetting["darkThemeConfig"]).toContain("pageBackground");

    await updateSetting(env, {
      ...initialSetting,
      adminBackgroundLightUrl: "/api/assets/admin/background/light.webp",
      adminBackgroundDarkUrl: "/api/assets/admin/background/dark.webp",
      lightThemeConfig: JSON.stringify({ pageBackground: "#f0eadc", primaryColor: "#a87942" }),
      darkThemeConfig: JSON.stringify({ pageBackground: "#101010", primaryColor: "#d0a56a" }),
    } as any);
    const updatedSetting = await getSetting(env);

    expect(updatedSetting["adminBackgroundLightUrl"]).toBe("/api/assets/admin/background/light.webp");
    expect(updatedSetting["adminBackgroundDarkUrl"]).toBe("/api/assets/admin/background/dark.webp");
    expect(updatedSetting["lightThemeConfig"]).toContain("#f0eadc");
    expect(updatedSetting["darkThemeConfig"]).toContain("#101010");
  });

  it("should expose performance panel flag in site config and persist changes", async () => {
    const env = createEnv();
    const { getSiteConfig, updateSiteConfig } = await import("./db");

    const initialConfig = await getSiteConfig(env);
    expect(initialConfig.showPerformancePanel).toBe(false);

    await updateSiteConfig(env, { ...initialConfig, noImageMode: true, compactMode: true, showPerformancePanel: true });
    const updatedConfig = await getSiteConfig(env);

    expect(updatedConfig.noImageMode).toBe(true);
    expect(updatedConfig.compactMode).toBe(true);
    expect(updatedConfig.showPerformancePanel).toBe(true);
  });

  it("should expose weather config in site config and persist changes", async () => {
    const env = createEnv();
    const { getSiteConfig, updateSiteConfig } = await import("./db");

    const initialConfig = await getSiteConfig(env);
    expect(initialConfig.weatherMode).toBe("city");
    expect(initialConfig.weatherCity).toBe("Shanghai");

    await updateSiteConfig(env, {
      ...initialConfig,
      weatherMode: "auto",
      weatherCity: "Hangzhou",
    });
    const updatedConfig = await getSiteConfig(env);

    expect(updatedConfig.weatherMode).toBe("auto");
    expect(updatedConfig.weatherCity).toBe("Hangzhou");
  });

  it("should expose layout scale in site config and persist changes", async () => {
    const env = createEnv();
    const { getSiteConfig, updateSiteConfig } = await import("./db");

    const initialConfig = await getSiteConfig(env);
    expect(initialConfig["layoutScale"]).toBe("default");

    await updateSiteConfig(env, {
      ...initialConfig,
      layoutScale: "large",
    } as any);
    const updatedConfig = await getSiteConfig(env);

    expect(updatedConfig["layoutScale"]).toBe("large");
  });

  it("should hash category password and verify it on unlock", async () => {
    const env = createEnv();
    const { addCatelog, verifyCatelogPassword, listCatelogs } = await import("./db");

    await addCatelog(env, {
      name: "受限分类",
      sort: 1,
      hide: false,
      passwordProtected: true,
      accessPassword: "123456",
    });

    const catelogs = await listCatelogs(env);
    expect(catelogs[0]?.passwordProtected).toBe(true);
    await expect(verifyCatelogPassword(env, 1, "123456")).resolves.toBe(true);
    await expect(verifyCatelogPassword(env, 1, "wrong")).resolves.toBe(false);
  });

  it("should hash tool password and verify it on unlock", async () => {
    const env = createEnv();
    const { addTool, listTools, verifyToolPassword } = await import("./db");

    await addTool(env, {
      name: "受限书签",
      url: "https://example.com/private",
      logo: "",
      catelog: "私密",
      desc: "需要密码",
      sort: 1,
      hide: false,
      passwordProtected: true,
      accessPassword: "tool-secret",
    });

    const tools = await listTools(env);
    expect(tools[0]?.passwordProtected).toBe(true);
    await expect(verifyToolPassword(env, 1, "tool-secret")).resolves.toBe(true);
    await expect(verifyToolPassword(env, 1, "wrong")).resolves.toBe(false);
  });

  it("should keep locked tool url hidden in public list data", async () => {
    const env = createEnv();
    const { addTool, listTools } = await import("./db");

    await addTool(env, {
      name: "公开书签",
      url: "https://example.com/public",
      logo: "",
      catelog: "默认",
      desc: "公开",
      sort: 1,
      hide: false,
    });
    await addTool(env, {
      name: "加密书签",
      url: "https://example.com/secret",
      logo: "",
      catelog: "默认",
      desc: "加密",
      sort: 2,
      hide: false,
      passwordProtected: true,
      accessPassword: "secret",
    });

    const tools = await listTools(env);
    const lockedTool = tools.find((item) => item.name === "加密书签");

    expect(lockedTool?.url).toBe("");
    expect(lockedTool?.passwordProtected).toBe(true);
    expect(lockedTool?.locked).toBe(true);
  });

  it("should expose resolvedLogo as local asset path when remote logo cache exists", async () => {
    const env = createEnv();
    const { addTool, listTools, upsertImageCache } = await import("./db");

    await addTool(env, {
      name: "远程图标",
      url: "https://example.com",
      logo: "https://cdn.example.com/icon.png",
      catelog: "默认",
      desc: "带缓存图标",
      sort: 1,
      hide: false,
    });
    await upsertImageCache(env, {
      url: "https://cdn.example.com/icon.png",
      value: "logos/cache-icon.png",
      contentType: "image/png",
      sourceUrl: "https://cdn.example.com/icon.png",
    });

    const tools = await listTools(env);

    expect(tools[0]?.logo).toBe("https://cdn.example.com/icon.png");
    expect(tools[0]?.resolvedLogo).toBe("/api/assets/logos/cache-icon.png");
  });

  it("should keep remote logo unresolved when cache record does not exist", async () => {
    const env = createEnv();
    const { addTool, listTools } = await import("./db");

    await addTool(env, {
      name: "未缓存图标",
      url: "https://example.com",
      logo: "https://cdn.example.com/miss.png",
      catelog: "默认",
      desc: "未命中缓存",
      sort: 1,
      hide: false,
    });

    const tools = await listTools(env);

    expect(tools[0]?.logo).toBe("https://cdn.example.com/miss.png");
    expect(tools[0]?.resolvedLogo).toBeUndefined();
  });

  it("should resolve cached logos in chunks when there are many remote icons", async () => {
    const env = createEnv();
    const { addTool, listTools, upsertImageCache } = await import("./db");

    for (let index = 0; index < 140; index += 1) {
      const logoUrl = `https://cdn.example.com/icon-${index}.png`;
      await addTool(env, {
        name: `书签-${index}`,
        url: `https://example.com/${index}`,
        logo: logoUrl,
        catelog: "默认",
        desc: "批量图标",
        sort: index + 1,
        hide: false,
      });
      await upsertImageCache(env, {
        url: logoUrl,
        value: `logos/cache-icon-${index}.png`,
        contentType: "image/png",
        sourceUrl: logoUrl,
      });
    }

    const tools = await listTools(env);

    expect(tools).toHaveLength(140);
    expect(tools[0]?.resolvedLogo).toBe("/api/assets/logos/cache-icon-0.png");
    expect(tools[139]?.resolvedLogo).toBe("/api/assets/logos/cache-icon-139.png");
  });

  it("should trim dirty tool fields before exposing them to the frontend", async () => {
    const env = createEnv();
    const { addTool, listTools, upsertImageCache } = await import("./db");

    await addTool(env, {
      name: "  脏数据书签  ",
      url: " https://example.com/dirty ",
      logo: " https://cdn.example.com/dirty.png ",
      catelog: " 工具 ",
      desc: " 描述 ",
      sort: 1,
      hide: false,
    });
    await upsertImageCache(env, {
      url: "https://cdn.example.com/dirty.png",
      value: "logos/dirty.png",
      contentType: "image/png",
      sourceUrl: "https://cdn.example.com/dirty.png",
    });

    const tools = await listTools(env);

    expect(tools[0]?.name).toBe("脏数据书签");
    expect(tools[0]?.url).toBe("https://example.com/dirty");
    expect(tools[0]?.logo).toBe("https://cdn.example.com/dirty.png");
    expect(tools[0]?.catelog).toBe("工具");
    expect(tools[0]?.resolvedLogo).toBe("/api/assets/logos/dirty.png");
  });
});
