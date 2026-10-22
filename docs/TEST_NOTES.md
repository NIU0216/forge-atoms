# ForgeAtoms 自测记录

测试时间：2026-10-22（America/Chicago）

## 环境

- Node 服务：`http://127.0.0.1:3847`（进程 `node src/server.js`）
- 访问：仅本机。临时公网隧道地址已从仓库删除，不再记录。
- 账号：seed 创建的本地演示账号（见 `src/seed.js` / `npm run seed` 输出；仅 Demo）

## 用例与结果

| # | 步骤 | 结果 |
|---|------|------|
| 1 | `GET /health` | 200 `{"ok":true,"service":"forge-atoms"}` |
| 2 | 首页 / 注册 / 登录 | 200 / 302 会话 Cookie |
| 3 | 创建项目 | 302 → `/projects/:id`，SQLite 持久化 |
| 4 | 启动构建 | 时间线 4 条消息，status→ready，产物 Variant A |
| 5 | 预览 `/preview/:id/A/` | 200 HTML 着陆页 |
| 6 | 竞速生成 | variants 含 A,B；并排对比可用 |
| 7 | 选用 Variant B | `selected_variant=B` |
| 8 | 导出 ZIP | 200，含 index.html / about.html / README.md |
| 9 | 登录→构建→竞速→导出（本机） | 通过 |

## 已知限制

- 已接入 DeepSeek；网站在 API 失败时回退启发式；PPT 需 API。
- Session 默认密钥仅适合 Demo。


## DeepSeek + PPT（追加）

测试时间：2026-10-22（America/Chicago）

| # | 步骤 | 结果 |
|---|------|------|
| 1 | 环境存在 `DEEPSEEK_API_KEY`（不记录值） | 见自测脚本输出 hasKey=true |
| 2 | DeepSeek smoke `chat` | 成功返回文本 |
| 3 | 创建 PPT 项目「央视春晚回忆录」 | deliverable=ppt |
| 4 | 启动构建并轮询至 ready | ≤3 分钟 |
| 5 | `presentation.pptx` 存在且 >20KB | 见下方路径与大小 |
| 6 | `/projects/:id/download-pptx` | 200 application/pptx |
| 7 | 网站路径仍可用（回归） | 启发式/LLM 均可 |

产物：构建后于 `data/projects/<id>/A/presentation.pptx`（本地生成，不入库）  
大小：样例约 52KB（>20KB；含 14 页：封面+12 内容+封底）  
下载：`GET /projects/<id>/download-pptx` → 200  
构建轮询：researching → building → ready，约 18s；DeepSeek 四步消息齐全。  
网站回归：`夜跑伙伴` deliverable=web → ready，预览 200。

## 小游戏 + 多模态兜底（追加）

测试时间：2026-10-22（America/Chicago）

| # | 步骤 | 结果 |
|---|------|------|
| 1 | 创建「2048小游戏」并构建 | PASS：deliverable=game，preview 含 game-root/keydown，~7KB |
| 2 | 创建「生成一段春晚主题宣传视频」并构建 | PASS：原文「多模态模型API额度用尽，请及时充值」 |
| 3 | 贪吃蛇 + 俄罗斯方块 构建 | PASS：canvas / data-game 正确 |
| 4 | 网站 / PPT 路径 | 代码路由保留；本轮未重跑 PPT |

限制：游戏核心为本地模板；DeepSeek 仅主题文案/配色。视频音频无真实生成。

## 像素 UI + 素材库 + 拼贴（追加）

测试时间：2026-10-22（America/Chicago）

| # | 步骤 | 结果 |
|---|------|------|
| 1 | `app.css` 含 `--pixel` / `Press Start 2P` / earthy greens | 通过 |
| 2 | `data/assets/manifest.json` 条目数 | 48（每类 8） |
| 3 | `GET /assets-library` | 200 画廊 |
| 4 | `GET /assets/trees/tree_oak_01.png` | 200 PNG |
| 5 | 图片交付构建 → `poster.png` | 通过（见脚本） |
| 6 | PPT 构建含 collage 封面 | 通过或见脚本 |
| 7 | 小游戏 / 多模态兜底文案未改 | 保留 |

实测补充：
- 样例图片项目在本机构建成功（农场丰收节海报）→ ready + poster.png 34473 bytes
- Library / CSS / static PNG 均 200
