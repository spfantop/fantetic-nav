export type LayoutScale = "large" | "default" | "small";

export const normalizeLayoutScale = (value: unknown): LayoutScale => {
  if (value === "large" || value === "small") {
    return value;
  }
  return "default";
};

export const getLayoutScaleFactor = (scale: LayoutScale) => {
  if (scale === "large") {
    return 1.1;
  }
  if (scale === "small") {
    return 0.9;
  }
  return 1;
};

export const scaleVirtualRowHeight = (baseHeight: number, scale: LayoutScale) => {
  return Math.round(baseHeight * getLayoutScaleFactor(scale));
};
