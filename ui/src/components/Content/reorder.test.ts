import {
  swapByIds,
  buildSortUpdates,
  mergeVisibleOrderIntoGlobalOrder,
  orderByIds,
} from "./reorder";

describe("reorder", () => {
  it("交换顺序：同项或不存在 id 时保持不变", () => {
    expect(swapByIds(["1", "2", "3"], "1", "1")).toEqual(["1", "2", "3"]);
    expect(swapByIds(["1", "2", "3"], "1", "9")).toEqual(["1", "2", "3"]);
  });

  it("交换顺序：正常交换两项", () => {
    expect(swapByIds(["1", "2", "3", "4"], "1", "3")).toEqual(["3", "2", "1", "4"]);
  });

  it("按 id 顺序映射对象列表", () => {
    const items = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ];
    expect(orderByIds(items, ["3", "1", "2"])).toEqual([
      { id: 3, name: "C" },
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
  });

  it("将可见顺序合并回全量顺序时保持隐藏项位置", () => {
    expect(mergeVisibleOrderIntoGlobalOrder(["1", "2", "3", "4", "5"], ["3", "1", "2"]))
      .toEqual(["3", "1", "2", "4", "5"]);
  });

  it("生成保存 payload：sort 连续递增", () => {
    expect(buildSortUpdates(["12", "20", "7"])).toEqual([
      { id: 12, sort: 1 },
      { id: 20, sort: 2 },
      { id: 7, sort: 3 },
    ]);
  });
});
