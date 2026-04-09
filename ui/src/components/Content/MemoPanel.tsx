import { memo } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { Button, Input } from "antd";

interface MemoPanelProps {
  visible: boolean;
  value: string;
  saving: boolean;
  collapsed: boolean;
  dragging: boolean;
  panelStyle?: CSSProperties;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onToggleCollapsed: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
}

const MemoPanel = ({
  visible,
  value,
  saving,
  collapsed,
  dragging,
  panelStyle,
  onPointerDown,
  onToggleCollapsed,
  onChange,
  onSave,
}: MemoPanelProps) => {
  if (!visible) {
    return null;
  }

  return (
    <div className={`memo-panel ${collapsed ? "memo-panel-collapsed" : ""} ${dragging ? "memo-panel-dragging" : ""}`} style={panelStyle}>
      <div
        className="memo-panel-header"
        onPointerDown={(event) => {
          // 只允许拖动标题栏，避免文本选择和拖拽行为互相干扰。
          onPointerDown(event);
        }}
      >
        <strong>备忘录</strong>
        <button type="button" className="memo-panel-toggle" onClick={onToggleCollapsed}>
          {collapsed ? "展开" : "收起"}
        </button>
      </div>
      {!collapsed ? (
        <>
          <Input.TextArea
            value={value}
            rows={8}
            placeholder="记录临时想法、待办或站点备注"
            onChange={(event) => onChange(event.target.value)}
          />
          <div className="memo-panel-actions">
            <Button type="primary" size="small" loading={saving} onClick={onSave}>
              保存备忘录
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default memo(MemoPanel);
