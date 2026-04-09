import { memo, useEffect, useMemo, useState } from "react";
import {
  clearPerfMetrics,
  getPerfMetrics,
  isPerformancePanelEnabled,
  setPerformancePanelEnabled,
  subscribePerfMetrics,
} from "../../utils/perf";

interface PerformancePanelProps {
  visibleByConfig: boolean;
  toolCount: number;
  filteredCount: number;
  searchText: string;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

const PerformancePanel = ({ visibleByConfig, toolCount, filteredCount, searchText }: PerformancePanelProps) => {
  const [enabled, setEnabled] = useState(() => isPerformancePanelEnabled());
  const [metrics, setMetrics] = useState(() => getPerfMetrics());

  useEffect(() => {
    setEnabled(isPerformancePanelEnabled());
    const unsubscribe = subscribePerfMetrics(() => {
      setEnabled(isPerformancePanelEnabled());
      setMetrics(getPerfMetrics());
    });
    return unsubscribe;
  }, []);

  const averageDuration = useMemo(() => {
    if (!metrics.length) {
      return 0;
    }
    return metrics.reduce((sum, item) => sum + item.duration, 0) / metrics.length;
  }, [metrics]);

  if (!visibleByConfig && !enabled) {
    return null;
  }

  return (
    <div className="perf-panel">
      <div className="perf-panel-header">
        <strong>性能面板</strong>
        <div className="perf-panel-actions">
          <button
            type="button"
            onClick={() => {
              setPerformancePanelEnabled(!enabled);
            }}
          >
            {enabled ? "隐藏" : "固定"}
          </button>
          <button type="button" onClick={clearPerfMetrics}>
            清空
          </button>
        </div>
      </div>
      <div className="perf-panel-stats">
        <span>书签总数 {toolCount}</span>
        <span>当前结果 {filteredCount}</span>
        <span>搜索词 {searchText || "无"}</span>
        <span>平均耗时 {averageDuration.toFixed(1)}ms</span>
      </div>
      <div className="perf-panel-list">
        {metrics.length ? (
          metrics.map((item) => (
            <div key={item.id} className="perf-panel-row">
              <div className="perf-panel-row-main">
                <span>{item.name}</span>
                <strong>{item.duration.toFixed(1)}ms</strong>
              </div>
              <div className="perf-panel-row-sub">
                <span>{item.detail || "-"}</span>
                <span>{formatTime(item.time)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="perf-panel-empty">暂无性能记录</div>
        )}
      </div>
    </div>
  );
};

export default memo(PerformancePanel);
