package utils

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt"
	"github.com/mereith/nav/logger"
	"github.com/mereith/nav/types"
)

func RandomJWTKey() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		logger.LogError("生成随机密钥失败: %v", err)
		return ""
	}
	return hex.EncodeToString(bytes)
}

// JTW 密钥
var jwtSecret = []byte("replace_me")

func init() {
	secret := strings.TrimSpace(os.Getenv("NAV_JWT_SECRET"))
	if secret == "" {
		secret = RandomJWTKey()
	}
	if secret == "" {
		secret = "change_me_in_production"
		logger.LogError("JWT 密钥生成失败，已使用回退密钥，请尽快设置 NAV_JWT_SECRET")
	}
	jwtSecret = []byte(secret)
	logger.LogInfo("JWT 密钥初始化完成")
}

// 签名一个 JTW
func SignJWT(user types.User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"name": user.Name,
		"id":   user.Id,
		"exp":  time.Now().Add(time.Hour * 24 * 30).Unix(),
	})
	tokenString, err := token.SignedString([]byte(jwtSecret))
	return tokenString, err
}

// 签名一个 JTW
func SignJWTForAPI(tokenName string, tokenId int) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"name": tokenName,
		"id":   tokenId,
		"exp":  time.Now().Add(time.Hour * 24 * 365).Unix(),
	})
	tokenString, err := token.SignedString([]byte(jwtSecret))
	return tokenString, err
}

// 解密一个 JTW
func ParseJWT(tokenString string) (*jwt.Token, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (i interface{}, e error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("非法签名算法")
		}
		return jwtSecret, nil
	})
	return token, err
}

func ExtractToken(rawToken string) string {
	rawToken = strings.TrimSpace(rawToken)
	if strings.HasPrefix(strings.ToLower(rawToken), "bearer ") {
		return strings.TrimSpace(rawToken[7:])
	}
	return rawToken
}

func IsLogin(c *gin.Context) bool {
	rawToken := c.Request.Header.Get("Authorization")
	if rawToken == "" {
		return false
	}
	rawToken = ExtractToken(rawToken)
	token, err := ParseJWT(rawToken)
	return err == nil && token.Valid
}
