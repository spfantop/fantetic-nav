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
	utils.CheckErr(err)
	for rows.Next() {
		var token types.Token
		err = rows.Scan(&token.Id, &token.Name, &token.Value, &token.Disabled)
		utils.CheckErr(err)
		results = append(results, token)
	}
	defer rows.Close()
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
	utils.CheckErr(err)

	res, err := stmt.Exec(data.Id, data.Name, data.Value, data.Disabled)
	utils.CheckErr(err)
	_, err = res.LastInsertId()
	utils.CheckErr(err)
}

func UpdateUser(data types.UpdateUserDto) {
	hashedPassword, err := utils.HashPassword(data.Password)
	utils.CheckErr(err)
	if hashedPassword == "" {
		return
	}
	sql_update_user := `
		UPDATE nav_user
		SET name = ?, password = ?
		WHERE id = ?;
		`
	stmt, err := database.DB.Prepare(sql_update_user)
	utils.CheckErr(err)
	res, err := stmt.Exec(data.Name, hashedPassword, data.Id)
	utils.CheckErr(err)
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
	utils.CheckErr(err)
	if stmt == nil {
		return
	}
	defer stmt.Close()
	_, err = stmt.Exec(hashedPassword, id)
	utils.CheckErr(err)
}
