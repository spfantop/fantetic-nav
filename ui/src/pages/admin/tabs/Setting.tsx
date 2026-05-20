import { App, Button, Card, Form, Input, Select, Spin, Switch } from 'antd';
import { useCallback, useEffect } from 'react';
import { fetchUpdateSetting, fetchUpdateSiteConfig, fetchUpdateUser } from '../../../utils/api';
import { useData } from '../hooks/useData';
import './Setting.css';

export interface SettingProps {}

export const Setting: React.FC<SettingProps> = () => {
  const { message } = App.useApp();
  const { store, loading, reload } = useData();
  const [userForm] = Form.useForm();
  const [settingForm] = Form.useForm();
  const [siteConfigForm] = Form.useForm();

  useEffect(() => {
    userForm.setFieldsValue(store?.user ?? {});
    settingForm.setFieldsValue(store?.setting ?? {});
    siteConfigForm.setFieldsValue(store?.siteConfig ?? {});
  }, [store, userForm, settingForm, siteConfigForm]);

  const handleUpdateUser = useCallback(
    async (values: any) => {
      try {
        await fetchUpdateUser({ ...values, id: store?.user?.id });
        message.success('修改成功');
      } catch {
        message.warning('修改失败');
      } finally {
        reload();
      }
    },
    [reload, store]
  );

  const handleUpdateWebSite = useCallback(
    async (values: any) => {
      try {
        await fetchUpdateSetting(values);
        message.success('修改成功');
      } catch {
        message.warning('修改失败');
      } finally {
        reload();
      }
    },
    [reload]
  );

  const handleUpdateSiteConfig = useCallback(
    async (values: any) => {
      try {
        await fetchUpdateSiteConfig(values);
        message.success('修改成功');
      } catch {
        message.warning('修改失败');
      } finally {
        reload();
      }
    },
    [reload]
  );

  return (
    <div className="overflow-auto admin-setting-page">
      <Card className="admin-setting-card" title="修改用户信息" style={{ marginBottom: 24 }}>
        <Spin spinning={loading}>
          <Form onFinish={handleUpdateUser} initialValues={store?.user ?? {}} form={userForm}>
            <Form.Item label="用户名" name="name" required labelCol={{ span: 4 }}>
              <Input placeholder="请输入新用户名" />
            </Form.Item>
            <Form.Item label="密码" name="password" required labelCol={{ span: 4 }}>
              <Input.Password placeholder="请输入新密码" />
            </Form.Item>
            <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>

      <Card className="admin-setting-card" title="修改网站信息" style={{ marginBottom: 24 }}>
        <Spin spinning={loading}>
          <Form
            onFinish={handleUpdateWebSite}
            initialValues={store?.setting ?? {}}
            labelCol={{ span: 6 }}
            form={settingForm}
          >
            <Form.Item
              label="网站 logo"
              name="favicon"
              tooltip="输入 logo 的 URL，仅支持 png 或 svg 格式"
              required
              rules={[{ required: true, message: '请输入网站 logo 链接' }]}
            >
              <Input placeholder="请输入网站 logo" />
            </Form.Item>
            <Form.Item
              label="网站标题"
              name="title"
              required
              rules={[{ required: true, message: '请输入网站标题' }]}
            >
              <Input placeholder="请输入网站标题" />
            </Form.Item>
            <Form.Item label="备案信息" name="govRecord">
              <Input placeholder="请输入网站备案信息" />
            </Form.Item>
            <Form.Item label="底部文案" name="footerName">
              <Input placeholder="例如：笔尖码动" />
            </Form.Item>
            <Form.Item
              label="底部链接"
              name="footerLink"
              rules={[{ type: 'url', message: '请输入合法 URL（含 http/https）' }]}
            >
              <Input placeholder="例如：https://henniubi.com" />
            </Form.Item>

            <Form.Item
              label="默认跳转方式"
              name="jumpTargetBlank"
              rules={[{ required: true, message: '这是必填项' }]}
              tooltip="选择点击卡片后的默认跳转方式"
            >
              <Select
                classNames={{ popup: { root: "admin-setting-select-popup" } }}
                options={[
                  { label: '原地跳转', value: false },
                  { label: '新标签页', value: true },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="logo 192x192"
              name="logo192"
              rules={[{ required: true, message: '请输入 192x192 的 logo 链接' }]}
            >
              <Input placeholder="192x192 logo 链接" />
            </Form.Item>
            <Form.Item
              label="logo 512x512"
              name="logo512"
              rules={[{ required: true, message: '请输入 512x512 的 logo 链接' }]}
            >
              <Input placeholder="512x512 logo 链接" />
            </Form.Item>
            <Form.Item label="隐藏管理后台卡片" name="hideAdmin" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="隐藏 Github 按钮" name="hideGithub" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="隐藏跳转方式卡片" name="hideToggleJumpTarget" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>

      <Card className="admin-setting-card" title="修改网站配置">
        <Spin spinning={loading}>
          <Form
            onFinish={handleUpdateSiteConfig}
            initialValues={store?.siteConfig ?? {}}
            labelCol={{ span: 6 }}
            form={siteConfigForm}
          >
            <Form.Item label="无图模式" name="noImageMode" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="精简模式" name="compactMode" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="显示时间" name="showClock" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
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
