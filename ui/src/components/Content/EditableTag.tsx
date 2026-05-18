import React, { memo } from "react";

interface EditableTagProps {
  id: string;
  label: string;
  active: boolean;
  dragging?: boolean;
  target?: boolean;
  tagRef?: (node: HTMLSpanElement | null) => void;
  onClick: () => void;
  onDragStart: (event: React.DragEvent<HTMLSpanElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLSpanElement>) => void;
  onDragEnd: (event: React.DragEvent<HTMLSpanElement>) => void;
}

const EditableTag: React.FC<EditableTagProps> = ({
  id,
  label,
  active,
  dragging = false,
  target = false,
  tagRef,
  onClick,
  onDragStart,
  onDragOver,
  onDragEnd,
}) => {
  return (
    <span
      ref={tagRef}
      data-edit-tag-id={id}
      className={`select-tag editable-tag ${active ? "select-tag-active" : ""} ${dragging ? "is-dragging" : ""} ${target ? "is-target" : ""}`}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <span className="editable-tag-label">{label}</span>
    </span>
  );
};

export default memo(EditableTag);
