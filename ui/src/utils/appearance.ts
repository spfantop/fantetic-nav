export type ThemePalette = {
  pageBackground: string;
  panelBackground: string;
  cardBackground: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  tagBackground: string;
  tagActiveBackground: string;
  inputBackground: string;
  inputBorder: string;
  inputFocus: string;
  primaryColor: string;
  primaryText: string;
  adminHeaderBackground: string;
  adminSidebarBackground: string;
};

export const DEFAULT_LIGHT_THEME_PALETTE: ThemePalette = {
  // 亮色主题改成更清透的暖米白基底，后台页能拉开顶部、侧栏和内容区的层次。
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
};

export const DEFAULT_DARK_THEME_PALETTE: ThemePalette = {
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
};

export const APPEARANCE_CHANGE_EVENT = "app-appearance-change";

const getDefaultPalette = (mode: "light" | "dark") =>
  mode === "dark" ? DEFAULT_DARK_THEME_PALETTE : DEFAULT_LIGHT_THEME_PALETTE;

export const parseThemePalette = (raw: string | undefined, mode: "light" | "dark"): ThemePalette => {
  const fallback = getDefaultPalette(mode);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ThemePalette>;
    return {
      ...fallback,
      ...parsed,
    };
  } catch {
    return fallback;
  }
};

const applyPaletteVariables = (palette: ThemePalette) => {
  const root = document.documentElement;
  root.style.setProperty("--theme-page-bg", palette.pageBackground);
  root.style.setProperty("--theme-panel-bg", palette.panelBackground);
  root.style.setProperty("--theme-card-bg", palette.cardBackground);
  root.style.setProperty("--theme-card-border", palette.cardBorder);
  root.style.setProperty("--theme-text-primary", palette.textPrimary);
  root.style.setProperty("--theme-text-secondary", palette.textSecondary);
  root.style.setProperty("--theme-tag-bg", palette.tagBackground);
  root.style.setProperty("--theme-tag-active-bg", palette.tagActiveBackground);
  root.style.setProperty("--theme-input-bg", palette.inputBackground);
  root.style.setProperty("--theme-input-border", palette.inputBorder);
  root.style.setProperty("--theme-input-focus", palette.inputFocus);
  root.style.setProperty("--theme-primary", palette.primaryColor);
  root.style.setProperty("--theme-primary-text", palette.primaryText);
  root.style.setProperty("--theme-admin-header-bg", palette.adminHeaderBackground);
  root.style.setProperty("--theme-admin-sidebar-bg", palette.adminSidebarBackground);
};

export const applyAppearanceSettings = (
  setting:
    | {
        adminBackgroundUrl?: string;
        adminBackgroundLightUrl?: string;
        adminBackgroundDarkUrl?: string;
        lightThemeConfig?: string;
        darkThemeConfig?: string;
      }
    | undefined,
  isDarkMode: boolean
) => {
  const mode = isDarkMode ? "dark" : "light";
  const palette = parseThemePalette(
    isDarkMode ? setting?.darkThemeConfig : setting?.lightThemeConfig,
    mode
  );
  const root = document.documentElement;
  const backgroundUrl = isDarkMode
    ? setting?.adminBackgroundDarkUrl || setting?.adminBackgroundUrl || ""
    : setting?.adminBackgroundLightUrl || setting?.adminBackgroundUrl || "";

  applyPaletteVariables(palette);
  root.style.setProperty("--theme-background-image", backgroundUrl ? `url("${backgroundUrl}")` : "none");
  root.style.setProperty("--admin-background-image", backgroundUrl ? `url("${backgroundUrl}")` : "none");
};
