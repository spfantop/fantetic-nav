import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { Spin } from 'antd';
import { decodeTheme, initTheme } from './utils/theme';
import { isLogin } from './utils/check';
import './App.css';

const Home = React.lazy(() => import('./pages/Home'));
const AdminPage = React.lazy(() => import('./pages/admin').then(m => ({ default: m.AdminPage })));
const Login = React.lazy(() => import('./pages/Login'));
const Tools = React.lazy(() => import('./pages/admin/tabs/Tools').then(m => ({ default: m.Tools })));
const Catelog = React.lazy(() => import('./pages/admin/tabs/Catelog').then(m => ({ default: m.Catelog })));
const ApiToken = React.lazy(() => import('./pages/admin/tabs/ApiToken').then(m => ({ default: m.ApiToken })));
const Setting = React.lazy(() => import('./pages/admin/tabs/Setting').then(m => ({ default: m.Setting })));
const SearchEngine = React.lazy(() => import('./pages/admin/tabs/Search')) ;

const RequireAuth = ({ children }: { children: JSX.Element }) => {
    if (!isLogin()) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

// 统一管理页面级背景色，保证亮色主题始终使用稳定的自然浅色而不是动态壁纸。
const getPageBackgroundColor = (isDarkMode: boolean) => (isDarkMode ? '#121212' : '#f5f1e8');

const LoadingFallback = () => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const theme = initTheme();
        const decodedTheme = decodeTheme(theme);
        const dark = decodedTheme.includes('dark');
        setIsDarkMode(dark);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target instanceof HTMLElement) {
                    const darkNow = mutation.target.classList.contains('dark-mode');
                    setIsDarkMode(darkNow);
                }
            });
        });

        const body = document.querySelector('body');
        if (body) observer.observe(body, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            width: '100%',
            // 加载态也保持与页面主背景一致，避免切页时闪出动态壁纸效果。
            backgroundColor: getPageBackgroundColor(isDarkMode),
            color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#272e3b',
            transition: 'background-color 0.3s'
        }}>
            <Spin size="large" tip="加载中..." />
        </div>
    );
};

function App() {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // 初始化主题后仅同步明暗状态，不再为亮色主题拉取随机壁纸。
        const theme = initTheme();
        const decodedTheme = decodeTheme(theme);
        const dark = decodedTheme.includes('dark');
        setIsDarkMode(dark);

        // 监听 body class 变化，确保主题切换时页面底色即时同步。
        const observer = new MutationObserver(() => {
            const body = document.body;
            const darkNow = body.classList.contains('dark-mode');
            setIsDarkMode(darkNow);
        });

        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    return (
        <AntApp>
            <div
                style={{
                    minHeight: '100vh',
                    // 页面根容器固定使用纯色背景，去掉亮色主题的自动壁纸切换。
                    backgroundColor: getPageBackgroundColor(isDarkMode),
                    transition: 'background-color 0.3s'
                }}
            >
                <Router>
                    <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/login" element={<Login />} />
                            <Route
                                path="/admin"
                                element={
                                    <RequireAuth>
                                        <AdminPage />
                                    </RequireAuth>
                                }
                            >
                                <Route index element={<Tools />} />
                                <Route path="tools" element={<Tools />} />
                                <Route path="categories" element={<Catelog />} />
                                <Route path="search-engines" element={<SearchEngine />} />
                                <Route path="api-token" element={<ApiToken />} />
                                <Route path="settings" element={<Setting />} />
                            </Route>
                        </Routes>
                    </Suspense>
                </Router>
            </div>
        </AntApp>
    );
}

export default App;
