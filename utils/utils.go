package utils

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"io"
	"net/http"
	neturl "net/url"
	"os"
	"runtime/debug"
	"strings"
	"time"

	"github.com/mereith/nav/logger"
	"github.com/mereith/nav/types"
)

func CheckErr(err error) bool {
	if err != nil {
		logger.LogError("捕获到错误：%s, 堆栈信息：%s", err, string(debug.Stack()))
		return true
	}
	return false
}

func CheckTxErr(err error, tx *sql.Tx) bool {
	if err != nil {
		logger.LogError("出现事务异常，回滚事务: %s, 堆栈信息：%s", err, string(debug.Stack()))
		err2 := tx.Rollback()
		if err2 != nil {
			logger.LogError("事务回滚失败: %s", err2)
		}
		return true
	}
	return false
}

func In(target string, str_array []string) bool {
	for _, element := range str_array {
		if target == element {
			return true
		}
	}
	return false
}

func GetImgBase64FromUrl(url string) string {
	imgUrl := url
	parsedURL, parseErr := neturl.Parse(imgUrl)
	if parseErr != nil || parsedURL == nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return ""
	}
	req, err := http.NewRequest("GET", imgUrl, nil)
	if err != nil {
		CheckErr(err)
		return ""
	}
	req.Header.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36")
	client := &http.Client{
		Timeout: 8 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		CheckErr(err)
		return ""
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return ""
	}
	contentType := strings.ToLower(strings.TrimSpace(strings.Split(res.Header.Get("Content-Type"), ";")[0]))
	if contentType != "" && !strings.HasPrefix(contentType, "image/") && contentType != "application/octet-stream" {
		return ""
	}

	limitedBody := io.LimitReader(res.Body, 2*1024*1024)
	data, readErr := io.ReadAll(limitedBody)
	if readErr != nil {
		CheckErr(readErr)
		return ""
	}
	if len(data) == 0 {
		return ""
	}
	detectedType := strings.ToLower(http.DetectContentType(data))
	if !strings.HasPrefix(detectedType, "image/") {
		if !strings.Contains(string(data), "<svg") {
			return ""
		}
	}

	imageBase64 := base64.StdEncoding.EncodeToString(data)
	return imageBase64
}

func PathExistsOrCreate(path string) {
	_, err := os.Stat(path)
	if err == nil {
		return
	}
	os.Mkdir(path, os.ModePerm)
}

func GenerateId() int {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return int(time.Now().UnixNano())
	}
	return int(time.Now().UnixNano()) ^ int(int32(b[0])<<24|int32(b[1])<<16|int32(b[2])<<8|int32(b[3]))
}

func FilterHideTools(tools []types.Tool, cates []types.Catelog) []types.Tool {
	result := make([]types.Tool, 0)
	var hideCates []string
	for _, cate := range cates {
		if cate.Hide {
			hideCates = append(hideCates, cate.Name)
		}
	}
	for _, tool := range tools {
		if !tool.Hide && !In(tool.Catelog, hideCates) {
			result = append(result, tool)
		}
	}
	return result
}

func FilterHideCates(cates []types.Catelog) []types.Catelog {
	result := make([]types.Catelog, 0)
	for _, cate := range cates {
		if !cate.Hide {
			result = append(result, cate)
		}
	}
	return result
}
