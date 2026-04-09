import {
  applyAppearanceSettings,
  DEFAULT_DARK_THEME_PALETTE,
  DEFAULT_LIGHT_THEME_PALETTE,
  parseThemePalette,
} from "./appearance";

describe("appearance", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
  });

  it("falls back to default palette when config is missing", () => {
    expect(parseThemePalette("", "light")).toEqual(DEFAULT_LIGHT_THEME_PALETTE);
    expect(parseThemePalette("", "dark")).toEqual(DEFAULT_DARK_THEME_PALETTE);
  });

  it("uses the refined light admin palette by default", () => {
    // 后台亮色默认值需要保持更亮的页面基底和更明确的后台层级，避免界面发灰发闷。
    expect(DEFAULT_LIGHT_THEME_PALETTE.pageBackground).toBe("#f6f2e8");
    expect(DEFAULT_LIGHT_THEME_PALETTE.cardBackground).toBe("rgba(255, 252, 247, 0.92)");
    expect(DEFAULT_LIGHT_THEME_PALETTE.adminHeaderBackground).toBe("rgba(255, 248, 239, 0.88)");
    expect(DEFAULT_LIGHT_THEME_PALETTE.adminSidebarBackground).toBe("rgba(247, 237, 221, 0.9)");
  });

  it("merges saved palette with defaults", () => {
    const palette = parseThemePalette(JSON.stringify({ pageBackground: "#fff000" }), "light");

    expect(palette.pageBackground).toBe("#fff000");
    expect(palette.primaryColor).toBe(DEFAULT_LIGHT_THEME_PALETTE.primaryColor);
  });

  it("applies current mode palette and background urls to css variables", () => {
    applyAppearanceSettings(
      {
        adminBackgroundLightUrl: "/light.webp",
        adminBackgroundDarkUrl: "/dark.webp",
        lightThemeConfig: JSON.stringify({ pageBackground: "#f8f0e0", primaryColor: "#aa8844" }),
        darkThemeConfig: JSON.stringify({ pageBackground: "#12100f", primaryColor: "#cc9966" }),
      },
      true
    );

    expect(document.documentElement.style.getPropertyValue("--theme-page-bg")).toBe("#12100f");
    expect(document.documentElement.style.getPropertyValue("--theme-primary")).toBe("#cc9966");
    expect(document.documentElement.style.getPropertyValue("--admin-background-image")).toBe('url("/dark.webp")');
  });
});
