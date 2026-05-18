import "./index.css";
import { memo, useMemo } from "react";

interface TagSelectorProps {
  tags: any;
  onTagChange: (newTag: string) => void;
  currTag: string;
}

const TagSelector = (props: TagSelectorProps) => {
  const { tags = ["all"], onTagChange, currTag } = props;

  const renderedTags = useMemo(() => {
    return tags.map((each: string) => {
      const displayText =
        each === null || each === undefined || each === "" || (typeof each === "string" && each.trim() === "")
          ? "未分类"
          : each;

      return (
        <span
          className={`select-tag ${currTag === each ? "select-tag-active" : ""}`}
          key={`${each}-select-tag`}
          onClick={() => onTagChange(each)}
        >
          {displayText}
        </span>
      );
    });
  }, [tags, onTagChange, currTag]);

  return (
    <div className="tag-selector span-3">
      <div className="tag-selector-wrapper">{renderedTags}</div>
    </div>
  );
};

export default memo(TagSelector);
