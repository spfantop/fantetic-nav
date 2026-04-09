import { useEffect, useMemo, useState } from "react";
import { scaleVirtualRowHeight } from "../utils/layoutScale";
import type { LayoutScale } from "../utils/layoutScale";

interface VirtualGridOptions {
  enabled: boolean;
  itemCount: number;
  compactMode: boolean;
  noImageMode: boolean;
  layoutScale: LayoutScale;
  overscanRows?: number;
}

const getColumns = (width: number, compactMode: boolean) => {
  if (compactMode) {
    if (width < 500) {
      return 2;
    }
    if (width < 700) {
      return 3;
    }
    if (width < 1060) {
      return 4;
    }
    return 6;
  }

  return 3;
};

const getRowHeight = (width: number, compactMode: boolean, noImageMode: boolean, layoutScale: LayoutScale) => {
  if (compactMode) {
    if (width < 500) {
      return scaleVirtualRowHeight(40, layoutScale);
    }
    if (width < 700) {
      return scaleVirtualRowHeight(44, layoutScale);
    }
    if (width < 1060) {
      return scaleVirtualRowHeight(50, layoutScale);
    }
    return scaleVirtualRowHeight(58, layoutScale);
  }

  if (width < 500) {
    return scaleVirtualRowHeight(122, layoutScale);
  }
  if (width < 700) {
    return scaleVirtualRowHeight(126, layoutScale);
  }
  if (width < 1060) {
    return scaleVirtualRowHeight(noImageMode ? 108 : 120, layoutScale);
  }
  return scaleVirtualRowHeight(noImageMode ? 112 : 136, layoutScale);
};

export const useVirtualGrid = (
  container: HTMLElement | null,
  { enabled, itemCount, compactMode, noImageMode, layoutScale, overscanRows = 3 }: VirtualGridOptions
) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [rowGap, setRowGap] = useState(0);

  useEffect(() => {
    if (!enabled || !container) {
      setScrollTop(0);
      setViewportHeight(0);
      return;
    }

    const updateViewport = () => {
      setViewportHeight(container.clientHeight);
      setScrollTop(container.scrollTop);
      setViewportWidth(container.clientWidth || window.innerWidth);

      const contentGrid = container.firstElementChild as HTMLElement | null;
      if (contentGrid) {
        const computedStyle = window.getComputedStyle(contentGrid);
        const nextRowGap = Number.parseFloat(computedStyle.rowGap || computedStyle.gap || "0") || 0;
        setRowGap(nextRowGap);
      }
    };

    updateViewport();
    container.addEventListener("scroll", updateViewport, { passive: true });
    window.addEventListener("resize", updateViewport);

    return () => {
      container.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, [container, enabled]);

  return useMemo(() => {
    if (!enabled || itemCount === 0) {
      return {
        active: false,
        startIndex: 0,
        endIndex: itemCount,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        rowGap: 0,
      };
    }

    const columns = getColumns(viewportWidth, compactMode);
    const rowHeight = getRowHeight(viewportWidth, compactMode, noImageMode, layoutScale);
    const totalRows = Math.ceil(itemCount / columns);
    const visibleRows = Math.max(1, Math.ceil(viewportHeight / rowHeight));
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows);
    const endRow = Math.min(totalRows, startRow + visibleRows + overscanRows * 2);
    const startIndex = startRow * columns;
    const endIndex = Math.min(itemCount, endRow * columns);

    return {
      active: true,
      startIndex,
      endIndex,
      topSpacerHeight: startRow * rowHeight,
      bottomSpacerHeight: Math.max(0, totalRows - endRow) * rowHeight,
      rowGap,
    };
  }, [compactMode, enabled, itemCount, layoutScale, noImageMode, overscanRows, rowGap, scrollTop, viewportHeight, viewportWidth]);
};

export default useVirtualGrid;
