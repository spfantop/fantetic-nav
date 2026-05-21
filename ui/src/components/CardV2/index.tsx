import { memo, useMemo, useState, useEffect, useCallback } from "react";
import "./index.css";
import { getLogoUrl } from "../../utils/check";
import { getJumpTarget } from "../../utils/setting";

const loadedImageSrcCache = new Set<string>();
const failedImageSrcCache = new Set<string>();
const EAGER_LOAD_COUNT = 10;
const IMAGE_SRC_CACHE_MAX = 800;

const ensureCacheSize = (cache: Set<string>) => {
  if (cache.size < IMAGE_SRC_CACHE_MAX) {
    return;
  }
  const oldest = cache.values().next().value;
  if (oldest) {
    cache.delete(oldest);
  }
};

const Card = ({ title, url, des, logo, catelog, onClick, index, isSearching, noImageMode, compactMode, showCatelog = true }) => {
  const imageSrc = useMemo(() => {
    return url === "admin" ? logo : getLogoUrl(logo);
  }, [logo, url]);
  const [imageLoaded, setImageLoaded] = useState(() => loadedImageSrcCache.has(imageSrc));
  const [imageError, setImageError] = useState(() => failedImageSrcCache.has(imageSrc));
  const [showLoading, setShowLoading] = useState(() => !loadedImageSrcCache.has(imageSrc) && !failedImageSrcCache.has(imageSrc));

  useEffect(() => {
    const loadedFromCache = loadedImageSrcCache.has(imageSrc);
    const failedFromCache = failedImageSrcCache.has(imageSrc);
    setImageLoaded(loadedFromCache);
    setImageError(failedFromCache);
    setShowLoading(!loadedFromCache && !failedFromCache);

    if (loadedFromCache || failedFromCache) {
      return;
    }

    const timeout = setTimeout(() => {
      setShowLoading(false);
      console.warn("图片加载超时:", imageSrc);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [imageSrc]);

  const handleImageLoad = useCallback(() => {
    ensureCacheSize(loadedImageSrcCache);
    loadedImageSrcCache.add(imageSrc);
    failedImageSrcCache.delete(imageSrc);
    setImageLoaded(true);
    setShowLoading(false);
  }, [imageSrc]);

  const handleImageError = useCallback(() => {
    ensureCacheSize(failedImageSrcCache);
    failedImageSrcCache.add(imageSrc);
    loadedImageSrcCache.delete(imageSrc);
    setImageError(true);
    setShowLoading(false);
  }, [imageSrc]);

  const imageElement = useMemo(() => {
    if (imageError) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", opacity: 0.6 }}>
          图
        </div>
      );
    }

    const shouldEagerLoad = !isSearching && index < EAGER_LOAD_COUNT;
    return (
      <>
        {showLoading && !imageLoaded && <div className="card-loading-spinner"></div>}
        <img
          src={imageSrc}
          alt={title}
          loading={shouldEagerLoad ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            opacity: imageLoaded ? 1 : 0.1,
            transition: "opacity 0.3s ease",
          }}
        />
      </>
    );
  }, [imageSrc, title, imageLoaded, imageError, showLoading, handleImageLoad, handleImageError, index, isSearching]);

  const displayCatelog = useMemo(() => {
    return catelog === null || catelog === undefined || catelog === "" || (typeof catelog === "string" && catelog.trim() === "") ? "未分类" : catelog;
  }, [catelog]);

  const showNumIndex = index < 10 && isSearching;
  return (
    <a
      href={url === "toggleJumpTarget" ? undefined : url}
      onClick={() => {
        onClick(url);
      }}
      target={getJumpTarget() === "blank" ? "_blank" : "_self"}
      rel="noreferrer"
      className="card-box"
    >
      {showNumIndex && <span className="card-index">{index + 1}</span>}
      <div className={`card-content ${compactMode ? "compact-mode" : ""}`}>
        {!noImageMode && <div className="card-left">{imageElement}</div>}
        <div className="card-right">
          <div className="card-right-top">
            <span className="card-right-title" title={title}>
              {title}
            </span>
            {!compactMode && showCatelog && (
              <span className="card-tag" title={displayCatelog}>
                {displayCatelog}
              </span>
            )}
          </div>
          {!compactMode && (
            <div className="card-right-bottom" title={des}>
              {des}
            </div>
          )}
        </div>
      </div>
    </a>
  );
};

export default memo(Card);
