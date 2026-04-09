import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isLogin } from '../utils/check';
import { AUTH_STATE_CHANGE_EVENT } from '../utils/api';
import Content from '../components/Content';

const Home: React.FC = () => {
  const location = useLocation();
  const editMode = new URLSearchParams(location.search).get('edit') === '1';
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const handleAuthChanged = () => {
      // 登录态切换时强制重挂首页内容，避免分类、标签和书签沿用上一轮会话的本地状态。
      setAuthVersion((previous) => previous + 1);
    };
    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChanged as EventListener);
    return () => {
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthChanged as EventListener);
    };
  }, []);

  // 视图调整模式需要管理员登录后进入，直接复用现有登录态即可。
  if (editMode && !isLogin()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="App">
      <div className="main">
        <Content key={`${editMode ? "edit" : "normal"}-${authVersion}-${isLogin() ? "auth" : "guest"}`} editMode={editMode} />
      </div>
    </div>
  );
};

export default Home; 
