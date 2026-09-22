"""Demo DAG for Human-in-the-loop approval in Airflow 3.

`ApprovalOperator` pauses the DAG and asks a human to Approve or Reject a
proposed action in the Airflow UI (task instance -> Required Actions). On
Approve the downstream tasks run; on Reject they are skipped.

On Airflow 3.3+ the task parks in the AWAITING_INPUT state, so no triggerer is
needed and no trigger is created. Trigger this DAG manually, then open the
"Required Actions" link on the approval task to respond.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from airflow.providers.standard.operators.hitl import ApprovalOperator
from airflow.sdk import dag, task


@dag(
    dag_id="greenhouse_hitl_demo",
    description="A human approves or rejects a greenhouse action before it executes.",
    schedule=None,
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["paperflow", "hitl"],
)
def greenhouseHitlDemo():
    @task
    def proposeAction() -> str:
        return "Open the roof vents for 30 minutes to bring 31.5C back under 30C."

    @task
    def executeAction(proposal: str, approval: dict) -> str:
        user = approval.get("responded_by_user") or {}
        print(f"Approved by {user.get('name', 'unknown')} at {approval['responded_at']}")
        print(f"Executing: {proposal}")
        return f"executed: {proposal}"

    proposal = proposeAction()

    approve = ApprovalOperator(
        task_id="approveAction",
        subject="Execute this greenhouse action?",
        body="Proposed action: {{ ti.xcom_pull(task_ids='proposeAction') }}",
        response_timeout=timedelta(hours=1),
    )

    proposal >> approve
    executeAction(proposal, approve.output)


greenhouseHitlDemo()
