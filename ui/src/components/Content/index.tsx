import "./index.css";
import { Button, ColorPicker, Form, Input, Modal, Select, message } from "antd";
import { LockClosedIcon, LockOpen2Icon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { Helmet } from "react-helmet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import CardV2 from "../CardV2";
import SearchBar from "../SearchBar";
import { Loading } from "../Loading";
import TagSelector from "../TagSelector";
import DarkSwitch from "../DarkSwitch";
import EditableTag from "./EditableTag";
import EditableCard from "./EditableCard";
import LocalClock from "./LocalClock";
import MemoPanel from "./MemoPanel";
import WeatherPanel from "./WeatherPanel";
import type { WeatherDockEdge, WeatherPanelMode } from "./WeatherPanel";
import type { TagSelectorItem } from "../TagSelector";
import PageActions from "./PageActions";
import PerformancePanel from "./PerformancePanel";
import {
  FetchList,
  fetchDeleteCatelog,
  fetchDeleteTool,
  fetchUnlockCatelog,
  fetchUnlockTool,
  AUTH_STATE_CHANGE_EVENT,
  fetchUpdateSetting,
  fetchUpdateSiteConfig,
  fetchUpdateCateLog,
  fetchUpdateTool,
} from "../../utils/api";
import { applyGlobalFontFamily } from "../../utils/font";
import { isLogin } from "../../utils/check";
import { generateSearchEngineCard } from "../../utils/serachEngine";
import { toggleJumpTarget } from "../../utils/setting";
import { loadLocalWeather } from "../../utils/weather";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { buildSearchIndex, matchesSearchIndex } from "../../utils/search";
import { applyAppearanceSettings, DEFAULT_DARK_THEME_PALETTE, DEFAULT_LIGHT_THEME_PALETTE, parseThemePalette } from "../../utils/appearance";
import { buildEditableThemeFormValues, COMPACT_THEME_FIELDS, normalizePaletteWithEditableFields } from "../../utils/appearanceEditor";
import { normalizeLayoutScale } from "../../utils/layoutScale";
import type { LayoutScale } from "../../utils/layoutScale";
import { measureAsync, measureSync, recordPerfMetric, setSitePerformancePanelEnabled } from "../../utils/perf";
import useVirtualGrid from "../../hooks/useVirtualGrid";
import {
  applyPreviewOrder,
  commitTagItemsByPreview,
  commitScopedToolOrder,
  findClosestReorderSlot,
  mergeVisiblePreviewIntoGlobalOrder,
  reorderPreviewByTarget,
} from "./manualReorder";

const UNLOCKED_CATELOG_STORAGE_KEY = "unlocked-catelogs";
const WEATHER_DOCK_STORAGE_KEY = "weather-dock-state";
const MEMO_PANEL_POSITION_STORAGE_KEY = "memo-panel-position";
const UNLOCKED_TOOL_STORAGE_KEY = "unlocked-tools";
const TAG_BAR_ORDER_STORAGE_KEY = "tag-bar-order";
const ALL_TOOLS_ORDER_STORAGE_KEY = "all-tools-order";
const ALL_TOOLS_TAG_ID = "__all_tools__";
const TOOL_SORT_STEP = 1024;
const WEATHER_EDGE_GAP = 10;
// 收紧天气面板占位，展开后也尽量不压到首页主体区域。
const WEATHER_COLLAPSED_WIDTH = 176;
const WEATHER_EXPANDED_WIDTH = 264;
const WEATHER_COLLAPSED_HEIGHT = 86;
const WEATHER_EXPANDED_HEIGHT = 264;

interface WeatherDockState {
  edge: WeatherDockEdge;
  offset: number;
  mode: WeatherPanelMode;
}

interface WeatherDockDragState {
  pointerId: number;
  dragging: boolean;
}

interface MemoPanelPosition {
  right: number;
  bottom: number;
}

interface MemoPanelDragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startRight: number;
  startBottom: number;
  dragging: boolean;
}

interface ManualCardDragOverlay {
  item: any;
  width: number;
  height: number;
  left: number;
  top: number;
}

interface ManualCardDragSession {
  pointerId: number;
  activeId: string;
  currentTag: string;
  visibleOrder: string[];
  offsetX: number;
  offsetY: number;
}

interface ManualTagDragOverlay {
  id: string;
  label: ReactNode;
  width: number;
  height: number;
}

interface ManualTagDragSession {
  pointerId: number;
  activeId: string;
  visibleOrder: string[];
  offsetX: number;
  offsetY: number;
}

const readUnlockedCatelogs = () => {
  try {
    const raw = window.localStorage.getItem(UNLOCKED_CATELOG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeUnlockedCatelogs = (ids: number[]) => {
  window.localStorage.setItem(UNLOCKED_CATELOG_STORAGE_KEY, JSON.stringify(ids));
};

const clamp = (value: number, min: number, max: number) => {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const getWeatherPanelSize = (mode: WeatherPanelMode) => {
  if (mode === "expanded") {
    return { width: WEATHER_EXPANDED_WIDTH, height: WEATHER_EXPANDED_HEIGHT };
  }
  return { width: WEATHER_COLLAPSED_WIDTH, height: WEATHER_COLLAPSED_HEIGHT };
};

const clampDockOffset = (edge: WeatherDockEdge, offset: number, mode: WeatherPanelMode) => {
  const { width, height } = getWeatherPanelSize(mode);
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxOffset =
    edge === "top" || edge === "bottom"
      ? viewportWidth - width - WEATHER_EDGE_GAP
      : viewportHeight - height - WEATHER_EDGE_GAP;

  return clamp(offset, WEATHER_EDGE_GAP, maxOffset);
};

const buildDockState = (edge: WeatherDockEdge, offset: number, mode: WeatherPanelMode): WeatherDockState => ({
  edge,
  offset: clampDockOffset(edge, offset, mode),
  mode,
});

const readWeatherDockState = () => {
  try {
    const raw = window.localStorage.getItem(WEATHER_DOCK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const edge = ["top", "right", "bottom", "left"].includes(parsed?.edge) ? parsed.edge : "left";
      const mode = ["collapsed", "expanded", "dismissed"].includes(parsed?.mode) ? parsed.mode : "collapsed";
      return buildDockState(edge as WeatherDockEdge, Number(parsed?.offset ?? 120), mode as WeatherPanelMode);
    }

    // 兼容旧的自由坐标存档，首次进入时自动迁移到最近边缘吸附模型。
    const legacyRaw = window.localStorage.getItem("weather-floating-position");
    const legacyDismissed = window.localStorage.getItem("weather-dismissed") === "1";
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      const x = Number(parsed?.x ?? 24);
      const y = Number(parsed?.y ?? 24);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const distances = [
        { edge: "top" as WeatherDockEdge, distance: y, offset: x },
        { edge: "bottom" as WeatherDockEdge, distance: viewportHeight - y, offset: x },
        { edge: "left" as WeatherDockEdge, distance: x, offset: y },
        { edge: "right" as WeatherDockEdge, distance: viewportWidth - x, offset: y },
      ].sort((left, right) => left.distance - right.distance);

      return buildDockState(distances[0].edge, distances[0].offset, legacyDismissed ? "dismissed" : "collapsed");
    }
  } catch {
    return buildDockState("left", 120, "collapsed");
  }

  return buildDockState("left", 120, "collapsed");
};

const readUnlockedTools = () => {
  try {
    const raw = window.localStorage.getItem(UNLOCKED_TOOL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const readMemoPanelPosition = (): MemoPanelPosition => {
  try {
    const raw = window.localStorage.getItem(MEMO_PANEL_POSITION_STORAGE_KEY);
    if (!raw) {
      return { right: 18, bottom: 88 };
    }
    const parsed = JSON.parse(raw);
    return {
      right: Number.isFinite(Number(parsed?.right)) ? Number(parsed.right) : 18,
      bottom: Number.isFinite(Number(parsed?.bottom)) ? Number(parsed.bottom) : 88,
    };
  } catch {
    return { right: 18, bottom: 88 };
  }
};

const getMemoPanelBounds = (memoCollapsed: boolean) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const panelWidth = memoCollapsed ? 132 : Math.min(320, viewportWidth - 36);
  const panelHeight = memoCollapsed ? 56 : 272;

  return {
    maxRight: Math.max(12, viewportWidth - panelWidth - 12),
    maxBottom: Math.max(12, viewportHeight - panelHeight - 12),
  };
};

const snapMemoPanelPosition = (position: MemoPanelPosition, memoCollapsed: boolean): MemoPanelPosition => {
  const { maxRight, maxBottom } = getMemoPanelBounds(memoCollapsed);
  return {
    right: position.right <= 36 ? 18 : clamp(position.right, 12, maxRight),
    bottom: position.bottom <= 36 ? 18 : clamp(position.bottom, 12, maxBottom),
  };
};

const writeUnlockedTools = (payload: Record<number, string>) => {
  window.localStorage.setItem(UNLOCKED_TOOL_STORAGE_KEY, JSON.stringify(payload));
};

const readTagBarOrder = () => {
  try {
    const raw = window.localStorage.getItem(TAG_BAR_ORDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const writeTagBarOrder = (order: string[]) => {
  window.localStorage.setItem(TAG_BAR_ORDER_STORAGE_KEY, JSON.stringify(order));
};

const readAllToolsOrder = () => {
  try {
    const raw = window.localStorage.getItem(ALL_TOOLS_ORDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const writeAllToolsOrder = (order: string[]) => {
  window.localStorage.setItem(ALL_TOOLS_ORDER_STORAGE_KEY, JSON.stringify(order));
};

const buildTagBarId = (id: number) => `catelog:${id}`;

const getNextCategorySort = (items: any[], categoryName: string) => {
  const currentMaxSort = items.reduce((maxSort, item) => {
    if (String(item.catelog ?? "") !== categoryName) {
      return maxSort;
    }
    const resolvedSort = Number(item.sort);
    return Number.isFinite(resolvedSort) ? Math.max(maxSort, resolvedSort) : maxSort;
  }, 0);

  return currentMaxSort > 0 ? currentMaxSort + TOOL_SORT_STEP : TOOL_SORT_STEP;
};

const mergeAllToolsOrder = (items: any[], order: string[]) => {
  const availableIds = items.map((item) => String(item.id));
  const keptIds = order.filter((item) => availableIds.includes(item));
  const missingIds = availableIds.filter((item) => !keptIds.includes(item));
  return [...keptIds, ...missingIds];
};

const cloneSnapshot = (items: any[]) => items.map((item) => ({ ...item }));
const withSequentialSort = (items: any[]) => items.map((item, index) => ({ ...item, sort: index + 1 }));
const normalizeInitialOrder = (items: any[]) =>
  items
    .map((item, index) => ({
      ...item,
      // 旧数据里可能完全没有 sort，先按稀疏间隔补齐，后续局部换位和跨分类调整会更稳定。
      sort: Number.isFinite(Number(item?.sort)) && Number(item?.sort) > 0 ? Number(item.sort) : (index + 1) * TOOL_SORT_STEP,
    }))
    .sort((left, right) => Number(left.sort) - Number(right.sort) || Number(left.id) - Number(right.id));

const buildTagDisplayItems = (items: any[], unlockedCatelogIds: number[]): TagSelectorItem[] => [
  { value: "全部工具", label: "全部工具" },
  ...items.map((item) => {
    const unlocked = Boolean(item.passwordProtected) && unlockedCatelogIds.includes(item.id);
    return {
      value: item.name,
      label: item.name || "未分类",
      locked: Boolean(item.passwordProtected) && !unlocked,
      unlocked,
    };
  }),
];

const mergeTagBarOrder = (items: any[], order: string[]) => {
  const availableIds = [ALL_TOOLS_TAG_ID, ...items.map((item) => buildTagBarId(item.id))];
  const keptIds = order.filter((item) => availableIds.includes(item));
  const missingIds = availableIds.filter((item) => !keptIds.includes(item));
  return [...keptIds, ...missingIds];
};

const getShortcutIndex = (event: KeyboardEvent) => {
  const key = event.key;
  if (/^[1-9]$/.test(key)) {
    return Number(key) - 1;
  }
  if (/^Digit[1-9]$/.test(event.code)) {
    return Number(event.code.slice(-1)) - 1;
  }
  if (/^Numpad[1-9]$/.test(event.code)) {
    return Number(event.code.slice(-1)) - 1;
  }
  return -1;
};

const Content = (props: { editMode?: boolean }) => {
  const { editMode = false } = props;
  const [data, setData] = useState<any>({});
  const [draftTools, setDraftTools] = useState<any[]>([]);
  const [draftCatelogItems, setDraftCatelogItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currTag, setCurrTag] = useState("全部工具");
  const [searchString, setSearchString] = useState("");
  const [val, setVal] = useState("");
  const [searchEngineCards, setSearchEngineCards] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [weatherMessage, setWeatherMessage] = useState("天气加载中");
  const [weatherDock, setWeatherDock] = useState<WeatherDockState>(() => readWeatherDockState());
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(false);
  const [layoutScale, setLayoutScale] = useState<LayoutScale>("default");
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingMemo, setSavingMemo] = useState(false);
  const [memoCollapsed, setMemoCollapsed] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");
  const [memoPanelPosition, setMemoPanelPosition] = useState<MemoPanelPosition>(() => readMemoPanelPosition());
  const [memoDragging, setMemoDragging] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.body.classList.contains("dark-mode"));
  const [pendingUnlockTag, setPendingUnlockTag] = useState<any>(null);
  const [unlockedCatelogIds, setUnlockedCatelogIds] = useState<number[]>(() => readUnlockedCatelogs());
  const [toolUnlockModalOpen, setToolUnlockModalOpen] = useState(false);
  const [toolUnlockPassword, setToolUnlockPassword] = useState("");
  const [pendingUnlockTool, setPendingUnlockTool] = useState<any>(null);
  const [unlockedToolUrls, setUnlockedToolUrls] = useState<Record<number, string>>(() => readUnlockedTools());
  const [tagBarOrder, setTagBarOrder] = useState<string[]>(() => readTagBarOrder());
  const [allToolsOrder, setAllToolsOrder] = useState<string[]>(() => readAllToolsOrder());
  const [cardPreviewOrder, setCardPreviewOrder] = useState<string[] | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingCardOverlay, setDraggingCardOverlay] = useState<ManualCardDragOverlay | null>(null);
  const [cardTargetId, setCardTargetId] = useState<string | null>(null);
  const [tagPreviewOrder, setTagPreviewOrder] = useState<string[] | null>(null);
  const [draggingTagId, setDraggingTagId] = useState<string | null>(null);
  const [draggingTagOverlay, setDraggingTagOverlay] = useState<ManualTagDragOverlay | null>(null);
  const [tagTargetId, setTagTargetId] = useState<string | null>(null);
  const [jiggleMode, setJiggleMode] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [contextMenu, setContextMenu] = useState<any>(null);
  const [editingTool, setEditingTool] = useState<any>(null);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [themeDraftValues, setThemeDraftValues] = useState<any>(null);

  const [toolForm] = Form.useForm();
  const [tagForm] = Form.useForm();
  const [themeForm] = Form.useForm();
  const debouncedInputValue = useDebouncedValue(val, 180);
  const longPressTimerRef = useRef<number | null>(null);
  const cardNodeMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const cardOverlayRef = useRef<HTMLDivElement | null>(null);
  const cardPreviewOrderRef = useRef<string[] | null>(null);
  const manualCardDragRef = useRef<ManualCardDragSession | null>(null);
  const manualCardPointerUpRef = useRef<(event: PointerEvent) => void>();
  const manualCardMoveFrameRef = useRef<number | null>(null);
  const manualCardMoveEventRef = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null);
  const lastNearestCardSlotIdRef = useRef<string | null>(null);
  const editableCardItemsRef = useRef<any[]>([]);
  const tagNodeMapRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  const tagOverlayRef = useRef<HTMLDivElement | null>(null);
  const tagPreviewOrderRef = useRef<string[] | null>(null);
  const manualTagDragRef = useRef<ManualTagDragSession | null>(null);
  const manualTagPointerUpRef = useRef<(event: PointerEvent) => void>();
  const manualTagMoveFrameRef = useRef<number | null>(null);
  const manualTagMoveEventRef = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null);
  const lastNearestTagSlotIdRef = useRef<string | null>(null);
  const contentWrapperRef = useRef<HTMLDivElement | null>(null);
  const weatherDragRef = useRef<WeatherDockDragState | null>(null);
  const memoDragRef = useRef<MemoPanelDragState | null>(null);
  const filteredDataRef = useRef<any>([]);
  const originalSnapshotRef = useRef<{ tools: any[]; catelogs: any[] } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await measureAsync("首页数据整理", () => FetchList(), "FetchList");
      const normalizedTools = normalizeInitialOrder(
        (response?.tools ?? []).filter((item: any) => !String(item.url ?? "").startsWith("toggleJumpTarget") && item.id < 900000000000)
      );
      const normalizedCatelogs = normalizeInitialOrder(response?.catelogItems ?? []);
      setData(response);
      setLayoutScale(normalizeLayoutScale(response?.siteConfig?.layoutScale));
      setMemoDraft(String(response?.setting?.memoContent ?? ""));
      setDraftTools(cloneSnapshot(normalizedTools));
      setDraftCatelogItems(cloneSnapshot(normalizedCatelogs));
      setTagBarOrder((previous) => mergeTagBarOrder(normalizedCatelogs, previous.length ? previous : readTagBarOrder()));
      setAllToolsOrder((previous) => mergeAllToolsOrder(normalizedTools, previous.length ? previous : readAllToolsOrder()));
      originalSnapshotRef.current = {
        tools: cloneSnapshot(normalizedTools),
        catelogs: cloneSnapshot(normalizedCatelogs),
      };
      applyGlobalFontFamily(response?.setting?.fontFamily);

      const tagNames = ["全部工具", ...(response?.catelogItems ?? []).map((item: any) => item.name)];
      const savedTag = window.localStorage.getItem("tag");
      const unlockedIds = readUnlockedCatelogs();
      const firstUnlockedTag = (response?.catelogItems ?? []).find((item: any) => !item.passwordProtected || unlockedIds.includes(item.id))?.name;
      const savedTagItem = (response?.catelogItems ?? []).find((item: any) => item.name === savedTag);
      const preferredTag =
        savedTag && tagNames.includes(savedTag) && (!savedTagItem?.passwordProtected || unlockedIds.includes(savedTagItem.id))
          ? savedTag
          : firstUnlockedTag ?? tagNames[0] ?? "全部工具";
      setCurrTag(preferredTag);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSitePerformancePanelEnabled(Boolean(data?.siteConfig?.showPerformancePanel));
  }, [data?.siteConfig?.showPerformancePanel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleAuthStateChange = () => {
      loadData();
    };
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.body.classList.contains("dark-mode"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthStateChange as EventListener);
    return () => {
      observer.disconnect();
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthStateChange as EventListener);
    };
  }, [loadData]);

  useEffect(() => {
    if (debouncedInputValue !== "") {
      setCurrTag("全部工具");
      setSearchString(debouncedInputValue.trim());
      return;
    }

    setSearchString("");
    const tagInLocalStorage = window.localStorage.getItem("tag");
    if (tagInLocalStorage && tagInLocalStorage !== "" && tagInLocalStorage !== "管理后台") {
      setCurrTag(tagInLocalStorage);
    }
  }, [debouncedInputValue]);

  useEffect(() => {
    // 搜索态保留搜索引擎扩展卡片，视图调整时关闭它，避免把非真实书签也拖进保存逻辑。
    if (editMode) {
      setSearchEngineCards([]);
      return;
    }

    const loadSearchEngineCards = async () => {
      try {
        const cards = await generateSearchEngineCard(searchString);
        setSearchEngineCards(cards);
      } catch (error) {
        console.error("加载搜索引擎卡片失败:", error);
        setSearchEngineCards([]);
      }
    };

    loadSearchEngineCards();
  }, [editMode, searchString]);

  useEffect(() => {
    if (data?.setting?.showWeather === false) {
      setWeather(null);
      setWeatherMessage("天气已关闭");
      return;
    }

    let active = true;
    loadLocalWeather({
      mode: data?.siteConfig?.weatherMode,
      city: data?.siteConfig?.weatherCity,
    })
      .then((snapshot) => {
        if (!active) {
          return;
        }
        setWeather(snapshot);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setWeather(null);
        setWeatherMessage(error instanceof Error ? error.message : "天气不可用");
      });

    return () => {
      active = false;
    };
  }, [data?.setting?.showWeather, data?.siteConfig?.weatherCity, data?.siteConfig?.weatherMode]);

  useEffect(() => {
    window.localStorage.setItem(WEATHER_DOCK_STORAGE_KEY, JSON.stringify(weatherDock));
  }, [weatherDock]);

  useEffect(() => {
    window.localStorage.setItem(MEMO_PANEL_POSITION_STORAGE_KEY, JSON.stringify(memoPanelPosition));
  }, [memoPanelPosition]);

  useEffect(() => {
    writeUnlockedTools(unlockedToolUrls);
  }, [unlockedToolUrls]);

  useEffect(() => {
    writeTagBarOrder(tagBarOrder);
  }, [tagBarOrder]);

  useEffect(() => {
    writeAllToolsOrder(allToolsOrder);
  }, [allToolsOrder]);

  useEffect(() => {
    cardPreviewOrderRef.current = cardPreviewOrder;
  }, [cardPreviewOrder]);

  useEffect(() => {
    tagPreviewOrderRef.current = tagPreviewOrder;
  }, [tagPreviewOrder]);

  useEffect(() => {
    // 右键菜单在空白处点击后关闭，避免遮挡后续拖拽。
    const handleCloseMenu = () => setContextMenu(null);
    document.addEventListener("click", handleCloseMenu);
    return () => document.removeEventListener("click", handleCloseMenu);
  }, []);

  const catelogMap = useMemo(() => {
    return new Map((draftCatelogItems ?? []).map((item: any) => [item.name, item]));
  }, [draftCatelogItems]);

  const orderedDraftCatelogItems = useMemo(() => {
    const order = mergeTagBarOrder(draftCatelogItems, tagBarOrder);
    const orderMap = new Map(order.map((item, index) => [item, index]));
    return [...draftCatelogItems].sort((left, right) => {
      const leftIndex = orderMap.get(buildTagBarId(left.id)) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = orderMap.get(buildTagBarId(right.id)) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
  }, [draftCatelogItems, tagBarOrder]);

  const isLockedCatelog = useCallback(
    (catelogName: string) => {
      const tag = catelogMap.get(catelogName);
      if (!tag?.passwordProtected) {
        return false;
      }
      return !unlockedCatelogIds.includes(tag.id);
    },
    [catelogMap, unlockedCatelogIds]
  );

  const publicTools = useMemo(() => {
    return (editMode ? draftTools : data?.tools ?? []).filter((item: any) => !isLockedCatelog(item.catelog));
  }, [data?.tools, draftTools, editMode, isLockedCatelog]);

  const indexedPublicTools = useMemo(() => {
    return publicTools.map((item: any) => ({
      item,
      index: buildSearchIndex(item.name, item.desc, item.url, item.catelog),
    }));
  }, [publicTools]);

  const filteredData = useMemo(() => {
    const currentTools = measureSync("首页过滤", () => {
      const nextItems = indexedPublicTools
        .filter(({ item }: any) => {
          if (currTag === "全部工具") {
            return true;
          }
          return item.catelog === currTag;
        })
        .filter(({ index }: any) => {
          if (searchString === "") {
            return true;
          }
          return matchesSearchIndex(index, searchString);
        })
        .map(({ item }: any) => item);

      if (currTag !== "全部工具") {
        return nextItems;
      }

      const order = mergeAllToolsOrder(nextItems, allToolsOrder);
      const orderMap = new Map(order.map((item, index) => [item, index]));
      return [...nextItems].sort((left, right) => {
        const leftIndex = orderMap.get(String(left.id)) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = orderMap.get(String(right.id)) ?? Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex;
      });
    }, `tag=${currTag} keyword=${searchString || "-"}`);

    const visibleTools = editMode ? currentTools : [...currentTools, ...searchEngineCards];
    // 搜索快捷键必须和页面当前展示顺序完全一致，包含搜索引擎扩展卡片。
    filteredDataRef.current = visibleTools;
    return visibleTools;
  }, [allToolsOrder, currTag, editMode, indexedPublicTools, searchEngineCards, searchString]);

  const virtualGrid = useVirtualGrid(contentWrapperRef.current, {
    // 全部工具先关闭虚拟列表，保证它和普通分类使用同一套首屏排版，避免标签下方间距观感不一致。
    enabled: !editMode && !loading && currTag !== "全部工具" && filteredData.length > 120,
    itemCount: filteredData.length,
    compactMode: Boolean(data?.siteConfig?.compactMode),
    noImageMode: Boolean(data?.siteConfig?.noImageMode),
    layoutScale,
  });

  const visibleNormalCards = useMemo(() => {
    if (!virtualGrid.active) {
      return filteredData;
    }
    return filteredData.slice(virtualGrid.startIndex, virtualGrid.endIndex);
  }, [filteredData, virtualGrid.active, virtualGrid.endIndex, virtualGrid.startIndex]);

  const editableCardItems = useMemo(() => {
    if (!editMode) {
      return filteredData;
    }
    if (!cardPreviewOrder?.length) {
      return filteredData;
    }
    return applyPreviewOrder(filteredData, cardPreviewOrder);
  }, [cardPreviewOrder, editMode, filteredData]);

  // 视图调整时全量卡片抖动动画在大数据量下会明显掉帧，这里保留编辑能力，但停掉批量动画。
  const enableCardJiggleAnimation = editableCardItems.length <= 120;

  useEffect(() => {
    editableCardItemsRef.current = editableCardItems;
  }, [editableCardItems]);

  const editableTagItems = useMemo(() => {
    const baseItems = [
      { id: ALL_TOOLS_TAG_ID, rawId: ALL_TOOLS_TAG_ID, label: "全部工具", item: null, active: currTag === "全部工具", jiggleVariant: "alt" as const },
      ...orderedDraftCatelogItems.map((item, index) => ({
        id: buildTagBarId(item.id),
        rawId: String(item.id),
        label: (
          <>
            {item.passwordProtected ? (
              <span
                className={`tag-lock-indicator ${unlockedCatelogIds.includes(item.id) ? "tag-lock-indicator-unlocked" : "tag-lock-indicator-locked"}`}
                aria-hidden="true"
              >
                {unlockedCatelogIds.includes(item.id) ? <LockOpen2Icon /> : <LockClosedIcon />}
              </span>
            ) : null}
            <span className="tag-label-text">{item.name || "未分类"}</span>
          </>
        ),
        item,
        active: currTag === item.name,
        jiggleVariant: index % 2 === 0 ? "base" as const : "alt" as const,
      })),
    ];

    if (!editMode || !tagPreviewOrder?.length) {
      return baseItems;
    }

    return applyPreviewOrder(baseItems, tagPreviewOrder);
  }, [currTag, editMode, orderedDraftCatelogItems, tagPreviewOrder, unlockedCatelogIds]);

  useEffect(() => {
    recordPerfMetric("首页结果数", filteredData.length, `tools=${publicTools.length}`);
  }, [filteredData.length, publicTools.length]);

  useEffect(() => {
    // 全部工具启用虚拟列表后，如果沿用旧的滚动位置，首帧会先带出顶部占位，视觉上像分类下方空了一大截。
    // 这里在分类切换后强制把滚动容器同步归零，确保全部工具和普通分类从同一顶边开始排版。
    if (!contentWrapperRef.current) {
      return;
    }

    contentWrapperRef.current.scrollTop = 0;
    const frameId = window.requestAnimationFrame(() => {
      if (contentWrapperRef.current) {
        contentWrapperRef.current.scrollTop = 0;
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [currTag]);

  useEffect(() => {
    if (virtualGrid.active) {
      recordPerfMetric(
        "首页虚拟窗口",
        virtualGrid.endIndex - virtualGrid.startIndex,
        `${virtualGrid.startIndex}-${virtualGrid.endIndex}`
      );
    }
  }, [virtualGrid.active, virtualGrid.endIndex, virtualGrid.startIndex]);

  const handleClearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    handleClearLongPress();
    // 进入视图调整页时直接进入抖动态，避免再要求用户长按触发。
    if (editMode) {
      setJiggleMode(true);
      return;
    }
    setJiggleMode(false);
    setCardPreviewOrder(null);
    setDraggingCardId(null);
    setDraggingCardOverlay(null);
    setCardTargetId(null);
    setTagPreviewOrder(null);
    setDraggingTagId(null);
    setDraggingTagOverlay(null);
    setTagTargetId(null);
  }, [editMode]);

  useEffect(() => {
    if (!data?.setting) {
      return;
    }
    const initialDraftValues = buildEditableThemeFormValues({
      lightThemePalette: parseThemePalette(data.setting.lightThemeConfig, "light"),
      darkThemePalette: parseThemePalette(data.setting.darkThemeConfig, "dark"),
    });
    // 进入页面或重新拉取配置时，把配色草稿和表单同步到最新已保存值，作为本轮调整的回退基线。
    setThemeDraftValues(initialDraftValues);
    themeForm.setFieldsValue(initialDraftValues);
  }, [data?.setting, themeForm]);

  const watchedLightThemePalette = Form.useWatch("lightThemePalette", themeForm);
  const watchedDarkThemePalette = Form.useWatch("darkThemePalette", themeForm);

  useEffect(() => {
    if (!themeDraftValues) {
      return;
    }
    setThemeDraftValues({
      lightThemePalette: watchedLightThemePalette ?? themeDraftValues.lightThemePalette,
      darkThemePalette: watchedDarkThemePalette ?? themeDraftValues.darkThemePalette,
    });
  }, [watchedDarkThemePalette, watchedLightThemePalette]);

  useEffect(() => {
    if (!themePanelOpen || !data?.setting) {
      return;
    }

    const previewSetting = {
      ...data.setting,
      lightThemeConfig: JSON.stringify(
        normalizePaletteWithEditableFields(
          watchedLightThemePalette || {},
          parseThemePalette(data.setting.lightThemeConfig, "light") || DEFAULT_LIGHT_THEME_PALETTE,
        ),
      ),
      darkThemeConfig: JSON.stringify(
        normalizePaletteWithEditableFields(
          watchedDarkThemePalette || {},
          parseThemePalette(data.setting.darkThemeConfig, "dark") || DEFAULT_DARK_THEME_PALETTE,
        ),
      ),
    };
    // 视图调整里调色必须实时回写 CSS 变量，这样用户移动取色器时能直接看到页面变化。
    applyAppearanceSettings(previewSetting, isDarkMode);
  }, [data?.setting, isDarkMode, themePanelOpen, watchedDarkThemePalette, watchedLightThemePalette]);

  const resetSearch = (notSetTag?: boolean) => {
    setVal("");
    setSearchString("");
    const tagInLocalStorage = window.localStorage.getItem("tag");
    if (!notSetTag && tagInLocalStorage && tagInLocalStorage !== "" && tagInLocalStorage !== "管理后台") {
      setCurrTag(tagInLocalStorage);
    }
  };

  const openUnlockModal = (tag: any) => {
    setPendingUnlockTag(tag);
    setUnlockPassword("");
    setUnlockModalOpen(true);
  };

  const handleSetCurrTag = (tagName: string) => {
    const tag = catelogMap.get(tagName);
    if (tag?.passwordProtected && !unlockedCatelogIds.includes(tag.id)) {
      openUnlockModal(tag);
      return;
    }

    setCurrTag(tagName);
    if (tagName !== "管理后台") {
      window.localStorage.setItem("tag", tagName);
    }
    // 分类切换后统一回到顶部，避免全部工具虚拟列表沿用旧滚动位置导致标签下方出现大片空白。
    contentWrapperRef.current?.scrollTo({ top: 0, behavior: "auto" });
    resetSearch(true);
  };

  const handleSetSearch = (nextValue: string) => {
    setVal(nextValue);
  };

  const handleUnlockCatelog = async () => {
    if (!pendingUnlockTag) {
      return;
    }
    try {
      await fetchUnlockCatelog(pendingUnlockTag.id, unlockPassword);
      const nextIds = Array.from(new Set([...unlockedCatelogIds, pendingUnlockTag.id]));
      setUnlockedCatelogIds(nextIds);
      writeUnlockedCatelogs(nextIds);
      setCurrTag(pendingUnlockTag.name);
      window.localStorage.setItem("tag", pendingUnlockTag.name);
      setUnlockModalOpen(false);
      message.success("分类已解锁");
    } catch (error: any) {
      message.error(error?.response?.data?.errorMessage || "分类密码错误");
    }
  };

  const openToolUnlockModal = (tool: any) => {
    setPendingUnlockTool(tool);
    setToolUnlockPassword("");
    setToolUnlockModalOpen(true);
  };

  const openUrl = (url: string) => {
    const target = window.localStorage.getItem("jumpTarget") === "self" ? "_self" : "_blank";
    window.open(url, target, "noreferrer");
  };

  const handleOpenTool = useCallback(async (item: any) => {
    if (!item) {
      return;
    }
    if (item.url === "toggleJumpTarget") {
      toggleJumpTarget();
      loadData();
      return;
    }
    if (!item.passwordProtected) {
      if (item.url) {
        openUrl(item.url);
      }
      resetSearch();
      return;
    }

    const cachedUrl = unlockedToolUrls[item.id];
    if (cachedUrl) {
      openUrl(cachedUrl);
      resetSearch();
      return;
    }

    openToolUnlockModal(item);
  }, [loadData, unlockedToolUrls]);

  const handleUnlockTool = async () => {
    if (!pendingUnlockTool) {
      return;
    }
    try {
      const result = await fetchUnlockTool(pendingUnlockTool.id, toolUnlockPassword);
      const resolvedUrl = String(result?.url ?? "");
      if (!resolvedUrl) {
        throw new Error("书签地址为空");
      }
      setUnlockedToolUrls((previous) => ({
        ...previous,
        [pendingUnlockTool.id]: resolvedUrl,
      }));
      setToolUnlockModalOpen(false);
      openUrl(resolvedUrl);
      resetSearch();
      message.success("书签已解锁");
    } catch (error: any) {
      message.error(error?.response?.data?.errorMessage || "书签密码错误");
    }
  };

  const onKeyEnter = useCallback((ev: KeyboardEvent) => {
    const cards = filteredDataRef.current;
    if (ev.keyCode === 13 && !editMode) {
      if (cards && cards.length) {
        handleOpenTool(cards[0]);
      }
    }
    if ((ev.ctrlKey || ev.metaKey) && !editMode) {
      const index = getShortcutIndex(ev);
      if (index < 0) {
        return;
      }
      ev.preventDefault();
      if (index >= 0 && index < cards.length) {
        handleOpenTool(cards[index]);
      }
    }
  }, [editMode, handleOpenTool]);

  useEffect(() => {
    if (searchString.trim() === "" || editMode) {
      document.removeEventListener("keydown", onKeyEnter);
    } else {
      document.addEventListener("keydown", onKeyEnter);
    }
    return () => document.removeEventListener("keydown", onKeyEnter);
  }, [editMode, onKeyEnter, searchString]);

  const handleToolContextMenu = (event: ReactMouseEvent, item: any) => {
    if (!editMode || !jiggleMode) {
      return;
    }
    event.preventDefault();
    setContextMenu({
      type: "tool",
      item,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleTagContextMenu = (event: ReactMouseEvent, item: any) => {
    if (!editMode || !jiggleMode) {
      return;
    }
    event.preventDefault();
    setContextMenu({
      type: "tag",
      item,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleDeleteFromDraft = () => {
    if (!contextMenu) {
      return;
    }

    if (contextMenu.type === "tool") {
      setDraftTools((previous) => previous.filter((item) => item.id !== contextMenu.item.id));
    } else {
      setDraftCatelogItems((previous) => previous.filter((item) => item.id !== contextMenu.item.id));
      setDraftTools((previous) => previous.filter((item) => item.catelog !== contextMenu.item.name));
      if (currTag === contextMenu.item.name) {
        setCurrTag("全部工具");
      }
    }
    setContextMenu(null);
  };

  const openEditModal = () => {
    if (!contextMenu) {
      return;
    }
    if (contextMenu.type === "tool") {
      setEditingTool(contextMenu.item);
      toolForm.setFieldsValue({
        ...contextMenu.item,
        accessPassword: "",
        clearAccessPassword: false,
      });
    } else {
      setEditingTag(contextMenu.item);
      tagForm.setFieldsValue({
        name: contextMenu.item.name,
        hide: contextMenu.item.hide,
        accessPassword: "",
        clearAccessPassword: false,
      });
    }
    setContextMenu(null);
  };

  const handleToolModalSave = async () => {
    const values = await toolForm.validateFields();
    setDraftTools((previous) => {
      const nextCategory = String(values.catelog ?? editingTool.catelog ?? "");
      const categoryChanged = nextCategory !== String(editingTool.catelog ?? "");
      const nextSort = categoryChanged ? getNextCategorySort(previous, nextCategory) : editingTool.sort;

      return previous.map((item) =>
        item.id === editingTool.id ? { ...item, ...values, sort: nextSort } : item
      );
    });
    if (currTag === editingTool.catelog && values.catelog !== editingTool.catelog) {
      setCurrTag("全部工具");
    }
    setEditingTool(null);
  };

  const handleTagModalSave = async () => {
    const values = await tagForm.validateFields();
    setDraftCatelogItems((previous) =>
      previous.map((item) =>
        item.id === editingTag.id
          ? { ...item, ...values }
          : item
      )
    );
    setDraftTools((previous) =>
      previous.map((item) =>
        item.catelog === editingTag.name ? { ...item, catelog: values.name } : item
      )
    );
    if (currTag === editingTag.name) {
      setCurrTag(values.name);
    }
    setEditingTag(null);
  };

  const updateCardOverlayPosition = useCallback((clientX: number, clientY: number) => {
    const dragSession = manualCardDragRef.current;
    if (!dragSession || !cardOverlayRef.current) {
      return;
    }
    const left = clientX - dragSession.offsetX;
    const top = clientY - dragSession.offsetY;
    cardOverlayRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }, []);

  const findNearestCardSlotId = useCallback((clientX: number, clientY: number) => {
    const dragSession = manualCardDragRef.current;
    const visibleOrder = cardPreviewOrderRef.current?.length ? cardPreviewOrderRef.current : dragSession?.visibleOrder ?? [];
    if (!visibleOrder.length) {
      return null;
    }

    const slots: Array<{ id: string; left: number; top: number; width: number; height: number }> = [];
    for (const id of visibleOrder) {
      const node = cardNodeMapRef.current.get(id);
      if (!node) {
        continue;
      }
      const rect = node.getBoundingClientRect();
      slots.push({
        id,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }
    // 卡片拖拽只在真正进入目标卡片或靠得足够近时才触发预览重排，避免大量卡片被迫连锁换位。
    return findClosestReorderSlot(slots, clientX, clientY, dragSession?.activeId);
  }, []);

  const processCardPointerMove = useCallback(() => {
    manualCardMoveFrameRef.current = null;
    const moveEvent = manualCardMoveEventRef.current;
    const dragSession = manualCardDragRef.current;
    if (!moveEvent || !dragSession || moveEvent.pointerId !== dragSession.pointerId) {
      return;
    }

    updateCardOverlayPosition(moveEvent.clientX, moveEvent.clientY);
    const nearestSlotId = findNearestCardSlotId(moveEvent.clientX, moveEvent.clientY);
    if (!nearestSlotId || nearestSlotId === dragSession.activeId) {
      return;
    }
    if (nearestSlotId === lastNearestCardSlotIdRef.current) {
      return;
    }
    lastNearestCardSlotIdRef.current = nearestSlotId;
    setCardTargetId(nearestSlotId);
  }, [findNearestCardSlotId, updateCardOverlayPosition]);

  const handleCardPointerMove = useCallback((event: PointerEvent) => {
    const dragSession = manualCardDragRef.current;
    if (!dragSession || event.pointerId !== dragSession.pointerId) {
      return;
    }

    manualCardMoveEventRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    if (manualCardMoveFrameRef.current !== null) {
      return;
    }
    // 拖拽移动只在下一帧统一计算命中和浮层位移，避免高频 pointermove 把主线程打满。
    manualCardMoveFrameRef.current = window.requestAnimationFrame(processCardPointerMove);
  }, [processCardPointerMove]);

  const handleManualCardPointerUp = useCallback((event: PointerEvent) => {
    const dragSession = manualCardDragRef.current;
    if (!dragSession || event.pointerId !== dragSession.pointerId) {
      return;
    }

    if (manualCardMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(manualCardMoveFrameRef.current);
      manualCardMoveFrameRef.current = null;
    }
    manualCardMoveEventRef.current = null;
    lastNearestCardSlotIdRef.current = null;
    setCardTargetId(null);
    window.removeEventListener("pointermove", handleCardPointerMove);
    if (manualCardPointerUpRef.current) {
      window.removeEventListener("pointerup", manualCardPointerUpRef.current);
      window.removeEventListener("pointercancel", manualCardPointerUpRef.current);
    }

    const releaseTargetId =
      findNearestCardSlotId(event.clientX, event.clientY) ??
      lastNearestCardSlotIdRef.current;
    const finalPreviewOrder =
      releaseTargetId && releaseTargetId !== dragSession.activeId
        ? reorderPreviewByTarget(dragSession.visibleOrder, dragSession.activeId, releaseTargetId)
        : dragSession.visibleOrder;
    if (dragSession.currentTag === "全部工具") {
      setAllToolsOrder((previous) => {
        const normalizedOrder = mergeAllToolsOrder(draftTools, previous);
        return mergeVisiblePreviewIntoGlobalOrder(normalizedOrder, finalPreviewOrder);
      });
    } else {
      setDraftTools((previous) => commitScopedToolOrder(previous, finalPreviewOrder, dragSession.currentTag, TOOL_SORT_STEP));
    }

    setCardPreviewOrder(null);
    manualCardDragRef.current = null;
    setDraggingCardId(null);
    setDraggingCardOverlay(null);
  }, [draftTools, findNearestCardSlotId, handleCardPointerMove]);

  useEffect(() => {
    manualCardPointerUpRef.current = handleManualCardPointerUp;
  }, [handleManualCardPointerUp]);

  const handleCardPointerDown = useCallback((item: any, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editMode || !jiggleMode || event.button !== 0) {
      return;
    }

    const activeId = String(item.id);
    const activeNode = cardNodeMapRef.current.get(activeId);
    if (!activeNode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const visibleItems = editableCardItemsRef.current;
    const visibleOrder = visibleItems.map((currentItem) => String(currentItem.id));
    const rect = activeNode.getBoundingClientRect();

    manualCardDragRef.current = {
      pointerId: event.pointerId,
      activeId,
      currentTag: currTag,
      visibleOrder,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    lastNearestCardSlotIdRef.current = activeId;
    setCardPreviewOrder(visibleOrder);
    setDraggingCardId(activeId);
    setCardTargetId(activeId);
    setDraggingCardOverlay({
      item,
      width: rect.width,
      height: rect.height,
      left: 0,
      top: 0,
    });
    window.addEventListener("pointermove", handleCardPointerMove);
    const pointerUpHandler = manualCardPointerUpRef.current ?? handleManualCardPointerUp;
    window.addEventListener("pointerup", pointerUpHandler);
    window.addEventListener("pointercancel", pointerUpHandler);
    window.requestAnimationFrame(() => {
      updateCardOverlayPosition(event.clientX, event.clientY);
    });
  }, [currTag, editMode, handleCardPointerMove, handleManualCardPointerUp, jiggleMode, updateCardOverlayPosition]);

  const processTagPointerMove = useCallback(() => {
    manualTagMoveFrameRef.current = null;
    const moveEvent = manualTagMoveEventRef.current;
    const dragSession = manualTagDragRef.current;
    if (!moveEvent || !dragSession || moveEvent.pointerId !== dragSession.pointerId) {
      return;
    }

    if (tagOverlayRef.current) {
      tagOverlayRef.current.style.transform = `translate3d(${moveEvent.clientX - dragSession.offsetX}px, ${moveEvent.clientY - dragSession.offsetY}px, 0)`;
    }

    const visibleOrder = tagPreviewOrderRef.current?.length ? tagPreviewOrderRef.current : dragSession.visibleOrder;
    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const id of visibleOrder) {
      const node = tagNodeMapRef.current.get(id);
      if (!node) {
        continue;
      }
      const rect = node.getBoundingClientRect();
      const slot = {
        id,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      };
      const distance = Math.hypot(slot.centerX - moveEvent.clientX, slot.centerY - moveEvent.clientY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = slot.id;
      }
    }
    if (!nearestId || nearestId === dragSession.activeId || nearestId === lastNearestTagSlotIdRef.current) {
      return;
    }
    lastNearestTagSlotIdRef.current = nearestId;
    setTagTargetId(nearestId);

    setTagPreviewOrder((previous) => {
      const baseOrder = previous?.length ? previous : dragSession.visibleOrder;
      return reorderPreviewByTarget(baseOrder, dragSession.activeId, nearestId);
    });
  }, []);

  const handleTagPointerMove = useCallback((event: PointerEvent) => {
    const dragSession = manualTagDragRef.current;
    if (!dragSession || event.pointerId !== dragSession.pointerId) {
      return;
    }

    manualTagMoveEventRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    if (manualTagMoveFrameRef.current !== null) {
      return;
    }
    manualTagMoveFrameRef.current = window.requestAnimationFrame(processTagPointerMove);
  }, [processTagPointerMove]);

  const handleManualTagPointerUp = useCallback((event: PointerEvent) => {
    const dragSession = manualTagDragRef.current;
    if (!dragSession || event.pointerId !== dragSession.pointerId) {
      return;
    }

    if (manualTagMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(manualTagMoveFrameRef.current);
      manualTagMoveFrameRef.current = null;
    }
    manualTagMoveEventRef.current = null;
    lastNearestTagSlotIdRef.current = null;
    setTagTargetId(null);
    window.removeEventListener("pointermove", handleTagPointerMove);
    if (manualTagPointerUpRef.current) {
      window.removeEventListener("pointerup", manualTagPointerUpRef.current);
      window.removeEventListener("pointercancel", manualTagPointerUpRef.current);
    }

    const finalPreviewOrder = tagPreviewOrderRef.current?.length ? tagPreviewOrderRef.current : dragSession.visibleOrder;
    setTagBarOrder(finalPreviewOrder);
    setDraftCatelogItems((previous) => commitTagItemsByPreview(previous, finalPreviewOrder));

    manualTagDragRef.current = null;
    setTagPreviewOrder(null);
    setDraggingTagId(null);
    setDraggingTagOverlay(null);
  }, [handleTagPointerMove]);

  useEffect(() => {
    manualTagPointerUpRef.current = handleManualTagPointerUp;
  }, [handleManualTagPointerUp]);

  const handleTagPointerDown = useCallback((tagEntry: any, event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!editMode || !jiggleMode || event.button !== 0) {
      return;
    }

    const activeId = String(tagEntry.id);
    const activeNode = tagNodeMapRef.current.get(activeId);
    if (!activeNode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const visibleOrder = editableTagItems.map((item) => String(item.id));
    const rect = activeNode.getBoundingClientRect();

    manualTagDragRef.current = {
      pointerId: event.pointerId,
      activeId,
      visibleOrder,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    lastNearestTagSlotIdRef.current = activeId;
    setTagPreviewOrder(visibleOrder);
    setDraggingTagId(activeId);
    setTagTargetId(activeId);
    setDraggingTagOverlay({
      id: activeId,
      label: tagEntry.label,
      width: rect.width,
      height: rect.height,
    });
    window.addEventListener("pointermove", handleTagPointerMove);
    const pointerUpHandler = manualTagPointerUpRef.current ?? handleManualTagPointerUp;
    window.addEventListener("pointerup", pointerUpHandler);
    window.addEventListener("pointercancel", pointerUpHandler);
    window.requestAnimationFrame(() => {
      if (tagOverlayRef.current) {
        tagOverlayRef.current.style.transform = `translate3d(${event.clientX - (event.clientX - rect.left)}px, ${event.clientY - (event.clientY - rect.top)}px, 0)`;
      }
    });
  }, [editMode, editableTagItems, handleManualTagPointerUp, handleTagPointerMove, jiggleMode]);

  const handleSaveView = async () => {
    if (!originalSnapshotRef.current) {
      return;
    }
    setSavingView(true);
    try {
      // 书签排序在拖拽时已经交换到具体项上，保存时直接提交当前 sort，避免把后续项全部重算。
      const draftToolsForSave = cloneSnapshot(draftTools);
      const draftCatelogsForSave = withSequentialSort(draftCatelogItems);
      const originalToolMap = new Map(cloneSnapshot(originalSnapshotRef.current.tools).map((item) => [item.id, item]));
      const originalTagMap = new Map(withSequentialSort(originalSnapshotRef.current.catelogs).map((item) => [item.id, item]));

      const deletedToolIds = originalSnapshotRef.current.tools
        .filter((item) => !draftToolsForSave.some((next) => next.id === item.id))
        .map((item) => item.id);
      const deletedTagIds = originalSnapshotRef.current.catelogs
        .filter((item) => !draftCatelogsForSave.some((next) => next.id === item.id))
        .map((item) => item.id);

      for (const item of draftCatelogsForSave) {
        const original = originalTagMap.get(item.id);
        if (!original || JSON.stringify(original) !== JSON.stringify(item)) {
          await fetchUpdateCateLog({ ...item });
        }
      }

      for (const id of deletedTagIds) {
        await fetchDeleteCatelog(id);
      }

      for (const item of draftToolsForSave) {
        const original = originalToolMap.get(item.id);
        if (!original || JSON.stringify(original) !== JSON.stringify(item)) {
          await fetchUpdateTool(item);
        }
      }

      for (const id of deletedToolIds) {
        await fetchDeleteTool(id);
      }

      const normalizedScale = normalizeLayoutScale(layoutScale);
      if (normalizeLayoutScale(data?.siteConfig?.layoutScale) !== normalizedScale) {
        const nextSiteConfig = {
          ...(data?.siteConfig ?? {}),
          layoutScale: normalizedScale,
        };
        await fetchUpdateSiteConfig(nextSiteConfig);
        setData((previous: any) => (previous ? { ...previous, siteConfig: nextSiteConfig } : previous));
      }

      message.success("视图调整已保存");
      // 保存后页面仍停留在 edit=1，因此需要清空本轮拖拽状态并保持可编辑，避免保存一次后无法继续调整。
      setCardPreviewOrder(null);
      setDraggingCardId(null);
      setDraggingCardOverlay(null);
      setCardTargetId(null);
      setTagPreviewOrder(null);
      setDraggingTagId(null);
      setDraggingTagOverlay(null);
      setTagTargetId(null);
      manualCardDragRef.current = null;
      manualTagDragRef.current = null;
      setJiggleMode(true);
      await loadData();
    } catch (error) {
      console.error(error);
      message.error("保存失败，请稍后重试");
    } finally {
      setSavingView(false);
    }
  };

  const handleResetDraft = async () => {
    setJiggleMode(false);
    setContextMenu(null);
    setLayoutPanelOpen(false);
    setThemePanelOpen(false);
    setLayoutScale(normalizeLayoutScale(data?.siteConfig?.layoutScale));
    if (data?.setting) {
      // 未保存的配色草稿只在退出调整时回滚，关闭调色面板本身不回滚。
      applyAppearanceSettings(data.setting, isDarkMode);
    }
    window.location.href = "/";
  };

  const handleOpenSettings = useCallback(() => {
    window.location.href = "/admin/settings";
  }, []);

  const handleOpenLayoutEditor = useCallback(() => {
    setThemePanelOpen(false);
    setLayoutPanelOpen((previous) => !previous);
  }, []);

  const handleOpenThemeEditor = useCallback(() => {
    if (!themeDraftValues) {
      return;
    }
    themeForm.setFieldsValue(themeDraftValues);
    setLayoutPanelOpen(false);
    setThemePanelOpen((previous) => !previous);
  }, [themeDraftValues, themeForm]);

  const handleSaveMemo = useCallback(async () => {
    if (!data?.setting) {
      return;
    }
    try {
      setSavingMemo(true);
      const payload = {
        ...data.setting,
        memoContent: memoDraft,
      };
      await fetchUpdateSetting(payload);
      setData((previous: any) => (previous ? { ...previous, setting: payload } : previous));
      message.success("备忘录已保存");
    } catch (error) {
      console.error(error);
      message.error("备忘录保存失败，请稍后重试");
    } finally {
      setSavingMemo(false);
    }
  }, [data?.setting, memoDraft]);

  const handleSaveThemeEditor = useCallback(async () => {
    if (!data?.setting) {
      return;
    }
    try {
      setSavingTheme(true);
      const values = await themeForm.validateFields();
      const payload = {
        ...data.setting,
        lightThemeConfig: JSON.stringify(
          normalizePaletteWithEditableFields(
            values.lightThemePalette || {},
            parseThemePalette(data.setting.lightThemeConfig, "light") || DEFAULT_LIGHT_THEME_PALETTE,
          ),
        ),
        darkThemeConfig: JSON.stringify(
          normalizePaletteWithEditableFields(
            values.darkThemePalette || {},
            parseThemePalette(data.setting.darkThemeConfig, "dark") || DEFAULT_DARK_THEME_PALETTE,
          ),
        ),
      };
      await fetchUpdateSetting(payload);
      setData((previous: any) => previous ? { ...previous, setting: payload } : previous);
      setThemeDraftValues(buildEditableThemeFormValues({
        lightThemePalette: parseThemePalette(payload.lightThemeConfig, "light"),
        darkThemePalette: parseThemePalette(payload.darkThemeConfig, "dark"),
      }));
      setThemePanelOpen(false);
      message.success("配色已保存");
    } catch (error) {
      message.error("配色保存失败，请稍后重试");
    } finally {
      setSavingTheme(false);
    }
  }, [data?.setting, themeForm]);

  const showClock = !loading && data?.setting?.showClock !== false;
  const showWeather = !loading && isLogin() && data?.setting?.showWeather !== false;
  const showSettingsButton = data?.setting?.showSettingsButton !== false;
  const showMemo = isLogin() && data?.setting?.showMemo === true;
  const showTagSection = true;
  const showCardsSection = true;
  const showFooter = Boolean(data?.setting?.footerText || data?.setting?.govRecord);

  const resolveWeatherDock = useCallback((clientX: number, clientY: number, mode: WeatherPanelMode) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const distances = [
      { edge: "top" as WeatherDockEdge, distance: clientY, offset: clientX - WEATHER_COLLAPSED_WIDTH / 2 },
      { edge: "bottom" as WeatherDockEdge, distance: viewportHeight - clientY, offset: clientX - WEATHER_COLLAPSED_WIDTH / 2 },
      { edge: "left" as WeatherDockEdge, distance: clientX, offset: clientY - WEATHER_COLLAPSED_HEIGHT / 2 },
      { edge: "right" as WeatherDockEdge, distance: viewportWidth - clientX, offset: clientY - WEATHER_COLLAPSED_HEIGHT / 2 },
    ].sort((left, right) => left.distance - right.distance);

    return buildDockState(distances[0].edge, distances[0].offset, mode);
  }, []);

  const buildWeatherPanelStyle = useCallback((dock: WeatherDockState) => {
    const sharedStyle = {
      left: "auto",
      right: "auto",
      top: "auto",
      bottom: "auto",
    };

    if (dock.edge === "top") {
      return { ...sharedStyle, top: WEATHER_EDGE_GAP, left: dock.offset };
    }
    if (dock.edge === "bottom") {
      return { ...sharedStyle, bottom: WEATHER_EDGE_GAP, left: dock.offset };
    }
    if (dock.edge === "left") {
      return { ...sharedStyle, left: WEATHER_EDGE_GAP, top: dock.offset };
    }
    return { ...sharedStyle, right: WEATHER_EDGE_GAP, top: dock.offset };
  }, []);

  const buildWeatherRestoreStyle = useCallback((dock: WeatherDockState) => {
    const sharedStyle = buildWeatherPanelStyle(dock);
    if (dock.edge === "top" || dock.edge === "bottom") {
      return { ...sharedStyle, width: 42, height: 34 };
    }
    return { ...sharedStyle, width: 34, height: 42 };
  }, [buildWeatherPanelStyle]);

  const buildMemoPanelStyle = useCallback(() => {
    const { maxRight, maxBottom } = getMemoPanelBounds(memoCollapsed);
    return {
      right: clamp(memoPanelPosition.right, 12, maxRight),
      bottom: clamp(memoPanelPosition.bottom, 12, maxBottom),
    };
  }, [memoCollapsed, memoPanelPosition.bottom, memoPanelPosition.right]);

  const handleWeatherPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement)?.closest("button")) {
      return;
    }

    event.preventDefault();
    weatherDragRef.current = {
      pointerId: event.pointerId,
      dragging: false,
    };
    window.addEventListener("pointermove", handleWeatherPointerMove);
    window.addEventListener("pointerup", handleWeatherPointerUp);
  };

  const handleWeatherPointerMove = useCallback((event: PointerEvent) => {
    if (!weatherDragRef.current) {
      return;
    }
    if (event.pointerId !== weatherDragRef.current.pointerId) {
      return;
    }
    weatherDragRef.current.dragging = true;
    setWeatherDock((previous) => resolveWeatherDock(event.clientX, event.clientY, previous.mode === "dismissed" ? "collapsed" : previous.mode));
  }, [resolveWeatherDock]);

  const handleWeatherPointerUp = useCallback((event: PointerEvent) => {
    window.removeEventListener("pointermove", handleWeatherPointerMove);
    window.removeEventListener("pointerup", handleWeatherPointerUp);
    if (weatherDragRef.current?.dragging) {
      setWeatherDock((previous) => resolveWeatherDock(event.clientX, event.clientY, previous.mode === "dismissed" ? "collapsed" : previous.mode));
    }
    weatherDragRef.current = null;
  }, [handleWeatherPointerMove, resolveWeatherDock]);

  const handleMemoPointerMove = useCallback((event: PointerEvent) => {
    if (!memoDragRef.current || event.pointerId !== memoDragRef.current.pointerId) {
      return;
    }
    const { maxRight, maxBottom } = getMemoPanelBounds(memoCollapsed);
    const nextRight = clamp(
      memoDragRef.current.startRight - (event.clientX - memoDragRef.current.startClientX),
      12,
      maxRight,
    );
    const nextBottom = clamp(
      memoDragRef.current.startBottom - (event.clientY - memoDragRef.current.startClientY),
      12,
      maxBottom,
    );
    memoDragRef.current.dragging = true;
    setMemoDragging(true);
    setMemoPanelPosition({ right: nextRight, bottom: nextBottom });
  }, [memoCollapsed]);

  const handleMemoPointerUp = useCallback((event: PointerEvent) => {
    handleMemoPointerMove(event);
    window.removeEventListener("pointermove", handleMemoPointerMove);
    window.removeEventListener("pointerup", handleMemoPointerUp);
    window.removeEventListener("pointercancel", handleMemoPointerUp);
    if (memoDragRef.current?.dragging) {
      setMemoPanelPosition((previous) => snapMemoPanelPosition(previous, memoCollapsed));
    }
    memoDragRef.current = null;
    setMemoDragging(false);
  }, [handleMemoPointerMove, memoCollapsed]);

  const handleMemoPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement)?.closest("button")) {
      return;
    }
    event.preventDefault();
    memoDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRight: buildMemoPanelStyle().right,
      startBottom: buildMemoPanelStyle().bottom,
      dragging: false,
    };
    window.addEventListener("pointermove", handleMemoPointerMove);
    window.addEventListener("pointerup", handleMemoPointerUp);
    window.addEventListener("pointercancel", handleMemoPointerUp);
  }, [buildMemoPanelStyle, handleMemoPointerMove, handleMemoPointerUp]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleWeatherPointerMove);
      window.removeEventListener("pointerup", handleWeatherPointerUp);
    };
  }, [handleWeatherPointerMove, handleWeatherPointerUp]);

  useEffect(() => {
    const handleResize = () => {
      // 视口变化时立即回收越界位置，避免备忘录漂出可视区。
      setMemoPanelPosition((previous) => snapMemoPanelPosition(previous, memoCollapsed));
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [memoCollapsed]);

  useEffect(() => {
    // 收起与展开尺寸不同，切换后统一重新夹紧到安全区域。
    setMemoPanelPosition((previous) => snapMemoPanelPosition(previous, memoCollapsed));
  }, [memoCollapsed]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleMemoPointerMove);
      window.removeEventListener("pointerup", handleMemoPointerUp);
      window.removeEventListener("pointercancel", handleMemoPointerUp);
      setMemoDragging(false);
    };
  }, [handleMemoPointerMove, handleMemoPointerUp]);

  useEffect(() => {
    return () => {
      if (manualCardMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(manualCardMoveFrameRef.current);
        manualCardMoveFrameRef.current = null;
      }
      window.removeEventListener("pointermove", handleCardPointerMove);
      if (manualCardPointerUpRef.current) {
        window.removeEventListener("pointerup", manualCardPointerUpRef.current);
        window.removeEventListener("pointercancel", manualCardPointerUpRef.current);
      }
    };
  }, [handleCardPointerMove, handleManualCardPointerUp]);

  useEffect(() => {
    return () => {
      if (manualTagMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(manualTagMoveFrameRef.current);
        manualTagMoveFrameRef.current = null;
      }
      window.removeEventListener("pointermove", handleTagPointerMove);
      if (manualTagPointerUpRef.current) {
        window.removeEventListener("pointerup", manualTagPointerUpRef.current);
        window.removeEventListener("pointercancel", manualTagPointerUpRef.current);
      }
    };
  }, [handleTagPointerMove, handleManualTagPointerUp]);

  useEffect(() => {
    const handleResize = () => {
      setWeatherDock((previous) => buildDockState(previous.edge, previous.offset, previous.mode));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const renderNormalCards = useCallback(() => {
    const renderedCards = visibleNormalCards.map((item, index) => (
      <CardV2
        title={
          <span className="card-right-title">
            {item.passwordProtected ? (
              <span
                className={`tag-lock-indicator ${unlockedToolUrls[item.id] ? "tag-lock-indicator-unlocked" : "tag-lock-indicator-locked"} card-lock-indicator`}
                aria-hidden="true"
              >
                {unlockedToolUrls[item.id] ? <LockOpen2Icon /> : <LockClosedIcon />}
              </span>
            ) : null}
            <span className="card-title-text">{item.name}</span>
          </span>
        }
        titleText={item.name}
        url={item.url}
        des={item.passwordProtected ? `${item.desc || ""} 需要输入密码后访问`.trim() : item.desc}
        logo={item.logo}
        resolvedLogo={item.resolvedLogo}
        key={item.id}
        catelog={item.catelog}
        index={virtualGrid.active ? virtualGrid.startIndex + index : index}
        isSearching={searchString.trim() !== ""}
        noImageMode={data?.siteConfig?.noImageMode || false}
        compactMode={data?.siteConfig?.compactMode || false}
        onClick={() => {
          handleOpenTool(item);
        }}
      />
    ));

    if (!virtualGrid.active) {
      return renderedCards;
    }

    const topSpacerHeight = Math.max(0, virtualGrid.topSpacerHeight - virtualGrid.rowGap);
    const bottomSpacerHeight = Math.max(0, virtualGrid.bottomSpacerHeight - virtualGrid.rowGap);

    return [
      ...(topSpacerHeight > 0
        ? [<div key="virtual-top-spacer" className="virtual-grid-spacer" style={{ height: topSpacerHeight }} />]
        : []),
      ...renderedCards,
      ...(bottomSpacerHeight > 0
        ? [<div key="virtual-bottom-spacer" className="virtual-grid-spacer" style={{ height: bottomSpacerHeight }} />]
        : []),
    ];
  }, [
    visibleNormalCards,
    virtualGrid.active,
    virtualGrid.bottomSpacerHeight,
    virtualGrid.rowGap,
    virtualGrid.startIndex,
    virtualGrid.topSpacerHeight,
    searchString,
    data?.siteConfig?.noImageMode,
    data?.siteConfig?.compactMode,
    unlockedToolUrls,
    handleOpenTool,
  ]);

  const tagsForDisplay = useMemo(
    () => buildTagDisplayItems(orderedDraftCatelogItems, unlockedCatelogIds),
    [orderedDraftCatelogItems, unlockedCatelogIds]
  );

  return (
    <>
      <Helmet>
        <meta charSet="utf-8" />
        <link rel="icon" href={data?.setting?.favicon ?? "favicon.ico"} />
        <title>{data?.setting?.title ?? "Fantetic Nav"}</title>
      </Helmet>

      <div className="topbar">
        <div className="topbar-shell">
          <div className={`topbar-meta ${showClock ? "" : "topbar-meta-compact"}`}>
            <div className="topbar-meta-left" />

            <div className="topbar-meta-center">
              {showClock ? (
                <div className="topbar-clock-trigger">
                  <LocalClock />
                </div>
              ) : null}
            </div>

            <div className="topbar-meta-right">
              <div />
            </div>
          </div>

          <div className="topbar-search">
            <SearchBar
              searchString={val}
              setSearchText={(text) => {
                setVal(text);
                handleSetSearch(text);
              }}
            />
          </div>

          {!editMode && showTagSection ? (
            <div>
              <TagSelector tags={tagsForDisplay} currTag={currTag} onTagChange={handleSetCurrTag} />
            </div>
          ) : null}
          {editMode && showTagSection ? (
            <div className="tag-selector span-3">
              <div className="tag-selector-wrapper edit-tag-wrapper">
                {editableTagItems.map((tagEntry) => (
                  <EditableTag
                    key={tagEntry.id}
                    id={tagEntry.id}
                    label={tagEntry.label}
                    active={tagEntry.active}
                    jiggle={jiggleMode}
                    jiggleVariant={tagEntry.jiggleVariant}
                    dragging={draggingTagId === String(tagEntry.id)}
                    placeholder={draggingTagId === String(tagEntry.id)}
                    target={draggingTagId !== String(tagEntry.id) && tagTargetId === String(tagEntry.id)}
                    tagRef={(node) => {
                      if (node) {
                        tagNodeMapRef.current.set(String(tagEntry.id), node);
                        return;
                      }
                      tagNodeMapRef.current.delete(String(tagEntry.id));
                    }}
                    onClick={() => {
                      if (tagEntry.item) {
                        handleSetCurrTag(tagEntry.item.name);
                        return;
                      }
                      handleSetCurrTag("全部工具");
                    }}
                    onPointerDown={(event) => handleTagPointerDown(tagEntry, event)}
                    onPointerUp={handleClearLongPress}
                    onPointerLeave={handleClearLongPress}
                    onContextMenu={(event) => {
                      if (!tagEntry.item) {
                        event.preventDefault();
                        return;
                      }
                      handleTagContextMenu(event, tagEntry.item);
                    }}
                  />
                ))}
              </div>
              {draggingTagOverlay ? (
                <div ref={tagOverlayRef} className="editable-tag-overlay-shell">
                  <EditableTag
                    id={`drag-tag-overlay-${draggingTagOverlay.id}`}
                    label={draggingTagOverlay.label}
                    active={false}
                    jiggle={false}
                    dragging
                    floating
                    dragStyle={{
                      width: draggingTagOverlay.width,
                      minWidth: draggingTagOverlay.width,
                      height: draggingTagOverlay.height,
                    }}
                    onClick={() => undefined}
                    onPointerDown={() => undefined}
                    onPointerUp={() => undefined}
                    onPointerLeave={() => undefined}
                    onContextMenu={(event) => event.preventDefault()}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {showWeather ? (
        <WeatherPanel
          weather={weather}
          weatherMessage={weatherMessage}
          mode={weatherDock.mode}
          edge={weatherDock.edge}
          panelStyle={buildWeatherPanelStyle(weatherDock)}
          restoreStyle={buildWeatherRestoreStyle(weatherDock)}
          onPointerDown={handleWeatherPointerDown}
          onToggleExpanded={() =>
            setWeatherDock((previous) => {
              const nextMode = previous.mode === "expanded" ? "collapsed" : "expanded";
              return buildDockState(previous.edge, previous.offset, nextMode);
            })
          }
          onDismiss={() => setWeatherDock((previous) => ({ ...previous, mode: "dismissed" }))}
          onRestore={() =>
            setWeatherDock((previous) => buildDockState(previous.edge, previous.offset, "collapsed"))
          }
        />
      ) : null}

      <PageActions
        editMode={editMode}
        savingView={savingView}
        savingTheme={savingTheme}
        themePanelOpen={themePanelOpen}
        layoutPanelOpen={layoutPanelOpen}
        visible={isLogin()}
        showSettingsButton={showSettingsButton}
        onExitAdjust={handleResetDraft}
        onSaveView={handleSaveView}
        onOpenLayoutEditor={handleOpenLayoutEditor}
        onOpenThemeEditor={handleOpenThemeEditor}
        onOpenSettings={handleOpenSettings}
        layoutEditorPanel={
          editMode && layoutPanelOpen ? (
            <div className="theme-editor-popover layout-editor-popover">
              <div className="theme-editor-popover-arrow" />
              <div className="theme-editor-popover-card layout-editor-card">
                <div className="theme-editor-popover-title">布局档位</div>
                <div className="layout-editor-options">
                  {[
                    { label: "较大", value: "large" },
                    { label: "默认", value: "default" },
                    { label: "较小", value: "small" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`layout-editor-option ${layoutScale === item.value ? "layout-editor-option-active" : ""}`}
                      onClick={() => setLayoutScale(item.value as LayoutScale)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null
        }
        themeEditorPanel={
          editMode && themePanelOpen ? (
            // 调色面板挂到按钮锚点内部，避免固定定位时箭头偏移和遮挡分类区。
            <div className="theme-editor-popover">
              <div className="theme-editor-popover-arrow" />
              <div className="theme-editor-popover-card">
                <div className="theme-editor-popover-title">配色调试</div>
                <Form form={themeForm} layout="vertical" className="theme-editor-form">
                  {!isDarkMode ? (
                    <Form.Item label="亮色配色">
                      <div className="theme-editor-grid">
                        {COMPACT_THEME_FIELDS.map((field) => (
                          <Form.Item key={`theme-light-${field.key}`} name={["lightThemePalette", field.key]} label={field.label} className="theme-editor-grid-item">
                            <ColorPicker showText />
                          </Form.Item>
                        ))}
                      </div>
                      <div className="theme-editor-actions">
                        <Button onClick={() => themeForm.setFieldValue("lightThemePalette", buildEditableThemeFormValues({ lightThemePalette: DEFAULT_LIGHT_THEME_PALETTE, darkThemePalette: DEFAULT_DARK_THEME_PALETTE }).lightThemePalette)}>
                          重置亮色
                        </Button>
                        <Button type="primary" loading={savingTheme} onClick={handleSaveThemeEditor}>
                          保存配色
                        </Button>
                      </div>
                    </Form.Item>
                  ) : null}
                  {isDarkMode ? (
                    <Form.Item label="暗色配色">
                      <div className="theme-editor-grid">
                        {COMPACT_THEME_FIELDS.map((field) => (
                          <Form.Item key={`theme-dark-${field.key}`} name={["darkThemePalette", field.key]} label={field.label} className="theme-editor-grid-item">
                            <ColorPicker showText />
                          </Form.Item>
                        ))}
                      </div>
                      <div className="theme-editor-actions">
                        <Button onClick={() => themeForm.setFieldValue("darkThemePalette", buildEditableThemeFormValues({ lightThemePalette: DEFAULT_LIGHT_THEME_PALETTE, darkThemePalette: DEFAULT_DARK_THEME_PALETTE }).darkThemePalette)}>
                          重置暗色
                        </Button>
                        <Button type="primary" loading={savingTheme} onClick={handleSaveThemeEditor}>
                          保存配色
                        </Button>
                      </div>
                    </Form.Item>
                  ) : null}
                </Form>
              </div>
            </div>
          ) : null
        }
      />

      <PerformancePanel
        visibleByConfig={Boolean(data?.siteConfig?.showPerformancePanel)}
        toolCount={publicTools.length}
        filteredCount={filteredData.length}
        searchText={searchString}
      />

      <div className={`content-wraper ${showCardsSection ? "" : "content-wraper-hidden"}`} ref={contentWrapperRef}>
        <div className={`content cards layout-scale-${layoutScale} ${data?.siteConfig?.compactMode ? "compact-grid" : ""}`}>
          {loading ? (
            <Loading />
          ) : !editMode ? (
            renderNormalCards()
          ) : (
            <>
              {editableCardItems.map((item, index) => (
                <EditableCard
                  key={item.id}
                  id={String(item.id)}
                  item={item}
                  index={index}
                  noImageMode={data?.siteConfig?.noImageMode || false}
                  compactMode={data?.siteConfig?.compactMode || false}
                  jiggle={jiggleMode && enableCardJiggleAnimation}
                  jiggleVariant={index % 2 === 0 ? "base" : "alt"}
                  unlocked={Boolean(unlockedToolUrls[item.id])}
                  dragging={draggingCardId === String(item.id)}
                  placeholder={draggingCardId === String(item.id)}
                  target={draggingCardId !== String(item.id) && cardTargetId === String(item.id)}
                  cardRef={(node) => {
                    if (node) {
                      cardNodeMapRef.current.set(String(item.id), node);
                      return;
                    }
                    cardNodeMapRef.current.delete(String(item.id));
                  }}
                  onClick={() => {
                    if (!jiggleMode && draggingCardId !== String(item.id)) {
                      handleOpenTool(item);
                    }
                  }}
                  onPointerDown={(event) => handleCardPointerDown(item, event)}
                  onPointerUp={handleClearLongPress}
                  onPointerLeave={handleClearLongPress}
                  onContextMenu={(event) => handleToolContextMenu(event, item)}
                />
              ))}
              {draggingCardOverlay ? (
                <div ref={cardOverlayRef} className="editable-card-overlay-shell">
                  <EditableCard
                    id={`drag-overlay-${draggingCardOverlay.item.id}`}
                    item={draggingCardOverlay.item}
                    index={-1}
                    noImageMode={data?.siteConfig?.noImageMode || false}
                    compactMode={data?.siteConfig?.compactMode || false}
                    jiggle={false}
                    unlocked={Boolean(unlockedToolUrls[draggingCardOverlay.item.id])}
                    dragging
                    floating
                    dragStyle={{
                      width: draggingCardOverlay.width,
                      minWidth: draggingCardOverlay.width,
                    }}
                    onClick={() => undefined}
                    onPointerDown={() => undefined}
                    onPointerUp={() => undefined}
                    onPointerLeave={() => undefined}
                    onContextMenu={(event) => event.preventDefault()}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {showFooter ? (
        <div className="record-wraper">
          {data?.setting?.footerText ? (
            data?.setting?.footerLink ? (
              <a href={data.setting.footerLink} target="_blank" rel="noreferrer">{data.setting.footerText}</a>
            ) : (
              <span>{data.setting.footerText}</span>
            )
          ) : null}
          {data?.setting?.govRecord ? (
            <a href="https://beian.miit.gov.cn" target="_blank" rel="noreferrer">{data.setting.govRecord}</a>
          ) : null}
        </div>
      ) : null}

      <MemoPanel
        visible={showMemo}
        value={memoDraft}
        saving={savingMemo}
        collapsed={memoCollapsed}
        dragging={memoDragging}
        panelStyle={buildMemoPanelStyle()}
        onPointerDown={handleMemoPointerDown}
        onToggleCollapsed={() => setMemoCollapsed((previous) => !previous)}
        onChange={setMemoDraft}
        onSave={handleSaveMemo}
      />

      {contextMenu ? (
        <div className="edit-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button onClick={openEditModal}>
            <Pencil1Icon />
            修改
          </button>
          <button onClick={handleDeleteFromDraft}>
            <TrashIcon />
            删除
          </button>
        </div>
      ) : null}

      <Modal
        title={`解锁分类${pendingUnlockTag ? `：${pendingUnlockTag.name}` : ""}`}
        open={unlockModalOpen}
        rootClassName="theme-aware-modal"
        onOk={handleUnlockCatelog}
        onCancel={() => setUnlockModalOpen(false)}
      >
        <Input.Password
          placeholder="请输入分类密码"
          value={unlockPassword}
          onChange={(event) => setUnlockPassword(event.target.value)}
        />
      </Modal>

      <Modal
        title={`解锁书签${pendingUnlockTool ? `：${pendingUnlockTool.name}` : ""}`}
        open={toolUnlockModalOpen}
        rootClassName="theme-aware-modal"
        onOk={handleUnlockTool}
        onCancel={() => setToolUnlockModalOpen(false)}
      >
        <Input.Password
          placeholder="请输入书签密码"
          value={toolUnlockPassword}
          onChange={(event) => setToolUnlockPassword(event.target.value)}
        />
      </Modal>

      <Modal
        title="修改书签"
        open={Boolean(editingTool)}
        rootClassName="theme-aware-modal"
        onOk={handleToolModalSave}
        onCancel={() => setEditingTool(null)}
      >
        <Form form={toolForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="url" label="网址" rules={[{ required: true, message: "请输入网址" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="logo" label="图标">
            <Input />
          </Form.Item>
          <Form.Item name="catelog" label="分类" rules={[{ required: true, message: "请选择分类" }]}>
            <Select
              popupClassName="theme-aware-select-dropdown"
              options={draftCatelogItems.map((item) => ({ label: item.name, value: item.name }))}
              placeholder="请选择分类"
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="desc" label="描述">
            <Input />
          </Form.Item>
          <Form.Item name="accessPassword" label="访问密码" tooltip="留空表示不修改，填写后会覆盖原有密码">
            <Input.Password placeholder="可选，填写后访问该书签需要输入密码" />
          </Form.Item>
          <Form.Item name="clearAccessPassword" label="清空密码">
            <Select
              popupClassName="theme-aware-select-dropdown"
              options={[
                { label: "否", value: false },
                { label: "是", value: true },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="修改分类"
        open={Boolean(editingTag)}
        rootClassName="theme-aware-modal"
        onOk={handleTagModalSave}
        onCancel={() => setEditingTag(null)}
      >
        <Form form={tagForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入分类名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="accessPassword" label="分类密码" tooltip="留空表示不修改，填写后会覆盖原有密码">
            <Input.Password placeholder="可选，填写后进入该分类需要输入密码" />
          </Form.Item>
          <Form.Item name="clearAccessPassword" label="清空密码">
            <Select
              popupClassName="theme-aware-select-dropdown"
              options={[
                { label: "否", value: false },
                { label: "是", value: true },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <DarkSwitch />
    </>
  );
};

export default Content;
