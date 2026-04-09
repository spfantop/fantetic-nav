import React, { memo } from "react";
import { LockClosedIcon, LockOpen2Icon } from "@radix-ui/react-icons";
import { getLogoUrl } from "../../utils/check";

interface EditableCardProps {
  id: string;
  item: any;
  index: number;
  noImageMode: boolean;
  compactMode: boolean;
  jiggle: boolean;
  jiggleVariant?: "base" | "alt";
  unlocked?: boolean;
  dragging?: boolean;
  placeholder?: boolean;
  floating?: boolean;
  target?: boolean;
  dragStyle?: React.CSSProperties;
  cardRef?: (node: HTMLDivElement | null) => void;
  onClick: () => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export const EditableCard: React.FC<EditableCardProps> = ({
  id,
  item,
  index,
  noImageMode,
  compactMode,
  jiggle,
  jiggleVariant = "base",
  unlocked = false,
  dragging = false,
  placeholder = false,
  floating = false,
  target = false,
  dragStyle,
  cardRef,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onContextMenu,
}) => {
  return (
    <div
      ref={cardRef}
      data-card-id={id}
      style={dragStyle}
      className={`card-box editable-card-box ${jiggle && !dragging ? `jiggle-item-card ${jiggleVariant === "alt" ? "jiggle-item-card-alt" : ""}` : ""} ${dragging ? "editable-card-box-dragging" : ""} ${placeholder ? "editable-card-box-placeholder" : ""} ${floating ? "editable-card-box-floating" : ""} ${target ? "editable-card-box-target" : ""}`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={() => {
        onPointerUp();
      }}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
    >
      {index < 9 ? <span className="card-index editable-card-index">{index + 1}</span> : null}
      <div className={`card-content ${compactMode ? "compact-mode" : ""}`}>
        {!noImageMode ? (
          <div className="card-left">
            <img src={getLogoUrl(item.logo)} alt={item.name} loading="lazy" />
          </div>
        ) : null}
        <div className="card-right">
          <div className="card-right-top">
            <span className="card-right-title" title={item.name}>
              {item.passwordProtected ? (
                <span
                  className={`tag-lock-indicator ${unlocked ? "tag-lock-indicator-unlocked" : "tag-lock-indicator-locked"} card-lock-indicator`}
                  aria-hidden="true"
                >
                  {unlocked ? <LockOpen2Icon /> : <LockClosedIcon />}
                </span>
              ) : null}
              <span className="card-title-text">{item.name}</span>
            </span>
            {!compactMode ? (
              <span className="card-tag" title={item.catelog}>
                {item.catelog || "未分类"}
              </span>
            ) : null}
          </div>
          {!compactMode ? (
            <div className="card-right-bottom" title={item.desc}>
              {item.desc}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default memo(EditableCard);
