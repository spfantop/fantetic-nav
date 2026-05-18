package database

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"

	"github.com/mereith/nav/logger"
	"github.com/mereith/nav/utils"
)

var DB *sql.DB

func columnExists(tableName string, columnName string) bool {
	query := `SELECT COUNT(*) FROM pragma_table_info(?) WHERE name=?`
	var count int
	err := DB.QueryRow(query, tableName, columnName).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}

func InitDB() {
	var err error
	utils.PathExistsOrCreate("./data")
	dir := "./data"
	dbPath := filepath.Join(dir, "nav.db")
	dbPath = dbPath + "?_journal=WAL&_timeout=5000&_busy_timeout=5000&_txlock=immediate"
	DB, err = sql.Open("sqlite", dbPath)
	utils.CheckErr(err)
	DB.Exec(`PRAGMA journal_mode=WAL;`)
	DB.Exec(`PRAGMA synchronous=NORMAL;`)
	DB.Exec(`PRAGMA busy_timeout=5000;`)

	sqlCreateTable := `
		CREATE TABLE IF NOT EXISTS nav_user (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT,
			password TEXT
		);
	`
	_, err = DB.Exec(sqlCreateTable)
	utils.CheckErr(err)

	sqlCreateTable = `
		CREATE TABLE IF NOT EXISTS nav_setting (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			favicon TEXT,
			title TEXT,
			govRecord TEXT,
			footerName TEXT,
			footerLink TEXT,
			logo192 TEXT,
			logo512 TEXT,
			hideAdmin BOOLEAN,
			hideGithub BOOLEAN,
			hideToggleJumpTarget BOOLEAN,
			jumpTargetBlank BOOLEAN
		);
	`
	_, err = DB.Exec(sqlCreateTable)
	utils.CheckErr(err)

	if !columnExists("nav_setting", "logo192") {
		DB.Exec(`ALTER TABLE nav_setting ADD COLUMN logo192 TEXT;`)
	}
	if !columnExists("nav_setting", "logo512") {
		DB.Exec(`ALTER TABLE nav_setting ADD COLUMN logo512 TEXT;`)
	}
	if !columnExists("nav_setting", "govRecord") {
		DB.Exec(`ALTER TABLE nav_setting ADD COLUMN govRecord TEXT;`)
	}
	if !columnExists("nav_setting", "footerName") {
		DB.Exec(`ALTER TABLE nav_setting ADD COLUMN footerName TEXT;`)
	}
	if !columnExists("nav_setting", "footerLink") {
		DB.Exec(`ALTER TABLE nav_setting ADD COLUMN footerLink TEXT;`)
	}
	if !columnExists("nav_setting", "jumpTargetBlank") {
		DB.Exec(`ALTER TABLE nav_setting ADD COLUMN jumpTargetBlank BOOLEAN;`)
	}
	if !columnExists("nav_setting", "hideAdmin") {
		DB.Exec(`ALTER TABLE nav_setting ADD COLUMN hideAdmin BOOLEAN;`)
	}
	if !columnExists("nav_setting", "hideGithub") {
		DB.Exec(`ALTER TABLE nav_setting ADD COLUMN hideGithub BOOLEAN;`)
	}
	if !columnExists("nav_setting", "hideToggleJumpTarget") {
		DB.Exec(`ALTER TABLE nav_setting ADD COLUMN hideToggleJumpTarget BOOLEAN;`)
	}

	sqlCreateTable = `
		CREATE TABLE IF NOT EXISTS nav_table (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT,
			url TEXT,
			logo TEXT,
			catelog TEXT,
			desc TEXT
		);
	`
	_, err = DB.Exec(sqlCreateTable)
	utils.CheckErr(err)

	if !columnExists("nav_table", "sort") {
		DB.Exec(`ALTER TABLE nav_table ADD COLUMN sort INTEGER;`)
	}
	if !columnExists("nav_table", "allSort") {
		DB.Exec(`ALTER TABLE nav_table ADD COLUMN allSort INTEGER;`)
	}
	if !columnExists("nav_table", "hide") {
		DB.Exec(`ALTER TABLE nav_table ADD COLUMN hide BOOLEAN;`)
	}
	DB.Exec(`UPDATE nav_table SET allSort = sort WHERE allSort IS NULL;`)
	DB.Exec(`CREATE INDEX IF NOT EXISTS idx_nav_table_sort ON nav_table(sort);`)
	DB.Exec(`CREATE INDEX IF NOT EXISTS idx_nav_table_all_sort ON nav_table(allSort);`)
	DB.Exec(`CREATE INDEX IF NOT EXISTS idx_nav_table_catelog ON nav_table(catelog);`)
	DB.Exec(`CREATE INDEX IF NOT EXISTS idx_nav_table_hide ON nav_table(hide);`)

	sqlCreateTable = `
		CREATE TABLE IF NOT EXISTS nav_catelog (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT
		);
	`
	_, err = DB.Exec(sqlCreateTable)
	utils.CheckErr(err)

	if !columnExists("nav_catelog", "sort") {
		DB.Exec(`ALTER TABLE nav_catelog ADD COLUMN sort INTEGER NOT NULL DEFAULT 0;`)
	}
	if !columnExists("nav_catelog", "hide") {
		DB.Exec(`ALTER TABLE nav_catelog ADD COLUMN hide BOOLEAN;`)
	}
	DB.Exec(`CREATE INDEX IF NOT EXISTS idx_nav_catelog_sort ON nav_catelog(sort);`)
	DB.Exec(`CREATE INDEX IF NOT EXISTS idx_nav_catelog_hide ON nav_catelog(hide);`)
	migration_2024_12_13()

	sqlCreateTable = `
		CREATE TABLE IF NOT EXISTS nav_api_token (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT,
			value TEXT,
			disabled INTEGER
		);
	`
	_, err = DB.Exec(sqlCreateTable)
	utils.CheckErr(err)

	sqlCreateTable = `
		CREATE TABLE IF NOT EXISTS nav_img (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			url TEXT,
			value TEXT
		);
	`
	_, err = DB.Exec(sqlCreateTable)
	utils.CheckErr(err)

	sqlCreateTable = `
		CREATE TABLE IF NOT EXISTS nav_search_engine (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			baseUrl TEXT NOT NULL,
			queryParam TEXT NOT NULL,
			logo TEXT,
			sort INTEGER NOT NULL DEFAULT 0,
			enabled BOOLEAN NOT NULL DEFAULT 1
		);
	`
	_, err = DB.Exec(sqlCreateTable)
	utils.CheckErr(err)

	sqlCreateTable = `
		CREATE TABLE IF NOT EXISTS nav_site_config (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			noImageMode BOOLEAN NOT NULL DEFAULT 0,
			compactMode BOOLEAN NOT NULL DEFAULT 0,
			showClock BOOLEAN NOT NULL DEFAULT 1
		);
	`
	_, err = DB.Exec(sqlCreateTable)
	utils.CheckErr(err)

	if !columnExists("nav_site_config", "compactMode") {
		DB.Exec(`ALTER TABLE nav_site_config ADD COLUMN compactMode BOOLEAN NOT NULL DEFAULT 0;`)
	}
	if !columnExists("nav_site_config", "showClock") {
		DB.Exec(`ALTER TABLE nav_site_config ADD COLUMN showClock BOOLEAN NOT NULL DEFAULT 1;`)
	}

	sqlGetSearchEngine := `SELECT COUNT(*) FROM nav_search_engine;`
	var searchEngineCount int
	err = DB.QueryRow(sqlGetSearchEngine).Scan(&searchEngineCount)
	utils.CheckErr(err)
	if searchEngineCount == 0 {
		defaultEngines := []struct {
			name       string
			baseURL    string
			queryParam string
			logo       string
			sort       int
		}{
			{"百度", "https://www.baidu.com/s", "wd", "baidu.ico", 1},
			{"Bing", "https://cn.bing.com/search", "q", "bing.ico", 2},
			{"Google", "https://www.google.com/search", "q", "google.ico", 3},
		}

		sqlAddSearchEngine := `
			INSERT INTO nav_search_engine (name, baseUrl, queryParam, logo, sort, enabled)
			VALUES (?, ?, ?, ?, ?, ?);
		`
		stmt, err := DB.Prepare(sqlAddSearchEngine)
		utils.CheckErr(err)
		defer stmt.Close()

		for _, engine := range defaultEngines {
			_, err = stmt.Exec(engine.name, engine.baseURL, engine.queryParam, engine.logo, engine.sort, true)
			utils.CheckErr(err)
		}
		logger.LogInfo("默认搜索引擎初始化成功")
	}

	sqlGetUser := `SELECT * FROM nav_user;`
	rows, err := DB.Query(sqlGetUser)
	utils.CheckErr(err)
	if !rows.Next() {
		initPassword := strings.TrimSpace(os.Getenv("NAV_INIT_ADMIN_PASSWORD"))
		if initPassword == "" {
			initPassword = "admin"
			logger.LogInfo("未检测到 NAV_INIT_ADMIN_PASSWORD，使用默认管理员密码: admin")
		}
		hashedPassword, hashErr := utils.HashPassword(initPassword)
		utils.CheckErr(hashErr)
		if hashedPassword == "" {
			hashedPassword = initPassword
		}
		sqlAddUser := `
			INSERT INTO nav_user (id, name, password)
			VALUES (?, ?, ?);
		`
		stmt, err := DB.Prepare(sqlAddUser)
		utils.CheckErr(err)
		res, err := stmt.Exec(utils.GenerateId(), "admin", hashedPassword)
		utils.CheckErr(err)
		_, err = res.LastInsertId()
		utils.CheckErr(err)
	}
	rows.Close()

	sqlGetSetting := `SELECT * FROM nav_setting;`
	rows, err = DB.Query(sqlGetSetting)
	utils.CheckErr(err)
	if !rows.Next() {
		sqlAddSetting := `
			INSERT INTO nav_setting (favicon, title, govRecord, footerName, footerLink, logo192, logo512, hideAdmin, hideGithub, hideToggleJumpTarget, jumpTargetBlank)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
		`
		stmt, err := DB.Prepare(sqlAddSetting)
		utils.CheckErr(err)
		res, err := stmt.Exec("favicon.ico", "Van Nav", "", "笔尖码动", "https://henniubi.com", "logo192.png", "logo512.png", false, false, false, true)
		utils.CheckErr(err)
		_, err = res.LastInsertId()
		utils.CheckErr(err)
	}
	rows.Close()

	sqlGetSiteConfig := `SELECT * FROM nav_site_config;`
	rows, err = DB.Query(sqlGetSiteConfig)
	utils.CheckErr(err)
	if !rows.Next() {
		sqlAddSiteConfig := `
			INSERT INTO nav_site_config (noImageMode, compactMode, showClock)
			VALUES (?, ?, ?);
		`
		stmt, err := DB.Prepare(sqlAddSiteConfig)
		utils.CheckErr(err)
		res, err := stmt.Exec(false, false, true)
		utils.CheckErr(err)
		_, err = res.LastInsertId()
		utils.CheckErr(err)
	}
	rows.Close()

	logger.LogInfo("数据库初始化成功")
	cleanupEmptyCategories()
}

func cleanupEmptyCategories() {
	sqlCleanup := `
		DELETE FROM nav_catelog
		WHERE name IS NULL OR name = '' OR TRIM(name) = '';
	`
	result, err := DB.Exec(sqlCleanup)
	if err != nil {
		logger.LogInfo("清理空分类记录时出错: %v", err)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err == nil && rowsAffected > 0 {
		logger.LogInfo("已清理 %d 条空分类记录", rowsAffected)
	}
}
