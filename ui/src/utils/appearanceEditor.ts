import {
  DEFAULT_DARK_THEME_PALETTE,
  DEFAULT_LIGHT_THEME_PALETTE,
  type ThemePalette,
} from "./appearance";

export const COMPACT_THEME_FIELDS = [
  { key: "pageBackground", label: "页面底色" },
  { key: "cardBackground", label: "卡片底色" },
  { key: "cardBorder", label: "卡片边框" },
  { key: "textPrimary", label: "主文字" },
  { key: "textSecondary", label: "次文字" },
  { key: "tagBackground", label: "标签底色" },
  { key: "primaryColor", label: "强调色" },
  { key: "primaryText", label: "强调字色" },
  { key: "tagActiveBackground", label: "标签激活" },
  { key: "inputBackground", label: "搜索底色" },
  { key: "inputBorder", label: "搜索边框" },
  { key: "inputFocus", label: "搜索高亮" },
] as const;

type CompactThemeFieldKey = (typeof COMPACT_THEME_FIELDS)[number]["key"];

export type CompactThemePalette = Pick<ThemePalette, CompactThemeFieldKey>;

const toColorString = (value: any) => {
  if (value && typeof value === "object" && typeof value.toRgbString === "function") {
    return value.toRgbString();
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return "";
};

export const pickCompactThemePalette = (palette: ThemePalette): CompactThemePalette => ({
  pageBackground: palette.pageBackground,
  cardBackground: palette.cardBackground,
  cardBorder: palette.cardBorder,
  textPrimary: palette.textPrimary,
  textSecondary: palette.textSecondary,
  tagBackground: palette.tagBackground,
  primaryColor: palette.primaryColor,
  primaryText: palette.primaryText,
  tagActiveBackground: palette.tagActiveBackground,
  inputBackground: palette.inputBackground,
  inputBorder: palette.inputBorder,
  inputFocus: palette.inputFocus,
});

export const normalizePaletteWithEditableFields = (
  palette: Record<string, any>,
  fallback: ThemePalette,
) => {
  const nextPalette = { ...fallback };
  COMPACT_THEME_FIELDS.forEach(({ key }) => {
    const nextValue = toColorString(palette?.[key]);
    if (nextValue) {
      nextPalette[key] = nextValue;
    }
  });
  return nextPalette;
};

export const buildEditableThemeFormValues = (setting: any) => ({
  lightThemePalette: pickCompactThemePalette({
    ...DEFAULT_LIGHT_THEME_PALETTE,
    ...(setting?.lightThemePalette || {}),
  }),
  darkThemePalette: pickCompactThemePalette({
    ...DEFAULT_DARK_THEME_PALETTE,
    ...(setting?.darkThemePalette || {}),
  }),
});
