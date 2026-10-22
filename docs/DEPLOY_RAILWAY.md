# 在 Railway 上部署 ForgeAtoms

本仓库已包含 `Dockerfile` 与 `railway.toml`，适合从 GitHub 一键部署。演示用 SQLite 写在容器磁盘上；**免费/Hobby 默认磁盘是临时的**，服务重启或重新部署后用户数据可能清空（除非你挂上 Volume）。

## 1. 从 GitHub 创建项目

1. 打开 [Railway](https://railway.app/) 并登录。
2. **New Project** → **Deploy from GitHub repo**。
3. 选择仓库 `NIU0216/forge-atoms`（需授权 Railway 访问该仓库）。
4. Root Directory 保持仓库根目录（有 `Dockerfile` / `package.json` 的那一层）。
5. Railway 会识别 `Dockerfile` 并构建；也可用 Nixpacks（`npm start`），但原生依赖建议用 Docker。

## 2. 环境变量（Variables）

在服务的 **Variables** 里添加：

| 变量 | 必填 | 说明 |
|------|------|------|
| `SESSION_SECRET` | 推荐 | Express session 密钥；请换成随机长字符串 |
| `DEEPSEEK_API_KEY` | 可选但推荐 | DeepSeek API Key；不设则 LLM/PPT 主题等会降级 |
| `DEEPSEEK_BASE_URL` | 可选 | 默认 `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 可选 | 默认 `deepseek-chat` |
| `PORT` | 一般不用 | Railway 会自动注入；应用读取 `process.env.PORT` |

**不要把任何 API Key 写进仓库或 Dockerfile。**

生成 `SESSION_SECRET` 示例（在本地终端）：

```bash
openssl rand -hex 32
```

## 3. 生成公开域名

部署成功后：服务 → **Settings** → **Networking** → **Generate Domain**。  
健康检查路径为 `/health`（`railway.toml` 已配置）。

## 4. Demo 账号

首次启动若库中没有演示用户，服务会自动 seed：

- 邮箱：`demo@forgeatoms.local`
- 密码：`demo1234`

仅用于演示，不要当生产账号。

## 5. SQLite 与持久化

- 数据库路径：`data/forgeatoms.db`（相对项目根）。
- 素材在 `data/assets/`（已进仓库）；项目产物在 `data/projects/`（gitignore）。
- **临时磁盘**：重新部署后 SQLite 与用户上传/生成内容可能丢失。
- 若要保留数据：在 Railway 给服务挂 **Volume**，把挂载点指到 `/app/data`（与 Dockerfile 中 `WORKDIR /app` 一致），再重新部署。

## 6. 推荐服务设置速查

- **Root Directory**：`.`（仓库根）
- **Builder**：Dockerfile（`railway.toml` 已指定）
- **Start Command**：`npm start`（或留空，由 Dockerfile `CMD` 负责）
- **Healthcheck Path**：`/health`
- **环境变量**：至少 `SESSION_SECRET`；建议 `DEEPSEEK_API_KEY`

## 7. 本地对照

```bash
cp .env.example .env   # 填入密钥，勿提交
npm ci
npm start              # 或先 npm run seed
```

打开 `http://127.0.0.1:3847/`。
