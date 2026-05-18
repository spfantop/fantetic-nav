import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Content from '../components/Content';
import { isLogin } from '../utils/check';

const Home: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedEdit = new URLSearchParams(location.search).get('edit') === '1';
  const fromAdmin = Boolean((location.state as any)?.fromAdmin);
  const editMode = useMemo(() => requestedEdit && fromAdmin && isLogin(), [requestedEdit, fromAdmin]);

  useEffect(() => {
    if (requestedEdit && !editMode) {
      navigate('/', { replace: true });
    }
  }, [requestedEdit, editMode, navigate]);

  return (
    <div className="App">
      <div className="main">
        <Content editMode={editMode} onLeaveEdit={() => navigate('/', { replace: true })} />
      </div>
    </div>
  );
};

export default Home; 
