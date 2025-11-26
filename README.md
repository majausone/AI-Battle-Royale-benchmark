# AI Battle Royale Benchmark

Web dashboard + Node backend that runs a battle royale benchmark between LLM-powered agents. Each AI service designs units, rebalances their prices, buys armies and fights inside a canvas renderer. The backend (`server.js`) serves the SPA in `public/`, exposes REST endpoints for every subsystem, stores everything in SQLite (`kewo_battle.db`) and talks to Claude, DeepSeek, Gemini, Grok, Kimi, OpenAI or any custom endpoint through HTTP and Socket.IO.

## Requirements
- Node.js (ESM enabled; `"type": "module"` in `package.json`).
- npm to install `express`, `socket.io`, `sqlite3`, etc.
- API keys for the AI services you plan to benchmark.
- Nothing else: SQLite is file-based and auto-created when you start the server.

## Quick start
1. `npm install`
2. Copy `example.env` to `.env` and set `ENCRYPTION_KEY` (>= 32 chars). Without it, `database.js` aborts because API keys are AES-256-CBC encrypted before landing in `ai_services`.
3. `npm start` (or `npm run dev` for hot reload) and browse `http://localhost:3000`. The server listens on port `3000` (`server.js`).

## Configuring the benchmark (UI flow)
1. **Config ➜ AI Services (`public/config-tab.js`)**
   - Edit the seeded services or click **Add Service**. For every entry you need:
     - `Service Type`: drives the payload that `aiPromptRoutes.js`/`socketHandlers.js` will send (`claude`, `chatgpt`, `deepseek`, `gemini`, `grok`, `moonshot`, `custom`).
     - `Endpoint URL`: optional override; `custom` requires it explicitly.
     - `API Key` and `Model Name`: they are stored encrypted through `/api/config2/ai-services`.
     - Feature toggles:
       - **Thinking Mode** for Claude (`thinking` → `service.is_thinking`) when you run long-form “reasoners” like `claude-3-5-sonnet`.
       - **Reasoning Model** for OpenAI (`reasoning` → switches to `/v1/responses` + `reasoning: { effort: "high" }` for any `o3-*` model).
       - **Mirror Mode** for DeepSeek (enables the official `mirror` flag).
     - `Test Connection` posts to `/api/ai/test` (`aiTestRoutes.js`) and fires a minimal prompt to verify credentials.
   - The upper half of this tab saves display settings (`display_settings` table): FPS counter, units counter, game-speed indicator, volume (`setVolume`), game speed, and map/rain/snow toggles.

2. **Teams tab (`public/teams-tab.js`)**
   - Set `Initial Gold`, `Number of Rounds`, `Units Number`, and `Prompt Mode` (normal/crazy/boss). Those fields live in `game_settings` and are injected into the base prompt `public/promt-resquest-unit.txt`.
   - Add teams via `/api/config2/teams/add`, pick a color, and keep only the squads you want available.
   - For each team add its AI agents and assign one of the configured services. Every agent lets you:
     - Decide which units they can purchase (`ai_available_units` via the UI toggles).
     - Persist their purchases (`ai_purchased_units`) so rematches reuse them.

3. **Game tab (`public/round-tab.js`)**
   - Press **Start Match** to call `/api/matches/create`. The `matchProcessPopup` drives the entire benchmark loop:
     1. **Request Units** loads `public/promt-resquest-unit.txt`, adds crazy/boss suffixes when needed and emits `requestUnits` through Socket.IO. Each LLM must answer using `// unit-*.json`, `// skill-*.js`, `// seffect-*.json` blocks. `socketHandlers.js` validates them, writes files under `public/units|skills|seffects|fx` and logs everything into `matches`, `match_participants`, `responses`, `files` and `prompt_metrics`.
     2. **Adapt Prices** feeds `public/prompt-adapt-prices.txt` to the services listed in `public/aiPrices.js`, which updates `/api/units/:id` so the market stays balanced.
     3. **Buy Units** loads `public/prompt-buy-units.txt` through `public/aiBuy.js`; each AI spends its starting gold and the purchases are persisted.
     4. **Battle** starts once the pipeline finishes. `roundControl.js` + `gameManager.js` + `gameState.js` run the simulation, `roundDataRoutes.js` syncs the scoreboards and `round_wins` tracks the win tally.
   - Separate buttons let you rerun any phase individually (request/adapt/buy). `testMode` + the “simple” toggles make everything run locally without hitting external APIs.

4. **Other tabs**
   - **Test Units**: edit JSON/JS assets under `public/units`, `public/skills`, `public/seffects`, `public/fx`.
   - **Stats (`public/stats-tab.js`)**: consumes `/api/stats/*` to show ranking tables, winrates, issues per service, unit throughput and prompt durations with date filters.
   - **Data (`public/data-tab.js`)**: paginated match history (`matches`, `match_participants`) with filters by AI/team and cleanup actions.
   - **Errors (`public/errors-tab.js`)**: streams `activeErrors` populated by `socketHandlers.js → reportValidationIssue` whenever malformed files/responses are detected.

## Headless & parallel benchmark runs
Everything the UI does is a REST or Socket.IO call, so you can drive the full loop headlessly and spawn multiple matches at once:

1. Start the server with `npm start` and configure services/teams via the existing endpoints (`/api/config2/ai-services`, `/api/config2/teams`, `/api/config2/game-settings`, etc.).
2. Create matches programmatically by POSTing to `/api/matches/create` (`statsRoutes.js`) and add participants through `/api/matches/:id/participants`.
3. Use any Socket.IO client to emit `requestUnits` or `requestUnitsForAI` with the `matchId` you created. `socketHandlers.js` builds a `tasks` array and runs `Promise.all(tasks)`, so every AI/service pair is prompted in parallel.
4. Kick off price adaptation and shopping by calling `/api/ai/prompt` directly (see `public/aiPrices.js` and `public/aiBuy.js` for the payload shape) or by emitting the same socket events they use.
5. Record wins with `/api/round-wins/ensure` + `/api/round-wins` and `/api/round-history`; finish matches via `/api/matches/:id/complete`.
6. Spin up multiple workers that follow the flow above: the DB schema tracks matches separately, and the Node process is stateless between requests, so you can benchmark many “headless battles” in parallel without rendering the canvas.
7. Need dummy data? Run `node test-match-creator.js`; it creates services, teams, matches, files and responses entirely off-screen for CI-style benchmarking.

Because SQLite writes are fast and the LLM calls dominate runtime, parallelizing the socket events is usually the best way to stress-test provider APIs or compare models without opening the UI.

## How it works internally
- **Express backend (`server.js`)**: wires every route module (`unitsRoutes`, `skillsRoutes`, `specialEffectsRoutes`, `fxRoutes`, `configRoutes`, `configHandlers`, `aiPromptRoutes`, `aiServiceConfigRoutes`, `gameSettingsRoutes`, `teamsRoutes`, `displaySettingsRoutes`, `roundDataRoutes`, `statsRoutes`, etc.) and serves `public/`. `middlewareSetup.js` enables CORS, large JSON bodies (50 MB) and static assets.
- **Socket workers (`socketHandlers.js`)**: own the `requestUnits`/`requestUnitsForAI` events, call provider-specific branches inside `callLLM`, parse the returned files, persist them and raise validation issues when needed. They also keep prompt duration metrics via `savePromptMetric`.
- **REST API surface**:
  - `/api/units`, `/api/skills`, `/api/seffects`, `/api/fx`: CRUD around the respective files.
  - `/api/config2/*`: syncs teams, services, display settings and round/meta data (`configHandlers.js`, `aiServiceConfigRoutes.js`, `gameSettingsRoutes.js`, `teamsRoutes.js`, `displaySettingsRoutes.js`, `roundDataRoutes.js`).
  - `/api/ai/prompt`: generic async prompt executor used by the UI (`aiSender.js`), price adapter (`aiPrices.js`) and buyer (`aiBuy.js`).
  - `/api/stats/*`: aggregations + pagination in `statsRoutes.js` to inspect matches, AIs, teams and prompt metrics.
- **Database (`database.js`)**: bootstraps the schema described in `database-schema.txt`, encrypts API keys with `crypto.scryptSync`, and exposes helpers such as `createMatch`, `addParticipantToMatch`, `incrementParticipantUnits`, `saveEvaluation`, `getRoundHistory`, `getDisplaySettings`, etc.
- **Frontend**: pure ES modules. `main.js` loads the game engine (`gameManager.js`, `render.js`, `characters.js`, `unitLoader.js`), orchestrates tabs (`tabs-manager.js`) and listens to socket events via `socketManager.js`.

## Prompt templates & automation
- `public/promt-resquest-unit.txt`: base prompt, receives `{{UNITS_NUMBER}}`, team name and prompt mode (normal/crazy/boss).
- `public/prompt-adapt-prices.txt`: price-balancing instructions; `aiPrices.js` injects full unit/skill/seffect metadata before sending it.
- `public/prompt-buy-units.txt`: describes the expected JSON (`{ "purchases": { "unitId": count, ... } }`). `aiBuy.js` parses and persists it.
Edit any of them to customize how units are generated, priced or purchased—the next benchmark run will pick them up automatically.

## npm scripts
- `npm start` → `node server.js`
- `npm run dev` → `nodemon server.js`

## Tips
- Keep `.env` out of version control; the encryption key decrypts every stored API key.
- Generated assets live in `public/units`, `public/skills`, `public/seffects`, `public/fx`. Track them in git if you want a history of LLM-created units.
- Use `node test-match-creator.js` to seed the DB for demos or CI smoke tests.
- There is no automated test suite. Validate changes by running `npm start`, spinning a match, and checking the Match Process popup plus the `Stats` / `Data` tabs and the server logs.
