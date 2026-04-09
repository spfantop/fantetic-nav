import { buildSearchIndex, matchesSearchIndex } from "./search";

export const getOptions = (rawList: any) => {
  return rawList.map((item: any) => {
    return {
      label: item.name,
      value: item.name,
      key: item.id,
    }
  })
}
export const getFilter = (rawList: any) => {
  return rawList.map((item: any) => {
    return {
      text: item.name,
      value: item.name,
    }
  })
}

export const mutiSearch = (s: string, t: string) => {
  return matchesSearchIndex(buildSearchIndex(s), t);
};
