import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          fontFamily: '"LXGW WenKai", sans-serif',
          colorPrimary: '#6f6f6f',
          colorInfo: '#6f6f6f',
          colorSuccess: '#6f6f6f',
          colorWarning: '#6a6a6a',
          colorError: '#7a4a4a',
          colorBgBase: '#121212',
          colorBgContainer: '#1f1f1f',
          colorBorder: '#383838',
          colorTextBase: '#f1f1f1',
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);

serviceWorker.register(null);

