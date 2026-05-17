import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp, Spin } from 'antd';
import { applyTheme } from './utils/theme';
import { isLogin } from './utils/check';
import './App.css';

const Home = React.lazy(() => import('./pages/Home'));
const AdminPage = React.lazy(() => import('./pages/admin').then(m => ({ default: m.AdminPage })));
const Login = React.lazy(() => import('./pages/Login'));
const Tools = React.lazy(() => import('./pages/admin/tabs/Tools').then(m => ({ default: m.Tools })));
const Catelog = React.lazy(() => import('./pages/admin/tabs/Catelog').then(m => ({ default: m.Catelog })));
const ApiToken = React.lazy(() => import('./pages/admin/tabs/ApiToken').then(m => ({ default: m.ApiToken })));
const Setting = React.lazy(() => import('./pages/admin/tabs/Setting').then(m => ({ default: m.Setting })));
const SearchEngine = React.lazy(() => import('./pages/admin/tabs/Search'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

const getPageBackgroundColor = () => '#121212';

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  if (!isLogin()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const LoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100%',
      backgroundColor: getPageBackgroundColor(),
      color: 'rgba(255,255,255,0.6)',
      transition: 'background-color 0.3s',
    }}
  >
    <Spin size="large" tip="加载中..." />
  </div>
);

function App() {
  useEffect(() => {
    applyTheme('dark', 'app-init', true);
  }, []);

  return (
    <AntApp>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: getPageBackgroundColor(),
          transition: 'background-color 0.3s',
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
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </div>
    </AntApp>
  );
}

export default App;

