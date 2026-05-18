import "./index.css";
import { Helmet } from "react-helmet";
import { message } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import pinyin from "pinyin-match";
import CardV2 from "../CardV2";
import SearchBar from "../SearchBar";
import TagSelector from "../TagSelector";
import { Loading } from "../Loading";
import LocalClock from "./LocalClock";
import EditableCard from "./EditableCard";
import EditableTag from "./EditableTag";
import {
  FetchList,
  fetchUpdateCatelogsSort,
  fetchUpdateToolsAllSort,
  fetchUpdateToolsSort,
} from "../../utils/api";
import { generateSearchEngineCard } from "../../utils/serachEngine";
import { toggleJumpTarget } from "../../utils/setting";
import {
  buildSortUpdates,
  mergeVisibleOrderIntoGlobalOrder,
  orderByIds,
  swapByIds,
} from "./reorder";

const FRAME_INITIAL_COUNT_DESKTOP = 24;
const FRAME_INITIAL_COUNT_MOBILE = 16;
const FRAME_BATCH_COUNT = 32;
const BACK_TO_TOP_THRESHOLD = 300;
const ALL_TOOLS_TAG = "全部工具";
const ADMIN_TAG = "管理后台";
const DEFAULT_TAG = "默认";
const HOME_CACHE_TTL = 2000;
const HOME_STORAGE_CACHE_KEY = "van_nav_home_cache_v1";
const TAG_ORDER_STORAGE_KEY = "van_nav_tag_order_v1";
const IDLE_PREWARM_COUNT = 12;
const FIXED_TAIL_TOOL_URLS = ["admin", "toggleJumpTarget"];

let homeDataCache: any = null;
let homeDataCacheAt = 0;
let homeDataInFlight: Promise<any> | null = null;
const prewarmedLogoSet = new Set<string>();

const mutiSearch = (s: string, t: string) => {
  const source = String(s || "").toLowerCase();
  const target = String(t || "").toLowerCase();
  return source.includes(target) || Boolean(pinyin.match(source, target));
};

const fetchHomeData = async () => {
  const now = Date.now();
  if (homeDataCache && now - homeDataCacheAt < HOME_CACHE_TTL) {
    return homeDataCache;
  }
  if (homeDataInFlight) {
    return homeDataInFlight;
  }
  homeDataInFlight = FetchList()
    .then((result) => {
      homeDataCache = result;
      homeDataCacheAt = Date.now();
      return result;
    })
    .finally(() => {
      homeDataInFlight = null;
    });
  return homeDataInFlight;
};

const readHomeStorageCache = () => {
  try {
    const raw = window.localStorage.getItem(HOME_STORAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeHomeStorageCache = (payload: any) => {
  try {
    window.localStorage.setItem(HOME_STORAGE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // 忽略缓存写入失败，避免影响主流程。
  }
};

const normalizeHomeData = (payload: any) => {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const catelogs = Array.isArray(payload.catelogs) ? [...payload.catelogs] : [];
  const allIndex = catelogs.indexOf(ALL_TOOLS_TAG);
  if (allIndex > 0) {
    catelogs.splice(allIndex, 1);
    catelogs.unshift(ALL_TOOLS_TAG);
  }

  return {
    ...payload,
    catelogs,
    tools: Array.isArray(payload.tools) ? payload.tools : [],
  };
};

const getInitialRenderCount = () => {
  if (typeof window === "undefined") {
    return FRAME_INITIAL_COUNT_DESKTOP;
  }
  return window.innerWidth < 768 ? FRAME_INITIAL_COUNT_MOBILE : FRAME_INITIAL_COUNT_DESKTOP;
};

const sortTools = (tools: any[]) =>
  [...tools].sort((left, right) => Number(left?.sort ?? 0) - Number(right?.sort ?? 0) || Number(left.id) - Number(right.id));

const sortToolsForTag = (tools: any[], tag: string) => {
  const fixedTailTools = tools.filter((item) => FIXED_TAIL_TOOL_URLS.includes(String(item?.url ?? "")));
  const normalTools = tools.filter((item) => !FIXED_TAIL_TOOL_URLS.includes(String(item?.url ?? "")));
  if (tag === ALL_TOOLS_TAG) {
    const sorted = [...normalTools].sort(
      (left, right) =>
        Number(left?.allSort ?? left?.sort ?? 0) - Number(right?.allSort ?? right?.sort ?? 0) || Number(left.id) - Number(right.id)
    );
    const admin = fixedTailTools.find((item) => String(item?.url ?? "") === "admin");
    const toggle = fixedTailTools.find((item) => String(item?.url ?? "") === "toggleJumpTarget");
    return [...sorted, ...(admin ? [admin] : []), ...(toggle ? [toggle] : [])];
  }
  return [...normalTools, ...fixedTailTools].sort((left, right) => Number(left?.sort ?? 0) - Number(right?.sort ?? 0) || Number(left.id) - Number(right.id));
};

const isFixedTailTool = (item: any) => FIXED_TAIL_TOOL_URLS.includes(String(item?.url ?? ""));

const sortTags = (tags: string[]) => {
  const uniq = Array.from(new Set(tags.filter((item) => typeof item === "string")));
  const withoutAll = uniq.filter((item) => item !== ALL_TOOLS_TAG);
  return [ALL_TOOLS_TAG, ...withoutAll];
};

const readTagOrder = () => {
  try {
    const raw = window.localStorage.getItem(TAG_ORDER_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const writeTagOrder = (order: string[]) => {
  try {
    window.localStorage.setItem(TAG_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // 忽略本地持久化失败。
  }
};

const mergeTagOrder = (base: string[], preferred: string[]) => {
  const baseSet = new Set(base);
  const keep = preferred.filter((item) => baseSet.has(item));
  const rest = base.filter((item) => !keep.includes(item));
  return [...keep, ...rest];
};

interface CardDragSession {
  activeId: string;
  currentTag: string;
  startVisibleOrder: string[];
  startGlobalOrder: string[];
}

interface TagDragSession {
  activeId: string;
  startOrder: string[];
}

interface ContentProps {
  editMode?: boolean;
  onLeaveEdit?: () => void;
}

const Content = ({ editMode = false, onLeaveEdit }: ContentProps) => {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [currTag, setCurrTag] = useState(ALL_TOOLS_TAG);
  const [searchString, setSearchString] = useState("");
  const [val, setVal] = useState("");
  const [searchEngineCards, setSearchEngineCards] = useState<any[]>([]);
  const [renderCount, setRenderCount] = useState(getInitialRenderCount);
  const [showBackTop, setShowBackTop] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draftTools, setDraftTools] = useState<any[]>([]);
  const [draftTagOrder, setDraftTagOrder] = useState<string[]>([ALL_TOOLS_TAG]);
  const [dirtyTools, setDirtyTools] = useState(false);
  const [dirtyTags, setDirtyTags] = useState(false);
  const [dirtyAllTools, setDirtyAllTools] = useState(false);
  const [dirtyCatelogs, setDirtyCatelogs] = useState<Record<string, boolean>>({});
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [cardTargetId, setCardTargetId] = useState<string | null>(null);
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [tagTargetId, setTagTargetId] = useState<string | null>(null);

  const filteredDataRef = useRef<any[]>([]);
  const renderRafRef = useRef<number | null>(null);
  const contentWrapperRef = useRef<HTMLDivElement | null>(null);
  const originalSnapshotRef = useRef<{ tools: any[]; tags: string[] } | null>(null);
  const cardDragRef = useRef<CardDragSession | null>(null);
  const tagDragRef = useRef<TagDragSession | null>(null);

  const applyTagFromData = useCallback((nextData: any) => {
    const tagInLocalStorage = window.localStorage.getItem("tag");
    if (tagInLocalStorage && nextData?.catelogs?.includes(tagInLocalStorage)) {
      setCurrTag(tagInLocalStorage);
      return;
    }
    const defaultTag =
      Array.isArray(nextData?.catelogs) && nextData.catelogs.length > 0
        ? nextData.catelogs.find((tag: string) => tag !== ALL_TOOLS_TAG) ?? nextData.catelogs[0]
        : DEFAULT_TAG;
    setCurrTag(defaultTag);
  }, []);

  const stopRenderRaf = useCallback(() => {
    if (renderRafRef.current !== null) {
      window.cancelAnimationFrame(renderRafRef.current);
      renderRafRef.current = null;
    }
  }, []);

  const loadData = useCallback(async () => {
    const localCacheData = normalizeHomeData(readHomeStorageCache());
    if (localCacheData) {
      const localTagOrder = readTagOrder();
      const normalizedTags = mergeTagOrder(sortTags(localCacheData.catelogs ?? [ALL_TOOLS_TAG]), localTagOrder);
      setData(localCacheData);
      setDraftTools(sortTools(localCacheData.tools ?? []));
      setDraftTagOrder(normalizedTags);
      applyTagFromData(localCacheData);
      setLoading(false);
    }

    try {
      if (!localCacheData) {
        setLoading(true);
      }
      const result = normalizeHomeData(await fetchHomeData());
      const localTagOrder = readTagOrder();
      const normalizedTags = mergeTagOrder(sortTags(result.catelogs ?? [ALL_TOOLS_TAG]), localTagOrder);
      setData(result);
      setDraftTools(sortTools(result.tools ?? []));
      setDraftTagOrder(normalizedTags);
      writeHomeStorageCache(result);
      applyTagFromData(result);
    } catch (error) {
      console.error("加载首页数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, [applyTagFromData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!editMode) {
      return;
    }
    const sortedTools = sortTools(data?.tools ?? []);
    const sortedTags = mergeTagOrder(sortTags(data?.catelogs ?? [ALL_TOOLS_TAG]), readTagOrder());
    originalSnapshotRef.current = {
      tools: sortedTools.map((item) => ({ ...item })),
      tags: [...sortedTags],
    };
    setDraftTools(sortedTools);
    setDraftTagOrder(sortedTags);
    setDirtyTools(false);
    setDirtyTags(false);
    setDirtyAllTools(false);
    setDirtyCatelogs({});
    setDraggingCardId(null);
    setDraggingTagId(null);
    setCardTargetId(null);
    setTagTargetId(null);
  }, [editMode, data?.tools, data?.catelogs]);

  useEffect(() => {
    if (!editMode) {
      return;
    }
    if (searchString.trim()) {
      setVal("");
      setSearchString("");
      message.info("编辑模式下已关闭搜索，避免只排序过滤结果。");
    }
  }, [editMode, searchString]);

  useEffect(() => {
    const loadSearchEngineCards = async () => {
      if (editMode) {
        setSearchEngineCards([]);
        return;
      }
      try {
        const cards = await generateSearchEngineCard(searchString);
        setSearchEngineCards(cards);
      } catch (error) {
        console.error("加载搜索引擎卡片失败:", error);
        setSearchEngineCards([]);
      }
    };

    loadSearchEngineCards();
  }, [searchString, editMode]);

  const handleSetCurrTag = (tag: string) => {
    setCurrTag(tag);
    if (tag !== ADMIN_TAG) {
      window.localStorage.setItem("tag", tag);
    }
    if (editMode) {
      setDraggingCardId(null);
      setDraggingTagId(null);
      setCardTargetId(null);
      setTagTargetId(null);
    }
    resetSearch(true);
  };

  const resetSearch = (notSetTag?: boolean) => {
    setVal("");
    setSearchString("");
    const tagInLocalStorage = window.localStorage.getItem("tag");
    if (!notSetTag && tagInLocalStorage && tagInLocalStorage !== ADMIN_TAG) {
      setCurrTag(tagInLocalStorage);
    }
  };

  const handleSetSearch = (nextVal: string) => {
    if (editMode) {
      return;
    }
    if (nextVal.trim() !== "") {
      setCurrTag(ALL_TOOLS_TAG);
      setSearchString(nextVal.trim());
      return;
    }
    resetSearch();
  };

  const tagsForRender = useMemo(
    () => (editMode ? draftTagOrder : mergeTagOrder(sortTags(data?.catelogs ?? [ALL_TOOLS_TAG]), readTagOrder())),
    [editMode, draftTagOrder, data?.catelogs]
  );

  const toolsSource = useMemo(
    () => (editMode ? sortToolsForTag(draftTools, currTag) : sortToolsForTag(data?.tools ?? [], currTag)),
    [editMode, draftTools, data?.tools, currTag]
  );

  const filteredData = useMemo(() => {
    const localResult = toolsSource
      .filter((item: any) => {
        if (currTag === ALL_TOOLS_TAG) {
          return true;
        }
        return item.catelog === currTag;
      })
      .filter((item: any) => {
        if (searchString === "") {
          return true;
        }
        return mutiSearch(item.name, searchString) || mutiSearch(item.desc, searchString) || mutiSearch(item.url, searchString);
      });

    const extraCards = Array.isArray(searchEngineCards) ? searchEngineCards : [];
    return editMode ? localResult : [...localResult, ...extraCards];
  }, [toolsSource, currTag, searchString, searchEngineCards, editMode]);

  useEffect(() => {
    filteredDataRef.current = filteredData;
  }, [filteredData]);

  useEffect(() => {
    stopRenderRaf();
    const total = filteredData.length;
    const initialCount = Math.min(getInitialRenderCount(), total);
    setRenderCount(initialCount);

    if (total <= initialCount) {
      return;
    }

    const appendNextFrame = () => {
      setRenderCount((prev) => {
        const next = Math.min(prev + FRAME_BATCH_COUNT, total);
        if (next < total) {
          renderRafRef.current = window.requestAnimationFrame(appendNextFrame);
        } else {
          renderRafRef.current = null;
        }
        return next;
      });
    };

    renderRafRef.current = window.requestAnimationFrame(appendNextFrame);

    return () => stopRenderRaf();
  }, [filteredData, stopRenderRaf]);

  const onKeyEnter = useCallback(
    (ev: KeyboardEvent) => {
      const cards = filteredDataRef.current;
      if (ev.keyCode === 13 && cards?.length) {
        window.open(cards[0]?.url, "_blank");
        resetSearch();
      }
      if (ev.ctrlKey || ev.metaKey) {
        const index = Number(ev.key) - 1;
        if (Number.isNaN(index)) {
          return;
        }
        ev.preventDefault();
        if (index >= 0 && index < cards.length) {
          window.open(cards[index]?.url, "_blank");
          resetSearch();
        }
      }
    },
    []
  );

  useEffect(() => {
    if (searchString.trim() === "" || editMode) {
      document.removeEventListener("keydown", onKeyEnter);
    } else {
      document.addEventListener("keydown", onKeyEnter);
    }
    return () => document.removeEventListener("keydown", onKeyEnter);
  }, [searchString, onKeyEnter, editMode]);

  const renderedCards = useMemo(() => filteredData.slice(0, renderCount), [filteredData, renderCount]);

  useEffect(() => {
    if (searchString.trim() !== "" || editMode) {
      return;
    }
    const nextBatch = filteredData.slice(renderCount, renderCount + IDLE_PREWARM_COUNT);
    if (!nextBatch.length) {
      return;
    }
    const preload = () => {
      nextBatch.forEach((item: any) => {
        if (!item?.logo || item.url === "admin" || item.url === "toggleJumpTarget") {
          return;
        }
        if (prewarmedLogoSet.has(item.logo)) {
          return;
        }
        prewarmedLogoSet.add(item.logo);
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.as = "image";
        link.href = `/api/img?url=${encodeURIComponent(item.logo)}`;
        document.head.appendChild(link);
      });
    };
    const idleCallback = (window as any).requestIdleCallback;
    const cancelIdleCallback = (window as any).cancelIdleCallback;
    if (typeof idleCallback === "function") {
      const id = idleCallback(preload, { timeout: 1000 });
      return () => cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(preload, 160);
    return () => window.clearTimeout(timer);
  }, [filteredData, renderCount, searchString, editMode]);

  const handleContentScroll = useCallback((ev: any) => {
    const nextShow = ev.currentTarget.scrollTop > BACK_TO_TOP_THRESHOLD;
    setShowBackTop((prev) => (prev === nextShow ? prev : nextShow));
  }, []);

  const scrollToTop = useCallback(() => {
    contentWrapperRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const cancelEditMode = () => {
    const snapshot = originalSnapshotRef.current;
    if (snapshot) {
      setDraftTools(snapshot.tools.map((item) => ({ ...item })));
      setDraftTagOrder([...snapshot.tags]);
    }
    setDirtyTools(false);
    setDirtyTags(false);
    setDirtyAllTools(false);
    setDirtyCatelogs({});
    setDraggingCardId(null);
    setDraggingTagId(null);
    setCardTargetId(null);
    setTagTargetId(null);
    onLeaveEdit?.();
  };

  const handleSaveOrder = async () => {
    const updateTasks: { key: string; run: () => Promise<any> }[] = [];
    try {
      setSavingOrder(true);
      if (dirtyTools) {
        if (dirtyAllTools) {
          const allSortUpdates = draftTools
            .slice()
            .filter((item) => !isFixedTailTool(item))
            .sort((a, b) => Number(a?.allSort ?? a?.sort ?? 0) - Number(b?.allSort ?? b?.sort ?? 0))
            .map((item, index) => ({ id: Number(item.id), allSort: index + 1 }));
          updateTasks.push({
            key: "allSort",
            run: () => fetchUpdateToolsAllSort(allSortUpdates),
          });
        }
        const changedCatelogNames = Object.keys(dirtyCatelogs).filter((key) => dirtyCatelogs[key]);
        if (changedCatelogNames.length > 0) {
          const categoryUpdates = changedCatelogNames.flatMap((catelog) =>
            draftTools
              .filter((item) => String(item.catelog ?? "") === catelog)
              .slice()
              .sort((a, b) => Number(a?.sort ?? 0) - Number(b?.sort ?? 0))
              .map((item, index) => ({ id: Number(item.id), sort: index + 1 }))
          );
          if (categoryUpdates.length > 0) {
            updateTasks.push({
              key: "categorySort",
              run: () => fetchUpdateToolsSort(categoryUpdates),
            });
          }
        }
      }
      if (dirtyTags) {
        const tagIdMap = new Map((data?.catelogItems ?? []).map((item: any) => [item.name, item.id]));
        const tagIds = draftTagOrder
          .filter((tag) => tag !== ALL_TOOLS_TAG)
          .map((tag) => String(tagIdMap.get(tag)))
          .filter((id) => id !== "undefined");
        updateTasks.push({
          key: "tagSort",
          run: () => fetchUpdateCatelogsSort(buildSortUpdates(tagIds)),
        });
      }

      if (!updateTasks.length) {
        writeTagOrder(draftTagOrder);
        onLeaveEdit?.();
        return;
      }

      const failed: { key: string; result: PromiseRejectedResult }[] = [];
      for (const task of updateTasks) {
        try {
          await task.run();
        } catch (error) {
          failed.push({
            key: task.key,
            result: {
              status: "rejected",
              reason: error,
            },
          });
          break;
        }
      }

      if (failed.length > 0) {
        const hasAllSort404 = failed.some((item) => {
          const status = (item.result.reason as any)?.response?.status;
          return item.key === "allSort" && status === 404;
        });
        if (hasAllSort404) {
          message.error("保存失败：后端未启用“全部工具排序”接口，请重启后端服务后重试。");
          return;
        }
        const hasSqliteBusy = failed.some((item) => String((item.result.reason as any)?.response?.data?.errorMessage ?? "").includes("SQLITE_BUSY"));
        if (hasSqliteBusy) {
          message.error("保存失败：数据库繁忙，请稍后重试（已改为串行提交，若仍出现请重启后端）。");
          return;
        }
        const failKeys = failed.map((item) => item.key).join("、");
        message.error(`保存失败：${failKeys} 提交失败，请重试。`);
        return;
      }

      writeTagOrder(draftTagOrder);
      message.success("布局顺序已保存");
      onLeaveEdit?.();
      setDirtyTools(false);
      setDirtyTags(false);
      setDirtyAllTools(false);
      setDirtyCatelogs({});
      await loadData();
    } catch (error) {
      console.error("保存布局失败:", error);
      message.error("保存失败，已保留当前草稿，请重试");
    } finally {
      setSavingOrder(false);
    }
  };

  const resolveCardOrder = useCallback(() => filteredData, [filteredData]);

  const resolveTagOrder = useCallback(() => draftTagOrder, [draftTagOrder]);

  const renderCardsV2 = useCallback(() => {
    return renderedCards.map((item, index) => {
      const isSearchEngineOption = Number(item?.id) >= 8800880000 && Number(item?.id) < 8800999999;
      return (
        <CardV2
          title={item.name}
          url={item.url}
          des={item.desc}
          logo={item?.logo}
          key={item.id}
          catelog={item.catelog}
          index={index}
          isSearching={searchString.trim() !== ""}
          noImageMode={data?.siteConfig?.noImageMode || false}
          compactMode={data?.siteConfig?.compactMode || false}
          showCatelog={!isSearchEngineOption}
          onClick={() => {
            resetSearch();
            if (item.url === "toggleJumpTarget") {
              toggleJumpTarget();
              loadData();
            }
          }}
        />
      );
    });
  }, [renderedCards, searchString, data?.siteConfig?.noImageMode, data?.siteConfig?.compactMode, loadData]);

  const commitCardDrag = () => {
    const drag = cardDragRef.current;
    if (!drag) {
      return;
    }
    const targetId = cardTargetId;
    if (!targetId || targetId === drag.activeId) {
      setDraggingCardId(null);
      setCardTargetId(null);
      cardDragRef.current = null;
      return;
    }
    const startMap = new Map(draftTools.map((item) => [String(item.id), item]));
    const activeItem = startMap.get(drag.activeId);
    const targetItem = startMap.get(targetId);
    if (!activeItem || !targetItem) {
      setDraggingCardId(null);
      setCardTargetId(null);
      cardDragRef.current = null;
      return;
    }
    if (isFixedTailTool(activeItem) || isFixedTailTool(targetItem)) {
      setDraggingCardId(null);
      setCardTargetId(null);
      cardDragRef.current = null;
      return;
    }
    if (drag.currentTag !== ALL_TOOLS_TAG && String(activeItem.catelog ?? "") !== String(targetItem.catelog ?? "")) {
      setDraggingCardId(null);
      setCardTargetId(null);
      cardDragRef.current = null;
      return;
    }
    const finalOrder = swapByIds(drag.startVisibleOrder, drag.activeId, targetId);
    if (drag.currentTag === ALL_TOOLS_TAG) {
      const mergedOrder = mergeVisibleOrderIntoGlobalOrder(drag.startGlobalOrder, finalOrder);
      const allSortMap = new Map(mergedOrder.map((id, index) => [id, index + 1]));
      const nextTools = draftTools.map((item) => ({
        ...item,
        allSort: isFixedTailTool(item)
          ? Number(item?.allSort ?? item?.sort ?? 0)
          : allSortMap.get(String(item.id)) ?? Number(item?.allSort ?? item?.sort ?? 0),
      }));
      setDraftTools(nextTools);
      setDirtyAllTools(true);
      setDirtyTools(true);
    } else {
      const categorySortMap = new Map(finalOrder.map((id, index) => [id, index + 1]));
      const nextTools = draftTools.map((item) => {
        if (String(item.catelog ?? "") !== drag.currentTag) {
          return item;
        }
        return {
          ...item,
          sort: categorySortMap.get(String(item.id)) ?? Number(item?.sort ?? 0),
        };
      });
      setDraftTools(nextTools);
      setDirtyCatelogs((previous) => ({ ...previous, [drag.currentTag]: true }));
      setDirtyTools(true);
    }
    setDraggingCardId(null);
    setCardTargetId(null);
    cardDragRef.current = null;
  };

  const handleCardDragStart = (item: any, event: React.DragEvent<HTMLDivElement>) => {
    if (!editMode) {
      return;
    }
    if (currTag === ALL_TOOLS_TAG && isFixedTailTool(item)) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(item.id));
    const startVisibleOrder = filteredData.map((each: any) => String(each.id));
    const startGlobalOrder = draftTools.map((tool) => String(tool.id));
    cardDragRef.current = {
      activeId: String(item.id),
      currentTag: currTag,
      startVisibleOrder,
      startGlobalOrder,
    };
    setDraggingCardId(String(item.id));
    setCardTargetId(null);
  };

  const handleCardDragOver = (overId: string, event: React.DragEvent<HTMLDivElement>) => {
    const drag = cardDragRef.current;
    if (!drag) {
      return;
    }
    event.preventDefault();
    if (!overId || overId === drag.activeId) {
      return;
    }
    const activeItem = draftTools.find((item) => String(item.id) === drag.activeId);
    const overItem = draftTools.find((item) => String(item.id) === overId);
    if ((activeItem && isFixedTailTool(activeItem)) || (overItem && isFixedTailTool(overItem))) {
      return;
    }
    if (
      !activeItem ||
      !overItem ||
      (drag.currentTag !== ALL_TOOLS_TAG && String(activeItem.catelog ?? "") !== String(overItem.catelog ?? ""))
    ) {
      return;
    }
    setCardTargetId(overId);
  };

  const handleCardDragEnd = () => {
    commitCardDrag();
  };

  const handleTagDragStart = (tag: string, event: React.DragEvent<HTMLSpanElement>) => {
    if (!editMode) {
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tag);
    tagDragRef.current = {
      activeId: tag,
      startOrder: [...draftTagOrder],
    };
    setDraggingTagId(tag);
    setTagTargetId(null);
  };

  const handleTagDragOver = (overId: string, event: React.DragEvent<HTMLSpanElement>) => {
    const drag = tagDragRef.current;
    if (!drag) {
      return;
    }
    event.preventDefault();
    if (!overId || overId === drag.activeId) {
      return;
    }
    setTagTargetId(overId);
  };

  const handleTagDragEnd = () => {
    const drag = tagDragRef.current;
    if (!drag) {
      return;
    }
    const targetId = tagTargetId;
    if (!targetId || targetId === drag.activeId) {
      setDraggingTagId(null);
      setTagTargetId(null);
      tagDragRef.current = null;
      return;
    }
    const finalOrder = swapByIds(drag.startOrder, drag.activeId, targetId);
    setDraftTagOrder([...finalOrder]);
    setDirtyTags((previous) => previous || JSON.stringify(finalOrder) !== JSON.stringify(drag.startOrder));
    setDraggingTagId(null);
    setTagTargetId(null);
    tagDragRef.current = null;
  };

  const showClock = data?.siteConfig ? data.siteConfig.showClock !== false : false;
  const editableCards = editMode ? resolveCardOrder() : [];
  const editableTags = editMode ? resolveTagOrder() : [];

  return (
    <>
      <Helmet>
        <meta charSet="utf-8" />
        <link rel="icon" href={data?.setting?.favicon ?? "/logo192.png"} />
        <title>{data?.setting?.title ?? "Van Nav"}</title>
      </Helmet>

      <div className="topbar">
        {showClock ? (
          <div className="clock-row">
            <LocalClock />
          </div>
        ) : null}

        <div className={`content topbar-content ${data?.siteConfig?.compactMode ? "compact-mode" : ""}`}>
          <SearchBar
            searchString={val}
            setSearchText={(text) => {
              setVal(text);
              handleSetSearch(text);
            }}
          />

          {!editMode ? (
            <TagSelector tags={tagsForRender} currTag={currTag} onTagChange={handleSetCurrTag} />
          ) : (
            <div className="tag-selector span-3">
              <div className="tag-selector-wrapper edit-tag-wrapper">
                {editableTags.map((tag) => (
                  <EditableTag
                    key={tag}
                    id={tag}
                    label={tag}
                    active={currTag === tag}
                    dragging={draggingTagId === tag}
                    target={draggingTagId !== tag && tagTargetId === tag}
                    onClick={() => handleSetCurrTag(tag)}
                    onDragStart={(event) => handleTagDragStart(tag, event)}
                    onDragOver={(event) => handleTagDragOver(tag, event)}
                    onDragEnd={handleTagDragEnd}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="content-wraper" onScroll={handleContentScroll} ref={contentWrapperRef}>
        <div className={`content cards ${data?.siteConfig?.compactMode ? "compact-grid" : ""}`}>
          {loading ? (
            <Loading />
          ) : !editMode ? (
            renderCardsV2()
          ) : (
            editableCards.map((item, index) => (
                <EditableCard
                key={item.id}
                item={item}
                index={index}
                isSearching={false}
                noImageMode={data?.siteConfig?.noImageMode || false}
                compactMode={data?.siteConfig?.compactMode || false}
                dragging={draggingCardId === String(item.id)}
                placeholder={draggingCardId === String(item.id)}
                target={draggingCardId !== String(item.id) && cardTargetId === String(item.id)}
                onDragStart={(event) => handleCardDragStart(item, event)}
                onDragOver={(event) => handleCardDragOver(String(item.id), event)}
                onDragEnd={handleCardDragEnd}
                onClickCapture={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
            ))
          )}
        </div>
      </div>

      {editMode ? (
        <div className="home-edit-floating-actions">
          <button type="button" className="home-edit-btn" onClick={cancelEditMode} disabled={savingOrder}>
            取消
          </button>
          <button type="button" className="home-edit-btn home-edit-btn-primary" onClick={handleSaveOrder} disabled={savingOrder}>
            {savingOrder ? "保存中..." : "保存"}
          </button>
        </div>
      ) : null}

      {showBackTop ? (
        <button
          className={`back-top-icon-btn ${data?.siteConfig?.compactMode ? "compact-mode" : ""}`}
          onClick={scrollToTop}
          type="button"
          aria-label="scroll to top"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M12 7.4L6.2 13.2l1.4 1.4 4.4-4.4 4.4 4.4 1.4-1.4z" />
          </svg>
        </button>
      ) : null}

      <div className="record-wraper">
        <a href="https://henniubi.com" target="_blank" rel="noreferrer">
          笔尖码动
        </a>
        <br />
        <a href="https://beian.miit.gov.cn" target="_blank" rel="noreferrer">
          {data?.setting?.govRecord ?? ""}
        </a>
      </div>
    </>
  );
};

export default Content;

