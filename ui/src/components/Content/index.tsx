import "./index.css";
import CardV2 from "../CardV2";
import SearchBar from "../SearchBar";
import { Loading } from "../Loading";
import { Helmet } from "react-helmet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FetchList, fetchBatchLogos } from "../../utils/api";
import TagSelector from "../TagSelector";
import pinyin from "pinyin-match";
import { generateSearchEngineCard } from "../../utils/serachEngine";
import { toggleJumpTarget } from "../../utils/setting";
import LocalClock from "./LocalClock";

const FRAME_INITIAL_COUNT = 48;
const FRAME_BATCH_COUNT = 48;
const BACK_TO_TOP_THRESHOLD = 300;
const ALL_TOOLS_TAG = "全部工具";
const ADMIN_TAG = "管理后台";
const DEFAULT_TAG = "默认";
const HOME_CACHE_TTL = 2000;

let homeDataCache: any = null;
let homeDataCacheAt = 0;
let homeDataInFlight: Promise<any> | null = null;

const mutiSearch = (s, t) => {
  const source = (s as string).toLowerCase();
  const target = t.toLowerCase();
  const rawInclude = source.includes(target);
  const pinYinInclude = Boolean(pinyin.match(source, target));
  return rawInclude || pinYinInclude;
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

const Content = () => {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [currTag, setCurrTag] = useState(ALL_TOOLS_TAG);
  const [searchString, setSearchString] = useState("");
  const [val, setVal] = useState("");
  const [searchEngineCards, setSearchEngineCards] = useState<any[]>([]);
  const [batchLogoMap, setBatchLogoMap] = useState<Record<string, string>>({});
  const [renderCount, setRenderCount] = useState(FRAME_INITIAL_COUNT);
  const [showBackTop, setShowBackTop] = useState(false);

  const filteredDataRef = useRef<any>([]);
  const renderRafRef = useRef<number | null>(null);
  const logoBatchReqRef = useRef(0);
  const contentWrapperRef = useRef<HTMLDivElement | null>(null);


  const stopRenderRaf = useCallback(() => {
    if (renderRafRef.current !== null) {
      window.cancelAnimationFrame(renderRafRef.current);
      renderRafRef.current = null;
    }
  }, []);

  const startBatchLogoFetch = useCallback(async (tools: any[]) => {
    const reqId = ++logoBatchReqRef.current;
    const urls = Array.from(
      new Set(
        (tools || [])
          .map((tool: any) => tool?.logo)
          .filter((logo: any) => typeof logo === "string" && /^https?:\/\//i.test(logo.trim()))
          .map((logo: string) => logo.trim())
      )
    );

    if (!urls.length) {
      if (reqId === logoBatchReqRef.current) {
        setBatchLogoMap({});
      }
      return;
    }

    try {
      const result = await fetchBatchLogos(urls);
      if (reqId !== logoBatchReqRef.current) {
        return;
      }
      const nextMap: Record<string, string> = {};
      Object.entries(result || {}).forEach(([url, item]: [string, any]) => {
        if (item?.base64 && item?.mime) {
          nextMap[url] = `data:${item.mime};base64,${item.base64}`;
        }
      });
      setBatchLogoMap(nextMap);
    } catch {
      if (reqId === logoBatchReqRef.current) {
        setBatchLogoMap({});
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetchHomeData();
      if (Array.isArray(r?.catelogs)) {
        const allIndex = r.catelogs.indexOf(ALL_TOOLS_TAG);
        if (allIndex !== -1) {
          const allTag = r.catelogs.splice(allIndex, 1)[0];
          r.catelogs.push(allTag);
        }
      }
      setData(r);
      setBatchLogoMap({});
      startBatchLogoFetch(r?.tools || []);

      const tagInLocalStorage = window.localStorage.getItem("tag");
      if (tagInLocalStorage && tagInLocalStorage !== "" && r?.catelogs?.includes(tagInLocalStorage)) {
        setCurrTag(tagInLocalStorage);
      } else {
        const defaultTag =
          Array.isArray(r?.catelogs) && r.catelogs.length > 0
            ? r.catelogs.find((t) => t !== ALL_TOOLS_TAG) ?? r.catelogs[0]
            : DEFAULT_TAG;
        setCurrTag(defaultTag);
      }
    } catch (error) {
      console.error("加载首页数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, [startBatchLogoFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
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
  }, [searchString]);

  const handleSetCurrTag = (tag: string) => {
    setCurrTag(tag);
    if (tag !== ADMIN_TAG) {
      window.localStorage.setItem("tag", tag);
    }
    resetSearch(true);
  };

  const resetSearch = (notSetTag?: boolean) => {
    setVal("");
    setSearchString("");
    const tagInLocalStorage = window.localStorage.getItem("tag");
    if (!notSetTag && tagInLocalStorage && tagInLocalStorage !== "" && tagInLocalStorage !== ADMIN_TAG) {
      setCurrTag(tagInLocalStorage);
    }
  };

  const handleSetSearch = (nextVal: string) => {
    if (nextVal !== "" && nextVal) {
      setCurrTag(ALL_TOOLS_TAG);
      setSearchString(nextVal.trim());
    } else {
      resetSearch();
    }
  };

  const filteredData = useMemo(() => {
    if (data.tools) {
      const localResult = data.tools
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
      return [...localResult, ...searchEngineCards];
    }
    return [...searchEngineCards];
  }, [data, currTag, searchString, searchEngineCards]);

  useEffect(() => {
    filteredDataRef.current = filteredData;
  }, [filteredData]);

  useEffect(() => {
    stopRenderRaf();
    const total = filteredData.length;
    const initialCount = Math.min(FRAME_INITIAL_COUNT, total);
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

    return () => {
      stopRenderRaf();
    };
  }, [filteredData, stopRenderRaf]);

  const onKeyEnter = useCallback(
    (ev: KeyboardEvent) => {
      const cards = filteredDataRef.current;
      if (ev.keyCode === 13 && cards?.length) {
        window.open(cards[0]?.url, "_blank");
        resetSearch();
      }
      if (ev.ctrlKey || ev.metaKey) {
        const num = Number(ev.key);
        if (isNaN(num)) return;
        ev.preventDefault();
        const index = Number(ev.key) - 1;
        if (index >= 0 && index < cards.length) {
          window.open(cards[index]?.url, "_blank");
          resetSearch();
        }
      }
    },
    []
  );

  useEffect(() => {
    if (searchString.trim() === "") {
      document.removeEventListener("keydown", onKeyEnter);
    } else {
      document.addEventListener("keydown", onKeyEnter);
    }
    return () => {
      document.removeEventListener("keydown", onKeyEnter);
    };
  }, [searchString, onKeyEnter]);

  const renderedCards = useMemo(() => filteredData.slice(0, renderCount), [filteredData, renderCount]);

  const renderCardsV2 = useCallback(() => {
    return renderedCards.map((item, index) => {
      const rawLogo = item?.logo;
      const mappedLogo = typeof rawLogo === "string" ? batchLogoMap[rawLogo] || rawLogo : rawLogo;
      return (
        <CardV2
          title={item.name}
          url={item.url}
          des={item.desc}
          logo={mappedLogo}
          key={item.id}
          catelog={item.catelog}
          index={index}
          isSearching={searchString.trim() !== ""}
          noImageMode={data?.siteConfig?.noImageMode || false}
          compactMode={data?.siteConfig?.compactMode || false}
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
  }, [renderedCards, batchLogoMap, searchString, data?.siteConfig?.noImageMode, data?.siteConfig?.compactMode, loadData]);

  const handleContentScroll = useCallback((ev: any) => {
    const nextShow = ev.currentTarget.scrollTop > BACK_TO_TOP_THRESHOLD;
    setShowBackTop((prev) => (prev === nextShow ? prev : nextShow));
  }, []);

  const scrollToTop = useCallback(() => {
    contentWrapperRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const showClock = data?.siteConfig?.showClock ?? true;

  return (
    <>
      <Helmet>
        <meta charSet="utf-8" />
        <link rel="icon" href={data?.setting?.favicon ?? "/logo192.png"} />
        <title>{data?.setting?.title ?? "Van Nav"}</title>
      </Helmet>
      <div className="topbar">
        {showClock && (
          <div className="clock-row">
            <LocalClock />
          </div>
        )}
        <div className="content">
          <SearchBar
            searchString={val}
            setSearchText={(t) => {
              setVal(t);
              handleSetSearch(t);
            }}
          />
          <TagSelector tags={data?.catelogs ?? [ALL_TOOLS_TAG]} currTag={currTag} onTagChange={handleSetCurrTag} />
        </div>
      </div>
      <div className="content-wraper" onScroll={handleContentScroll} ref={contentWrapperRef}>
        <div className={`content cards ${data?.siteConfig?.compactMode ? "compact-grid" : ""}`}>
          {loading ? <Loading /> : renderCardsV2()}
        </div>
      </div>
      {showBackTop && (
        <button className="back-top-icon-btn" onClick={scrollToTop} type="button" aria-label="scroll to top">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M12 7.4L6.2 13.2l1.4 1.4 4.4-4.4 4.4 4.4 1.4-1.4z" />
          </svg>
        </button>
      )}
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



