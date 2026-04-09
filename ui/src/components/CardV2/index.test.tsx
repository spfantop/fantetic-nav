import { render, screen } from "@testing-library/react";
import Card from "./index";

jest.mock("../../utils/setting", () => ({
  getJumpTarget: () => "self",
}));

describe("CardV2 logo source", () => {
  it("prefers resolvedLogo when the worker has already localized the icon", () => {
    render(
      <Card
        title="示例"
        titleText="示例"
        url="https://example.com"
        des="描述"
        logo="https://cdn.example.com/original.png"
        resolvedLogo="/api/assets/logos/cached.png"
        catelog="开发"
        onClick={() => undefined}
        index={0}
        isSearching={false}
        noImageMode={false}
        compactMode={false}
      />,
    );

    expect(screen.getByAltText("示例")).toHaveAttribute("src", "/api/assets/logos/cached.png");
  });

  it("falls back to legacy proxy url when resolvedLogo is missing", () => {
    render(
      <Card
        title="示例"
        titleText="示例"
        url="https://example.com"
        des="描述"
        logo="https://cdn.example.com/original.png"
        resolvedLogo={undefined}
        catelog="开发"
        onClick={() => undefined}
        index={0}
        isSearching={false}
        noImageMode={false}
        compactMode={false}
      />,
    );

    expect(screen.getByAltText("示例")).toHaveAttribute("src", "/api/img?url=https://cdn.example.com/original.png");
  });
});
