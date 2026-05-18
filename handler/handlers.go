package handler

import (
	"container/list"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mereith/nav/database"
	"github.com/mereith/nav/logger"
	"github.com/mereith/nav/service"
	"github.com/mereith/nav/types"
	"github.com/mereith/nav/utils"
)

type GetLogoBatchReq struct {
	Urls []string `json:"urls"`
}

type cachedLogo struct {
	data        []byte
	contentType string
}

type logoCacheItem struct {
	key   string
	value cachedLogo
}

type logoLRUCache struct {
	maxEntries int
	ll         *list.List
	cache      map[string]*list.Element
	mu         sync.Mutex
}

type logoNegativeCache struct {
	ttl   time.Duration
	cache map[string]time.Time
	mu    sync.Mutex
}

func newLogoLRUCache(maxEntries int) *logoLRUCache {
	return &logoLRUCache{
		maxEntries: maxEntries,
		ll:         list.New(),
		cache:      make(map[string]*list.Element, maxEntries),
	}
}

func (c *logoLRUCache) Get(key string) (cachedLogo, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if ele, ok := c.cache[key]; ok {
		c.ll.MoveToFront(ele)
		return ele.Value.(*logoCacheItem).value, true
	}
	return cachedLogo{}, false
}

func (c *logoLRUCache) Add(key string, value cachedLogo) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if ele, ok := c.cache[key]; ok {
		ele.Value.(*logoCacheItem).value = value
		c.ll.MoveToFront(ele)
		return
	}
	ele := c.ll.PushFront(&logoCacheItem{key: key, value: value})
	c.cache[key] = ele
	if c.maxEntries > 0 && c.ll.Len() > c.maxEntries {
		last := c.ll.Back()
		if last == nil {
			return
		}
		c.ll.Remove(last)
		kv := last.Value.(*logoCacheItem)
		delete(c.cache, kv.key)
	}
}

func newLogoNegativeCache(ttl time.Duration) *logoNegativeCache {
	return &logoNegativeCache{
		ttl:   ttl,
		cache: make(map[string]time.Time),
	}
}

func (c *logoNegativeCache) Hit(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	expiresAt, ok := c.cache[key]
	if !ok {
		return false
	}
	if time.Now().After(expiresAt) {
		delete(c.cache, key)
		return false
	}
	return true
}

func (c *logoNegativeCache) Add(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache[key] = time.Now().Add(c.ttl)
}

func (c *logoNegativeCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.cache, key)
}

var decodedLogoCache = newLogoLRUCache(1024)
var missingLogoCache = newLogoNegativeCache(2 * time.Minute)

func etagLastModified(etag string) time.Time {
	if len(etag) < 10 {
		return time.Unix(946684800, 0).UTC()
	}
	raw := strings.Trim(etag, "\"")
	if len(raw) < 8 {
		return time.Unix(946684800, 0).UTC()
	}
	seed, err := strconv.ParseInt(raw[:8], 16, 64)
	if err != nil {
		return time.Unix(946684800, 0).UTC()
	}
	return time.Unix(946684800+seed, 0).UTC()
}

func detectImageContentType(rawURL string) string {
	urlLower := strings.ToLower(rawURL)
	switch {
	case strings.Contains(urlLower, ".svg"):
		return "image/svg+xml"
	case strings.Contains(urlLower, ".png"):
		return "image/png"
	case strings.Contains(urlLower, ".jpg"), strings.Contains(urlLower, ".jpeg"):
		return "image/jpeg"
	case strings.Contains(urlLower, ".webp"):
		return "image/webp"
	case strings.Contains(urlLower, ".gif"):
		return "image/gif"
	default:
		return "image/x-icon"
	}
}

func ExportToolsHandler(c *gin.Context) {
	tools := service.GetAllTool()
	c.JSON(200, gin.H{
		"success": true,
		"message": "导出工具成功",
		"data":    tools,
	})
}

func ImportToolsHandler(c *gin.Context) {
	var tools []types.Tool
	err := c.ShouldBindJSON(&tools)
	if err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	// 导入所有工具
	service.ImportTools(tools)
	c.JSON(200, gin.H{
		"success": true,
		"message": "导入工具成功",
	})
}

func DeleteApiTokenHandler(c *gin.Context) {
	// 删除 Token
	id := c.Param("id")
	sql_delete_api_token := `
		UPDATE nav_api_token
		SET disabled = 1
		WHERE id = ?;
		`
	stmt, err := database.DB.Prepare(sql_delete_api_token)
	utils.CheckErr(err)
	res, err := stmt.Exec(id)
	utils.CheckErr(err)
	_, err = res.RowsAffected()
	utils.CheckErr(err)
	c.JSON(200, gin.H{
		"success": true,
		"message": "删除 API Token 成功",
	})
}

func AddApiTokenHandler(c *gin.Context) {
	var token types.AddTokenDto
	err := c.ShouldBindJSON(&token)
	if err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	newId := utils.GenerateId()
	var signedJwt string
	signedJwt, err = utils.SignJWTForAPI(token.Name, newId)
	if err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	service.AddApiTokenInDB(types.Token{
		Name:     token.Name,
		Value:    signedJwt,
		Id:       newId,
		Disabled: 0,
	})
	// 签名 jwt
	c.JSON(200, gin.H{
		"success": true,
		"data": gin.H{
			"id":    newId,
			"Value": signedJwt,
			"Name":  token.Name,
		},
		"message": "添加 Token 成功",
	})
}

func UpdateSettingHandler(c *gin.Context) {
	var data types.Setting
	if err := c.ShouldBindJSON(&data); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	logger.LogInfo("更新配置: %+v", data)
	err := service.UpdateSetting(data)
	if err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "更新配置成功",
	})
}

func UpdateUserHandler(c *gin.Context) {
	var data types.UpdateUserDto
	if err := c.ShouldBindJSON(&data); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	service.UpdateUser(data)
	c.JSON(200, gin.H{
		"success": true,
		"message": "更新用户成功",
	})
}

func UpdateSiteConfigHandler(c *gin.Context) {
	var data types.SiteConfig
	if err := c.ShouldBindJSON(&data); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	logger.LogInfo("更新网站配置: %+v", data)
	err := service.UpdateSiteConfig(data)
	if err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "更新网站配置成功",
	})
}

func GetAllHandler(c *gin.Context) {
	tools := service.GetAllTool()
	// 获取全部数据
	catelogs := service.GetAllCatelog()
	if !utils.IsLogin(c) {
		// 过滤掉隐藏工具
		tools = utils.FilterHideTools(tools, catelogs)
	}
	if !utils.IsLogin(c) {
		// 过滤掉隐藏分类
		catelogs = utils.FilterHideCates(catelogs)
	}
	setting := service.GetSetting()
	siteConfig := service.GetSiteConfig()

	cachePayload := gin.H{
		"tools":      tools,
		"catelogs":   catelogs,
		"setting":    setting,
		"siteConfig": siteConfig,
	}
	etagBytes, _ := json.Marshal(cachePayload)
	etagHash := sha1.Sum(etagBytes)
	etag := "\"" + hex.EncodeToString(etagHash[:]) + "\""
	lastModified := etagLastModified(etag)
	c.Header("Cache-Control", "private, max-age=0, must-revalidate")
	c.Header("ETag", etag)
	c.Header("Last-Modified", lastModified.Format(http.TimeFormat))
	if strings.TrimSpace(c.GetHeader("If-None-Match")) == etag {
		c.Status(http.StatusNotModified)
		return
	}
	if ifModifiedSince := c.GetHeader("If-Modified-Since"); ifModifiedSince != "" {
		if t, err := time.Parse(http.TimeFormat, ifModifiedSince); err == nil && !lastModified.After(t.UTC()) {
			c.Status(http.StatusNotModified)
			return
		}
	}

	c.JSON(200, gin.H{
		"success": true,
		"data":    cachePayload,
	})
}

func GetLogoImgHandler(c *gin.Context) {
	rawURL := c.Query("url")
	if rawURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": "URL参数不能为空",
		})
		return
	}
	if missingLogoCache.Hit(rawURL) {
		c.JSON(http.StatusNotFound, gin.H{
			"success":      false,
			"errorMessage": "未找到图片",
		})
		return
	}
	img := service.GetImgFromDB(rawURL)
	if img.Value == "" {
		missingLogoCache.Add(rawURL)
		c.JSON(http.StatusNotFound, gin.H{
			"success":      false,
			"errorMessage": "未找到图片",
		})
		return
	}
	etagHash := sha1.Sum([]byte(rawURL + ":" + img.Value))
	etag := "\"" + hex.EncodeToString(etagHash[:]) + "\""
	lastModified := etagLastModified(etag)
	c.Header("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800")
	c.Header("ETag", etag)
	c.Header("Last-Modified", lastModified.Format(http.TimeFormat))

	if strings.TrimSpace(c.GetHeader("If-None-Match")) == etag {
		c.Status(http.StatusNotModified)
		return
	}
	if ifModifiedSince := c.GetHeader("If-Modified-Since"); ifModifiedSince != "" {
		if t, err := time.Parse(http.TimeFormat, ifModifiedSince); err == nil && !lastModified.After(t.UTC()) {
			c.Status(http.StatusNotModified)
			return
		}
	}

	cacheKey := etag + "|" + rawURL
	if cached, ok := decodedLogoCache.Get(cacheKey); ok {
		c.Data(http.StatusOK, cached.contentType, cached.data)
		return
	}

	imgBuffer, err := base64.StdEncoding.DecodeString(img.Value)
	if err != nil {
		missingLogoCache.Add(rawURL)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"errorMessage": "图片解码失败",
		})
		return
	}
	missingLogoCache.Delete(rawURL)
	contentType := detectImageContentType(rawURL)
	decodedLogoCache.Add(cacheKey, cachedLogo{
		data:        imgBuffer,
		contentType: contentType,
	})
	c.Data(http.StatusOK, contentType, imgBuffer)
}

func GetLogoImgBatchHandler(c *gin.Context) {
	var req GetLogoBatchReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	if len(req.Urls) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    map[string]any{},
		})
		return
	}

	imgs := service.GetImgsFromDB(req.Urls)
	result := make(map[string]any, len(imgs))
	etagInputs := make([]string, 0, len(imgs))
	for originalURL, img := range imgs {
		result[originalURL] = gin.H{
			"mime":   detectImageContentType(originalURL),
			"base64": img.Value,
		}
		etagInputs = append(etagInputs, originalURL+":"+img.Value)
	}
	sort.Strings(etagInputs)
	etagRaw := strings.Join(etagInputs, "|")
	etagHash := sha1.Sum([]byte(etagRaw))
	etag := "\"" + hex.EncodeToString(etagHash[:]) + "\""
	if strings.TrimSpace(c.GetHeader("If-None-Match")) == etag {
		c.Status(http.StatusNotModified)
		return
	}
	c.Header("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
	c.Header("ETag", etag)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func GetAdminAllDataHandler(c *gin.Context) {
	// 管理员获取全部数据，还有个用户名。
	tools := service.GetAllTool()
	catelogs := service.GetAllCatelog()
	setting := service.GetSetting()
	siteConfig := service.GetSiteConfig()
	tokens := service.GetApiTokens()
	userId, ok := c.Get("uid")
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": "不存在该用户！",
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"data": gin.H{
			"tools":      tools,
			"catelogs":   catelogs,
			"setting":    setting,
			"siteConfig": siteConfig,
			"user": gin.H{
				"name": c.GetString("username"),
				"id":   userId,
			},
			"tokens": tokens,
		},
	})
}

func LoginHandler(c *gin.Context) {
	clientIP := c.ClientIP()
	status := service.GetLoginGuardStatus(clientIP)
	if status.Locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"success":      false,
			"errorMessage": "登录失败次数过多，请稍后再试",
			"data": gin.H{
				"locked":      true,
				"needCaptcha": true,
				"retryAfter":  status.RetryAfter,
			},
		})
		return
	}

	var data types.LoginDto
	if err := c.ShouldBindJSON(&data); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	if status.NeedCaptcha {
		if data.CaptchaID == "" || data.CaptchaAnswer == "" || !service.VerifyLoginCaptcha(clientIP, data.CaptchaID, data.CaptchaAnswer) {
			nextStatus := service.RecordLoginFailure(clientIP)
			c.JSON(200, gin.H{
				"success":      false,
				"errorMessage": "验证码错误或已过期",
				"data": gin.H{
					"locked":      nextStatus.Locked,
					"needCaptcha": true,
					"retryAfter":  nextStatus.RetryAfter,
				},
			})
			return
		}
	}
	user := service.GetUser(data.Name)
	if user.Name == "" {
		nextStatus := service.RecordLoginFailure(clientIP)
		c.JSON(200, gin.H{
			"success":      false,
			"errorMessage": "用户名或密码错误",
			"data": gin.H{
				"locked":      nextStatus.Locked,
				"needCaptcha": nextStatus.NeedCaptcha,
				"retryAfter":  nextStatus.RetryAfter,
			},
		})
		return
	}
	validPassword := false
	if utils.LooksLikeBcryptHash(user.Password) {
		validPassword = utils.VerifyPassword(user.Password, data.Password)
	} else {
		// 兼容历史明文密码，登录成功后自动迁移为哈希存储
		validPassword = user.Password == data.Password
		if validPassword {
			hashed, hashErr := utils.HashPassword(data.Password)
			if hashErr == nil && hashed != "" {
				service.UpdateUserPassword(user.Id, hashed)
			}
		}
	}
	if !validPassword {
		nextStatus := service.RecordLoginFailure(clientIP)
		c.JSON(200, gin.H{
			"success":      false,
			"errorMessage": "用户名或密码错误",
			"data": gin.H{
				"locked":      nextStatus.Locked,
				"needCaptcha": nextStatus.NeedCaptcha,
				"retryAfter":  nextStatus.RetryAfter,
			},
		})
		return
	}
	service.RecordLoginSuccess(clientIP)
	// 生成 token
	token, err := utils.SignJWT(user)
	utils.CheckErr(err)

	c.JSON(200, gin.H{
		"success": true,
		"message": "登录成功",
		"data": gin.H{
			"user":  user,
			"token": token,
		},
	})

}

func GetLoginCaptchaHandler(c *gin.Context) {
	clientIP := c.ClientIP()
	status := service.GetLoginGuardStatus(clientIP)
	if status.Locked {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"success":      false,
			"errorMessage": "当前 IP 已临时封锁，请稍后再试",
			"data": gin.H{
				"locked":      true,
				"needCaptcha": true,
				"retryAfter":  status.RetryAfter,
			},
		})
		return
	}
	id, question, expireIn := service.CreateLoginCaptcha(clientIP)
	c.JSON(200, gin.H{
		"success": true,
		"data": gin.H{
			"captchaId": id,
			"imageData": question,
			"expireIn":  expireIn,
		},
	})
}

// 退出登录
func LogoutHandler(c *gin.Context) {
	c.JSON(200, gin.H{
		"success": true,
		"message": "登出成功",
	})
}

func AddToolHandler(c *gin.Context) {
	// 添加工具
	var data types.AddToolDto
	if err := c.ShouldBindJSON(&data); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	logger.LogInfo("%s 获取 logo: %s", data.Name, data.Logo)
	id, err := service.AddTool(data)
	if err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	if data.Logo == "" {
		go service.LazyFetchLogo(data.Url, id)
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "添加成功",
	})
}

func DeleteToolHandler(c *gin.Context) {
	// 删除工具
	id := c.Param("id")
	sql_delete_tool := `
		DELETE FROM nav_table WHERE id = ?;
		`
	stmt, err := database.DB.Prepare(sql_delete_tool)
	utils.CheckErr(err)
	res, err := stmt.Exec(id)
	utils.CheckErr(err)
	_, err = res.RowsAffected()
	utils.CheckErr(err)
	// 删除工具的 logo，如果有
	numberId, err := strconv.Atoi(id)
	utils.CheckErr(err)
	url1 := service.GetToolLogoUrlById(numberId)
	urlEncoded := url.QueryEscape(url1)
	sql_delete_tool_img := `
		DELETE FROM nav_img WHERE url = ?;
		`
	stmt, err = database.DB.Prepare(sql_delete_tool_img)
	utils.CheckErr(err)
	res, err = stmt.Exec(urlEncoded)
	utils.CheckErr(err)
	_, err = res.RowsAffected()
	utils.CheckErr(err)
	c.JSON(200, gin.H{
		"success": true,
		"message": "删除成功",
	})
}

func UpdateToolHandler(c *gin.Context) {
	// 更新工具
	var data types.UpdateToolDto
	if err := c.ShouldBindJSON(&data); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	service.UpdateTool(data)
	if data.Logo == "" {
		logger.LogInfo("%s 获取 logo: %s", data.Name, data.Logo)
		go service.LazyFetchLogo(data.Url, int64(data.Id))
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "更新成功",
	})
}

func AddCatelogHandler(c *gin.Context) {
	// 添加分类
	var data types.AddCatelogDto
	if err := c.ShouldBindJSON(&data); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	service.AddCatelog(data)

	c.JSON(200, gin.H{
		"success": true,
		"message": "增加分类成功",
	})
}

func DeleteCatelogHandler(c *gin.Context) {
	// 删除分类
	id := c.Param("id")
	sql_delete_catelog := `
		DELETE FROM nav_catelog WHERE id = ?;
		`
	stmt, err := database.DB.Prepare(sql_delete_catelog)
	utils.CheckErr(err)
	res, err := stmt.Exec(id)
	utils.CheckErr(err)
	_, err = res.RowsAffected()
	utils.CheckErr(err)
	c.JSON(200, gin.H{
		"success": true,
		"message": "删除分类成功",
	})
}

func UpdateCatelogHandler(c *gin.Context) {
	// 更新分类
	var data types.UpdateCatelogDto
	if err := c.ShouldBindJSON(&data); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	service.UpdateCatelog(data)

	c.JSON(200, gin.H{
		"success": true,
		"message": "更新分类成功",
	})
}

func UpdateCatelogsSortHandler(c *gin.Context) {
	var updates []types.UpdateCatelogsSortDto
	if err := c.ShouldBindJSON(&updates); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	err := service.UpdateCatelogsSort(updates)
	if err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "更新排序成功",
	})
}

func ManifastHanlder(c *gin.Context) {

	setting := service.GetSetting()
	title := setting.Title

	var icons = []gin.H{}

	logo192 := setting.Logo192
	if logo192 == "" {
		logo192 = "logo192.png"
	}

	logo512 := setting.Logo512
	if logo512 == "" {
		logo512 = "logo512.png"
	}

	icons = append(icons, gin.H{
		"src":   logo192,
		"type":  "image/png",
		"sizes": "192x192",
	})
	icons = append(icons, gin.H{
		"src":   logo512,
		"type":  "image/png",
		"sizes": "512x512",
	})

	if title == "" {
		title = "Van nav"
	}
	c.JSON(200, gin.H{
		"short_name":       title,
		"name":             title,
		"icons":            icons,
		"start_url":        "/",
		"display":          "standalone",
		"scope":            "/",
		"theme_color":      "#000000",
		"background_color": "#ffffff",
	})
}

func UpdateToolsSortHandler(c *gin.Context) {
	var updates []types.UpdateToolsSortDto
	if err := c.ShouldBindJSON(&updates); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	err := service.UpdateToolsSort(updates)
	if err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "更新排序成功",
	})
}

func UpdateToolsAllSortHandler(c *gin.Context) {
	var updates []types.UpdateToolsAllSortDto
	if err := c.ShouldBindJSON(&updates); err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	err := service.UpdateToolsAllSort(updates)
	if err != nil {
		utils.CheckErr(err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "更新全部工具排序成功",
	})
}

// ==================== 搜索引擎相关处理函数 ====================

// 获取所有搜索引擎
func GetAllSearchEnginesHandler(c *gin.Context) {
	engines, err := database.GetAllSearchEngines()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"data":    engines,
	})
}

// 获取启用的搜索引擎（用于前端搜索功能）
func GetEnabledSearchEnginesHandler(c *gin.Context) {
	engines, err := database.GetEnabledSearchEngines()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"data":    engines,
	})
}

// 添加搜索引擎
func AddSearchEngineHandler(c *gin.Context) {
	var engine types.SearchEngine
	err := c.ShouldBindJSON(&engine)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	id, err := database.AddSearchEngine(engine)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "添加搜索引擎成功",
		"data": gin.H{
			"id": id,
		},
	})
}

// 更新搜索引擎
func UpdateSearchEngineHandler(c *gin.Context) {
	var engine types.SearchEngine
	err := c.ShouldBindJSON(&engine)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	// 从URL参数获取ID
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": "无效的ID",
		})
		return
	}
	engine.Id = id

	err = database.UpdateSearchEngine(engine)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "更新搜索引擎成功",
	})
}

// 删除搜索引擎
func DeleteSearchEngineHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": "无效的ID",
		})
		return
	}

	err = database.DeleteSearchEngine(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "删除搜索引擎成功",
	})
}

// 更新搜索引擎排序
func UpdateSearchEngineSortHandler(c *gin.Context) {
	var sortData []struct {
		Id   int `json:"id"`
		Sort int `json:"sort"`
	}
	err := c.ShouldBindJSON(&sortData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	err = database.UpdateSearchEngineSort(sortData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":      false,
			"errorMessage": err.Error(),
		})
		return
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "更新排序成功",
	})
}
