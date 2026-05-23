package service

import (
	"database/sql"

	"github.com/mereith/nav/database"
	"github.com/mereith/nav/types"
	"github.com/mereith/nav/utils"
)

func GetApiTokens() []types.Token {
	sql_get_api_tokens := `
		SELECT id,name,value,disabled FROM nav_api_token WHERE disabled = 0;
		`
	results := make([]types.Token, 0)
	rows, err := database.DB.Query(sql_get_api_tokens)
	if utils.CheckErr(err) {
		return results
	}
	defer rows.Close()
	for rows.Next() {
		var token types.Token
		err = rows.Scan(&token.Id, &token.Name, &token.Value, &token.Disabled)
		if utils.CheckErr(err) {
			continue
		}
		results = append(results, token)
	}
	return results
}

func GetUser(name string) types.User {
	sql_get_user := `
		SELECT id,name,password FROM nav_user WHERE name = ?;
		`
	var user types.User
	row := database.DB.QueryRow(sql_get_user, name)
	err := row.Scan(&user.Id, &user.Name, &user.Password)
	if err == sql.ErrNoRows {
		return types.User{}
	}
	utils.CheckErr(err)
	return user
}

func AddApiTokenInDB(data types.Token) {
	sql_add_api_token := `
		INSERT INTO nav_api_token (id,name,value,disabled)
		VALUES (?,?,?,?);
		`
	stmt, err := database.DB.Prepare(sql_add_api_token)
	if utils.CheckErr(err) {
		return
	}
	defer stmt.Close()
	res, err := stmt.Exec(data.Id, data.Name, data.Value, data.Disabled)
	if utils.CheckErr(err) {
		return
	}
	_, err = res.LastInsertId()
	utils.CheckErr(err)
}

func UpdateUser(data types.UpdateUserDto) {
	hashedPassword, err := utils.HashPassword(data.Password)
	if utils.CheckErr(err) {
		return
	}
	sql_update_user := `
		UPDATE nav_user
		SET name = ?, password = ?
		WHERE id = ?;
		`
	stmt, err := database.DB.Prepare(sql_update_user)
	if utils.CheckErr(err) {
		return
	}
	defer stmt.Close()
	res, err := stmt.Exec(data.Name, hashedPassword, data.Id)
	if utils.CheckErr(err) {
		return
	}
	_, err = res.RowsAffected()
	utils.CheckErr(err)
}

func UpdateUserPassword(id int, hashedPassword string) {
	sqlUpdatePassword := `
		UPDATE nav_user
		SET password = ?
		WHERE id = ?;
	`
	stmt, err := database.DB.Prepare(sqlUpdatePassword)
	if utils.CheckErr(err) {
		return
	}
	defer stmt.Close()
	_, err = stmt.Exec(hashedPassword, id)
	utils.CheckErr(err)
}
