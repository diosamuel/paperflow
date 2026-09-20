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

## Status

`dags/paperflow_dag.py` is a self-contained mock DAG (sensor read → rule
evaluation → branch to green/yellow/red). It stands in for Phase 1 of `PLAN.md`,
which will move this logic into `src/paperflow/` and drive real MQTT/Raspberry Pi
hardware.
