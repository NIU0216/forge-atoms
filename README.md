# ForgeAtoms

Open-source demo inspired by [atoms.dev](https://atoms.dev/): turn an idea into a runnable deliverable with a multi-agent pipeline (research → product → architecture → engineering).

**Features**

- Register / login with SQLite persistence (sessions + hashed passwords)
- Deliverables: landing page (web), PPTX (DeepSeek), playable mini-games (2048 / Snake / Tetris), pixel collage posters
- Stardew-like pixel UI + 48-asset library (characters, trees, flora, fruit, food, scenes)
- Race A/B variants, ZIP export, public source browser (redacts secrets)
- Video / audio requests show a multimodal quota fallback page (no real multimodal call)

## Quick start

```bash
git clone <your-repo-url> forge-atoms
cd forge-atoms
cp .env.example .env
# Edit .env — set DEEPSEEK_API_KEY (required for PPT / LLM theming)
npm install
npm run seed
npm start
```

Open http://127.0.0.1:3847/

`npm run seed` creates a **demo-only** account for local testing. Credentials are printed by the seed script and live in `src/seed.js` (not for production).

Optional: `bash scripts/restart-all.sh` restarts the app and (if `cloudflared` is installed) a temporary public Quick Tunnel. The tunnel URL is written to `DEPLOY_URL.txt` (gitignored).

## Environment

| Variable | Purpose |
|----------|---------|
| `DEEPSEEK_API_KEY` | DeepSeek Chat API key (never commit this) |
| `DEEPSEEK_BASE_URL` | Default `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | Default `deepseek-chat` |
| `SESSION_SECRET` | Express session secret — change in production |
| `PORT` | Default `3847` |

## Security

- **Never commit** `.env`, API keys, SQLite databases, or generated `data/projects/*` outputs.
- Code only reads `process.env.DEEPSEEK_API_KEY`; no key values belong in the repo.
- Rotate any key that may have been pasted into a shell history or chat.

## Docs

- [Technical](docs/TECHNICAL.md)
- [User manual](docs/USER_MANUAL.md)
- [Test notes](docs/TEST_NOTES.md)

## License

Demo / educational use. Add a license of your choice before publishing widely.
