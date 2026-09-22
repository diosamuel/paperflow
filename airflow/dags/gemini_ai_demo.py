"""Demo DAG for apache-airflow-providers-common-ai driven by Gemini.

Covers the three TaskFlow decorators the provider ships for pydantic-ai:
``@task.llm`` (single prompt -> structured output), ``@task.agent``
(multi-turn agent loop) and ``@task.llm_branch`` (the model picks the
downstream task). Requires a ``pydanticai`` connection named
``gemini_default`` holding the Gemini API key.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from airflow.sdk import dag, task

GEMINI_CONN_ID = "gemini_default"
GEMINI_MODEL = "google:gemini-2.5-flash"


class GreenhouseDecision(BaseModel):
    """Structured output returned by the @task.llm step."""

    status: str
    reason: str
    actions: list[str]


@dag(
    dag_id="gemini_ai_demo",
    description="Gemini LLM, agent, and LLM-driven branching over mock sensor data.",
    schedule=None,
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["paperflow", "ai"],
)
def geminiAiDemo():
    @task
    def readSensor() -> dict:
        return {"temperature": 31.5, "humidity": 42.0, "soil_moisture": 18.0}

    @task.llm(
        llm_conn_id=GEMINI_CONN_ID,
        model_id=GEMINI_MODEL,
        system_prompt=(
            "You are a greenhouse controller. Classify the reading as 'red' when "
            "temperature >= 30, 'yellow' when >= 25, otherwise 'green'. Return a "
            "short reason and one to three concrete actions."
        ),
        output_type=GreenhouseDecision,
    )
    def analyzeReading(reading: dict) -> str:
        return f"Classify this greenhouse sensor reading: {reading}"

    @task.agent(
        llm_conn_id=GEMINI_CONN_ID,
        model_id=GEMINI_MODEL,
        system_prompt=(
            "You are a greenhouse operator. Turn the decision into a short, "
            "numbered action plan for the next 24 hours."
        ),
    )
    def planActions(decision: GreenhouseDecision) -> str:
        return f"Decision: {decision.status} because {decision.reason}. Actions: {decision.actions}"

    @task.llm_branch(
        llm_conn_id=GEMINI_CONN_ID,
        model_id=GEMINI_MODEL,
        system_prompt=(
            "Route the plan to exactly one downstream task: 'redTask' for a red "
            "status, 'yellowTask' for yellow, 'greenTask' for green."
        ),
    )
    def routePlan(plan: str) -> str:
        return f"Route this plan: {plan}"

    @task
    def greenTask(decision: GreenhouseDecision) -> str:
        print(f"GREEN - {decision.reason}")
        return "green"

    @task
    def yellowTask(decision: GreenhouseDecision) -> str:
        print(f"YELLOW - {decision.reason}")
        return "yellow"

    @task
    def redTask(decision: GreenhouseDecision) -> str:
        print(f"RED - {decision.reason}")
        return "red"

    reading = readSensor()
    decision = analyzeReading(reading)
    plan = planActions(decision)
    route = routePlan(plan)

    route >> [greenTask(decision), yellowTask(decision), redTask(decision)]


geminiAiDemo()
