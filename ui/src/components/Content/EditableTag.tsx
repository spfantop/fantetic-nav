import React, { memo } from "react";

interface EditableTagProps {
  id: string;
  label: React.ReactNode;
  active: boolean;
  jiggle: boolean;
  jiggleVariant?: "base" | "alt";
  dragging?: boolean;
  placeholder?: boolean;
  floating?: boolean;
  target?: boolean;
  tagRef?: (node: HTMLSpanElement | null) => void;
  dragStyle?: React.CSSProperties;
  onClick: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLSpanElement>) => void;
}

export const EditableTag: React.FC<EditableTagProps> = ({
  id,
  label,
  active,
  jiggle,
  jiggleVariant = "base",
  dragging = false,
  placeholder = false,
  floating = false,
  target = false,
  tagRef,
  dragStyle,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onContextMenu,
}) => {
  return (
    <span
      ref={tagRef}
      data-tag-id={id}
      style={dragStyle}
      className={`select-tag ${active ? "select-tag-active" : ""} ${dragging ? "editable-tag-dragging" : ""} ${placeholder ? "editable-tag-placeholder" : ""} ${floating ? "editable-tag-floating" : ""} ${target ? "editable-tag-target" : ""}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={() => {
        onPointerUp();
      }}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
    >
      <span className={`tag-item-shell ${jiggle && !dragging ? `jiggle-item ${jiggleVariant === "alt" ? "jiggle-item-alt" : ""}` : ""}`}>
        {label}
      </span>
    </span>
  );
};

export default memo(EditableTag);
