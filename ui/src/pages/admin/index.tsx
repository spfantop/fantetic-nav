import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ExitIcon, StarFilledIcon } from '@radix-ui/react-icons';
import { MenuItem, Sidebar } from './components/sidebar';
import { clearAllAppCaches, notifyAuthStateChanged } from '../../utils/api';
import "./index.css"
import {
  HomeIcon,
  GearIcon,
  BackpackIcon,
  TableIcon,
  MagnifyingGlassIcon,
  DragHandleDots2Icon,
} from '@radix-ui/react-icons';

const menuItems: MenuItem[] = [
  {
    key: 'tools',
    icon: <BackpackIcon className="w-5 h-5" />,
    label: '工具管理',
    path: '/admin/tools'
  },
  {
    key: 'categories',
    icon: <TableIcon className="w-5 h-5" />,
    label: '分类管理',
    path: '/admin/categories'
  },
  {
    key: 'search-engines',
    icon: <MagnifyingGlassIcon className="w-5 h-5" />,
    label: '搜索引擎管理',
    path: '/admin/search-engines'
  },
  {
    key: 'api-token',
    icon: <StarFilledIcon className="w-5 h-5" />,
    label: 'API Token',
    path: '/admin/api-token'
  },
  {
    key: 'settings',
    icon: <GearIcon className="w-5 h-5" />,
    label: '系统设置',
    path: '/admin/settings'
  }
];

export const AdminPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentKey, setCurrentKey] = useState('tools');

  useEffect(() => {
    if (!localStorage.getItem('_token')) {
      navigate('/login');
    }
  }, [navigate]);

  // 根据当前路径设置选中的菜单项
  useEffect(() => {
    const pathname = location.pathname;
    const currentItem = menuItems.find(item => pathname.includes(item.key));
    if (currentItem) {
      setCurrentKey(currentItem.key);
    }
  }, [location]);

  // 处理退出登录
  const handleLogout = () => {
    localStorage.removeItem('_token');
    clearAllAppCaches();
    notifyAuthStateChanged(false);
    window.location.href = '/';
  };

  return (
    <div className="admin-shell min-h-screen">
      <header className="admin-header">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold admin-title">Fantetic Nav 管理系统</h1>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="admin-top-link"
              >
                <HomeIcon className="w-4 h-4 mr-2" />
                返回主页
              </Link>
              <Link
                to="/?edit=1"
                className="admin-top-link"
              >
                <DragHandleDots2Icon className="w-4 h-4 mr-2" />
                视图调整
              </Link>
              <button
                onClick={handleLogout}
                className="admin-top-link"
              >
                <ExitIcon className="w-4 h-4 mr-2" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 w-full mx-auto h-[calc(100vh-64px)]">
        <Sidebar items={menuItems} currentKey={currentKey} onChange={setCurrentKey} />

        <main className="flex-1 overflow-auto admin-main">
          <div className="p-4 h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPage; 
