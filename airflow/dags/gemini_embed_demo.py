"""Demo DAG for the common.ai embedding step, backed by Gemini embeddings.

The provider ships no ``@task.embed`` decorator: embedding is done by
``LlamaIndexEmbeddingOperator``. ``LlamaIndexHook`` only builds OpenAI
embedders, so a Gemini embedder is constructed in a task and passed to the
operator as an XCom value.

Executing this DAG needs the extra packages:
    uv add -c constraints.txt llama-index-core llama-index-embeddings-google-genai
"""

from __future__ import annotations

from datetime import datetime

from airflow.providers.common.ai.operators.llamaindex_embedding import LlamaIndexEmbeddingOperator
from airflow.sdk import dag, task

EMBED_MODEL = "gemini-embedding-001"


@dag(
    dag_id="gemini_embed_demo",
    description="Chunk documents and embed them with Gemini via LlamaIndexEmbeddingOperator.",
    schedule=None,
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["paperflow", "ai"],
)
def geminiEmbedDemo():
    @task
    def loadDocuments() -> list[dict]:
        return [
            {
                "text": "Keep soil moisture above 20% for tomatoes in a greenhouse.",
                "metadata": {"source": "greenhouse-manual", "topic": "soil"},
            },
            {
                "text": "Open the vents when the temperature rises above 30 degrees Celsius.",
                "metadata": {"source": "greenhouse-manual", "topic": "temperature"},
            },
        ]

    @task
    def buildEmbedder():
        from llama_index.embeddings.google_genai import GoogleGenAIEmbedding

        return GoogleGenAIEmbedding(model_name=EMBED_MODEL)

    embed = LlamaIndexEmbeddingOperator(
        task_id="embedChunks",
        documents=loadDocuments(),
        embed_model=buildEmbedder(),
        chunk_size=256,
        chunk_overlap=32,
    )

    @task
    def report(result: dict) -> None:
        print(f"documents={result['document_count']} chunks={result['chunk_count']}")
        for chunk in result["chunks"]:
            print(f"  dim={len(chunk['vector'])} text={chunk['text'][:60]!r}")

    report(embed.output)


geminiEmbedDemo()
