import { Button, Card, ColorPicker, Form, Input, Upload, message, Select, Spin, Switch } from "antd";
import { useCallback, useEffect } from "react";
import { UploadOutlined } from "@ant-design/icons";
import { DEFAULT_DARK_THEME_PALETTE, DEFAULT_LIGHT_THEME_PALETTE, parseThemePalette } from "../../../utils/appearance";
import { buildEditableThemeFormValues, COMPACT_THEME_FIELDS, normalizePaletteWithEditableFields } from "../../../utils/appearanceEditor";
import { fetchUpdateSetting, fetchUpdateUser, fetchUpdateSiteConfig, fetchUploadAdminBackground } from "../../../utils/api";
import { applyGlobalFontFamily, FONT_FAMILY_OPTIONS } from "../../../utils/font";
import { useData } from "../hooks/useData";
import { normalizeLayoutScale } from "../../../utils/layoutScale";
export interface SettingProps { }

export const Setting: React.FC<SettingProps> = (props) => {
  const { store, loading, reload } = useData();
  const [userForm] = Form.useForm();
  const [siteInfoForm] = Form.useForm();
  const [configForm] = Form.useForm();
  useEffect(() => {
    userForm.setFieldsValue(store?.user ?? {})
    siteInfoForm.setFieldsValue(store?.setting ?? {})
    configForm.setFieldsValue({
      ...(store?.setting ?? {}),
      ...buildEditableThemeFormValues({
        lightThemePalette: parseThemePalette(store?.setting?.lightThemeConfig, "light"),
        darkThemePalette: parseThemePalette(store?.setting?.darkThemeConfig, "dark"),
      }),
      ...(store?.siteConfig ?? {}),
      layoutScale: normalizeLayoutScale(store?.siteConfig?.layoutScale),
    })
  }, [store, userForm, siteInfoForm, configForm])
  const handleUpdateUser = useCallback(
    async (values: any) => {
      try {
        await fetchUpdateUser({ ...values, id: store?.user?.id });
        message.success("修改成功!");
      } catch (err) {
        message.warning("修改失败!");
      } finally {
        reload();
      }
    },
    [reload, store]
  );
  const handleUpdateSiteInfo = useCallback(
    async (values: any) => {
      try {
        const payload = {
          ...store?.setting,
          ...values,
        };
        await fetchUpdateSetting(payload);
        message.success("修改成功!");
      } catch (err) {
        message.warning("修改失败!");
      } finally {
        reload();
      }
    },
    [reload, store]
  );
  const handleUpdateSiteConfigAndSetting = useCallback(
    async (values: any) => {
      try {
        const settingPayload = {
          ...store?.setting,
          jumpTargetBlank: values.jumpTargetBlank,
          hideAdmin: values.hideAdmin,
          showClock: values.showClock,
          showWeather: values.showWeather,
          showMemo: values.showMemo,
          memoContent: values.memoContent || "",
          showSettingsButton: values.showSettingsButton,
          fontFamily: values.fontFamily,
          hideToggleJumpTarget: values.hideToggleJumpTarget,
          adminBackgroundLightUrl: values.adminBackgroundLightUrl || "",
          adminBackgroundDarkUrl: values.adminBackgroundDarkUrl || "",
          lightThemeConfig: JSON.stringify(normalizePaletteWithEditableFields(values.lightThemePalette || {}, parseThemePalette(store?.setting?.lightThemeConfig, "light") || DEFAULT_LIGHT_THEME_PALETTE)),
          darkThemeConfig: JSON.stringify(normalizePaletteWithEditableFields(values.darkThemePalette || {}, parseThemePalette(store?.setting?.darkThemeConfig, "dark") || DEFAULT_DARK_THEME_PALETTE)),
        };
        const siteConfigPayload = {
          ...store?.siteConfig,
          noImageMode: values.noImageMode,
          compactMode: values.compactMode,
          layoutScale: normalizeLayoutScale(values.layoutScale),
          weatherMode: values.weatherMode,
          weatherCity: values.weatherCity,
          showPerformancePanel: values.showPerformancePanel,
        };
        await fetchUpdateSetting(settingPayload);
        await fetchUpdateSiteConfig(siteConfigPayload);
        applyGlobalFontFamily(settingPayload.fontFamily);
        message.success("修改成功!");
      } catch (err) {
        message.warning("修改失败!");
      } finally {
        reload();
      }
    },
    [reload, store]
  );
  const handleUploadAdminBackground = useCallback(
    async (file: File, fieldName: string) => {
      try {
        const result = await fetchUploadAdminBackground(file);
        const url = result?.url || "";
        configForm.setFieldValue(fieldName, url);
        message.success("背景图上传成功，请提交后保存配置");
      } catch (err) {
        message.warning("背景图上传失败");
      }
      return false;
    },
    [configForm]
  );
  return (
    <div className="overflow-auto">
      <Card title={`修改用户信息`} style={{ marginBottom: 32 }}>
        <Spin spinning={loading}>
          <Form
            onFinish={handleUpdateUser}
            initialValues={store?.user ?? {}}
            form={userForm}
            layout="vertical"
            className="admin-setting-form"
          >
            <Form.Item
              label="用户名"
              name="name"
              required
            >
              <Input placeholder="请输入新用户名"></Input>
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              required
            >
              <Input.Password placeholder="请输入新密码" ></Input.Password>
            </Form.Item>
            <Form.Item className="admin-form-actions">
              <Button type="primary" htmlType="submit">
                提交
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
      <Card title={`修改网站信息`}>
        <Spin spinning={loading}>
          <Form
            onFinish={handleUpdateSiteInfo}
            initialValues={store?.setting ?? {}}
            form={siteInfoForm}
            layout="vertical"
            className="admin-setting-form"
          >
            <Form.Item
              label="网站 logo"
              name="favicon"
              tooltip="输入 logo 的 url，仅支持 png 或 svg 格式"
              required
              rules={[{ required: true, message: "请输入网站 logo 链接" }]}

            >
              <Input placeholder="请输入网站 logo"></Input>
            </Form.Item>
            <Form.Item
              label="网站标题"
              name="title"
              required
              rules={[{ required: true, message: "请输入网站 title" }]}


            >
              <Input placeholder="请输入网站标题"></Input>
            </Form.Item>
            <Form.Item
              label="公信部备案"
              name="govRecord"
            >
              <Input placeholder="请输入网站备案信息"></Input>
            </Form.Item>
            <Form.Item
              label="底部文案"
              name="footerText"
              tooltip="首页底部展示的站点署名文案"
            >
              <Input placeholder="请输入底部展示文案，例如 笔尖码动"></Input>
            </Form.Item>
            <Form.Item
              label="底部链接"
              name="footerLink"
              tooltip="留空则仅展示文字，不可点击"
            >
              <Input placeholder="请输入底部链接，例如 https://henniubi.com"></Input>
            </Form.Item>
            <Form.Item
              label="logo 192x192"
              name="logo192"
              rules={[{ required: true, message: "请输入 192x192 大小的 logo 链接" }]}

              tooltip="192x192 大小的 logo，用于实现可安装的 web 应用"

            >
              <Input placeholder="192x192 大小的 logo 链接"></Input>
            </Form.Item>
            <Form.Item
              label="logo 512x512"
              name="logo512"
              rules={[{ required: true, message: "请输入 512x512 大小的 logo 链接" }]}

              tooltip="512x512 大小的 logo，用于实现可安装的 web 应用"

            >
              <Input placeholder="512x512 大小的 logo 链接"></Input>
            </Form.Item>
            <Form.Item className="admin-form-actions">
              <Button type="primary" htmlType="submit">
                提交
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
      <Card title={`修改网站配置`} style={{ marginTop: 32 }}>
        <Spin spinning={loading}>
          <Form
            onFinish={handleUpdateSiteConfigAndSetting}
            initialValues={{
              ...(store?.setting ?? {}),
              ...(store?.siteConfig ?? {}),
              layoutScale: normalizeLayoutScale(store?.siteConfig?.layoutScale),
            }}
            form={configForm}
            layout="vertical"
            className="admin-setting-form"
          >
            <Form.Item label={<span className="admin-setting-section-title">开关项</span>}>
              <div className="admin-switch-grid">
                <Form.Item label="隐藏管理员后台卡片" name="hideAdmin" valuePropName="checked" tooltip="默认展示，开启后将在前台隐藏管理员卡片" className="admin-inline-form-item">
                  <Switch defaultChecked={Boolean(store?.setting?.hideAdmin)} />
                </Form.Item>
                <Form.Item label="首页显示本地时间" name="showClock" valuePropName="checked" tooltip="关闭后，首页搜索框上方将不再展示本地时间时钟" className="admin-inline-form-item">
                  <Switch defaultChecked={Boolean(store?.setting?.showClock ?? true)} />
                </Form.Item>
                <Form.Item label="首页显示天气" name="showWeather" valuePropName="checked" tooltip="关闭后，首页左上角不再展示本地天气信息" className="admin-inline-form-item">
                  <Switch defaultChecked={Boolean(store?.setting?.showWeather ?? true)} />
                </Form.Item>
                <Form.Item label="启用备忘录" name="showMemo" valuePropName="checked" tooltip="开启后，登录管理员首页可显示右侧悬浮备忘录" className="admin-inline-form-item">
                  <Switch defaultChecked={Boolean(store?.setting?.showMemo)} />
                </Form.Item>
                <Form.Item label="显示右上角设置按钮" name="showSettingsButton" valuePropName="checked" tooltip="关闭后，登录后首页右上角将隐藏设置按钮" className="admin-inline-form-item">
                  <Switch defaultChecked={Boolean(store?.setting?.showSettingsButton ?? true)} />
                </Form.Item>
                <Form.Item label="隐藏跳转方式卡片" name="hideToggleJumpTarget" valuePropName="checked" tooltip="默认展示，开启后将在前台隐藏跳转方式卡片" className="admin-inline-form-item">
                  <Switch defaultChecked={Boolean(store?.setting?.hideToggleJumpTarget)} />
                </Form.Item>
                <Form.Item label="无图模式" name="noImageMode" valuePropName="checked" tooltip="开启后前台将不展示工具logo等图片" className="admin-inline-form-item">
                  <Switch defaultChecked={Boolean(store?.siteConfig?.noImageMode)} />
                </Form.Item>
                <Form.Item label="精简模式" name="compactMode" valuePropName="checked" tooltip="开启后卡片只显示标题和logo，如果同时开启无图模式则只显示标题" className="admin-inline-form-item">
                  <Switch defaultChecked={Boolean(store?.siteConfig?.compactMode)} />
                </Form.Item>
                <Form.Item label="性能调试面板" name="showPerformancePanel" valuePropName="checked" tooltip="开启后前台会展示性能统计面板，便于观察书签增多后的搜索和渲染耗时" className="admin-inline-form-item">
                  <Switch defaultChecked={Boolean(store?.siteConfig?.showPerformancePanel)} />
                </Form.Item>
              </div>
            </Form.Item>
            <Form.Item label={<span className="admin-setting-section-title">选择项</span>}>
              <div className="admin-select-grid">
                <Form.Item
                  label="默认跳转方式"
                  name="jumpTargetBlank"
                  rules={[{ required: true, message: "这是必填项" }]}
                  tooltip="选择点击卡片后默认的跳转方式"
                  className="admin-inline-form-item"
                >
                  <Select options={[{ label: "原地跳转", value: false }, { label: "新标签页", value: true }]} />
                </Form.Item>
                <Form.Item
                  label="全局字体"
                  name="fontFamily"
                  tooltip="影响首页、登录页和后台的整体字体风格"
                  rules={[{ required: true, message: "请选择字体" }]}
                  className="admin-inline-form-item"
                >
                  <Select options={FONT_FAMILY_OPTIONS} placeholder="请选择全局字体" />
                </Form.Item>
                <Form.Item
                  label="首页布局大小"
                  name="layoutScale"
                  tooltip="控制首页书签卡片的整体大小，默认值保持当前效果"
                  rules={[{ required: true, message: "请选择布局大小" }]}
                  className="admin-inline-form-item"
                >
                  <Select
                    options={[
                      { label: "较大", value: "large" },
                      { label: "默认", value: "default" },
                      { label: "较小", value: "small" },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label="天气模式"
                  name="weatherMode"
                  tooltip="推荐优先使用指定城市，隐私更稳；自动定位失败时也会回退到指定城市"
                  rules={[{ required: true, message: "请选择天气模式" }]}
                  className="admin-inline-form-item"
                >
                  <Select options={[{ label: "指定城市", value: "city" }, { label: "自动定位", value: "auto" }]} />
                </Form.Item>
                <Form.Item
                  label="天气城市"
                  name="weatherCity"
                  tooltip="自动定位失败时会回退到这里；建议填写英文城市名，例如 Shanghai、Hangzhou"
                  rules={[{ required: true, message: "请输入天气城市" }]}
                  className="admin-inline-form-item"
                >
                  <Input placeholder="请输入城市，例如 Shanghai" />
                </Form.Item>
              </div>
            </Form.Item>
            <Form.Item label={<span className="admin-setting-section-title">背景图</span>}>
              <div className="admin-background-section">
                <Form.Item label="首页/后台亮色背景" name="adminBackgroundLightUrl" className="admin-inline-form-item">
                  <Input placeholder="可直接填写图片地址，或使用右侧上传按钮" />
                </Form.Item>
                <div className="admin-background-upload-row">
                  <Upload accept="image/png,image/jpeg,image/webp,image/gif" maxCount={1} showUploadList={false} beforeUpload={(file) => handleUploadAdminBackground(file as File, "adminBackgroundLightUrl")}>
                    <Button icon={<UploadOutlined />}>上传亮色图</Button>
                  </Upload>
                  <Button onClick={() => configForm.setFieldValue("adminBackgroundLightUrl", "")}>清空亮色图</Button>
                </div>
                <Form.Item shouldUpdate noStyle>
                  {() => {
                    const previewUrl = configForm.getFieldValue("adminBackgroundLightUrl");
                    return previewUrl ? <div className="admin-background-preview" style={{ backgroundImage: `url("${previewUrl}")` }} /> : null;
                  }}
                </Form.Item>
                <Form.Item label="首页/后台暗色背景" name="adminBackgroundDarkUrl" className="admin-inline-form-item">
                  <Input placeholder="可直接填写图片地址，或使用右侧上传按钮" />
                </Form.Item>
                <div className="admin-background-upload-row">
                  <Upload accept="image/png,image/jpeg,image/webp,image/gif" maxCount={1} showUploadList={false} beforeUpload={(file) => handleUploadAdminBackground(file as File, "adminBackgroundDarkUrl")}>
                    <Button icon={<UploadOutlined />}>上传暗色图</Button>
                  </Upload>
                  <Button onClick={() => configForm.setFieldValue("adminBackgroundDarkUrl", "")}>清空暗色图</Button>
                </div>
                <Form.Item shouldUpdate noStyle>
                  {() => {
                    const previewUrl = configForm.getFieldValue("adminBackgroundDarkUrl");
                    return previewUrl ? <div className="admin-background-preview" style={{ backgroundImage: `url("${previewUrl}")` }} /> : null;
                  }}
                </Form.Item>
              </div>
            </Form.Item>
            <Form.Item shouldUpdate noStyle>
              {() =>
                configForm.getFieldValue("showMemo") ? (
                  <Form.Item label={<span className="admin-setting-section-title">备忘录</span>}>
                    <Form.Item
                      label="备忘录内容"
                      name="memoContent"
                      tooltip="仅管理员首页可见，适合记录待办或临时备注"
                      className="admin-inline-form-item"
                    >
                      <Input.TextArea rows={6} placeholder="请输入备忘录内容" />
                    </Form.Item>
                  </Form.Item>
                ) : null
              }
            </Form.Item>
            <Form.Item label={<span className="admin-setting-section-title">亮色配色</span>} tooltip="这里只保留最常用的几项，便于快速定调；更细的效果可在首页视图调整里实时预览">
              <div className="admin-theme-actions">
                <Button onClick={() => configForm.setFieldValue("lightThemePalette", buildEditableThemeFormValues({ lightThemePalette: DEFAULT_LIGHT_THEME_PALETTE, darkThemePalette: DEFAULT_DARK_THEME_PALETTE }).lightThemePalette)}>重置亮色配色</Button>
              </div>
              <div className="admin-theme-grid">
                {COMPACT_THEME_FIELDS.map((field) => (
                  <Form.Item key={`light-${field.key}`} name={["lightThemePalette", field.key]} label={field.label} className="admin-theme-grid-item">
                    <ColorPicker showText />
                  </Form.Item>
                ))}
              </div>
            </Form.Item>
            <Form.Item label={<span className="admin-setting-section-title">暗色配色</span>} tooltip="这里只保留最常用的几项，便于快速定调；更细的效果可在首页视图调整里实时预览">
              <div className="admin-theme-actions">
                <Button onClick={() => configForm.setFieldValue("darkThemePalette", buildEditableThemeFormValues({ lightThemePalette: DEFAULT_LIGHT_THEME_PALETTE, darkThemePalette: DEFAULT_DARK_THEME_PALETTE }).darkThemePalette)}>重置暗色配色</Button>
              </div>
              <div className="admin-theme-grid">
                {COMPACT_THEME_FIELDS.map((field) => (
                  <Form.Item key={`dark-${field.key}`} name={["darkThemePalette", field.key]} label={field.label} className="admin-theme-grid-item">
                    <ColorPicker showText />
                  </Form.Item>
                ))}
              </div>
            </Form.Item>
            <Form.Item className="admin-form-actions">
              <Button type="primary" htmlType="submit">
                提交
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};
