# PaperFlow — Airflow

Local Apache Airflow **3.3.2** project for PaperFlow, install by `uv`, running
**LocalExecutor** against **SQLite**. No Docker required.

## Layout

```
airflow/
├── pyproject.toml      # deps (apache-airflow==3.3.2) + requires-python
├── uv.lock             # resolved/pinned environments
├── constraints.txt     # Airflow official constraints (constraints-3.3.2)
├── dags/               # DAG files (AIRFLOW_HOME/dags)
└── .venv/              # created by `uv sync` (gitignored)
```

`airflow.cfg`, `airflow.db`, and `logs/` are generated on first run and are
gitignored. This directory **is** `AIRFLOW_HOME`.

## Setup

```bash
cd airflow
uv sync
```

## Run

`AIRFLOW_HOME` must be set for every Airflow command:

```bash
export AIRFLOW_HOME="$PWD"

uv run airflow db migrate     # create/upgrade the SQLite metadata DB
uv run airflow standalone     # UI + scheduler + dag-processor in one process
```

`airflow standalone` prints the generated admin password on first start.
UI: <http://localhost:8080>

Useful checks:

```bash
uv run airflow version
uv run airflow dags list
```

## Environment

Override any Airflow setting with `AIRFLOW__<SECTION>__<KEY>` instead of editing
the generated `airflow.cfg`, e.g.:

```bash
export AIRFLOW__CORE__LOAD_EXAMPLES=False
export AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION=True
```

## Adding dependencies

Airflow must be installed with its constraint file so the dependency set stays
reproducible. Pass the same constraints when adding anything new:

```bash
uv add -c constraints.txt "apache-airflow-providers-google==10.1.0"
```

Pin `apache-airflow` alongside it if you do not want it moved.

## Recreating the constraints file

```bash
curl -fsSL -o constraints.txt \
  "https://raw.githubusercontent.com/apache/airflow/constraints-3.3.2/constraints-3.12.txt"
```

## AI demo (Gemini)

`dags/gemini_ai_demo.py` uses the `common.ai` provider (`apache-airflow-providers-common-ai`,
built on pydantic-ai) with the `@task.llm`, `@task.agent` and `@task.llm_branch`
decorators. The provider is installed with the `google` extra:

```bash
uv add -c constraints.txt "apache-airflow-providers-common-ai[google]==0.9.0"
```

Create the connection the DAG expects (`conn_type=pydanticai`; the API key goes
in the password field, the model in `extra`):

```bash
uv run airflow connections add gemini_default \
  --conn-type pydanticai \
  --conn-password "$GEMINI_API_KEY" \
  --conn-extra '{"model": "google:gemini-2.5-flash"}'
```

The model is resolved from `model_id` on the task first, then `extra["model"]`.
Equivalent env-var form:

```bash
export AIRFLOW_CONN_GEMINI_DEFAULT="pydanticai://:$GEMINI_API_KEY@?model=google%3Agemini-2.5-flash"
```

Restart Airflow afterwards — providers are discovered at startup — then run:

```bash
uv run airflow dags test gemini_ai_demo 2025-01-01
```

`dags/gemini_embed_demo.py` covers the embedding step. The provider ships **no**
`@task.embed`: embedding is `LlamaIndexEmbeddingOperator`, and `LlamaIndexHook`
only builds OpenAI embedders, so the DAG builds a Gemini embedder in a task. It
parses without extra packages but needs these to execute:

```bash
uv add -c constraints.txt llama-index-core llama-index-embeddings-google-genai
```

## HITL demo

`dags/hitl_approval_demo.py` uses `ApprovalOperator` (from
`apache-airflow-providers-standard`, already a dependency of `common.ai`) to ask
a human to Approve or Reject a proposed action before downstream tasks run.

Needs Airflow 3.1+. On 3.3+ the task parks in the `AWAITING_INPUT` state, so no
triggerer is involved. Trigger the DAG from the UI, then open the task instance
and follow the **Required Actions** link to respond. On `Approve` the downstream
task runs; on `Reject` it is skipped.

`response_timeout` bounds the human wait (1 hour here); without it the task
waits indefinitely. `airflow dags test` cannot complete a HITL task, because
nothing answers the request — use the UI or the REST API.

Swap in another variant with a one-line change: `HITLBranchOperator` (with
`options_mapping={"Water": "waterTask", ...}`) to branch on the human choice, or
`HITLEntryOperator` (with `params` form fields) to collect input instead of a
yes/no.

## Logs

This project lives on an NTFS drive (`fuseblk`), which forbids `:` in filenames —
and Airflow names task-log directories after the run id
(`run_id=manual__2026-09-21T14:54:54.703791+00:00`). The log folder must be on a
Linux filesystem, otherwise every task dies with `FileNotFoundError` before it
runs and the UI only shows *"Could not read served logs: Hostname not available
for worker"*:

```ini
[logging]
base_log_folder = /home/diosamuel/paperflow-airflow-logs
dag_processor_child_process_log_directory = /home/diosamuel/paperflow-airflow-logs/dag_processor
```

## Status

`dags/paperflow_dag.py` is a self-contained mock DAG (sensor read → rule
evaluation → branch to green/yellow/red). It stands in for Phase 1 of `PLAN.md`,
which will move this logic into `src/paperflow/` and drive real MQTT/Raspberry Pi
hardware.
