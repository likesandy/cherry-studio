## Electron 下载缓慢/卡住：原因与解决方案

本指南总结在使用 Yarn 安装 `electron` 时出现“must be built…”长时间卡住或下载缓慢的常见原因与修复步骤，适用于 macOS / Linux / Windows。

### 常见原因
- 网络与镜像
  - 直连 GitHub/CDN 速度慢或被限流
  - 镜像未设置或设置未生效
- 代理未正确配置
  - 没有设置 `HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY`
  - 系统代理与终端代理不一致
- 缓存或残留构建状态异常
  - 之前中断安装，残留了不完整的缓存或 `build-state.yml`
- Yarn 配置与行为
  - 未启用 inline builds，脚本执行被延后/不可见
  - 旧参数不生效（如 `--verbose` 在 Yarn 4 不支持）
- 防火墙/证书拦截
  - 公司网络拦截、证书校验失败、MITM 导致下载失败或极慢

### 快速修复步骤（推荐顺序）
1) 核对环境版本（Node ≥ 22，Yarn 4.9.1）
<augment_code_snippet mode="EXCERPT">
````bash
node -v
yarn -v
# 若 Yarn 版本不一致：
corepack enable
corepack prepare yarn@4.9.1 --activate
````
</augment_code_snippet>

2) 使用国内镜像（已为本项目配置 .npmrc）
- `.npmrc` 中：`electron_mirror=https://npmmirror.com/mirrors/electron/`
- 临时覆盖（优先级更高）：
<augment_code_snippet mode="EXCERPT">
````bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
yarn install --inline-builds --network-timeout 600000
````
</augment_code_snippet>

3) 清理异常缓存与构建状态后重装
<augment_code_snippet mode="EXCERPT">
````bash
# 清理 Electron 缓存（macOS/Linux）
rm -rf "$HOME/.cache/electron" "$HOME/Library/Caches/electron"
# 清理构建状态（Yarn Berry）
rm -f .yarn/build-state.yml
# 重新安装（开启 inline builds 与更长超时）
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
YARN_ENABLE_INLINE_BUILDS=1 yarn install --inline-builds --network-timeout 600000
````
</augment_code_snippet>

4) 启动开发环境验证
<augment_code_snippet mode="EXCERPT">
````bash
yarn dev
````
</augment_code_snippet>

### 仍然缓慢/卡住时的进一步排查
- 打开更详细输出
  - Yarn 4 不支持 `--verbose`，可观察阶段性日志或使用 `--inline-builds` 获取构建阶段输出
- 校验代理连通性（如在公司网络）
<augment_code_snippet mode="EXCERPT">
````bash
# 设置/检查代理
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
# 测速与连通性
curl -I https://npmmirror.com/mirrors/electron/
````
</augment_code_snippet>

- 检查镜像可达性与区域限流
  - 更换为就近镜像，或在低峰时段安装
- 清理并重试
  - 删除 `node_modules/electron`、`.yarn/build-state.yml`、Electron 缓存后再次安装

### 本项目当前配置与建议
- Yarn 配置（.yarnrc.yml）
  - `nodeLinker: node-modules`（便于原生依赖与脚本执行）
  - `httpTimeout: 300000`
- NPM 配置（.npmrc）
  - `electron_mirror=https://npmmirror.com/mirrors/electron/`（已启用国内镜像）
- 建议在安装阶段使用：
  - `YARN_ENABLE_INLINE_BUILDS=1`（即时构建，问题更可见）
  - `--network-timeout 600000`（高延迟网络更稳）

### 常用命令速查
<augment_code_snippet mode="EXCERPT">
````bash
# 一次性快速修复
rm -rf "$HOME/.cache/electron" "$HOME/Library/Caches/electron"
rm -f .yarn/build-state.yml
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
YARN_ENABLE_INLINE_BUILDS=1 yarn install --inline-builds --network-timeout 600000
````
</augment_code_snippet>

<augment_code_snippet mode="EXCERPT">
````bash
# 启动调试
yarn dev
````
</augment_code_snippet>

### 附录：Electron 缓存位置
- macOS: `~/Library/Caches/electron`
- Linux: `~/.cache/electron`
- Windows: `%LOCALAPPDATA%/electron/Cache`

