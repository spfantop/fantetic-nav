import {
  buildEditableThemeFormValues,
  normalizePaletteWithEditableFields,
  pickCompactThemePalette,
} from "./appearanceEditor";
import { DEFAULT_LIGHT_THEME_PALETTE } from "./appearance";

describe("appearanceEditor", () => {
  it("keeps only the compact editable theme fields", () => {
    const compact = pickCompactThemePalette(DEFAULT_LIGHT_THEME_PALETTE);

    expect(compact.pageBackground).toBe(DEFAULT_LIGHT_THEME_PALETTE.pageBackground);
    expect(compact.tagBackground).toBe(DEFAULT_LIGHT_THEME_PALETTE.tagBackground);
    expect(compact.inputBackground).toBe(DEFAULT_LIGHT_THEME_PALETTE.inputBackground);
    expect(compact.primaryColor).toBe(DEFAULT_LIGHT_THEME_PALETTE.primaryColor);
    expect("panelBackground" in compact).toBe(false);
  });

  it("merges compact edits back onto the full palette", () => {
    const merged = normalizePaletteWithEditableFields(
      {
        pageBackground: "#ffffff",
        primaryColor: "#cc8844",
      },
      DEFAULT_LIGHT_THEME_PALETTE,
    );

    expect(merged.pageBackground).toBe("#ffffff");
    expect(merged.primaryColor).toBe("#cc8844");
    expect(merged.panelBackground).toBe(DEFAULT_LIGHT_THEME_PALETTE.panelBackground);
  });

  it("builds form defaults from the current light and dark palette snapshots", () => {
    const values = buildEditableThemeFormValues({
      lightThemePalette: {
        ...DEFAULT_LIGHT_THEME_PALETTE,
        textPrimary: "#111111",
      },
    });

    expect(values.lightThemePalette.textPrimary).toBe("#111111");
    expect(values.darkThemePalette.primaryColor).toBeDefined();
  });
});
