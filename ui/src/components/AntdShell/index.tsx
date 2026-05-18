import React from "react";
import { App as AntApp, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";

interface Props {
  children: React.ReactNode;
}

const AntdShell: React.FC<Props> = ({ children }) => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          fontFamily: '"LXGW WenKai", sans-serif',
          colorPrimary: "#6f6f6f",
          colorInfo: "#6f6f6f",
          colorSuccess: "#6f6f6f",
          colorWarning: "#6a6a6a",
          colorError: "#7a4a4a",
          colorBgBase: "#121212",
          colorBgContainer: "#1f1f1f",
          colorBorder: "#383838",
          colorTextBase: "#f1f1f1",
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
};

export default AntdShell;
