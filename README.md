# ForgeAtoms

像素风 AI 多智能体工坊。用一句话描述想法，智能体按「调研 → 产品 → 架构 → 工程」生成可预览、可导出的交付物。灵感来自 [atoms.dev](https://atoms.dev/)。

## 功能

- 注册、登录，会话与项目数据保存在本地 SQLite
- 网站着陆页（预览、竞速 A/B、导出 ZIP）
- DeepSeek 生成可下载 PPT
- 可玩小游戏：2048、贪吃蛇、俄罗斯方块
- 像素海报拼装
- 素材库（人物、树木、花草、水果、美食、场景）
- 视频 / 音频请求只显示多模态额度兜底文案，不调用真实多模态接口
- 源码浏览自动脱敏，不展示密钥

## 本地运行

需要 Node.js 20 或更高版本（Railway 镜像使用 Node 20）。

```bash
git clone https://github.com/NIU0216/forge-atoms.git
cd forge-atoms
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
npm install
npm start
```

浏览器打开 http://127.0.0.1:3847/

可选：`npm run seed` 会写入仅供本机演示的账号，凭据见 `src/seed.js`。

## 安全

不要提交真实的 `DEEPSEEK_API_KEY`。`.env`、SQLite 数据库和 `data/projects/` 里的生成产物都不应进入仓库。`.env.example` 只保留空占位符。

## 文档

- [技术说明](docs/TECHNICAL.md)
- [用户手册](docs/USER_MANUAL.md)
- [测试记录](docs/TEST_NOTES.md)

## 部署到 Railway

见 [docs/DEPLOY_RAILWAY.md](docs/DEPLOY_RAILWAY.md)。仓库根目录含 `Dockerfile` 与 `railway.toml`，可从 GitHub 一键部署。

