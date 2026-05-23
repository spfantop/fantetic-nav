package service

import (
	"strings"
	"sync"

	"github.com/mereith/nav/database"
	"github.com/mereith/nav/logger"
	"github.com/mereith/nav/types"
	"github.com/mereith/nav/utils"
)

func ImportTools(data []types.Tool) {
	var catelogs []string
	for _, v := range data {
		if v.Catelog != "" && strings.TrimSpace(v.Catelog) != "" && !utils.In(v.Catelog, catelogs) {
			catelogs = append(catelogs, v.Catelog)
		}
		sql_add_tool := `
			INSERT INTO nav_table (id, name, catelog, url, logo, desc)
			VALUES (?, ?, ?, ?, ?, ?);
			`
		stmt, err := database.DB.Prepare(sql_add_tool)
		if utils.CheckErr(err) {
			continue
		}
		res, err := stmt.Exec(v.Id, v.Name, v.Catelog, v.Url, v.Logo, v.Desc)
		if utils.CheckErr(err) {
			stmt.Close()
			continue
		}
		_, err = res.LastInsertId()
		utils.CheckErr(err)
		stmt.Close()
	}
	for _, catelog := range catelogs {
		var addCatelogDto types.AddCatelogDto
		addCatelogDto.Name = catelog
		AddCatelog(addCatelogDto)
	}
	go func(data []types.Tool) {
		for _, v := range data {
			UpdateImg(v.Logo)
		}
	}(data)
	InvalidateCache()
}

func UpdateTool(data types.UpdateToolDto) {
	sql_update_tool := `
		UPDATE nav_table
		SET name = ?, url = ?, logo = ?, catelog = ?, desc = ?, sort = ?, allSort = ?, hide = ?
		WHERE id = ?;
		`
	stmt, err := database.DB.Prepare(sql_update_tool)
	if utils.CheckErr(err) {
		return
	}
	defer stmt.Close()
	res, err := stmt.Exec(data.Name, data.Url, data.Logo, data.Catelog, data.Desc, data.Sort, data.Sort, data.Hide, data.Id)
	if utils.CheckErr(err) {
		return
	}
	_, err = res.RowsAffected()
	utils.CheckErr(err)
	InvalidateCache()
	UpdateImg(data.Logo)
}

func AddTool(data types.AddToolDto) (int64, error) {
	var mu sync.Mutex
	mu.Lock()
	defer mu.Unlock()

	tx, err := database.DB.Begin()
	if err != nil {
		return 0, err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	sql_add_tool := `
		INSERT INTO nav_table (name, url, logo, catelog, desc, sort, allSort, hide)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?);
		`
	stmt, err := tx.Prepare(sql_add_tool)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	res, err := stmt.Exec(data.Name, data.Url, data.Logo, data.Catelog, data.Desc, data.Sort, data.Sort, data.Hide)
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	err = tx.Commit()
	if err != nil {
		return 0, err
	}
	logger.LogInfo("新增工具: %s", data.Name)
	InvalidateCache()

	if data.Logo != "" {
		UpdateImg(data.Logo)
	}

	return id, nil
}

func boolFromSQL(val interface{}) bool {
	if val == nil {
		return false
	}
	switch v := val.(type) {
	case bool:
		return v
	case int64:
		return v != 0
	case float64:
		return v != 0
	case string:
		return v == "1" || strings.ToLower(v) == "true"
	default:
		return false
	}
}

func intFromSQL(val interface{}, defaultVal int) int {
	if val == nil {
		return defaultVal
	}
	switch v := val.(type) {
	case int64:
		return int(v)
	case float64:
		return int(v)
	case int:
		return v
	default:
		return defaultVal
	}
}

func GetAllTool() []types.Tool {
	sql_get_all := `
		SELECT id,name,url,logo,catelog,desc,sort,allSort,hide FROM nav_table order by sort;
		`
	results := make([]types.Tool, 0)
	rows, err := database.DB.Query(sql_get_all)
	if utils.CheckErr(err) {
		return results
	}
	defer rows.Close()
	for rows.Next() {
		var tool types.Tool
		var hide interface{}
		var sort interface{}
		var allSort interface{}
		err = rows.Scan(&tool.Id, &tool.Name, &tool.Url, &tool.Logo, &tool.Catelog, &tool.Desc, &sort, &allSort, &hide)
		if utils.CheckErr(err) {
			continue
		}
		tool.Hide = boolFromSQL(hide)
		tool.Sort = intFromSQL(sort, 0)
		tool.AllSort = intFromSQL(allSort, tool.Sort)
		results = append(results, tool)
	}
	return results
}

func GetToolLogoUrlById(id int) string {
	sql_get_tool := `
		SELECT logo FROM nav_table WHERE id=?;
		`
	rows, err := database.DB.Query(sql_get_tool, id)
	if utils.CheckErr(err) {
		return ""
	}
	defer rows.Close()
	var tool types.Tool
	for rows.Next() {
		err = rows.Scan(&tool.Logo)
		utils.CheckErr(err)
	}
	return tool.Logo
}

func UpdateToolIcon(id int64, logo string) {
	sql_update_tool := `
		UPDATE nav_table SET logo=? WHERE id=?;
		`
	_, err := database.DB.Exec(sql_update_tool, logo, id)
	utils.CheckErr(err)
	UpdateImg(logo)
}
func UpdateToolsSort(updates []types.UpdateToolsSortDto) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}

	sql := `UPDATE nav_table SET sort = ? WHERE id = ?`
	stmt, err := tx.Prepare(sql)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, update := range updates {
		_, err = stmt.Exec(update.Sort, update.Id)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	err = tx.Commit()
	if err == nil {
		InvalidateCache()
	}
	return err
}

func UpdateToolsAllSort(updates []types.UpdateToolsAllSortDto) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}

	sql := `UPDATE nav_table SET allSort = ? WHERE id = ?`
	stmt, err := tx.Prepare(sql)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, update := range updates {
		_, err = stmt.Exec(update.AllSort, update.Id)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	err = tx.Commit()
	if err == nil {
		InvalidateCache()
	}
	return err
}
