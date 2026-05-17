import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

export interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
}

interface SidebarProps {
  items: MenuItem[];
  currentKey: string;
  onChange: (key: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ items, currentKey, onChange }) => {
  const location = useLocation();
  const SIDEBAR_MIN_WIDTH = 64;
  const SIDEBAR_COLLAPSE_WIDTH = 82;
  const SIDEBAR_MAX_WIDTH = 320;
  const SIDEBAR_DEFAULT_WIDTH = 220;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem('admin-sidebar-width') || SIDEBAR_DEFAULT_WIDTH);
    if (Number.isNaN(saved)) return SIDEBAR_DEFAULT_WIDTH;
    return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, saved));
  });
  const [dragging, setDragging] = useState(false);
  const rafRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);
  const expanded = sidebarWidth > SIDEBAR_COLLAPSE_WIDTH;

  useEffect(() => {
    localStorage.setItem('admin-sidebar-width', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (!dragging) return;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    const flushWidth = () => {
      rafRef.current = null;
      if (pendingWidthRef.current !== null) {
        setSidebarWidth(pendingWidthRef.current);
      }
    };
    const onMove = (e: PointerEvent) => {
      const next = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, e.clientX));
      pendingWidthRef.current = next;
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(flushWidth);
      }
    };
    const onUp = () => {
      setDragging(false);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  const handleResizeDoubleClick = () => {
    if (sidebarWidth <= SIDEBAR_COLLAPSE_WIDTH) {
      setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
      return;
    }
    setSidebarWidth(SIDEBAR_MIN_WIDTH);
  };

  return (
    <div
      className={`h-full bg-[#1f1f1f] border-r border-[#303030] relative ${dragging ? '' : 'transition-all duration-150'}`}
      style={{ width: sidebarWidth }}
    >
      <nav className="pt-4 relative h-full">
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.path}
            onClick={() => onChange(item.key)}
            className={`
              flex items-center px-4 py-3 text-[#cfcfcf] hover:bg-[#2a2a2a] cursor-pointer no-underline
              border-l-4
              ${(currentKey === item.key || location.pathname === item.path)
                ? 'bg-[#2a2a2a] border-[#8a8a8a] text-[#ffffff]'
                : 'border-transparent'}
            `}
          >
            <span className="text-xl">{item.icon}</span>
            {expanded && <span className="ml-3 truncate">{item.label}</span>}
          </Link>
        ))}

        <a
          href="https://github.com/mereithhh/van-nav"
          target="_blank"
          rel="noopener noreferrer"
          className="
            absolute bottom-4 left-4
            flex items-center justify-start py-2
            text-[#a8a8a8] hover:text-[#ffffff]
          "
        >
          <svg height="24" width="24" viewBox="0 0 16 16" className="fill-current">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {expanded && <span className="ml-2">GitHub</span>}
        </a>
      </nav>
      <div
        aria-label="resize sidebar"
        onPointerDown={() => setDragging(true)}
        onDoubleClick={handleResizeDoubleClick}
        className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-50 group flex items-center justify-center"
        title="双击收起/恢复默认宽度"
      >
        <div className="h-8 w-[1px] rounded-full bg-[#3f3f3f] group-hover:bg-[#686868] transition-colors" />
      </div>
    </div>
  );
};

