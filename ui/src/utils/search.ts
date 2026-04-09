import pinyin from "pinyin-match";

export interface SearchIndex {
  rawText: string;
  pinyinText: string;
}

// 统一把常用搜索字段压成小写字符串，减少每次过滤时重复做 String/trim/lowercase。
export const buildSearchIndex = (...parts: Array<unknown>) => {
  const values = parts
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter(Boolean);

  return {
    rawText: values.join(" "),
    // 拼音匹配只保留中文语义相关字段，避免把 URL 之类无意义内容也送进去做匹配。
    pinyinText: values.join(" "),
  } satisfies SearchIndex;
};

export const matchesSearchIndex = (index: SearchIndex, keyword: string) => {
  const target = String(keyword ?? "").trim().toLowerCase();
  if (!target) {
    return true;
  }

  if (index.rawText.includes(target)) {
    return true;
  }

  return Boolean(pinyin.match(index.pinyinText, target));
};
