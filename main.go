package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"time"

	"github.com/mereith/nav/database"
	"github.com/mereith/nav/handler"
	"github.com/mereith/nav/logger"
	"github.com/mereith/nav/middleware"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

const INDEX = "index.html"

//go:embed public
var fs embed.FS

type binaryFileSystem struct {
	fs   http.FileSystem
	root string
}

func (b *binaryFileSystem) Open(name string) (http.File, error) {
	openPath := path.Join(b.root, name)
	return b.fs.Open(openPath)
}

func (b *binaryFileSystem) Exists(prefix string, filepath string) bool {
	if p := strings.TrimPrefix(filepath, prefix); len(p) < len(filepath) {
		var name string
		if p == "" {
			name = path.Join(b.root, p, INDEX)
		} else {
			name = path.Join(b.root, p)
		}
		if _, err := b.fs.Open(name); err != nil {
			return false
		}
		return true
	}
	return false
}
func BinaryFileSystem(data embed.FS, root string) *binaryFileSystem {
	fs := http.FS(data)
	return &binaryFileSystem{
		fs,
		root,
	}
}

var port = flag.String("port", "6412", "指定监听端口")
var addr = flag.String("addr", "0.0.0.0", "指定监听地址")

func main() {
	flag.Parse()
	database.InitDB()
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()
	_ = router.SetTrustedProxies(nil)
	router.Use(middleware.SecurityHeadersMiddleware())
	router.Use(gzip.Gzip(gzip.DefaultCompression, gzip.WithExcludedExtensions([]string{".png", ".jpg", ".jpeg", ".ico", ".svg"})))
	router.GET("/manifest.json", handler.ManifestHandler)
	router.Use(Serve("/", BinaryFileSystem(fs, "public")))
	api := router.Group("/api")
	{
		api.GET("/", handler.GetAllHandler)

		api.POST("/login", handler.LoginHandler)
		api.GET("/login/captcha", handler.GetLoginCaptchaHandler)
		api.GET("/logout", handler.LogoutHandler)
		api.GET("/img", handler.GetLogoImgHandler)
		api.POST("/img/batch", handler.GetLogoImgBatchHandler)

		api.GET("/searchEngines", handler.GetEnabledSearchEnginesHandler)

		admin := api.Group("/admin")
		admin.Use(middleware.JWTMiddleware())
		{
			admin.POST("/apiToken", handler.AddApiTokenHandler)
			admin.DELETE("/apiToken/:id", handler.DeleteApiTokenHandler)
			admin.GET("/all", handler.GetAdminAllDataHandler)

			admin.GET("/exportTools", handler.ExportToolsHandler)

			admin.POST("/importTools", handler.ImportToolsHandler)

			admin.PUT("/user", handler.UpdateUserHandler)

			admin.PUT("/setting", handler.UpdateSettingHandler)

			admin.PUT("/siteConfig", handler.UpdateSiteConfigHandler)

			admin.POST("/tool", handler.AddToolHandler)
			admin.DELETE("/tool/:id", handler.DeleteToolHandler)
			admin.PUT("/tool/:id", handler.UpdateToolHandler)
			admin.PUT("/tools/sort", handler.UpdateToolsSortHandler)
			admin.PUT("/tools/all-sort", handler.UpdateToolsAllSortHandler)

			admin.POST("/catelog", handler.AddCatelogHandler)
			admin.DELETE("/catelog/:id", handler.DeleteCatelogHandler)
			admin.PUT("/catelog/:id", handler.UpdateCatelogHandler)
			admin.PUT("/catelogs/sort", handler.UpdateCatelogsSortHandler)

			admin.GET("/searchEngine", handler.GetAllSearchEnginesHandler)
			admin.POST("/searchEngine", handler.AddSearchEngineHandler)
			admin.PUT("/searchEngine/:id", handler.UpdateSearchEngineHandler)
			admin.DELETE("/searchEngine/:id", handler.DeleteSearchEngineHandler)
			admin.PUT("/searchEngines/sort", handler.UpdateSearchEngineSortHandler)
		}
	}
	listen := fmt.Sprintf("%s:%s", *addr, *port)
	srv := &http.Server{
		Addr:         listen,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.LogInfo("应用启动成功，网址: http://localhost:%s", *port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.LogError("应用启动失败，错误: %s", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.LogInfo("正在关闭服务器...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.LogError("服务器关闭异常: %s", err)
	}
	logger.LogInfo("服务器已关闭")
}
