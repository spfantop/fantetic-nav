package service

import (
	"github.com/mereith/nav/database"
	"github.com/mereith/nav/types"
	"github.com/mereith/nav/utils"
	"strings"
)

func UpdateCatelog(data types.UpdateCatelogDto) {

	sql_select_old_catelog_name := `select name from nav_catelog where id = ?;`
	var oldName string
	err := database.DB.QueryRow(sql_select_old_catelog_name, data.Id).Scan(&oldName)
	utils.CheckErr(err)

	tx, err := database.DB.Begin()
	if utils.CheckErr(err) {
		return
	}

	sql_update_catelog := `
		UPDATE nav_catelog
		SET name = ?, sort = ?, hide = ?
		WHERE id = ?;
		`
	stmt, err := tx.Prepare(sql_update_catelog)
	if utils.CheckTxErr(err, tx) {
		return
	}
	defer stmt.Close()
	res, err := stmt.Exec(data.Name, data.Sort, data.Hide, data.Id)
	if utils.CheckTxErr(err, tx) {
		return
	}
	_, err = res.RowsAffected()
	utils.CheckTxErr(err, tx)

	if oldName != data.Name {
		sql_update_tools := `
		UPDATE nav_table
		SET catelog = ?
		WHERE catelog = ?;
		`
		stmt2, err := tx.Prepare(sql_update_tools)
		if utils.CheckTxErr(err, tx) {
			return
		}
		defer stmt2.Close()
		res2, err := stmt2.Exec(data.Name, oldName)
		if utils.CheckTxErr(err, tx) {
			return
		}
		_, err = res2.RowsAffected()
		utils.CheckTxErr(err, tx)
	}
	err = tx.Commit()
	if err == nil {
		InvalidateCache()
	}
	utils.CheckErr(err)
}

func AddCatelog(data types.AddCatelogDto) {
	if data.Name == "" || strings.TrimSpace(data.Name) == "" {
		return
	}

	existCatelogs := GetAllCatelog()
	var existCatelogsArr []string
	for _, catelogDto := range existCatelogs {
		existCatelogsArr = append(existCatelogsArr, catelogDto.Name)
	}
	if utils.In(data.Name, existCatelogsArr) {
		return
	}
	sql_add_catelog := `
		INSERT INTO nav_catelog (name,sort,hide)
		VALUES (?,?,?);
		`
	stmt, err := database.DB.Prepare(sql_add_catelog)
	if utils.CheckErr(err) {
		return
	}
	defer stmt.Close()
	res, err := stmt.Exec(data.Name, data.Sort, data.Hide)
	if utils.CheckErr(err) {
		return
	}
	_, err = res.LastInsertId()
	if err == nil {
		InvalidateCache()
	}
	utils.CheckErr(err)
}

func GetAllCatelog() []types.Catelog {
	sql_get_all := `
		SELECT id,name,sort,hide FROM nav_catelog order by sort;
	`
	results := make([]types.Catelog, 0)
	rows, err := database.DB.Query(sql_get_all)
	if utils.CheckErr(err) {
		return results
	}
	defer rows.Close()
	for rows.Next() {
		var catelog types.Catelog
		err = rows.Scan(&catelog.Id, &catelog.Name, &catelog.Sort, &catelog.Hide)
		if utils.CheckErr(err) {
			continue
		}
		results = append(results, catelog)
	}
	return results
}

func UpdateCatelogsSort(updates []types.UpdateCatelogsSortDto) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}

	sql := `UPDATE nav_catelog SET sort = ? WHERE id = ?`
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
