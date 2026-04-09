import { getLayoutScaleFactor, normalizeLayoutScale, scaleVirtualRowHeight } from "./layoutScale";

describe("layoutScale", () => {
  it("should normalize unknown values to default", () => {
    expect(normalizeLayoutScale(undefined)).toBe("default");
    expect(normalizeLayoutScale("weird")).toBe("default");
  });

  it("should keep supported layout scale values", () => {
    expect(normalizeLayoutScale("small")).toBe("small");
    expect(normalizeLayoutScale("default")).toBe("default");
    expect(normalizeLayoutScale("large")).toBe("large");
  });

  it("should scale virtual row height consistently", () => {
    expect(getLayoutScaleFactor("small")).toBe(0.9);
    expect(getLayoutScaleFactor("default")).toBe(1);
    expect(getLayoutScaleFactor("large")).toBe(1.1);
    expect(scaleVirtualRowHeight(100, "small")).toBe(90);
    expect(scaleVirtualRowHeight(100, "large")).toBe(110);
  });
});
