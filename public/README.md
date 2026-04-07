# public

该目录用于给 Go `embed` 提供静态资源。

- 仓库默认只提交一个占位 `index.html`，目的是保证未构建前端时也能编译后端。
- 真正运行完整站点前，请执行 `scripts/build-public.ps1`，它会把 `ui/build` 同步到这里。
