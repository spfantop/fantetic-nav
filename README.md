# Fantetic Nav CF
*参考项目：https://github.com/Mereithhh/van-nav， 感谢原作者的付出。*
> 项目示例：https://fantetic-nav-cf.fan-89c.workers.dev/admin\
> 
> 登陆账号/密码：testadmin/adminadmin

基于 `Cloudflare Workers + D1 + R2 + React` 的导航站项目，包含首页、管理后台、主题配置、书签管理、分类管理、搜索、图标缓存和 Cloudflare 一体化部署能力。

本仓库已经收敛为 Cloudflare 版本，不再包含旧 Go 后端。

## 特性

- 首页导航、分类筛选、搜索联想与快捷访问
- 管理后台：书签、分类、搜索引擎、站点配置
- 亮色 / 暗色主题与可视化配色配置
- D1 存储业务数据，R2 缓存远程图标与静态资源
- Cloudflare Workers 统一承载 API 与前端静态资源
- 支持 D1 migration 与初始化 seed

## 技术栈

- 前端：React 18、TypeScript、Ant Design
- 服务端：Cloudflare Workers、Hono
- 数据库：Cloudflare D1
- 对象存储：Cloudflare R2
- 构建与部署：Wrangler

## 仓库结构

- [`ui/`](./ui)：前端页面与管理后台
- [`cloudflare/worker/`](./cloudflare/worker/)：Worker API 与 Cloudflare 端逻辑
- [`cloudflare/migrations/`](./cloudflare/migrations/)：D1 migration
- [`cloudflare/seed.sql`](./cloudflare/seed.sql)：初始化示例数据
- [`wrangler.toml`](./wrangler.toml)：Cloudflare 绑定与部署配置
- [`.dev.vars.example`](./.dev.vars.example)：本地开发环境变量示例
- [`CHANGELOG.md`](./CHANGELOG.md)：变更记录
- [`LICENSE`](./LICENSE)：许可证

## 环境要求

- Node.js 18 或更高版本
- `pnpm`
- Cloudflare Wrangler
- 一个 Cloudflare 账号

## 快速开始

根目录安装依赖：

```powershell

cd D:\Code\nav\van-nav
npm install
```

前端安装依赖：

```powershell

cd D:\Code\nav\van-nav\ui
pnpm install
```

## 环境变量

本地开发时请复制 `.dev.vars.example` 为 `.dev.vars`：

```powershell

cd D:\Code\nav\van-nav
Copy-Item .dev.vars.example .dev.vars
```

最少需要配置：

```env
JWT_SECRET=replace-with-a-long-random-secret
```

说明：

- `JWT_SECRET` 用于后台登录与鉴权签名
- 发布到 Cloudflare 前，也需要通过 `wrangler secret put` 把同名密钥写到线上

## 本地开发

推荐方式是先构建前端，再启动 Worker：

```powershell

cd D:\Code\nav\van-nav
npm run cf:dev:build
```

默认访问地址：

- `http://localhost:8787`
- `http://你的局域网IP:8787`

如果前端已经构建过，也可以直接启动 Worker：

```powershell

cd D:\Code\nav\van-nav
npm run cf:dev
```

如果只想调试前端热更新：

```powershell

cd D:\Code\nav\van-nav\ui
pnpm start-win
```

默认前端地址：

- `http://localhost:2333`
- `http://你的局域网IP:2333`

## Cloudflare 资源准备

部署前需要准备：

- 一个 D1 数据库
- 一个 R2 Bucket
- Cloudflare Worker Secret：`JWT_SECRET`
- 正确配置的 [`wrangler.toml`](./wrangler.toml)

当前项目依赖的 `wrangler.toml` 关键配置：

- `[[d1_databases]]`
- `[[r2_buckets]]`
- `[assets]`

发布前请务必确认：

- `database_id` 已替换为你自己的 D1 数据库 ID
- `bucket_name` / `preview_bucket_name` 已替换为你自己的 R2 Bucket
- `JWT_SECRET` 已通过 `wrangler secret put` 配好

配置线上 secret：

```powershell

cd D:\Code\nav\van-nav
npx wrangler secret put JWT_SECRET
```

## 数据库初始化

### 场景一：全新数据库初始化

如果你新建的是一个空 D1，执行下面顺序：

```powershell

cd D:\Code\nav\van-nav

cd ui
pnpm build
cd ..

npm run cf:d1:migrate
npm run cf:d1:seed
```

说明：

- `cf:d1:migrate`：执行 [`cloudflare/migrations/`](./cloudflare/migrations/) 中的 migration
- `cf:d1:seed`：导入 [`cloudflare/seed.sql`](./cloudflare/seed.sql) 中的初始化数据

### 场景二：已有数据库升级

如果你的 D1 已经有线上数据：

- 先备份数据库
- 再执行 `migration`
- 一般不要再次执行 `seed`

推荐顺序：

```powershell

cd D:\Code\nav\van-nav

cd ui
pnpm build
cd ..

npm run cf:d1:migrate
npm run cf:deploy
```

注意：

- 已有库如果出现 `duplicate column name`，说明这个库并不是空库，不能再按“全新初始化”方式处理
- 此时不要继续硬跑 `seed`

## 部署

正式部署建议顺序如下：

```powershell

cd D:\Code\nav\van-nav

cd ui
pnpm build
cd ..

npm run cf:typecheck
npm run cf:test
npm run cf:deploy
```

如果是全新数据库，部署前还需要先执行：

```powershell
npm run cf:d1:migrate
npm run cf:d1:seed
```

## 可用脚本

根目录：

- `npm run cf:dev`：启动 Worker 本地开发
- `npm run cf:dev:build`：先构建前端，再启动 Worker
- `npm run cf:deploy`：部署到 Cloudflare
- `npm run cf:typecheck`：Worker TypeScript 类型检查
- `npm run cf:test`：Worker 单元测试
- `npm run cf:d1:migrate`：执行 D1 migration
- `npm run cf:d1:seed`：执行 D1 seed

前端目录：

- `pnpm start-win`：前端本地开发
- `pnpm build`：前端生产构建
- `pnpm test`：前端测试

## GitHub 发布建议

如果你准备把仓库发布到 GitHub，建议在发布前检查以下内容：

- `wrangler.toml` 中的 Cloudflare 资源 ID 是否为你自己的正式配置
- `.dev.vars` 没有提交到仓库
- 不要提交真实的密钥、令牌、Cookie 或后台账号
- `README.md`、`CHANGELOG.md`、`LICENSE` 保持完整
- 首次发布建议打 tag，并在 GitHub Release 中说明：
  - 版本号
  - 主要功能
  - 破坏性变更
  - 初始化 / 升级步骤

推荐的发布说明至少包含：

- 部署方式
- 数据库初始化方式
- 已有库升级注意事项
- 环境变量要求

## 常见问题

### 1. `Migration ... duplicate column name`

说明你当前使用的不是空数据库，字段已经存在。

处理方式：

- 如果你要全新初始化：新建一个空 D1，再执行 `migrate + seed`
- 如果你要保留旧数据：只执行必要 migration，不要重复跑初始化 seed

### 2. 部署后首页还是旧版本

通常是因为没有重新构建前端。

请先执行：

```powershell
cd ui
pnpm build
cd ..
npm run cf:deploy
```

### 3. 登录异常或接口 401

优先检查：

- `.dev.vars` 是否配置了 `JWT_SECRET`
- Cloudflare 线上是否执行过 `wrangler secret put JWT_SECRET`
- 本地与线上密钥是否一致

### 4. 图标大量请求或首次加载较慢

当前版本会优先使用 Worker 已缓存到 R2 的图标资源；首次未命中的远程图标仍需要后端抓取并缓存，属于正常现象。

## 变更记录

详见 [`CHANGELOG.md`](./CHANGELOG.md)。

## 许可证

本项目基于 [`MIT License`](./LICENSE) 发布。
