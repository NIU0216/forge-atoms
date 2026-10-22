# ForgeAtoms 技术文档

## 1. 产品概述

**ForgeAtoms（AI 多智能体产品工坊）** 是一个受 [atoms.dev](https://atoms.dev/) 启发的可运行 Demo：用户用自然语言描述产品想法，系统以多智能体时间线（Iris 调研 / Emma 产品 / Bob 架构 / Alex 工程）完成「调研 → 规划 → 生成可预览着陆页」，并支持 **竞速 A/B** 与 **ZIP 导出**。

本 Demo **接入 DeepSeek Chat Completions API**（`DEEPSEEK_API_KEY`）驱动多智能体。网站路径在 API 失败时回退离线启发式；PPT 路径必须成功调用 API 才能交付 `.pptx`（pptxgenjs）。

## 2. 技术栈

| 层级 | 选型 |
|------|------|
| 运行时 | Node.js ≥ 18 |
| Web 框架 | Express 4 |
| 模板 | EJS（服务端渲染）+ Alpine.js（工作区交互） |
| 样式 | 自研 CSS（深色产品风） |
| 持久化 | better-sqlite3（SQLite 文件） |
| 会话 | express-session（httpOnly Cookie） |
| 密码 | bcryptjs |
| 导出 | archiver（ZIP） |
| 端口 | **3847**（固定） |

## 3. 目录结构

```
forge-atoms/
├── package.json
├── .env.example            # 空占位符；不要把填好的 .env 提交入库
├── data/
│   ├── forgeatoms.db       # SQLite 主库（运行时生成，不入库）
│   └── projects/<id>/<A|B>/  # 产物落盘（不入库）
├── docs/
│   ├── TECHNICAL.md
│   ├── USER_MANUAL.md
│   └── TEST_NOTES.md
└── src/
    ├── server.js           # 入口
    ├── db.js               # Schema / DB 连接
    ├── seed.js             # Demo 账号
    ├── middleware/auth.js
    ├── routes/
    │   ├── auth.js         # 注册 / 登录 / 登出
    │   ├── projects.js     # 项目 CRUD、构建、竞速、导出
    │   └── preview.js      # 产物预览（iframe）
    ├── services/
    │   ├── ideaParser.js   # 想法启发式解析
    │   ├── pageGenerator.js# 着陆页 / About / README 生成
    │   └── agentPipeline.js# 多智能体流水线
    ├── views/              # EJS 页面
    └── public/css/app.css
```

## 4. 数据模型

### users
- `id` TEXT PK  
- `email` TEXT UNIQUE  
- `password_hash` TEXT  
- `name` TEXT  
- `created_at` TEXT  

### projects
- `id` TEXT PK  
- `user_id` TEXT → users  
- `title` / `idea` TEXT  
- `status` ∈ `draft | researching | building | ready`  
- `selected_variant` ∈ `A | B`  
- `deliverable` ∈ `web | ppt`  
- `created_at` / `updated_at`  

### agent_messages
- 智能体时间线条目：`agent_key/name/role`、`content`、`step_order`

### artifacts
- 按 `(project_id, variant, filename)` 唯一存储 HTML 等产物

## 5. 核心流程

1. 用户注册/登录 → Session Cookie  
2. 创建项目（标题 + 想法）→ `status=draft`  
3. 「启动构建」→ `runBuild`：  
   - 依次写入 Iris → Emma → Bob → Alex 消息（带短延迟，轮询可见）  
   - 生成 Variant A 的 `index.html` + `about.html` 写入 DB 与磁盘  
   - `status=ready`  
4. 「竞速生成」→ `runRace`：并行写出 A/B 两套设计  
5. 「选用此版本」→ 更新 `selected_variant`  
6. 「导出 ZIP」→ `index.html` + `about.html` + `README.md`

前端工作区通过 `GET /projects/:id/status` 轮询，更新时间线与预览。

## 5.1 PPT 流水线（DeepSeek）

1. 检测/写入 `deliverable=ppt`
2. Iris：`chat` 调研简报
3. Emma：`chatJson` 大纲 `{title,subtitle,slides[]}`
4. Bob：`chatJson` 主题色
5. Alex：`pptxBuilder.buildPptx` → `data/projects/<id>/A/presentation.pptx`
6. artifacts：`outline.json` / `design.json` 文本；`presentation.pptx` 内容为 `__FILE__:projects/.../presentation.pptx`

服务模块：`src/services/llm.js`、`pptPipeline.js`、`pptxBuilder.js`、`deliverable.js`。

## 6. 主要 HTTP 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 营销首页 |
| GET/POST | `/register` `/login` | 注册登录 |
| POST | `/logout` | 登出 |
| GET | `/dashboard` | 项目列表 |
| GET/POST | `/projects/new` `/projects` | 新建 |
| GET | `/projects/:id` | 工作区 |
| POST | `/projects/:id/build` | 启动构建 |
| POST | `/projects/:id/race` | 竞速 A/B |
| POST | `/projects/:id/select-variant` | 选用版本 JSON `{variant}` |
| GET | `/projects/:id/status` | 轮询状态 JSON |
| GET | `/projects/:id/export?variant=A\|B` | 下载 ZIP |
| GET | `/projects/:id/download-pptx` | 下载 PPTX（PPT 项目） |
| GET | `/preview/:projectId/:variant/` | 预览 HTML |
| GET | `/health` | 健康检查 |

## 7. 本地运行

```bash
cp .env.example .env   # 填入 DEEPSEEK_API_KEY，不要提交 .env
npm install
npm run seed           # 可选：写入本地 demo 账号
npm start              # 监听 0.0.0.0:3847
```

访问：http://127.0.0.1:3847/

Demo 账号：运行 `npm run seed` 创建（邮箱/密码见 `src/seed.js`，仅本地演示，勿用于生产）

环境变量见 `.env.example`：

- `DEEPSEEK_API_KEY`（PPT 与文案需要；仓库中只留空占位）
- `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL`
- `SESSION_SECRET`（生产环境请自行更换）
- `PORT`（默认 3847）

## 8. 运行边界

应用是单进程 Node 服务，数据在 `data/`。本仓库只提供本地运行，不附带公网地址、隧道脚本或部署 URL。

## 9. 安全说明（Demo 级）

- 密码 bcrypt 哈希存储  
- Session Cookie httpOnly + sameSite=lax  
- 项目/预览均校验 `user_id`  
- **非生产加固**：无 CSRF Token、无速率限制、默认 SESSION_SECRET 仅适合演示  

## 10. 扩展建议

- 接入真实 LLM（OpenAI / 本地 Ollama）替换 `pageGenerator`  
- SSE/WebSocket 替代轮询  
- 多页站点生成、自定义域名、GitHub 同步
