export interface SortUpdateItem {
  id: number;
  sort: number;
}

export const swapByIds = (order: string[], activeId: string, overId: string) => {
  const activeIndex = order.findIndex((item) => item === activeId);
  const overIndex = order.findIndex((item) => item === overId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return order;
  }
  const next = [...order];
  [next[activeIndex], next[overIndex]] = [next[overIndex], next[activeIndex]];
  return next;
};

export const orderByIds = <T extends { id: number | string }>(items: T[], order: string[]) => {
  const map = new Map(items.map((item) => [String(item.id), item]));
  return order.map((id) => map.get(id)).filter(Boolean) as T[];
};

export const mergeVisibleOrderIntoGlobalOrder = (globalOrder: string[], visibleOrder: string[]) => {
  const visibleSet = new Set(visibleOrder);
  const queue = [...visibleOrder];
  return globalOrder.map((id) => {
    if (!visibleSet.has(id)) {
      return id;
    }
    return queue.shift() ?? id;
  });
};

export const buildSortUpdates = (order: string[]): SortUpdateItem[] =>
  order
    .map((id, index) => ({
      id: Number(id),
      sort: index + 1,
    }))
    .filter((item) => Number.isFinite(item.id));
