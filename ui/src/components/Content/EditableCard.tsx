import React, { memo } from "react";
import CardV2 from "../CardV2";

interface EditableCardProps {
  item: any;
  index: number;
  isSearching: boolean;
  noImageMode: boolean;
  compactMode: boolean;
  dragging?: boolean;
  placeholder?: boolean;
  target?: boolean;
  cardRef?: (node: HTMLDivElement | null) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: (event: React.DragEvent<HTMLDivElement>) => void;
  onClickCapture?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const EditableCard: React.FC<EditableCardProps> = ({
  item,
  index,
  isSearching,
  noImageMode,
  compactMode,
  dragging = false,
  placeholder = false,
  target = false,
  cardRef,
  onDragStart,
  onDragOver,
  onDragEnd,
  onClickCapture,
}) => {
  return (
    <div
      ref={cardRef}
      data-edit-card-id={String(item.id)}
      className={`editable-card-shell ${dragging ? "is-dragging" : ""} ${placeholder ? "is-placeholder" : ""} ${target ? "is-target" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onClickCapture={onClickCapture}
    >
      <CardV2
        title={item.name}
        url={item.url}
        des={item.desc}
        logo={item?.logo}
        catelog={item.catelog}
        index={index}
        isSearching={isSearching}
        noImageMode={noImageMode}
        compactMode={compactMode}
        onClick={() => undefined}
      />
    </div>
  );
};

export default memo(EditableCard);
