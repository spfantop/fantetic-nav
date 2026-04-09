// 统一维护全局字体预设，前台与后台共用同一份配置，避免出现设置页和实际渲染不一致。
export const FONT_FAMILY_PRESETS: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  sans: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
  serif: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif',
  rounded: '"HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  handwriting: '"LXGW WenKai", "STKaiti", "KaiTi", serif',
  sourceHanSans: '"Source Han Sans SC", "Noto Sans CJK SC", "Noto Sans SC", "PingFang SC", sans-serif',
  harmony: '"HarmonyOS Sans SC", "HarmonyOS Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
  pingfang: '"PingFang SC", "Hiragino Sans GB", "Helvetica Neue", sans-serif',
};

export const FONT_FAMILY_OPTIONS = [
  { label: "系统默认", value: "system" },
  { label: "现代黑体", value: "sans" },
  { label: "衬线书卷", value: "serif" },
  { label: "圆角简洁", value: "rounded" },
  { label: "楷意手写", value: "handwriting" },
  { label: "思源黑体", value: "sourceHanSans" },
  { label: "鸿蒙字体", value: "harmony" },
  { label: "苹果苹方", value: "pingfang" },
];

export const FONT_FAMILY_CHANGE_EVENT = "app-font-family-change";

export const resolveFontFamily = (fontFamily?: string) => {
  if (!fontFamily) {
    return FONT_FAMILY_PRESETS.system;
  }
  return FONT_FAMILY_PRESETS[fontFamily] ?? FONT_FAMILY_PRESETS.system;
};

export const applyGlobalFontFamily = (fontFamily?: string) => {
  const resolved = resolveFontFamily(fontFamily);
  document.documentElement.style.setProperty("--app-font-family", resolved);
  document.body.style.fontFamily = resolved;
  if (fontFamily) {
    window.localStorage.setItem("fontFamily", fontFamily);
  }
  window.dispatchEvent(
    new CustomEvent(FONT_FAMILY_CHANGE_EVENT, {
      detail: {
        fontFamily: fontFamily || "system",
        resolved,
      },
    })
  );
};

export const readSavedFontFamily = () => {
  return window.localStorage.getItem("fontFamily") || "system";
};
