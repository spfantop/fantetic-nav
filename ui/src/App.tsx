import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Spin, theme as antdTheme } from 'antd';
import { APPEARANCE_CHANGE_EVENT, applyAppearanceSettings, parseThemePalette } from './utils/appearance';
import { FetchList, fetchAdminData } from './utils/api';
import { isLogin } from './utils/check';
import { applyGlobalFontFamily, FONT_FAMILY_CHANGE_EVENT, readSavedFontFamily, resolveFontFamily } from './utils/font';
import { applyTheme, decodeTheme, initTheme } from './utils/theme';
import './App.css';

const Home = React.lazy(() => import('./pages/Home'));
const AdminPage = React.lazy(() => import('./pages/admin').then(m => ({ default: m.AdminPage })));
const Login = React.lazy(() => import('./pages/Login'));
const Tools = React.lazy(() => import('./pages/admin/tabs/Tools').then(m => ({ default: m.Tools })));
const Catelog = React.lazy(() => import('./pages/admin/tabs/Catelog').then(m => ({ default: m.Catelog })));
const ApiToken = React.lazy(() => import('./pages/admin/tabs/ApiToken').then(m => ({ default: m.ApiToken })));
const Setting = React.lazy(() => import('./pages/admin/tabs/Setting').then(m => ({ default: m.Setting })));
const SearchEngine = React.lazy(() => import('./pages/admin/tabs/Search')) ;

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
            backgroundColor: 'var(--theme-page-bg)',
            color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#272e3b',
            transition: 'background-color 0.3s'
        }}>
            <Spin size="large" tip="加载中..." />
        </div>
    );
};

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
    if (!isLogin()) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

function App() {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [fontFamily, setFontFamily] = useState(() => resolveFontFamily(readSavedFontFamily()));
    const [appearanceSetting, setAppearanceSetting] = useState<any>(null);

    useEffect(() => {
        // 应用启动时主动同步 body 明暗类名，避免直接进后台时仍停留在默认亮色 DOM 状态。
        const theme = initTheme();
        const savedFontFamily = readSavedFontFamily();
        applyGlobalFontFamily(savedFontFamily);
        setFontFamily(resolveFontFamily(savedFontFamily));
        const decodedTheme = decodeTheme(theme);
        applyTheme(decodedTheme, "app-init", true);
        const dark = decodedTheme.includes('dark');
        setIsDarkMode(dark);
        let active = true;
        const loadAppearance = async () => {
            try {
                const response = isLogin() ? await fetchAdminData() : await FetchList();
                if (active && response?.setting) {
                    setAppearanceSetting(response.setting);
                    applyAppearanceSettings(response.setting, dark);
                }
            } catch {
                if (active) {
                    applyAppearanceSettings(undefined, dark);
                }
            }
        };
        loadAppearance();

        const handleFontChange = (event: Event) => {
            const customEvent = event as CustomEvent<{ resolved?: string }>;
            setFontFamily(customEvent.detail?.resolved || resolveFontFamily(readSavedFontFamily()));
        };

        const handleAppearanceChange = (event: Event) => {
            const customEvent = event as CustomEvent<{ setting?: any }>;
            if (customEvent.detail?.setting) {
                setAppearanceSetting(customEvent.detail.setting);
                applyAppearanceSettings(customEvent.detail.setting, document.body.classList.contains('dark-mode'));
            }
        };

        window.addEventListener(FONT_FAMILY_CHANGE_EVENT, handleFontChange as EventListener);
        window.addEventListener(APPEARANCE_CHANGE_EVENT, handleAppearanceChange as EventListener);

        return () => {
            active = false;
            window.removeEventListener(FONT_FAMILY_CHANGE_EVENT, handleFontChange as EventListener);
            window.removeEventListener(APPEARANCE_CHANGE_EVENT, handleAppearanceChange as EventListener);
        };
    }, []);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            const body = document.body;
            setIsDarkMode(body.classList.contains('dark-mode'));
        });

        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        applyAppearanceSettings(appearanceSetting, isDarkMode);
    }, [appearanceSetting, isDarkMode]);

    const currentPalette = isDarkMode
        ? parseThemePalette(appearanceSetting?.darkThemeConfig, "dark")
        : parseThemePalette(appearanceSetting?.lightThemeConfig, "light");

    return (
        <ConfigProvider
            theme={{
                algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: {
                    fontFamily,
                    colorPrimary: currentPalette.primaryColor,
                    colorBgBase: currentPalette.pageBackground,
                    colorTextBase: currentPalette.textPrimary,
                    colorBorder: currentPalette.cardBorder,
                    borderRadius: 12,
                },
            }}
        >
            <AntApp>
                <div
                    style={{
                        minHeight: '100vh',
                        backgroundColor: currentPalette.pageBackground,
                        backgroundImage: 'var(--theme-background-image)',
                        backgroundPosition: 'center',
                        backgroundSize: 'cover',
                        backgroundRepeat: 'no-repeat',
                        transition: 'background-color 0.3s'
                    }}
                >
                    <Router>
                        <Suspense fallback={<LoadingFallback />}>
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>}>
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
        </ConfigProvider>
    );
}

export default App;
