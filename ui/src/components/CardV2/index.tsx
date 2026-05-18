import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import "./index.css";
import { getLogoUrl } from "../../utils/check";
import { getJumpTarget } from "../../utils/setting";

const loadedImageSrcCache = new Set<string>();
const failedImageSrcCache = new Set<string>();
const EAGER_LOAD_COUNT = 10;

const Card = ({ title, url, des, logo, catelog, onClick, index, isSearching, noImageMode, compactMode, showCatelog = true }) => {
  const cardRef = useRef<HTMLAnchorElement | null>(null);
  const imageSrc = useMemo(() => {
    return url === "admin" ? logo : getLogoUrl(logo);
  }, [logo, url]);
  const [imageLoaded, setImageLoaded] = useState(() => loadedImageSrcCache.has(imageSrc));
  const [imageError, setImageError] = useState(() => failedImageSrcCache.has(imageSrc));
  const [showLoading, setShowLoading] = useState(() => !loadedImageSrcCache.has(imageSrc) && !failedImageSrcCache.has(imageSrc));
  const [isInView, setIsInView] = useState(index < EAGER_LOAD_COUNT);
  
  // 当图片源变化时重置状态，并添加超时保护
  useEffect(() => {
    const loadedFromCache = loadedImageSrcCache.has(imageSrc);
    const failedFromCache = failedImageSrcCache.has(imageSrc);
    setImageLoaded(loadedFromCache);
    setImageError(failedFromCache);
    setShowLoading(!loadedFromCache && !failedFromCache);

    if (loadedFromCache || failedFromCache) {
      return;
    }
    
    // 10秒超时保护
    const timeout = setTimeout(() => {
      setShowLoading(false);
      console.warn('Image loading timeout:', imageSrc);
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, [imageSrc]);
  
  const handleImageLoad = useCallback(() => {
    loadedImageSrcCache.add(imageSrc);
    failedImageSrcCache.delete(imageSrc);
    setImageLoaded(true);
    setShowLoading(false);
  }, [imageSrc]);
  
  const handleImageError = useCallback(() => {
    failedImageSrcCache.add(imageSrc);
    loadedImageSrcCache.delete(imageSrc);
    setImageError(true);
    setShowLoading(false);
  }, [imageSrc]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsInView(index < EAGER_LOAD_COUNT);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === el) {
            setIsInView(entry.isIntersecting);
          }
        });
      },
      {
        root: document.querySelector(".content-wraper"),
        rootMargin: "280px 0px",
        threshold: 0.01,
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);
  
  const el = useMemo(() => {
    if (imageError) {
      return <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontSize: '20px',
        opacity: 0.6
      }}>🖼️</div>;
    }
    
    const shouldEagerLoad = (!isSearching && index < EAGER_LOAD_COUNT) || isInView;
    return (
      <>
        {showLoading && !imageLoaded && (
          <div className="card-loading-spinner"></div>
        )}
        <img 
          src={imageSrc}
          alt={title}
          loading={shouldEagerLoad ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            opacity: imageLoaded ? 1 : 0.1,
            transition: 'opacity 0.3s ease'
          }}
        />
      </>
    );
  }, [imageSrc, title, imageLoaded, imageError, showLoading, handleImageLoad, handleImageError, index, isSearching, isInView]);
  
  // 处理空分类，显示为"未分类"
  const displayCatelog = useMemo(() => {
    return catelog === null || catelog === undefined || catelog === "" || (typeof catelog === 'string' && catelog.trim() === "") 
      ? "未分类" 
      : catelog;
  }, [catelog]);
  
  const showNumIndex = index < 10 && isSearching;
  return (
    <a
      ref={cardRef}
      href={url === "toggleJumpTarget" ? undefined : url}
      onClick={() => {
        onClick();
      }}
      target={getJumpTarget() === "blank" ? "_blank" : "_self"}
      rel="noreferrer"
      className="card-box"
    >
      {showNumIndex && <span className="card-index">{index + 1}</span>}
      <div className={`card-content ${compactMode ? 'compact-mode' : ''}`}>
        {!noImageMode && (
          <div className="card-left">
            {el}
          </div>
        )}
        <div className="card-right">
          <div className="card-right-top">
            <span className="card-right-title" title={title}>{title}</span>
            {!compactMode && showCatelog && <span className="card-tag" title={displayCatelog}>{displayCatelog}</span>}
          </div>
          {!compactMode && <div className="card-right-bottom" title={des}>{des}</div>}
        </div>
      </div>
    </a>
  );
};

export default Card;
