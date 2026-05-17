package service

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"
	"unicode"
)

const (
	loginFailWindow    = 15 * time.Minute
	loginCaptchaAfter  = 3
	loginLockAfter     = 8
	loginLockDuration  = 30 * time.Minute
	loginCaptchaTTL    = 5 * time.Minute
	loginCaptchaLength = 5
)

type loginAttemptState struct {
	FailCount   int
	FirstFailed time.Time
	LockedUntil time.Time
}

type loginCaptchaState struct {
	IP        string
	Answer    string
	ExpiresAt time.Time
}

type LoginGuardStatus struct {
	NeedCaptcha bool
	Locked      bool
	RetryAfter  int64
}

var (
	loginGuardLock sync.Mutex
	attemptMap     = make(map[string]*loginAttemptState)
	captchaMap     = make(map[string]*loginCaptchaState)
)

func cleanupExpiredLocked(now time.Time) {
	for ip, state := range attemptMap {
		if state == nil {
			delete(attemptMap, ip)
			continue
		}
		if !state.LockedUntil.IsZero() && now.After(state.LockedUntil) {
			delete(attemptMap, ip)
		}
	}
	for id, state := range captchaMap {
		if state == nil || now.After(state.ExpiresAt) {
			delete(captchaMap, id)
		}
	}
}

func getOrInitAttempt(ip string, now time.Time) *loginAttemptState {
	state, ok := attemptMap[ip]
	if !ok || state == nil {
		state = &loginAttemptState{
			FailCount:   0,
			FirstFailed: now,
		}
		attemptMap[ip] = state
		return state
	}
	if state.FailCount > 0 && now.Sub(state.FirstFailed) > loginFailWindow {
		state.FailCount = 0
		state.FirstFailed = now
		state.LockedUntil = time.Time{}
	}
	return state
}

func GetLoginGuardStatus(ip string) LoginGuardStatus {
	now := time.Now()
	loginGuardLock.Lock()
	defer loginGuardLock.Unlock()
	cleanupExpiredLocked(now)
	state := getOrInitAttempt(ip, now)
	if !state.LockedUntil.IsZero() && now.Before(state.LockedUntil) {
		return LoginGuardStatus{
			NeedCaptcha: true,
			Locked:      true,
			RetryAfter:  int64(state.LockedUntil.Sub(now).Seconds()),
		}
	}
	return LoginGuardStatus{
		NeedCaptcha: state.FailCount >= loginCaptchaAfter,
		Locked:      false,
		RetryAfter:  0,
	}
}

func RecordLoginFailure(ip string) LoginGuardStatus {
	now := time.Now()
	loginGuardLock.Lock()
	defer loginGuardLock.Unlock()
	cleanupExpiredLocked(now)
	state := getOrInitAttempt(ip, now)
	if state.FailCount == 0 {
		state.FirstFailed = now
	}
	state.FailCount++
	if state.FailCount >= loginLockAfter {
		state.LockedUntil = now.Add(loginLockDuration)
		return LoginGuardStatus{
			NeedCaptcha: true,
			Locked:      true,
			RetryAfter:  int64(loginLockDuration.Seconds()),
		}
	}
	return LoginGuardStatus{
		NeedCaptcha: state.FailCount >= loginCaptchaAfter,
		Locked:      false,
		RetryAfter:  0,
	}
}

func RecordLoginSuccess(ip string) {
	loginGuardLock.Lock()
	defer loginGuardLock.Unlock()
	delete(attemptMap, ip)
	for id, state := range captchaMap {
		if state != nil && state.IP == ip {
			delete(captchaMap, id)
		}
	}
}

func CreateLoginCaptcha(ip string) (string, string, int64) {
	now := time.Now()
	loginGuardLock.Lock()
	defer loginGuardLock.Unlock()
	cleanupExpiredLocked(now)

	answer := randomCaptchaText(loginCaptchaLength)
	id := randomCaptchaID()
	expiresAt := now.Add(loginCaptchaTTL)
	captchaMap[id] = &loginCaptchaState{
		IP:        ip,
		Answer:    answer,
		ExpiresAt: expiresAt,
	}
	image := renderCaptchaSVG(answer)
	return id, image, int64(loginCaptchaTTL.Seconds())
}

func VerifyLoginCaptcha(ip string, captchaID string, captchaAnswer string) bool {
	loginGuardLock.Lock()
	defer loginGuardLock.Unlock()
	now := time.Now()
	cleanupExpiredLocked(now)
	state, ok := captchaMap[captchaID]
	if !ok || state == nil {
		return false
	}
	delete(captchaMap, captchaID)
	if state.IP != ip {
		return false
	}
	return normalizeCaptchaText(state.Answer) == normalizeCaptchaText(captchaAnswer)
}

func randomCaptchaID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return fmt.Sprintf("fallback_%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func randomCaptchaText(length int) string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	var b strings.Builder
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			b.WriteByte('A')
			continue
		}
		b.WriteByte(alphabet[n.Int64()])
	}
	return b.String()
}

func normalizeCaptchaText(s string) string {
	s = strings.TrimSpace(s)
	var b strings.Builder
	for _, r := range s {
		if unicode.IsSpace(r) {
			continue
		}
		b.WriteRune(unicode.ToUpper(r))
	}
	return b.String()
}

func renderCaptchaSVG(text string) string {
	width := 160
	height := 48
	var lines strings.Builder
	for i := 0; i < 10; i++ {
		x1 := randomInt(0, width)
		y1 := randomInt(0, height)
		x2 := randomInt(0, width)
		y2 := randomInt(0, height)
		lines.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="rgba(190,190,190,0.35)" stroke-width="1"/>`, x1, y1, x2, y2))
	}
	var chars strings.Builder
	for i, ch := range text {
		x := 16 + i*27 + randomInt(-2, 2)
		y := 31 + randomInt(-4, 4)
		rotate := randomInt(-20, 20)
		chars.WriteString(fmt.Sprintf(`<text x="%d" y="%d" transform="rotate(%d %d %d)" fill="#f0e8dc" font-size="24" font-family="monospace" font-weight="700">%c</text>`, x, y, rotate, x, y, ch))
	}
	svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d"><rect width="100%%" height="100%%" rx="10" fill="#1b1815"/>%s%s</svg>`, width, height, lines.String(), chars.String())
	return "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(svg))
}

func randomInt(min int, max int) int {
	if max <= min {
		return min
	}
	n, err := rand.Int(rand.Reader, big.NewInt(int64(max-min+1)))
	if err != nil {
		return min
	}
	return min + int(n.Int64())
}
