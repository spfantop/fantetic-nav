import { memo } from "react";
import type { ReactNode } from "react";
import { Button } from "antd";
import { ColorWheelIcon, GearIcon } from "@radix-ui/react-icons";

interface PageActionsProps {
  editMode: boolean;
  savingView: boolean;
  savingTheme?: boolean;
  themePanelOpen?: boolean;
  layoutPanelOpen?: boolean;
  visible: boolean;
  showSettingsButton: boolean;
  onExitAdjust: () => void;
  onSaveView: () => void;
  onOpenLayoutEditor: () => void;
  onOpenThemeEditor: () => void;
  onOpenSettings: () => void;
  layoutEditorPanel?: ReactNode;
  themeEditorPanel?: ReactNode;
}

const PageActions = ({
  editMode,
  savingView,
  savingTheme,
  themePanelOpen,
  layoutPanelOpen,
  visible,
  showSettingsButton,
  onExitAdjust,
  onSaveView,
  onOpenLayoutEditor,
  onOpenThemeEditor,
  onOpenSettings,
  layoutEditorPanel,
  themeEditorPanel,
}: PageActionsProps) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="page-action-stack">
      {editMode ? (
        <>
          {/* 布局档位与调色一样挂在按钮锚点下方，避免浮层位置漂移。 */}
          <div className="page-action-drawer-anchor">
            <Button size="small" className={`page-action-chip page-action-chip-secondary ${layoutPanelOpen ? "page-action-chip-open" : ""}`} onClick={onOpenLayoutEditor}>
              布局
            </Button>
            {layoutEditorPanel}
          </div>
          {/* 调色抽屉挂在按钮锚点下方，箭头和位置会随按钮一起稳定。 */}
          <div className="page-action-drawer-anchor">
            <Button size="small" className={`page-action-chip page-action-chip-secondary ${themePanelOpen ? "page-action-chip-open" : ""}`} loading={savingTheme} onClick={onOpenThemeEditor}>
              <ColorWheelIcon />
              调色
            </Button>
            {themeEditorPanel}
          </div>
          <Button size="small" type="primary" className="page-action-chip page-action-chip-primary" loading={savingView} onClick={onSaveView}>
            保存视图
          </Button>
          <Button size="small" className="page-action-chip page-action-chip-secondary" onClick={onExitAdjust}>
            退出调整
          </Button>
        </>
      ) : null}
      {showSettingsButton ? (
        <button className="header-action-button page-settings-button" onClick={onOpenSettings} title="系统设置">
          <GearIcon />
        </button>
      ) : null}
    </div>
  );
};

export default memo(PageActions);
