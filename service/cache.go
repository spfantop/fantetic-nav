package service

import (
	"sync"
	"time"

	"github.com/mereith/nav/types"
)

type cachedData struct {
	Tools      []types.Tool
	Catelogs   []types.Catelog
	Setting    types.Setting
	SiteConfig types.SiteConfig
	ExpiresAt  time.Time
}

var (
	cacheMu  sync.RWMutex
	cacheTTL = 5 * time.Minute
	store    *cachedData
)

func GetCachedData() *cachedData {
	cacheMu.RLock()
	defer cacheMu.RUnlock()
	if store != nil && time.Now().Before(store.ExpiresAt) {
		copied := *store
		copied.Tools = make([]types.Tool, len(store.Tools))
		copy(copied.Tools, store.Tools)
		copied.Catelogs = make([]types.Catelog, len(store.Catelogs))
		copy(copied.Catelogs, store.Catelogs)
		return &copied
	}
	return nil
}

func RefreshCache() {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	store = &cachedData{
		Tools:      GetAllTool(),
		Catelogs:   GetAllCatelog(),
		Setting:    GetSetting(),
		SiteConfig: GetSiteConfig(),
		ExpiresAt:  time.Now().Add(cacheTTL),
	}
}

func InvalidateCache() {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	store = nil
}
