package service

import (
	"github.com/mereith/nav/database"
	"github.com/mereith/nav/logger"
	"github.com/mereith/nav/types"
)

func GetSetting() types.Setting {
	sqlGetSetting := `
		SELECT id,favicon,title,govRecord,footerName,footerLink,logo192,logo512,hideAdmin,hideGithub,hideToggleJumpTarget,jumpTargetBlank
		FROM nav_setting
		ORDER BY id ASC
		LIMIT 1;
	`

	var setting types.Setting
	row := database.DB.QueryRow(sqlGetSetting, 0)
	var hideGithub interface{}
	var hideAdmin interface{}
	var hideToggleJumpTarget interface{}
	var jumpTargetBlank interface{}

	err := row.Scan(
		&setting.Id,
		&setting.Favicon,
		&setting.Title,
		&setting.GovRecord,
		&setting.FooterName,
		&setting.FooterLink,
		&setting.Logo192,
		&setting.Logo512,
		&hideAdmin,
		&hideGithub,
		&hideToggleJumpTarget,
		&jumpTargetBlank,
	)
	if err != nil {
		logger.LogError("failed to get setting: %s", err)
		return types.Setting{
			Id:                   1,
			Favicon:              "favicon.ico",
			Title:                "Van Nav",
			GovRecord:            "",
			FooterName:           "笔尖码动",
			FooterLink:           "https://henniubi.com",
			Logo192:              "logo192.png",
			Logo512:              "logo512.png",
			HideAdmin:            false,
			HideGithub:           false,
			HideToggleJumpTarget: false,
			JumpTargetBlank:      true,
		}
	}

	if setting.FooterName == "" {
		setting.FooterName = "笔尖码动"
	}
	if setting.FooterLink == "" {
		setting.FooterLink = "https://henniubi.com"
	}

	if hideGithub == nil {
		setting.HideGithub = false
	} else {
		setting.HideGithub = hideGithub.(int64) != 0
	}

	if hideAdmin == nil {
		setting.HideAdmin = false
	} else {
		setting.HideAdmin = hideAdmin.(int64) != 0
	}

	if hideToggleJumpTarget == nil {
		setting.HideToggleJumpTarget = false
	} else {
		setting.HideToggleJumpTarget = hideToggleJumpTarget.(int64) != 0
	}

	if jumpTargetBlank == nil {
		setting.JumpTargetBlank = true
	} else {
		setting.JumpTargetBlank = jumpTargetBlank.(int64) != 0
	}

	return setting
}

func UpdateSetting(data types.Setting) error {
	sqlUpdateSetting := `
		UPDATE nav_setting
		SET favicon = ?, title = ?, govRecord = ?, footerName = ?, footerLink = ?, logo192 = ?, logo512 = ?, hideAdmin = ?, hideGithub = ?, hideToggleJumpTarget = ?, jumpTargetBlank = ?
		WHERE id = (SELECT id FROM nav_setting ORDER BY id ASC LIMIT 1);
	`

	stmt, err := database.DB.Prepare(sqlUpdateSetting)
	if err != nil {
		return err
	}
	res, err := stmt.Exec(
		data.Favicon,
		data.Title,
		data.GovRecord,
		data.FooterName,
		data.FooterLink,
		data.Logo192,
		data.Logo512,
		data.HideAdmin,
		data.HideGithub,
		data.HideToggleJumpTarget,
		data.JumpTargetBlank,
	)
	if err != nil {
		return err
	}
	_, err = res.RowsAffected()
	if err != nil {
		return err
	}
	return nil
}
