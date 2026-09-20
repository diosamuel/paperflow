# PaperFlow

Draw it. Airflow runs it. The physical world responds.

An educational project teaching kids workflow orchestration with Apache Airflow
and a Raspberry Pi.

**Needs:** Node 20+, Python 3.12+, and [uv](https://docs.astral.sh/uv/).

---

## Airflow + Builder UI — `airflow/`

```bash
cd airflow
uv sync

export AIRFLOW_HOME="$PWD"
uv run airflow db migrate
uv run airflow standalone    # http://localhost:8080
```

`airflow standalone` prints the admin password on first start.

The visual builder is served by the PaperFlow plugin at
**http://localhost:8080/paperflow/**. Its bundle has to be built first:

```bash
cd airflow/plugins/paperflow/ui
npm install
npm run build
```

For UI development, `npm run dev` serves the builder standalone at
http://localhost:5173.

## Vision API — `api/`

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # then set GEMINI_API_KEY
python main.py               # http://localhost:8000/docs
```

---

See `AGENTS.md` for architecture and `PLAN.md` for the roadmap.
