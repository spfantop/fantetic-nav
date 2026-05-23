package service

import (
	"github.com/mereith/nav/database"
	"github.com/mereith/nav/logger"
	"github.com/mereith/nav/types"
)

func GetSiteConfig() types.SiteConfig {
	sql_get_site_config := `
		SELECT id, noImageMode, compactMode, showClock
		FROM nav_site_config
		ORDER BY id ASC
		LIMIT 1;
		`
	var siteConfig types.SiteConfig
	row := database.DB.QueryRow(sql_get_site_config)
	var noImageMode interface{}
	var compactMode interface{}
	var showClock interface{}
	err := row.Scan(&siteConfig.Id, &noImageMode, &compactMode, &showClock)
	if err != nil {
		logger.LogError("获取网站配置失败: %s", err)
		return types.SiteConfig{
			Id:          1,
			NoImageMode: false,
			CompactMode: false,
			ShowClock:   true,
		}
	}

	siteConfig.NoImageMode = boolFromSQL(noImageMode)
	siteConfig.CompactMode = boolFromSQL(compactMode)
	siteConfig.ShowClock = boolFromSQL(showClock)

	return siteConfig
}

func UpdateSiteConfig(data types.SiteConfig) error {
	sql_update_site_config := `
		UPDATE nav_site_config
		SET noImageMode = ?, compactMode = ?, showClock = ?
		WHERE id = (SELECT id FROM nav_site_config ORDER BY id ASC LIMIT 1);
		`

	stmt, err := database.DB.Prepare(sql_update_site_config)
	if err != nil {
		return err
	}
	defer stmt.Close()
	res, err := stmt.Exec(data.NoImageMode, data.CompactMode, data.ShowClock)
	if err != nil {
		return err
	}
	_, err = res.RowsAffected()
	if err == nil {
		InvalidateCache()
	}
	return err
}
