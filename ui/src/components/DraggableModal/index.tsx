import React, { useMemo, useRef, useState } from "react";
import { Modal } from "antd";
import type { ModalProps } from "antd";

export const DraggableModal: React.FC<ModalProps> = ({ title, ...rest }) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const titleNode = useMemo(() => {
    return (
      <div
        style={{ cursor: "move", userSelect: "none", width: "100%" }}
        onMouseDown={(e) => {
          dragRef.current.dragging = true;
          dragRef.current.startX = e.clientX;
          dragRef.current.startY = e.clientY;
          dragRef.current.originX = offset.x;
          dragRef.current.originY = offset.y;

          const onMove = (ev: MouseEvent) => {
            if (!dragRef.current.dragging) return;
            const dx = ev.clientX - dragRef.current.startX;
            const dy = ev.clientY - dragRef.current.startY;
            setOffset({
              x: dragRef.current.originX + dx,
              y: dragRef.current.originY + dy,
            });
          };
          const onUp = () => {
            dragRef.current.dragging = false;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
      >
        {title}
      </div>
    );
  }, [title, offset.x, offset.y]);

  return (
    <Modal
      {...rest}
      okText={rest.okText ?? "确定"}
      cancelText={rest.cancelText ?? "取消"}
      title={titleNode}
      modalRender={(modal) => (
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>{modal}</div>
      )}
      afterOpenChange={(open) => {
        if (!open) {
          setOffset({ x: 0, y: 0 });
        }
        rest.afterOpenChange?.(open);
      }}
    />
  );
};

export default DraggableModal;
