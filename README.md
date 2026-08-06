# Signal Deck 科技市场看板

零后端、无需登录的科技股与全球指数看板。行情、图表、热力图、经济事件与新闻由 TradingView 免费组件提供。

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 发布到 GitHub Pages

项目已包含 `.github/workflows/deploy.yml`。创建 GitHub 仓库并推送到 `main` 分支后，在仓库设置中将 Pages 的 Source 设为 `GitHub Actions`，之后每次推送都会自动部署。

## 数据说明

美股免费网页行情可能延迟，不应作为即时交易报价使用。页面不保存用户数据，也不包含 API Key。
