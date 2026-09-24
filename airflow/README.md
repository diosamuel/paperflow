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

## AI demo (OpenAI-compatible)

`dags/llm_ai_demo.py` uses the `common.ai` provider
(`apache-airflow-providers-common-ai`, built on pydantic-ai) with the
`@task.llm`, `@task.agent` and `@task.llm_branch` decorators. It talks to any
OpenAI-spec endpoint through the provider's `pydanticai` connection type — no
provider-specific SDK is required, only the `openai` package (already a
dependency). Because pydantic-ai is OpenAI-spec here, the endpoint can be
OpenAI, Groq, Mistral, DeepSeek, Ollama, vLLM, or your own compatible service.

Create the connection the DAG expects (`conn_type=pydanticai`; `host` is the
base URL, the API key goes in the password field, the model in `extra` with the
`openai:` prefix):

```bash
uv run airflow connections add pydanticai_default \
  --conn-type pydanticai \
  --conn-host "https://your-endpoint/v1" \
  --conn-password "$OPENAI_API_KEY" \
  --conn-extra '{"model": "openai:gpt-4o-mini"}'
```

Use the `openai-chat:` prefix instead of `openai:` when your endpoint only
implements `/chat/completions` — the `openai:` prefix targets the newer
`/responses` API.

The model is resolved from `model_id` on the task first, then `extra["model"]`.
Equivalent env-var (JSON) form:

```bash
export AIRFLOW_CONN_PYDANTICAI_DEFAULT='{"conn_type": "pydanticai", "host": "https://your-endpoint/v1", "password": "sk-your-key", "extra": {"model": "openai:gpt-4o-mini"}}'
```

The DAG reads the connection id from `PAPERFLOW_LLM_CONN_ID` (default
`pydanticai_default`) and, by default, takes the model from the connection's
`extra["model"]`. Set `PAPERFLOW_LLM_MODEL` to override it per run.
Restart Airflow afterwards — providers are discovered at startup — then run:

```bash
uv run airflow dags test llm_ai_demo 2025-01-01
```

### Coding agent: Blockly pseudocode -> Airflow DAG

`dags/agent_tools_demo.py` shows `@task.agent` as a **coding agent**: it converts
Blockly-generated pseudocode into a real Airflow DAG, then validates its own work
in a loop. The validators are a custom pydantic-ai `FunctionToolset` the model
must call in order:

```python
from pydantic_ai import FunctionToolset

dagTools = FunctionToolset()


@dagTools.tool_plain
def checkAST(code: str) -> str:
    """Check 1: parse the code with Python's ast module."""
    try:
        ast.parse(code)
    except SyntaxError as error:
        return f"syntax error: line {error.lineno}: {error.msg}"
    return "ok"


@dagTools.tool_plain
def compilePython(code: str) -> str:
    """Check 2: compile the code to bytecode."""
    ...


@dagTools.tool_plain
def checkDAGValid(code: str) -> str:
    """Check 3: load the code as a real Airflow DAG with DagBag."""
    ...
```

```python
@task.agent(
    llm_conn_id=LLM_CONN_ID,
    system_prompt="Convert the pseudocode into a valid Airflow 3 DAG. Call checkAST, "
                  "compilePython, checkDAGValid and fix errors until all three return 'ok'.",
    toolsets=[dagTools],
    output_type=GeneratedDag,
    usage_limits=UsageLimits(request_limit=12, tool_calls_limit=20),
)
def generateDag(code: str) -> str:
    return f"Convert this Blockly pseudocode into a real Airflow DAG:\n\n{code}"
```

After the agent returns, a plain `writeDag` task re-runs all three checks,
extracts the `dag_id` with `ast`, requires it to start with `blockly_`, and
writes the code to `<dags_folder>/blockly_<id>.py` (the folder comes from
`conf.get("core", "dags_folder")`).

Use `@toolset.tool_plain` for a plain function, or `@toolset.tool` when the first
parameter is a `RunContext`. `usage_limits` bounds the loop so a non-converging
agent fails instead of running forever; tool calls are logged by default
(`enable_tool_logging=True`). Run it with:

```bash
uv run airflow dags test agent_tools_demo 2025-01-01
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
