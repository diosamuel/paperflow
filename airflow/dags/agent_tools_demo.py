from __future__ import annotations

import ast
import os
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

from pydantic import BaseModel
from pydantic_ai import FunctionToolset
from pydantic_ai.usage import UsageLimits
from airflow.dag_processing.dagbag import DagBag
from airflow.providers.standard.operators.hitl import ApprovalOperator
from airflow.sdk import conf, dag, task

LLM_CONN_ID = os.getenv("PAPERFLOW_LLM_CONN_ID", "pydanticai_default")
LLM_MODEL = os.getenv("PAPERFLOW_LLM_MODEL") or None
BLOCKLY_DIR = Path(
    os.getenv("PAPERFLOW_BLOCKLY_DIR")
    or Path(__file__).resolve().parents[2] / "blockly_dags"
)
DAG_PROMPT = (Path(__file__).resolve().parents[1] / "DAG_PROMPT.txt").read_text()

dagTools = FunctionToolset()

@dagTools.tool_plain
def checkAST(code: str) -> str:
    """Check 1: parse the code with Python's ast module. Returns 'ok' or the syntax error."""
    try:
        ast.parse(code)
    except SyntaxError as error:
        return f"syntax error: line {error.lineno}: {error.msg}"
    return "ok"


@dagTools.tool_plain
def compilePython(code: str) -> str:
    """Check 2: compile the code to bytecode. Returns 'ok' or the compile error."""
    try:
        compile(code, "<generated_dag>", "exec")
    except SyntaxError as error:
        return f"compile error: line {error.lineno}: {error.msg}"
    return "ok"


@dagTools.tool_plain
def checkDAGValid(code: str) -> str:
    """Check 3: load the code as a real Airflow DAG with DagBag. Returns 'ok: <dag ids>' or the error."""

    with tempfile.TemporaryDirectory() as folder:
        Path(folder, "generated_dag.py").write_text(code)
        try:
            bag = DagBag(folder)
        except Exception as error:
            return f"dag load failed: {type(error).__name__}: {error}"
        if bag.import_errors:
            errors = "; ".join(f"{Path(path).name}: {error}" for path, error in bag.import_errors.items())
            return f"import error: {errors}"
        if not bag.dag_ids:
            return (
                "no DAG created: the file defines no DAG. It must import from airflow.sdk "
                "and call the @dag-decorated function at module scope (DagBag skips files "
                "with no airflow import)."
            )
        return f"ok: {', '.join(sorted(bag.dag_ids))}"

def extractDagId(code: str) -> str | None:
    """Return the dag_id from the @dag(...) decorator, or None."""
    for node in ast.parse(code).body:
        if not isinstance(node, ast.FunctionDef):
            continue
        for decorator in node.decorator_list:
            if not isinstance(decorator, ast.Call):
                continue
            for keyword in decorator.keywords:
                if keyword.arg == "dag_id" and isinstance(keyword.value, ast.Constant):
                    return str(keyword.value.value)
    return None

def validateDagCode(code: str) -> None:
    """Deterministic gate: re-run every check and raise if any of them fails."""
    for check in (checkAST, compilePython, checkDAGValid):
        verdict = check(code)
        if not verdict.startswith("ok"):
            raise ValueError(f"{check.__name__} failed: {verdict}")

class GeneratedDag(BaseModel):
    """Structured output: the final DAG code plus a short summary."""
    code: str
    summary: str

@dag(
    dag_id="agent_tools_demo",
    description="Coding agent: Blockly pseudocode -> real Airflow DAG, validated by AST/compile/DagBag tools.",
    schedule=None,
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["paperflow", "ai", "hitl"],
)
def agentToolsDemo():
    @task
    def blocklyCode() -> str:
        files = sorted(
            BLOCKLY_DIR.glob("*.py"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        if not files:
            raise FileNotFoundError(f"No Blockly source files in {BLOCKLY_DIR}")
        print(f"using {files[0]}")
        return files[0].read_text()

    @task.agent(
        llm_conn_id=LLM_CONN_ID,
        model_id=LLM_MODEL,
        system_prompt=DAG_PROMPT,
        toolsets=[dagTools],
        output_type=GeneratedDag,
        usage_limits=UsageLimits(request_limit=12, tool_calls_limit=20),
    )
    def generateDag(code: str) -> str:
        return f"Blockly pseudocode:\n\n{code}"

    @task
    def writeDag(result: GeneratedDag, approval: dict) -> str:
        user = (approval.get("responded_by_user") or {}).get("name", "unknown")
        print(f"approved by {user} at {approval.get('responded_at')}")

        validateDagCode(result.code)
        dag_id = extractDagId(result.code)
        if not dag_id or not dag_id.startswith("blockly_"):
            raise ValueError(f"DAG id must start with 'blockly_', got {dag_id!r}")
        path = Path(conf.get("core", "dags_folder")) / f"{dag_id}.py"
        path.write_text(result.code)
        print(f"{result.summary}\nwrote {path}")
        return str(path)

    result = generateDag(blocklyCode())

    approve = ApprovalOperator(
        task_id="approveDag",
        subject="Write this generated DAG to airflow/dags?",
        body="{{ ti.xcom_pull(task_ids='generateDag').code }}",
        response_timeout=timedelta(hours=1),
    )

    result >> approve
    writeDag(result, approve.output)


agentToolsDemo()
