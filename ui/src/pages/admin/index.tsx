import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ExitIcon, StarFilledIcon } from '@radix-ui/react-icons';
import { MenuItem, Sidebar } from './components/sidebar';
import './index.css';
import {
  HomeIcon,
  GearIcon,
  BackpackIcon,
  TableIcon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons';

const menuItems: MenuItem[] = [
  {
    key: 'tools',
    icon: <BackpackIcon className="w-5 h-5" />,
    label: '工具管理',
    path: '/admin/tools',
  },
  {
    key: 'categories',
    icon: <TableIcon className="w-5 h-5" />,
    label: '分类管理',
    path: '/admin/categories',
  },
  {
    key: 'search-engines',
    icon: <MagnifyingGlassIcon className="w-5 h-5" />,
    label: '搜索引擎管理',
    path: '/admin/search-engines',
  },
  {
    key: 'api-token',
    icon: <StarFilledIcon className="w-5 h-5" />,
    label: 'API Token',
    path: '/admin/api-token',
  },
  {
    key: 'settings',
    icon: <GearIcon className="w-5 h-5" />,
    label: '系统设置',
    path: '/admin/settings',
  },
];

export const AdminPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentKey, setCurrentKey] = useState('tools');

  useEffect(() => {
    const pathname = location.pathname;
    const currentItem = menuItems.find((item) => pathname.includes(item.key));
    if (currentItem) {
      setCurrentKey(currentItem.key);
    }
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('_token');
    navigate('/');
  };

  return (
    <div className="admin-page-shell h-screen overflow-hidden bg-[#121212] text-[#e0e0e0] flex flex-col">
      <header className="bg-[#1f1f1f] border-b border-[#303030]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-[#f1f1f1]">Nav 管理系统</h1>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="flex items-center px-3 py-2 text-sm text-[#cfcfcf] hover:text-[#ffffff]"
              >
                <HomeIcon className="w-4 h-4 mr-2" />
                返回主页
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm text-[#cfcfcf] hover:text-[#ffffff]"
              >
                <ExitIcon className="w-4 h-4 mr-2" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 w-full overflow-hidden min-h-0">
        <Sidebar items={menuItems} currentKey={currentKey} onChange={setCurrentKey} />

        <main className="flex-1 overflow-hidden bg-[#121212] min-h-0">
          <div className="px-4 pt-4 pb-0 h-full overflow-auto box-border">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
