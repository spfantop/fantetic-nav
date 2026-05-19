import { render, screen } from "@testing-library/react";
import Content from "./index";
import { FetchList } from "../../utils/api";

jest.mock("../../utils/api", () => ({
  FetchList: jest.fn(),
  clearHomeEtagCache: jest.fn(),
  fetchUpdateToolsSort: jest.fn(() => Promise.resolve({})),
  fetchUpdateToolsAllSort: jest.fn(() => Promise.resolve({})),
  fetchUpdateCatelogsSort: jest.fn(() => Promise.resolve({})),
}));

jest.mock("../../utils/serachEngine", () => ({
  generateSearchEngineCard: jest.fn(() => Promise.resolve([])),
}));

describe("首页布局编辑", () => {
  beforeEach(() => {
    (FetchList as jest.Mock).mockResolvedValue({
      tools: [
        { id: 1, name: "A", desc: "A", catelog: "开发", sort: 1, url: "https://a.com", logo: "" },
      ],
      catelogs: ["全部工具", "开发"],
      catelogItems: [{ id: 101, name: "开发", sort: 1 }],
      setting: {},
      siteConfig: {},
    });
    window.localStorage.setItem("_token", "token");
    Object.defineProperty(window, "IntersectionObserver", {
      writable: true,
      value: class {
        observe() {}
        disconnect() {}
      },
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it("编辑模式下显示保存和取消按钮", async () => {
    render(<Content editMode />);
    expect(await screen.findByText("保存")).toBeInTheDocument();
    expect(screen.getByText("取消")).toBeInTheDocument();
  });

  it("命中 304 且缓存异常时会清缓存并回源恢复标签", async () => {
    const cacheKey = "fantetic_nav_home_cache_v2:auth";
    window.localStorage.setItem(cacheKey, JSON.stringify({ bad: true }));
    (FetchList as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        tools: [{ id: 1, name: "A", desc: "A", catelog: "开发", sort: 1, url: "https://a.com", logo: "" }],
        catelogs: ["全部工具", "开发"],
        catelogItems: [{ id: 101, name: "开发", sort: 1 }],
        setting: {},
        siteConfig: {},
      });

    render(<Content />);
    expect(await screen.findByText("开发")).toBeInTheDocument();
    expect(window.localStorage.getItem(cacheKey)).not.toEqual(JSON.stringify({ bad: true }));
  });
});

