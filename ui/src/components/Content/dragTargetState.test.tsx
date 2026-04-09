import { render, screen } from "@testing-library/react";
import EditableCard from "./EditableCard";
import EditableTag from "./EditableTag";

describe("drag target state", () => {
  it("renders target class for editable card when it is the current drop target", () => {
    render(
      <EditableCard
        id="1"
        item={{ id: 1, name: "示例", logo: "", desc: "", catelog: "开发" }}
        index={0}
        noImageMode
        compactMode={false}
        jiggle={false}
        target
        onClick={() => undefined}
        onPointerDown={() => undefined}
        onPointerUp={() => undefined}
        onPointerLeave={() => undefined}
        onContextMenu={() => undefined}
      />,
    );

    expect(screen.getByText("示例").closest(".editable-card-box")).toHaveClass("editable-card-box-target");
  });

  it("renders target class for editable tag when it is the current drop target", () => {
    render(
      <EditableTag
        id="tag-1"
        label="开发"
        active={false}
        jiggle={false}
        target
        onClick={() => undefined}
        onPointerDown={() => undefined}
        onPointerUp={() => undefined}
        onPointerLeave={() => undefined}
        onContextMenu={() => undefined}
      />,
    );

    expect(screen.getByText("开发").closest(".select-tag")).toHaveClass("editable-tag-target");
  });
});
