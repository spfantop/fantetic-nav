import "./index.css";
import { memo, useCallback } from "react";
import { LockClosedIcon, LockOpen2Icon } from "@radix-ui/react-icons";

export interface TagSelectorItem {
  value: string;
  label: string;
  locked?: boolean;
  unlocked?: boolean;
}

interface TagSelectorProps {
  tags: TagSelectorItem[];
  onTagChange: (newTag: string) => void;
  currTag: string;
}
const TagSelector = (props: TagSelectorProps) => {
  const { tags = [{ value: "all", label: "all" }], onTagChange, currTag } = props;
  const renderTags = useCallback(() => {
    const originTags = tags.map((tag) => {
      // 处理空分类，显示为“未分类”，同时保留锁状态元信息。
      const displayText = tag.label === null || tag.label === undefined || tag.label === "" || (typeof tag.label === "string" && tag.label.trim() === "")
        ? "未分类"
        : tag.label;
      
      return (
        <span
          className={`select-tag ${
            currTag === tag.value ? "select-tag-active" : ""
          }`}
          key={`${tag.value}-select-tag`}
          onClick={() => {
            onTagChange(tag.value);
          }}
        >
          {tag.locked || tag.unlocked ? (
            <span className={`tag-lock-indicator ${tag.unlocked ? "tag-lock-indicator-unlocked" : "tag-lock-indicator-locked"}`} aria-hidden="true">
              {tag.unlocked ? <LockOpen2Icon /> : <LockClosedIcon />}
            </span>
          ) : null}
          <span className="tag-label-text">{displayText}</span>
        </span>
      );
    });
    return originTags;
  }, [tags, onTagChange, currTag]);
  return (
    <div className="tag-selector span-3">
      <div className="tag-selector-wrapper">
        {renderTags()}
      </div>
    </div>
  );
};

export default memo(TagSelector);
