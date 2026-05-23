package main

import (
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mereith/nav/logger"
)

type ServeFileSystem interface {
	http.FileSystem
	Exists(prefix string, path string) bool
}

var (
	cacheImmutable  = "public, max-age=31536000, immutable"
	cacheLongAssets = "public, max-age=604800, stale-while-revalidate=86400"
	cacheNone       = "no-store"
)

var immutableExts = map[string]bool{
	".woff":  true,
	".woff2": true,
	".js":    true,
	".css":   true,
}

var longAssetExts = map[string]bool{
	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".webp": true,
	".ico":  true,
	".svg":  true,
	".gif":  true,
	".json": true,
}

func cacheHeaderByPath(filePath string) string {
	ext := strings.ToLower(path.Ext(filePath))
	if immutableExts[ext] {
		return cacheImmutable
	}
	if longAssetExts[ext] {
		return cacheLongAssets
	}
	return cacheNone
}

func Serve(urlPrefix string, fs ServeFileSystem) gin.HandlerFunc {
	fileserver := http.FileServer(fs)
	if urlPrefix != "" {
		fileserver = http.StripPrefix(urlPrefix, fileserver)
	}
	return func(c *gin.Context) {
		if fs.Exists(urlPrefix, c.Request.URL.Path) {
			reqPath := c.Request.URL.Path
			if reqPath == "/" {
				reqPath = "/index.html"
			}
			c.Header("Cache-Control", cacheHeaderByPath(reqPath))
			fileserver.ServeHTTP(c.Writer, c.Request)
			c.Abort()
		} else {
			path := c.Request.URL.Path
			pathHasAPI := strings.Contains(path, "/api") && !strings.Contains(path, "/api-token")
			if pathHasAPI {
				return
			} else {
				c.Header("Cache-Control", cacheNone)
				file, err := fs.Open("index.html")
				if err != nil {
					logger.LogError("文件不存在: %s", c.Request.URL.Path)
					return
				}
				defer file.Close()
				http.ServeContent(c.Writer, c.Request, "index.html", time.Now(), file)
				c.Abort()
			}
		}
	}
}
