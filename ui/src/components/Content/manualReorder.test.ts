import {
  applyPreviewOrder,
  commitScopedToolOrder,
  commitTagItemsByPreview,
  findClosestReorderSlot,
  mergeVisiblePreviewIntoGlobalOrder,
  reorderPreviewByTarget,
} from "./manualReorder";

describe("manualReorder", () => {
  it("reorders preview list by swapping only the active item and target item", () => {
    expect(reorderPreviewByTarget(["1", "2", "3", "4"], "1", "3")).toEqual(["3", "2", "1", "4"]);
    expect(reorderPreviewByTarget(["1", "2", "3", "4"], "4", "2")).toEqual(["1", "4", "3", "2"]);
  });

  it("applies preview order without mutating items outside the preview set", () => {
    const items = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ];

    expect(applyPreviewOrder(items, ["3", "1", "2"])).toEqual([
      { id: 3, name: "C" },
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
  });

  it("commits scoped tool order only inside the current category and rewrites sparse sort values", () => {
    const tools = [
      { id: 1, name: "A", catelog: "开发", sort: 1024 },
      { id: 2, name: "B", catelog: "开发", sort: 2048 },
      { id: 3, name: "C", catelog: "开发", sort: 3072 },
      { id: 4, name: "D", catelog: "工具", sort: 1024 },
    ];

    expect(commitScopedToolOrder(tools, ["3", "1", "2"], "开发", 1024)).toEqual([
      { id: 3, name: "C", catelog: "开发", sort: 1024 },
      { id: 1, name: "A", catelog: "开发", sort: 2048 },
      { id: 2, name: "B", catelog: "开发", sort: 3072 },
      { id: 4, name: "D", catelog: "工具", sort: 1024 },
    ]);
  });

  it("merges all-tools preview back into the global order while preserving hidden ids", () => {
    expect(
      mergeVisiblePreviewIntoGlobalOrder(
        ["1", "2", "3", "4", "5"],
        ["3", "1", "2"],
      ),
    ).toEqual(["3", "1", "2", "4", "5"]);
  });

  it("commits tag preview order back into the category item list without the all-tools sentinel", () => {
    const items = [
      { id: 10, name: "开发", sort: 1 },
      { id: 11, name: "工具", sort: 2 },
      { id: 12, name: "设计", sort: 3 },
    ];

    expect(commitTagItemsByPreview(items, ["__all_tools__", "catelog:12", "catelog:10", "catelog:11"])).toEqual([
      { id: 12, name: "设计", sort: 1 },
      { id: 10, name: "开发", sort: 2 },
      { id: 11, name: "工具", sort: 3 },
    ]);
  });

  it("only activates card preview reorder when the pointer enters or gets close enough to another slot", () => {
    const slots = [
      { id: "1", left: 0, top: 0, width: 100, height: 60 },
      { id: "2", left: 120, top: 0, width: 100, height: 60 },
      { id: "3", left: 240, top: 0, width: 100, height: 60 },
    ];

    expect(findClosestReorderSlot(slots, 40, 30, "1")).toBeNull();
    expect(findClosestReorderSlot(slots, 150, 20, "1")).toBe("2");
    expect(findClosestReorderSlot(slots, 208, 30, "1")).toBe("2");
  });
});
