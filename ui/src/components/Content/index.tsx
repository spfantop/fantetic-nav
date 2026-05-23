import "./index.css";
import { Helmet } from "react-helmet";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import pinyin from "pinyin-match";
import CardV2 from "../CardV2";
import SearchBar from "../SearchBar";
import TagSelector from "../TagSelector";
import { Loading } from "../Loading";
import LocalClock from "./LocalClock";
import EditableCard from "./EditableCard";
import EditableTag from "./EditableTag";
import {
  clearHomeEtagCache,
  FetchList,
  fetchUpdateCatelogsSort,
  fetchUpdateToolsAllSort,
  fetchUpdateToolsSort,
} from "../../utils/api";
import { generateSearchEngineCard } from "../../utils/serachEngine";
import { toggleJumpTarget } from "../../utils/setting";
import { notifyError, notifyInfo, notifySuccess } from "../../utils/notify";
import {
  buildSortUpdates,
  mergeVisibleOrderIntoGlobalOrder,
  swapByIds,
} from "./reorder";

const VIRTUAL_OVERSCAN_ROWS = 3;
const DEFAULT_ROW_HEIGHT = 112;
const BACK_TO_TOP_THRESHOLD = 300;
const ALL_TOOLS_TAG = "全部工具";
const ADMIN_TAG = "管理后台";
const DEFAULT_TAG = "默认";
const HOME_CACHE_TTL = 60000;
const HOME_STORAGE_CACHE_KEY_BASE = "fantetic_nav_home_cache_v2";
const TAG_ORDER_STORAGE_KEY = "fantetic_nav_tag_order_v1";
const FIXED_TAIL_TOOL_URLS = ["admin", "toggleJumpTarget"];

let homeDataCache: any = null;
let homeDataCacheAt = 0;
let homeDataInFlight: Promise<any> | null = null;
const getHomeStorageCacheKey = () => `${HOME_STORAGE_CACHE_KEY_BASE}:${window.localStorage.getItem("_token") ? "auth" : "guest"}`;
const clearHomeViewCache = () => {
  clearHomeEtagCache();
  homeDataCache = null;
  homeDataCacheAt = 0;
  homeDataInFlight = null;
  try {
    window.localStorage.removeItem(getHomeStorageCacheKey());
  } catch {
    // ignore
  }
};

const mutiSearch = (s: string, t: string) => {
  const source = String(s || "").toLowerCase();
  const target = String(t || "").toLowerCase();
  return source.includes(target) || Boolean(pinyin.match(source, target));
};

const fetchHomeData = async (force = false) => {
  const now = Date.now();
  if (!force && homeDataCache && now - homeDataCacheAt < HOME_CACHE_TTL) {
    return homeDataCache;
  }
  if (!force && homeDataInFlight) {
    return homeDataInFlight;
  }
  const request = FetchList()
    .then((result) => {
      homeDataCache = result;
      homeDataCacheAt = Date.now();
      return result;
    });
  if (!force) {
    homeDataInFlight = request;
  }
  try {
    return await request;
  } finally {
    if (!force && homeDataInFlight === request) {
      homeDataInFlight = null;
    }
  }
};

const readHomeStorageCache = () => {
  const cacheKey = getHomeStorageCacheKey();
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!hasUsableHomeData(parsed)) {
      // 缂傚倸鍊搁崐鎼佸磹瑜版帒绠伴柟闂寸劍閸嬨倝鏌曟繛褍鎳愰敍婊堟⒑鐟欏嫬鍔ゆい鏇ㄥ弮閸┾偓妞ゆ帒顦悘鐘炽亜閺囶亞绉€规洘甯掗～婵嬪础閻愰潧骞€闂傚倷绀侀幖顐﹀疮椤愶絾娅犻幖娣妽閸嬬喐绻涢幋娆忕仼缁绢厸鍋撻梻浣告啞閸旀牞銇愰崘顔藉€堕柍鍝勬噺閳锋帡鏌涢弴妤佹珔闁逞屽劯閸涱噮娼熷┑鐘绘涧椤戝棝鎮炴總鍛婄厱妞ゎ厽鍨甸弸娑㈡偨椤栨稑鈻曢柡灞剧☉椤繈顢楁担鐟伴棷闂備焦鐪归崹褰掆€﹀畡鎵殾闁挎繂鎷嬮崥瀣煕濠娾偓閻掞缚绨洪梻鍌欑閹诧紕绮欓幒妤€鍨傛繝闈涱儐閸ゅ牓鏌熸潏鍓х暠闂佽￥鍊濋悡顐﹀炊閵婏妇顦繝銏ｆ硾鐎氫即骞冨Δ鈧埥澶娾枍鏉堛劎鐭掗柛鈹惧亾?
      window.localStorage.removeItem(cacheKey);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(cacheKey);
    return null;
  }
};

const writeHomeStorageCache = (payload: any) => {
  try {
    window.localStorage.setItem(getHomeStorageCacheKey(), JSON.stringify(payload));
  } catch {
    // 闂傚倸顭崑鍕洪妸鈺佺柧妞ゆ劧绠戝Ч鏌ユ煙闁箑鏋ょ痪鍙ョ矙閺岀喖骞嗚閿涘秹鏌熼悾灞解枅闁哄本鐩獮鍥敇閻樺啿娅戦梻浣告啞閻熴儱螞濞嗗浚鍤楅柛鏇ㄥ墯缂嶅洦銇勯幇鈺佸壘闁哄洢鍨洪悡銉︾箾閹寸儐鐒介柣鎺旑焾闇夐悘蹇旂墬濞呭﹦鈧娲橀〃鍛搭敇婵傜宸濇い鎾楀嫷鍞甸梻鍌欑閹诧紕鎹㈤崒婊呯煋鐎规洖娲犻崑鎾绘濞戞粌顏梻鍥ь槸闇夐柨婵嗙墑閳ь兘鍋撻梺鍝勮閸婃繈寮?
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

const hasUsableHomeData = (payload: any) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const hasTools = Array.isArray(payload.tools);
  const hasCatelogs = Array.isArray(payload.catelogs);
  return hasTools && hasCatelogs;
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
    // 闂傚倸顭崑鍕洪妸鈺佺柧妞ゆ劧绠戝Ч鏌ユ煙閻楀牊绶查悗姘槹閵囧嫰骞掗崱妞惧婵犵數濮崑鎾绘煙缂併垹鏋涚紒鐘虫緲闇夐柨婵嗩樈濡垿鏌ｉ敐鍕煓闁哄本鐩浠嬪Ω瑜嶉埅褰掓⒑闂堟稒澶勯柛銊ョ秺楠炲繗銇愰幒鎳炽劑鏌ㄥ┑鍡椻偓鍛婄?
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
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [columnCount, setColumnCount] = useState(1);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
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
  const deferredSearchString = useDeferredValue(searchString);

  const filteredDataRef = useRef<any[]>([]);
  const contentWrapperRef = useRef<HTMLDivElement | null>(null);
  const cardsGridRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const scrollClassTimerRef = useRef<number | null>(null);
  const latestScrollTopRef = useRef(0);
  const rowHeightMeasuredRef = useRef(false);
  const originalSnapshotRef = useRef<{ tools: any[]; tags: string[] } | null>(null);
  const cardDragRef = useRef<CardDragSession | null>(null);
  const tagDragRef = useRef<TagDragSession | null>(null);
  const firstPaintLoggedRef = useRef(false);

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

  const loadData = useCallback(async (options?: { forceRemote?: boolean; skipLocalCache?: boolean }) => {
    const perfStart = typeof performance !== "undefined" ? performance.now() : 0;
    const localCacheData = options?.skipLocalCache ? null : normalizeHomeData(readHomeStorageCache());
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
      const fetched = await fetchHomeData(Boolean(options?.forceRemote));
      let result = fetched ? normalizeHomeData(fetched) : null;
      if (!result && !hasUsableHomeData(localCacheData)) {
        // 闂傚倷绀侀幉锛勭矙閹烘鍨傛繝闈涱儐閸?304 婵犵數鍋為崹鍫曞箰鐠囧樊娼栭柣鐔峰簻閼板灝霉閸忓吋缍戦柟鐟扮埣閺岀喎鈻撻崹顔界亾婵犮垼娉涚€氫即骞冨Δ鈧埥澶娾枍椤撯€充汗缂侇噮鍘藉鍕箛椤掑倻鍘俊鐐€栭悧妤冨垝瀹ュ姹查煫鍥ㄧ⊕閻撴盯鏌涢幇闈涘季闁哥喎娲ㄧ槐鎺撴綇閵娧呯暤闂侀潧妫欑敮鈥崇暦閵娾晩鏁嶆繛鎴炃氶崑?ETag 闂傚倷绀侀幉锟犳嚌閻愵剦娈界紒瀣儥閸熷懘姊洪鈧粔瀵哥矆閸℃稒鍋ｉ柧蹇曟嚀閸斿绱掗埀顒勫焵椤掆偓閳规垿鎮╁▎蹇擃仼濠殿喖鍟扮槐鎺楀籍閳ь剙顭囧▎鎾崇厺閹兼番鍔岄悡锟犳煕濞戝崬鐏ｆい锔诲櫍濮婄粯绗熼崶褍顫╅梺璇茬箲缁诲牆鐣烽姀銈呂ч柛鈩冨姃缁ㄥ姊哄Ч鍥х仼闁规祴鈧剚娴栭柕濞炬櫆閻撴洟鎮楅敐搴′簽闁活厼鐭傞弻锟犲幢韫囨挷澹曢梻鍌欑窔濞艰崵鎷归悢鐓庣閹兼番鍔岄悡姗€鏌″搴″箹闁哄绶氶弻锝呂旈埀顒勬偋閸℃瑧鐭堥柨鏇炲€归悡鐔镐繆椤栨氨浠㈤柣鎾村姍閺屽秷顧侀柛蹇旂洴濮婅棄顓兼径濠勫姦?
        clearHomeEtagCache();
        const retryFetched = await FetchList();
        result = retryFetched ? normalizeHomeData(retryFetched) : null;
      }
      if (!result) {
        return;
      }
      const localTagOrder = readTagOrder();
      const normalizedTags = mergeTagOrder(sortTags(result.catelogs ?? [ALL_TOOLS_TAG]), localTagOrder);
      setData(result);
      setDraftTools(sortTools(result.tools ?? []));
      setDraftTagOrder(normalizedTags);
      writeHomeStorageCache(result);
      applyTagFromData(result);
    } catch (error) {
      console.error("闂傚倷绀侀幉鈥愁潖缂佹ɑ鍙忛柟顖ｇ亹瑜版帒鐐婃い顓熷笧绾鹃箖姊洪崫鍕枆闁告ê缍婇崺鈧い鎺嗗亾妞わ箓娼ч锝夘敃閿旇棄浜遍梺鍓插亝缁诲嫰濡堕敂鐣岀瘈闁靛繆鈧啿濮哥紓渚囧枛婢т粙骞?", error);
    } finally {
      if (process.env.NODE_ENV !== "production" && perfStart) {
        const cost = Math.round(performance.now() - perfStart);
        console.info(`[perf] 婵犵妲呴崑鎾跺緤妤ｅ啯鍋嬮柣妯款嚙杩?loadData 闂傚倷娴囬崑鎰櫠濡ゅ懌鈧啴宕卞Δ濠冨瘜? ${cost}ms`);
      }
      setLoading(false);
    }
  }, [applyTagFromData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading || firstPaintLoggedRef.current) {
      return;
    }
    firstPaintLoggedRef.current = true;
    if (process.env.NODE_ENV !== "production") {
      requestAnimationFrame(() => {
        const cards = filteredDataRef.current.length;
        console.info(`[perf] 婵犵妲呴崑鎾跺緤妤ｅ啯鍋嬮柣妯款嚙杩濇繝銏ｆ硾椤戞垹妲愰弮鍫熺厸鐎广儱娴烽崢娑㈡煕鐎ｆ柨娲﹂悡鏇熺箾閸℃◤顏堟倶閿熺姵鍋￠柡鍥╁仦椤ャ垻鈧鍠栭…鐑界嵁濡櫣鏆﹂柛銉ｅ妽椤斿懘姊绘担鐑樺殌闁宦板姂瀹曟繆顦存俊鍙夊姇閳规垹鈧綆浜為、鍛存⒑閹稿海鈽夐悗姘煎墴閵嗗倹绻濆顓犲幐? ${cards}`);
      });
    }
  }, [loading]);

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
      notifyInfo("编辑模式下已关闭搜索，避免只排序过滤结果。");
    }
  }, [editMode, searchString]);

  useEffect(() => {
    const loadSearchEngineCards = async () => {
      if (editMode) {
        setSearchEngineCards([]);
        return;
      }
      try {
        const cards = await generateSearchEngineCard(deferredSearchString);
        setSearchEngineCards(cards);
      } catch (error) {
        console.error("闂佸憡姊绘慨鎯归崶顒€绠规繝濠傛噹閸嬪秶鈧鍠楀ú姗€骞栭幖浣哥闁挎稑瀚。璇差熆閹壆绨块悷?", error);
        setSearchEngineCards([]);
      }
    };

    loadSearchEngineCards();
  }, [deferredSearchString, editMode]);

  const resetSearch = useCallback((notSetTag?: boolean) => {
    setVal("");
    setSearchString("");
    const tagInLocalStorage = window.localStorage.getItem("tag");
    if (!notSetTag && tagInLocalStorage && tagInLocalStorage !== ADMIN_TAG) {
      setCurrTag(tagInLocalStorage);
    }
  }, []);

  const handleSetCurrTag = useCallback((tag: string) => {
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
  }, [editMode, resetSearch]);

  const handleSetSearch = useCallback((nextVal: string) => {
    if (editMode) {
      return;
    }
    if (nextVal.trim() !== "") {
      setCurrTag(ALL_TOOLS_TAG);
      setSearchString(nextVal.trim());
      return;
    }
    resetSearch();
  }, [editMode, resetSearch]);

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
        if (deferredSearchString === "") {
          return true;
        }
        return (
          mutiSearch(item.name, deferredSearchString) ||
          mutiSearch(item.desc, deferredSearchString) ||
          mutiSearch(item.url, deferredSearchString)
        );
      });

    const extraCards = Array.isArray(searchEngineCards) ? searchEngineCards : [];
    return editMode ? localResult : [...localResult, ...extraCards];
  }, [toolsSource, currTag, deferredSearchString, searchEngineCards, editMode]);

  useEffect(() => {
    filteredDataRef.current = filteredData;
  }, [filteredData]);

  useEffect(() => {
    const wrapper = contentWrapperRef.current;
    if (!wrapper) {
      return;
    }
    const updateViewport = () => {
      const next = wrapper.clientHeight;
      setViewportHeight((prev) => (prev === next ? prev : next));
    };
    updateViewport();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewport);
      return () => window.removeEventListener("resize", updateViewport);
    }
    const observer = new ResizeObserver(updateViewport);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const grid = cardsGridRef.current;
    if (!grid || editMode || loading) {
      return;
    }
    const updateGridMetrics = () => {
      const style = window.getComputedStyle(grid);
      const columns = Math.max(1, style.gridTemplateColumns.split(" ").filter(Boolean).length);
      setColumnCount((prev) => (prev === columns ? prev : columns));
      if (rowHeightMeasuredRef.current) {
        return;
      }
      const rowGap = Number.parseFloat(style.rowGap || style.gap || "0") || 0;
      const firstCard = grid.querySelector(".card-box") as HTMLElement | null;
      if (!firstCard) {
        return;
      }
      const nextRowHeight = Math.max(1, Math.round(firstCard.getBoundingClientRect().height + rowGap));
      setRowHeight((prev) => (Math.abs(prev - nextRowHeight) < 2 ? prev : nextRowHeight));
      rowHeightMeasuredRef.current = true;
    };
    rowHeightMeasuredRef.current = false;
    const raf = window.requestAnimationFrame(updateGridMetrics);
    const handleResize = () => {
      rowHeightMeasuredRef.current = false;
      window.requestAnimationFrame(updateGridMetrics);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
    };
  }, [editMode, loading, filteredData.length, data?.siteConfig?.compactMode]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
      if (scrollClassTimerRef.current !== null) {
        window.clearTimeout(scrollClassTimerRef.current);
      }
    };
  }, []);

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
    if (deferredSearchString.trim() === "" || editMode) {
      document.removeEventListener("keydown", onKeyEnter);
    } else {
      document.addEventListener("keydown", onKeyEnter);
    }
    return () => document.removeEventListener("keydown", onKeyEnter);
  }, [deferredSearchString, onKeyEnter, editMode]);

  const renderedCards = filteredData;

  const handleContentScroll = useCallback((ev: any) => {
    const currentTarget = ev.currentTarget as HTMLDivElement;
    if (!currentTarget.classList.contains("is-scrolling")) {
      currentTarget.classList.add("is-scrolling");
    }
    if (scrollClassTimerRef.current !== null) {
      window.clearTimeout(scrollClassTimerRef.current);
    }
    scrollClassTimerRef.current = window.setTimeout(() => {
      currentTarget.classList.remove("is-scrolling");
      scrollClassTimerRef.current = null;
    }, 120);

    latestScrollTopRef.current = currentTarget.scrollTop;
    if (scrollRafRef.current === null) {
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        setScrollTop(latestScrollTopRef.current);
      });
    }

    const nextShow = currentTarget.scrollTop > BACK_TO_TOP_THRESHOLD;
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
          notifyError("保存失败：后端未启用全部工具排序接口，请重启后端服务后重试。");
          return;
        }
        const hasSqliteBusy = failed.some((item) => String((item.result.reason as any)?.response?.data?.errorMessage ?? "").includes("SQLITE_BUSY"));
        if (hasSqliteBusy) {
          notifyError("保存失败：数据库繁忙，请稍后重试。");
          return;
        }
        const failKeys = failed.map((item) => item.key).join(", ");
        notifyError(`保存失败：${failKeys}`);
        return;
      }

      writeTagOrder(draftTagOrder);
      clearHomeEtagCache();
      homeDataCache = null;
      homeDataCacheAt = 0;
      notifySuccess("布局顺序已保存");
      onLeaveEdit?.();
      setDirtyTools(false);
      setDirtyTags(false);
      setDirtyAllTools(false);
      setDirtyCatelogs({});
      await loadData();
    } catch (error) {
      console.error("保存布局失败:", error);
      notifyError("保存失败，已保留当前草稿，请重试。");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleCardClick = useCallback((url: string) => {
    resetSearch();
    if (url === "toggleJumpTarget") {
      toggleJumpTarget();
      clearHomeViewCache();
      void loadData({ forceRemote: true, skipLocalCache: true });
    }
  }, [loadData, resetSearch]);

  const resolveCardOrder = useCallback(() => filteredData, [filteredData]);

  const resolveTagOrder = useCallback(() => draftTagOrder, [draftTagOrder]);

  const totalRows = useMemo(() => {
    if (editMode || renderedCards.length === 0) {
      return 0;
    }
    return Math.ceil(renderedCards.length / Math.max(1, columnCount));
  }, [editMode, renderedCards.length, columnCount]);

  const virtualRange = useMemo(() => {
    if (editMode || renderedCards.length === 0) {
      return { startIndex: 0, endIndex: renderedCards.length, topSpacer: 0, bottomSpacer: 0 };
    }
    const safeRowHeight = Math.max(1, rowHeight);
    const visibleRows = Math.max(1, Math.ceil(viewportHeight / safeRowHeight));
    const startRow = Math.max(0, Math.floor(scrollTop / safeRowHeight) - VIRTUAL_OVERSCAN_ROWS);
    const endRow = Math.min(totalRows, startRow + visibleRows + VIRTUAL_OVERSCAN_ROWS * 2);
    const startIndex = startRow * Math.max(1, columnCount);
    const endIndex = Math.min(renderedCards.length, endRow * Math.max(1, columnCount));
    return {
      startIndex,
      endIndex,
      topSpacer: startRow * safeRowHeight,
      bottomSpacer: Math.max(0, (totalRows - endRow) * safeRowHeight),
    };
  }, [editMode, renderedCards.length, rowHeight, viewportHeight, scrollTop, totalRows, columnCount]);

  const virtualCards = useMemo(
    () => renderedCards.slice(virtualRange.startIndex, virtualRange.endIndex),
    [renderedCards, virtualRange.startIndex, virtualRange.endIndex]
  );
  const virtualPaddingStyle = useMemo(
    () =>
      editMode
        ? undefined
        : ({
            paddingTop: virtualRange.topSpacer,
            paddingBottom: virtualRange.bottomSpacer,
          } as React.CSSProperties),
    [editMode, virtualRange.topSpacer, virtualRange.bottomSpacer]
  );

  const renderCardsV2 = useCallback(() => {
    return virtualCards.map((item, index) => {
      const absoluteIndex = virtualRange.startIndex + index;
      const isSearchEngineOption = Number(item?.id) >= 8800880000 && Number(item?.id) < 8800999999;
      return (
        <CardV2
          title={item.name}
          url={item.url}
          des={item.desc}
          logo={item?.logo}
          key={item.id}
          catelog={item.catelog}
          index={absoluteIndex}
          isSearching={searchString.trim() !== ""}
          noImageMode={data?.siteConfig?.noImageMode || false}
          compactMode={data?.siteConfig?.compactMode || false}
          showCatelog={!isSearchEngineOption}
          onClick={handleCardClick}
        />
      );
    });
  }, [virtualCards, virtualRange.startIndex, searchString, data?.siteConfig?.noImageMode, data?.siteConfig?.compactMode, handleCardClick]);

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
        <title>{data?.setting?.title ?? "Fantetic Nav"}</title>
      </Helmet>

      <div className="topbar">
        {showClock ? (
          <div className="clock-row">
            <LocalClock />
          </div>
        ) : null}

        <div className={`content topbar-content ${data?.siteConfig?.compactMode ? "compact-mode" : ""} ${editMode ? "edit-mode" : ""}`}>
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
        <div
          className={`content cards ${data?.siteConfig?.compactMode ? "compact-grid" : ""}`}
          ref={cardsGridRef}
          style={virtualPaddingStyle}
        >
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
        <a href={data?.setting?.footerLink || "https://henniubi.com"} target="_blank" rel="noreferrer">
          {data?.setting?.footerName || "Fantetic Nav"}
        </a>
        {data?.setting?.govRecord ? (
          <>
            <br />
            <a href="https://beian.miit.gov.cn" target="_blank" rel="noreferrer">
              {data.setting.govRecord}
            </a>
          </>
        ) : null}
      </div>
    </>
  );
};

export default Content;

