export const reorderPreviewByTarget = (order: string[], activeId: string, overId: string) => {
  const activeIndex = order.findIndex((item) => item === activeId);
  const overIndex = order.findIndex((item) => item === overId);
  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return order;
  }

  const next = [...order];
  // 视图调整使用交换式预览，避免插入式移动导致整行整体位移和跨行换位跳动。
  [next[activeIndex], next[overIndex]] = [next[overIndex], next[activeIndex]];
  return next;
};

export interface ReorderSlotRect {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

const isPointInsideSlot = (slot: ReorderSlotRect, clientX: number, clientY: number) =>
  clientX >= slot.left &&
  clientX <= slot.left + slot.width &&
  clientY >= slot.top &&
  clientY <= slot.top + slot.height;

export const findClosestReorderSlot = (
  slots: ReorderSlotRect[],
  clientX: number,
  clientY: number,
  activeId?: string,
  maxDistance = 42,
) => {
  const candidateSlots = slots.filter((slot) => slot.id !== activeId);
  if (!candidateSlots.length) {
    return null;
  }

  // 指针真正进入目标卡片时才立刻换位，避免还没拖到目标上方就触发整片区域预览抖动。
  const hoveredSlot = candidateSlots.find((slot) => isPointInsideSlot(slot, clientX, clientY));
  if (hoveredSlot) {
    return hoveredSlot.id;
  }

  let nearestId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  candidateSlots.forEach((slot) => {
    const centerX = slot.left + slot.width / 2;
    const centerY = slot.top + slot.height / 2;
    const distance = Math.hypot(centerX - clientX, centerY - clientY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = slot.id;
    }
  });

  // 指针离目标中心足够近时才允许预览重排，避免“按住拖动但还没靠近下一张卡”就被迫换位。
  return nearestDistance <= maxDistance ? nearestId : null;
};

export const applyPreviewOrder = <T extends { id: number | string }>(items: T[], previewOrder: string[]) => {
  const itemMap = new Map(items.map((item) => [String(item.id), item]));
  return previewOrder.map((id) => itemMap.get(id)).filter(Boolean) as T[];
};

export const commitScopedToolOrder = <T extends { id: number | string; catelog?: string; sort?: number }>(
  items: T[],
  previewOrder: string[],
  currentTag: string,
  sortStep: number,
) => {
  const scopedItems = items.filter((item) => String(item.catelog ?? "") === currentTag);
  const scopedMap = new Map(scopedItems.map((item) => [String(item.id), item]));
  const reorderedScopedItems = previewOrder.map((id) => scopedMap.get(id)).filter(Boolean) as T[];

  if (reorderedScopedItems.length !== scopedItems.length) {
    return items;
  }

  const committedScopedItems = reorderedScopedItems.map((item, index) => ({
    ...item,
    // 分类内最终顺序在松手后一次性落盘，避免拖拽过程中反复污染草稿排序。
    sort: (index + 1) * sortStep,
  }));
  const committedQueue = [...committedScopedItems];

  return items.map((item) => {
    if (String(item.catelog ?? "") !== currentTag) {
      return item;
    }
    return committedQueue.shift() ?? item;
  });
};

export const mergeVisiblePreviewIntoGlobalOrder = (globalOrder: string[], previewOrder: string[]) => {
  const previewSet = new Set(previewOrder);
  const previewQueue = [...previewOrder];

  return globalOrder.map((id) => {
    if (!previewSet.has(id)) {
      return id;
    }
    return previewQueue.shift() ?? id;
  });
};

export const commitTagItemsByPreview = <T extends { id: number | string; sort?: number }>(items: T[], previewOrder: string[]) => {
  const orderedIds = previewOrder
    .filter((id) => id !== "__all_tools__")
    .map((id) => id.replace(/^catelog:/, ""));
  const itemMap = new Map(items.map((item) => [String(item.id), item]));

  return orderedIds.map((id, index) => ({
    ...(itemMap.get(id) as T),
    // 分类标签在松手后一次性回写顺序，避免拖拽过程中和标签栏状态互相污染。
    sort: index + 1,
  }));
};
