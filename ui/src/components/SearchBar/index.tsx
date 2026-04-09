import { memo, useCallback, useEffect } from "react";
import "./index.css";
// import { useState } from 'react';

interface SearchBarProps {
  setSearchText: (t: string) => void;
  searchString: string;
}
const SearchBar = (props: SearchBarProps) => {
  // 弹窗输入密码、后台输入框等场景必须优先保留当前焦点，不能被全局搜索热键抢走。
  const shouldSkipGlobalFocus = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tagName = target.tagName.toLowerCase();
    if (["input", "textarea", "select"].includes(tagName)) {
      return true;
    }
    if (target.isContentEditable || target.closest("[contenteditable='true']")) {
      return true;
    }
    if (target.closest(".ant-modal") || target.closest(".ant-select-dropdown")) {
      return true;
    }
    return false;
  };

  const onKeyDown = useCallback((ev) => {
    const reg = /[a-zA-Z0-9]|[\u4e00-\u9fa5]/g;
    if (shouldSkipGlobalFocus(ev.target ?? document.activeElement)) {
      return;
    }
    if (ev.code === "Enter" || reg.test(ev.key)) {
      const el = document.getElementById("search-bar");
      if (el) {
        el.focus();
      }
    }
  }, [])
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [onKeyDown])
  return (
    <div className="search span-3">
      <div className="search-wraper">
        <input
          id="search-bar"
          type="search"
          placeholder="按任意键直接开始搜索"
          value={props.searchString}
          onChange={(ev) => {
            const v = ev.target.value
            props.setSearchText(v);
          }}
        ></input>
      </div>
    </div>
  );
};

export default memo(SearchBar);
