# AGENTS.md

> Guidance for AI coding agents (and humans) working in the **PaperFlow** repository.
> Keep this file up to date whenever commands, structure, or conventions change.

---

## 1. What PaperFlow Is

PaperFlow is an **educational** project that teaches children how workflow
orchestration works, using **Apache Airflow** as the intended runtime and a
**Raspberry Pi IoT** device as the physical world.

Motto: **"Draw it. Airflow runs it. The physical world responds."**

There is one kid-facing way to build a workflow:

1. **Visual builder (`airflow/plugins/paperflow/ui/`)** — a React Flow canvas where
   sensor/LED/task nodes are placed and connected into a DAG, plus a Blockly
   editor that turns blocks into **Python** code.

The generated workflow is meant to run in Airflow and eventually drive
**Raspberry Pi** sensors (temperature, humidity) and LEDs (red / green / yellow).

> ⚠️ **Airflow is local-only and minimal.** The old Docker Compose stack was
> deleted and is **not** how Airflow runs anymore. Orchestration now lives in
> `airflow/` as a `uv`-managed Airflow 3.3.2 project (LocalExecutor + SQLite) —
> no containers, no Postgres. It holds a single mock DAG
> (`airflow/dags/paperflow_dag.py`) plus the `paperflow` plugin that serves the
> builder UI at `/paperflow/`. There is still **no IR → DAG generator**.

---

## 2. Repository Map

```
paperflow/
├── api/                    # FastAPI "PaperFlow IoT API"
│   ├── main.py             # /, /health, /iot, /iot/sensor, /iot/buttons, /iot/led/{color}, /iot/stream
│   ├── mqtt_bridge.py      # paho subscriber + last-value cache for Pi telemetry
│   ├── requirements.txt
│   └── README.md
├── airflow/                # uv-managed Airflow 3.3.2 (LocalExecutor + SQLite)
│   ├── pyproject.toml      # dependencies: apache-airflow==3.3.2
│   ├── uv.lock             # resolved/pinned environment
│   ├── constraints.txt     # official constraints-3.3.2 for py3.12
│   ├── .python-version     # 3.12
│   ├── README.md           # setup/run commands
│   ├── dags/               # paperflow_dag.py (mock branch), led_sensor_demo.py (real IoT via api/), llm_ai_demo.py (common.ai / OpenAI-spec), auto_generate_dag.py (custom tool), hitl_approval_demo.py
│   └── plugins/
│       ├── .airflowignore      # prunes node_modules/dist from plugin scan
│       └── paperflow/
│           ├── paperflow.py    # AirflowPlugin: serves UI at /paperflow/
│           └── ui/             # Vite 8 + React 19 + TS + Tailwind v4
│               ├── index.html
│               ├── vite.config.ts   # base './', outDir dist
│               ├── src/
│               │   ├── main.tsx            # react-router: / -> Builder, /wiring -> Wiring
│               │   ├── pages/Builder.tsx   # React Flow + Blockly split view
│               │   ├── pages/Wiring.tsx    # Pi/breadboard canvas + live API log sidebar
│               │   ├── blocks/             # custom blocks + Python generators
│               │   ├── components/BlocklyEditor.tsx
│               │   ├── nodes/              # CardNode.tsx, ImageNode.tsx
│               │   ├── index.css           # Tailwind + Notion tokens
│               │   └── assets/
│               ├── public/     # sensor/LED PNGs, favicon, icons.svg
│               └── dist/       # build output — gitignored
├── blockly_dags/           # builder output awaiting agent conversion (POST /save target)
├── graphify-out/           # generated code-graph output (untracked artifact)
├── AGENTS.md               # this file
├── DESIGN.md               # token palette + landing-page spec
├── PLAN.md                 # roadmap (⚠️ gitignored — see note below)
├── README.md               # stub, currently stale (see §9)
├── .env.example            # central config template (tracked)
└── .env                    # your config, gitignored — `cp .env.example .env`
```

> ⚠️ `PLAN.md` is listed in `.gitignore`. Do **not** overwrite it destructively;
> it holds the full product plan. Append or update in place.

> ⚠️ `dags/` and the builder UI both live **inside `airflow/`** —
> `airflow/dags/` and `airflow/plugins/paperflow/ui/`. There is no repo-root
> `dags/` or `ui/`, and no Docker Compose stack — do not reintroduce one.

---

## 3. Running Things

### Builder UI — `airflow/plugins/paperflow/ui/`

The UI ships as an Airflow plugin, so Airflow serves the **built** bundle, not
the sources. To work on it in isolation:

```bash
cd airflow/plugins/paperflow/ui
npm install
npm run dev        # http://localhost:5173
npm run lint       # oxlint
npm run build      # tsc -b && vite build
```

**Always run `npm run lint` and `npm run build` before considering UI work
done** — editing `src/` alone changes nothing until you rebuild and restart
Airflow.

### IoT API — `api/`

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py                # or: uvicorn main:app --reload --port 8000
```

Configuration comes from the repo-root `.env`, which `main.py` loads explicitly.

Interactive docs: `http://localhost:8000/docs`. Endpoints: `GET /` (welcome),
`GET /health` (MQTT connectivity), `GET /iot` (combined sensor + button snapshot),
`GET /iot/sensor` (latest `temp`/`humid` from `paperflow/sensor`),
`GET /iot/buttons`, `GET /iot/leds` (last commanded LED state),
`POST /iot/led/{color}` (publishes `on=true`/`on=false` to
`paperflow/actuator/{color}`), `POST /iot/button` (publishes a press/release as the
Pi would **and triggers the newest DAG in `airflow/dags/`**), `GET /iot/stream` (SSE push of every reading,
consumed by the builder's Wiring page), and `POST /save` (the builder writes its
generated Python into repo-root `blockly_dags/`, then triggers the
`auto_generate_dag` DAG via the Airflow API so the agent converts it).

`mqtt_bridge.py` runs one paho client with the app's lifespan (started in
`main.py`), subscribing to `paperflow/sensor` and `paperflow/sensor/buttons` and
caching only the latest message in memory; the `/iot/*` endpoints read that cache.
Topics and payloads mirror `mqtt/raspi.py` on the Pi. Run a **single** API process
(no `--workers`) — each worker would hold its own MQTT connection and cache.
Requires `paho-mqtt` (see `api/requirements.txt`).

### Airflow — `airflow/`

`uv`-managed Airflow 3.3.2 on SQLite with LocalExecutor. This directory **is**
`AIRFLOW_HOME`, so export it before every command:

```bash
cd airflow
uv sync                       # create/refresh .venv from uv.lock

export AIRFLOW_HOME="$PWD"
uv run airflow db migrate     # initialise/upgrade the SQLite metadata DB
uv run airflow standalone     # UI + scheduler + dag-processor; prints admin password
```

Airflow UI: `http://localhost:8080`; the builder is served by the plugin at
**`http://localhost:8080/paperflow/`** (also linked in the Airflow nav). To
verify a DAG change end-to-end:
`uv run airflow dags test paperflow_demo 2025-01-01`.

---

## 4. Builder UI (`airflow/plugins/paperflow/ui/`) — Read Before Editing

The builder is an Airflow **plugin**, not a standalone site: Vite builds it and
`plugins/paperflow/paperflow.py` serves `dist/` at `/paperflow/`.

**Stack:** Vite 8, React 19, TypeScript 6, Tailwind CSS v4 (via
`@tailwindcss/vite`), `@xyflow/react` (React Flow v12), `blockly` v13, `react-router-dom` v7, oxlint.

Routing lives in `src/main.tsx`: `/` renders `pages/Builder.tsx`, `/wiring` renders
`pages/Wiring.tsx`. The Wiring page is a **read-only React Flow canvas** (Pi +
breadboard image nodes, the 24 red hotspot boxes, 13 red wire edges and 4 LED/
sensor illustrations copied from `airflow/position.svg` — the wire endpoints snap
to the nearest contact block) with a right sidebar
that streams `GET /iot/stream` (SSE) from the IoT API into a live log. The API
base defaults to `http://localhost:8000`
and can be overridden with the `VITE_API_BASE` env var at build time.

**`src/pages/Builder.tsx`**:
- A vertical split: React Flow canvas on top, Blockly editor on the bottom,
  separated by a draggable splitter that resizes the Blockly pane (clamped).
- A React Flow `<Panel position="top-left">` control panel containing:
  - a text input + **+ Add Card** (adds a `card` node with custom label),
  - a **Components** palette of `public/` sensor/LED images,
  - a **light/dark** theme toggle.
- Canvas is wrapped in `ReactFlowProvider`; the inner `Flow` component uses
  `useReactFlow()` for `screenToFlowPosition`.
- `AVAILABLE_IMAGES` (the sensor/LED palette list) is declared in this file.

**State / React Flow patterns**
- `useNodesState` / `useEdgesState` + `onNodesChange` / `onEdgesChange`;
  `onConnect` uses `addEdge`. (Passing `nodes`/`edges` without these handlers
  makes React Flow controlled and nodes won't drag/connect.)
- Node ids are generated with `crypto.randomUUID()`.
- Custom node types are registered once at module scope: `nodeTypes = { card, image }`.
- Handles are vertical: `target` on top, `source` on bottom, so the graph flows down.
- The palette enforces **one node per image** (`data.src`): already-placed images
  are `disabled` with `opacity-50`; delete a node to re-enable it.
- Initial layout: sensors in the left column, LEDs in the right column,
  rows at `COLUMN_GAP = 240`.

**`src/components/BlocklyEditor.tsx`**
- Custom blocks live in `src/blocks/*.ts` (JSON definition via
  `Blockly.defineBlocksWithJsonArray` + `pythonGenerator.forBlock` generator)
  and are imported here so they register before the toolbox renders.
- `Blockly.inject(...)` into a div; `workspace.dispose()` on cleanup.
- A `ResizeObserver` + `window` resize listener call `Blockly.svgResize`.
- Left/right split: workspace on the left, **Python** output on the right
  (`pythonGenerator.workspaceToCode`), updated via `workspace.addChangeListener`.
- The code pane width is resizable through a `--code-width` CSS variable
  (Tailwind arbitrary value `md:w-(--code-width)`).

**Styling**
- Tailwind v4 is CSS-first: **no `tailwind.config.js`**. Theme lives in
  `src/index.css`, which registers the `DESIGN.md` token palette as Tailwind
  `@theme` variables — e.g. `bg-brand-navy`, `bg-primary`, `text-on-dark`,
  `text-on-dark-muted`, `bg-canvas`, plus the brand spectrum
  (`bg-brand-pink`, `-orange`, `-purple`, `-teal`, `-green`, `-yellow`, …).
- Dark mode is **class-based**: `@custom-variant dark (&:where(.dark, .dark *))`,
  toggled by adding/removing `.dark` on `<html>`. React Flow controls/minimap
  dark styles are also set there.

---

## 5. Conventions

- **TypeScript + oxlint.** Keep `npm run lint` and `npm run build` green.
- Match existing file/component patterns; prefer small, typed components.
- **No code comments unless requested.**
- Keep user-facing copy simple and kid-friendly.
- Public images are plain **relative** URLs from `public/` — `temp-sensor.png`,
  **no leading slash**, or they 404 under the `/paperflow/` plugin subpath. Node
  images are declared in `AVAILABLE_IMAGES` in
  `airflow/plugins/paperflow/ui/src/pages/Builder.tsx`.
- `api/` is deliberately flat (no package): `main.py` imports `mqtt_bridge`
  directly, so run it from inside `api/`.

---

## 6. Known Gotchas

- **Blockly is large** (~1.4 MB minified, ~400 kB gzipped) and is now the whole
  app, so the build always prints a chunk-size warning — expected.
- **The plugin serves a prebuilt bundle**: editing anything under
  `plugins/paperflow/ui/src` does nothing until you re-run `npm run build` and
  restart Airflow. With no `dist/`, `/paperflow/` returns HTTP 404 plus a build
  hint.
- **Keep asset URLs relative.** `vite.config.ts` sets `base: './'` and images are
  referenced without a leading slash, so everything resolves under `/paperflow/`.
  A leading `/` points at Airflow's own root and 404s.
- **`plugins/.airflowignore` is load-bearing**: Airflow's plugin loader walks the
  plugins folder, and without that file it descends into `node_modules/`
  (~4.7k files), roughly doubling CLI/startup time.
- **Plugin FastAPI routes are not authenticated by Airflow** (per the official
  docs) — whatever a plugin mounts is reachable anonymously. Fine for local
  teaching use; not something to expose publicly as-is.
- React Flow ignores `Backspace`/`Delete` while focus is in an input, so the
  card-text field is safe; `deleteKeyCode={['Backspace', 'Delete']}` is set.
- Images must be referenced by URL from `public/`; putting them in `src/assets`
  requires imports instead. (Note: Tailwind's `bg-primary`-style utilities are
  `@theme`-generated, not class names you can invent.)
- **Blockly v13 generator API:** import `{ Order, pythonGenerator }` from
  `blockly/python` — order constants are on the `Order` enum
  (e.g. `Order.FUNCTION_CALL`), not `generator.ORDER_*`. Use
  `pythonGenerator.provideFunction_(name, codeLines)` to emit helper function
  definitions (like `read_humidity`) alongside generated code.
- **Airflow lives in `airflow/` and is uv-managed**: `export AIRFLOW_HOME="$PWD"`
  from inside that directory before any `airflow` command. `airflow.cfg`,
  `airflow.db`, and `logs/` are generated there and gitignored — `airflow.cfg`
  embeds an absolute `dags_folder`, so it must never be committed.
- **The repo drive is NTFS (`fuseblk`), so Airflow's default log path breaks every
  task.** Airflow names task-log directories after the run id
  (`.../run_id=manual__2026-09-21T14:54:54.703791+00:00/task_id=.../attempt=1.log`),
  and NTFS rejects `:` in filenames — `mkdir` fails with `Invalid argument`, no log
  file is written, and the task dies with `FileNotFoundError` before running. The
  UI only shows the confusing side effect: *"Could not read served logs: Hostname
  not available for worker"* (the TI's `hostname` is empty because the task never
  started). Keep `[logging] base_log_folder` **and**
  `[logging] dag_processor_child_process_log_directory` on a Linux filesystem
  (`/home/diosamuel/paperflow-airflow-logs` in this repo).
- **`airflow dags list` reads the DB, not the folder.** The dag-processor
  serializes DAGs, so without `airflow standalone` running the list is empty even
  though `DagBag` can happily parse the file.
- **Airflow 3 TaskFlow imports come from `airflow.sdk`** —
  `from airflow.sdk import dag, task`. `airflow.decorators` still works but emits
  deprecation warnings.
- **Pass `-c constraints.txt` when adding Airflow dependencies**
  (`uv add -c constraints.txt ...`), or the environment drifts off the tested
  Airflow 3.3.2 release.
- **Config is centralised in the repo-root `.env`** (template `.env.example`).
  `api/main.py` loads it explicitly and Vite reads it via `envDir`, so both work
  regardless of the working directory. **Airflow does not load `.env`** — DAGs
  read `PAPERFLOW_*` from the process env, so run `set -a; source .env; set +a`
  before `airflow standalone` to override the built-in defaults.
- The repo has been through a teardown: `graphify-out/` is a generated artifact,
  and the root `README.md` still documents the old Airflow commands (see §9).

---

## 7. Where to Extend (mapped to product goals)

| Goal | Where |
|------|-------|
| Add a hardware component (new sensor/LED) | Drop PNG in `plugins/paperflow/ui/public/`, add to `AVAILABLE_IMAGES` in `plugins/paperflow/ui/src/pages/Builder.tsx` |
| New custom node look/behavior | `plugins/paperflow/ui/src/nodes/*.tsx` |
| New Blockly block / category | `plugins/paperflow/ui/src/blocks/*.ts` (register block + `pythonGenerator.forBlock`), then add to the toolbox in `plugins/paperflow/ui/src/components/BlocklyEditor.tsx` |
| Change what the plugin serves / its nav entry | `plugins/paperflow/paperflow.py` |
| Blocks → Airflow tasks | Greenfield: build the IR → DAG generator (`PLAN.md` Part I §4/§8), writing into `airflow/dags/` |
| Add / edit a DAG | `airflow/dags/*.py` — Airflow 3 TaskFlow (`airflow.sdk`), camelCase names |
| Run/trigger a DAG from the UI | Airflow API at `http://localhost:8080` while `airflow standalone` runs |
| Raspberry Pi telemetry / actuators | `api/main.py` `GET /iot/sensor`, `POST /iot/led/{color}`; MQTT topics in `PLAN.md` §9 |

---

## 8. Verification Checklist

- **UI:** `cd airflow/plugins/paperflow/ui && npm run lint && npm run build`.
- **Plugin:** with Airflow running, `curl -I http://localhost:8080/paperflow/`
  should return 200 — and 404 with a build hint when `dist/` is missing.
- **API:** start it, then `curl http://localhost:8000/health`.
- **Airflow:** `cd airflow && export AIRFLOW_HOME="$PWD"`, then
  `uv run airflow dags test paperflow_demo 2025-01-01`.

There are currently **no automated tests** (no `tests/` yet). Prefer adding
pytest tests for Python logic and, if UI logic grows, a test runner for the
plugin UI.

---

## 9. Current Status & Gaps

**Done:** FastAPI IoT API (`api/`); local Airflow 3.3.2 project in
`airflow/` (uv-managed, LocalExecutor + SQLite) with a verified mock branch DAG;
the builder packaged as the `paperflow` Airflow plugin and served at
`/paperflow/` — React Flow canvas with custom nodes, dedupe, dark mode,
resizable splits; Blockly → Python output.

**Removed — do not resurrect:** the old Docker Compose stack
(`docker-compose.yaml`: Airflow 3.3.1 + PostgreSQL 16) along with `config/`,
repo-root `dags/`, `plugins/`, and `logs/`. The `apache/airflow:3.3.1` image and
`paperflow_postgres-db-volume` were deleted too. Superseded by `airflow/`;
history is in git (`b66541a`) if the old `vision_api_daily_dag.py` is needed.

**Missing / next:**
- No Workflow IR: the paper/IR design in `PLAN.md` Part I is unimplemented. The
  canvas → real-DAG bridge exists without one, as `airflow/dags/auto_generate_dag.py`
  (reads the newest `blockly_dags/*.py`, has the LLM agent rewrite it behind
  checkAST/compilePython/checkDAGValid, then — after a human `ApprovalOperator`
  gate — writes `airflow/dags/blockly_<id>.py`). The UI only saves the source; it
  does not trigger that DAG.
- `airflow/dags/paperflow_dag.py` is a self-contained mock; `PLAN.md` Phase 1
  will move that logic into `src/paperflow/`.
- Blockly toolbox is minimal; not yet mapped to Airflow task types.
- Raspberry Pi telemetry reaches `api/` over MQTT (`paperflow/sensor`) into an
  in-memory cache read by `/iot/*`; no Airflow DAG consumes it yet and the broker
  is the public `broker.mqtt.cool` (no auth).
- `src/paperflow/` (rules, sensors, IR, generator) from `PLAN.md` Part I is not
  implemented yet.
- No `tests/` and no UI unit tests.
- The react-router landing page was dropped when the UI moved into the plugin;
  `DESIGN.md` still specifies it if it is ever restored.
