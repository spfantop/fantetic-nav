import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorker from "./serviceWorker";

// 1️⃣ 获取 root 容器
const container = document.getElementById('root');
const root = createRoot(container!);

// 2️⃣ 渲染
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// 3️⃣ 注册 Service Worker
serviceWorker.register(null);
