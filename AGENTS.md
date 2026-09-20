# AGENTS.md

> Guidance for AI coding agents (and humans) working in the **PaperFlow** repository.
> Keep this file up to date whenever commands, structure, or conventions change.

---

## 1. What PaperFlow Is

PaperFlow is an **educational** project that teaches children how workflow
orchestration works, using **Apache Airflow** as the intended runtime and a
**Raspberry Pi IoT** device as the physical world.

Motto: **"Draw it. Airflow runs it. The physical world responds."**

There are two kid-facing ways to build a workflow. Both are intended to converge
on the **same Intermediate Representation (IR)** and therefore the same Airflow DAG:

1. **Visual builder (primary, `ui/`)** — a React Flow canvas where sensor/LED/card
   nodes are placed and connected into a DAG, plus a Blockly editor that turns
   blocks into **Python** code.
2. **Paper + Gemini vision (`api/`)** — a photo of a drawn paper template is
   analyzed by Gemini Vision to extract a workflow.

The generated workflow is meant to run in Airflow and eventually drive
**Raspberry Pi** sensors (temperature, humidity, soil) and LEDs
(red / blue / green).

> ⚠️ **Airflow is local-only and minimal.** The old Docker Compose stack was
> deleted and is **not** how Airflow runs anymore. Orchestration now lives in
> `airflow/` as a `uv`-managed Airflow 3.3.2 project (LocalExecutor + SQLite) —
> no containers, no Postgres. It holds a single mock DAG
> (`airflow/dags/paperflow_dag.py`); there is still **no IR → DAG generator** and
> nothing bridging the UI to Airflow.

---

## 2. Repository Map

```
paperflow/
├── api/                    # FastAPI "PaperFlow Vision API"
│   ├── main.py             # /, /health, /iot (placeholder), /upload
│   ├── gemini_service.py   # Gemini Vision call (google-genai, fallback SDK)
│   ├── requirements.txt
│   ├── README.md
│   └── .env.example
├── ui/                     # Vite 8 + React 19 + TS + Tailwind v4 frontend
│   ├── src/
│   │   ├── App.tsx             # router: `/` landing, `/builder` (lazy-loaded)
│   │   ├── pages/
│   │   │   ├── Landing.tsx     # Notion-style jumbotron hero (see DESIGN.md)
│   │   │   └── Builder.tsx     # split view: React Flow (top) + Blockly (bottom)
│   │   │                       #   + AVAILABLE_IMAGES palette
│   │   ├── blocks/
│   │   │   ├── createVariable.ts # custom "Create Variable" block + Python gen
│   │   │   └── humiditySensor.ts # custom "Humidity Sensor" block + Python gen
│   │   ├── components/
│   │   │   └── BlocklyEditor.tsx  # Blockly workspace + Python output
│   │   ├── nodes/
│   │   │   ├── CardNode.tsx       # generic labeled node
│   │   │   └── ImageNode.tsx      # image node (sensors / LEDs)
│   │   ├── assets/                # paperflow.svg, vite.svg
│   │   ├── index.css              # Tailwind import + dark variant + Notion tokens
│   │   └── main.tsx
│   └── public/                    # img assets served at "/"
│       ├── temp-sensor.png  humid-sensor.png  soil-sensor.png
│       └── red-led.png      blue-led.png      green-led.png
├── airflow/                # uv-managed Airflow 3.3.2 (LocalExecutor + SQLite)
│   ├── pyproject.toml      # dependencies: apache-airflow==3.3.2
│   ├── uv.lock             # resolved/pinned environment
│   ├── constraints.txt     # official constraints-3.3.2 for py3.12
│   ├── .python-version     # 3.12
│   ├── dags/paperflow_dag.py  # mock sensor → rule → branch DAG
│   └── README.md           # setup/run commands
├── graphify-out/           # generated code-graph output (untracked artifact)
├── AGENTS.md               # this file
├── DESIGN.md               # token palette + landing-page spec
├── PLAN.md                 # roadmap (⚠️ gitignored — see note below)
├── README.md               # stub, currently stale (see §9)
└── .env                    # leftover `AIRFLOW_UID=1000` (gitignored — see §6)
```

> ⚠️ `PLAN.md` is listed in `.gitignore`. Do **not** overwrite it destructively;
> it holds the full product plan. Append or update in place.

> ⚠️ `dags/` exists **only inside `airflow/`** (`airflow/dags/`). There is no
> repo-root `dags/`, and no Docker Compose stack — do not reintroduce one.

---

## 3. Running Things

### Frontend — `ui/`

```bash
cd ui
npm install
npm run dev        # http://localhost:5173
npm run lint       # oxlint
npm run build      # tsc -b && vite build
npm run preview    # preview production build
```

**Always run `npm run lint` and `npm run build` before considering UI work done.**

### Vision API — `api/`

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set GEMINI_API_KEY
python main.py                # or: uvicorn main:app --reload --port 8000
```

Interactive docs: `http://localhost:8000/docs`. Endpoints: `GET /` (welcome),
`GET /health` (reports whether `GEMINI_API_KEY` is configured and the default
model), `POST /upload` (multipart `file`, optional `prompt` form field),
`GET /iot` (placeholder).

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

UI: `http://localhost:8080`. To verify a DAG change end-to-end:
`uv run airflow dags test paperflow_demo 2025-01-01`.

---

## 4. Frontend Architecture (`ui/`) — Read Before Editing

**Stack:** Vite 8, React 19, TypeScript 6, Tailwind CSS v4 (via
`@tailwindcss/vite`), `@xyflow/react` (React Flow v12), `blockly` v13,
`react-router-dom`, oxlint.

**`src/App.tsx`** — route shell only. `BrowserRouter` with two routes:
`/` → `pages/Landing.tsx`, `/builder` → `pages/Builder.tsx` loaded via
`React.lazy` so the ~1 MB Blockly bundle never blocks the landing page.

**`src/pages/Landing.tsx`** — a single Notion-style jumbotron following
`DESIGN.md`: deep navy hero band (`bg-brand-navy`), centered hero-display
headline (responsive 36 → 48 → 56 → 80 px), purple primary CTA
("Start building" → `/builder`), outlined secondary-on-dark ("View on
GitHub"), and scattered sticky-note dots in brand colors (desktop only).

**`src/pages/Builder.tsx`** — formerly `App.tsx`; unchanged in behavior:
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
- Public images are plain `<img src="/name.png">` (absolute URL from `public/`),
  not imports. Node images are declared in `AVAILABLE_IMAGES` in
  `ui/src/pages/Builder.tsx`.
- `api/` is deliberately flat (no package): `main.py` imports `gemini_service`
  directly, so run it from inside `api/`.

---

## 6. Known Gotchas

- **Blockly is large** (~1.1 MB minified); it is isolated in the
  `/builder` route via `React.lazy`, so the landing page stays light
  (262 kB gzipped 84 kB). The build still prints a chunk-size warning for the
  Builder chunk — expected.
- React Flow ignores `Backspace`/`Delete` while focus is in an input, so the
  card-text field is safe; `deleteKeyCode={['Backspace', 'Delete']}` is set.
- Images must be referenced by URL from `public/`; putting them in `src/assets`
  requires imports instead. (Note: Tailwind's `bg-primary`-style utilities are
  `@theme`-generated, not class names you can invent.)
- `api/main.py` uses `load_dotenv()` and returns HTTP 500 from `/upload` if
  `GEMINI_API_KEY` is unset/"your_gemini_api_key_here"; `GET /health` tells you
  whether the key is configured.
- **Blockly v13 generator API:** import `{ Order, pythonGenerator }` from
  `blockly/python` — order constants are on the `Order` enum
  (e.g. `Order.FUNCTION_CALL`), not `generator.ORDER_*`. Use
  `pythonGenerator.provideFunction_(name, codeLines)` to emit helper function
  definitions (like `read_humidity`) alongside generated code.
- **Airflow lives in `airflow/` and is uv-managed**: `export AIRFLOW_HOME="$PWD"`
  from inside that directory before any `airflow` command. `airflow.cfg`,
  `airflow.db`, and `logs/` are generated there and gitignored — `airflow.cfg`
  embeds an absolute `dags_folder`, so it must never be committed.
- **`airflow dags list` reads the DB, not the folder.** The dag-processor
  serializes DAGs, so without `airflow standalone` running the list is empty even
  though `DagBag` can happily parse the file.
- **Airflow 3 TaskFlow imports come from `airflow.sdk`** —
  `from airflow.sdk import dag, task`. `airflow.decorators` still works but emits
  deprecation warnings.
- **Pass `-c constraints.txt` when adding Airflow dependencies**
  (`uv add -c constraints.txt ...`), or the environment drifts off the tested
  Airflow 3.3.2 release.
- **Root `.env` is a leftover** (`AIRFLOW_UID=1000`) from the removed compose
  stack; nothing reads it now. It is gitignored, so it is safe to delete.
- The repo has been through a teardown: `graphify-out/` is a generated artifact,
  and the root `README.md` still documents the old Airflow commands (see §9).

---

## 7. Where to Extend (mapped to product goals)

| Goal | Where |
|------|-------|
| Add a hardware component (new sensor/LED) | Drop PNG in `ui/public/`, add to `AVAILABLE_IMAGES` in `ui/src/pages/Builder.tsx` |
| New custom node look/behavior | `ui/src/nodes/*.tsx` |
| New Blockly block / category | `ui/src/blocks/*.ts` (register block + `pythonGenerator.forBlock`), then add to the toolbox in `ui/src/components/BlocklyEditor.tsx` |
| Blocks → Airflow tasks | Greenfield: build the IR → DAG generator (`PLAN.md` Part I §4/§8), writing into `airflow/dags/` |
| Add / edit a DAG | `airflow/dags/*.py` — Airflow 3 TaskFlow (`airflow.sdk`), camelCase names |
| Run/trigger a DAG from the UI | Airflow API at `http://localhost:8080` while `airflow standalone` runs |
| Raspberry Pi telemetry / actuators | `api/main.py` `GET /iot`; MQTT topics in `PLAN.md` §9 |
| Paper-recognition path | `api/` (Gemini Vision) — no DAG consumes it yet; that consumer still has to be written |

---

## 8. Verification Checklist

- **UI:** `cd ui && npm run lint && npm run build`.
- **API:** start it, then `curl http://localhost:8000/health`.
- **Airflow:** `cd airflow && export AIRFLOW_HOME="$PWD"`, then
  `uv run airflow dags test paperflow_demo 2025-01-01`.

There are currently **no automated tests** (no `tests/` yet). Prefer adding
pytest tests for Python logic and, if UI logic grows, a test runner for `ui/`.

---

## 9. Current Status & Gaps

**Done:** FastAPI vision service (`api/`); `ui/` Notion-style landing page;
React Flow canvas with custom nodes, dedupe, dark mode, resizable splits;
Blockly → Python output; local Airflow 3.3.2 project in `airflow/` (uv-managed,
LocalExecutor + SQLite) with a verified mock branch DAG.

**Removed — do not resurrect:** the old Docker Compose stack
(`docker-compose.yaml`: Airflow 3.3.1 + PostgreSQL 16) along with `config/`,
repo-root `dags/`, `plugins/`, and `logs/`. The `apache/airflow:3.3.1` image and
`paperflow_postgres-db-volume` were deleted too. Superseded by `airflow/`;
history is in git (`b66541a`) if the old `vision_api_daily_dag.py` is needed.

**Missing / next:**
- No IR → DAG generator: nothing bridges the UI canvas/Blockly output to Airflow.
- `airflow/dags/paperflow_dag.py` is a self-contained mock; `PLAN.md` Phase 1
  will move that logic into `src/paperflow/`.
- Blockly toolbox is minimal; not yet mapped to Airflow task types.
- Raspberry Pi integration is a placeholder (`GET /iot`), no MQTT broker yet.
- `src/paperflow/` (rules, sensors, IR, generator) from `PLAN.md` Part I is not
  implemented yet.
- No `tests/` and no `ui` unit tests.
- Root `README.md` is a stale stub listing old Airflow commands — worth
  replacing with real setup instructions.
