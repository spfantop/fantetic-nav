import { hasSyntheticAdminEquivalent } from "./homepageTools";

describe("api homepage helpers", () => {
  it("detects an existing admin shortcut so the synthetic card is not duplicated", () => {
    expect(
      hasSyntheticAdminEquivalent([
        { id: 1, name: "本站管理后台", url: "/tools/admin" },
      ]),
    ).toBe(true);

    expect(
      hasSyntheticAdminEquivalent([
        { id: 2, name: "控制台", url: "/login/" },
      ]),
    ).toBe(true);
  });

  it("allows injecting the synthetic admin shortcut when no equivalent card exists", () => {
    expect(
      hasSyntheticAdminEquivalent([
        { id: 3, name: "开发文档", url: "/docs" },
      ]),
    ).toBe(false);
  });
});
