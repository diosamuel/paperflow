import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from airflow.plugins_manager import AirflowPlugin

UI_DIST = os.path.join(os.path.dirname(__file__), "ui", "dist")

IFRAME_STYLE = """
<style>
  html, body {
    width: 100%;
    min-height: 100vh;
    margin: 0;
    padding: 0;
    overflow-x: auto;
  }
</style>
"""

router = APIRouter(tags=["PaperFlow"])


@router.get("/")
def serveBuilder():
    """Serve the compiled PaperFlow builder from ui/dist/index.html."""
    index = os.path.join(UI_DIST, "index.html")
    if not os.path.exists(index):
        raise HTTPException(
            status_code=404,
            detail="UI not built. Run `npm install && npm run build` in airflow/plugins/paperflow/ui.",
        )

    with open(index, encoding="utf-8") as f:
        html = f.read()

    response = HTMLResponse(content=html.replace("</head>", f"{IFRAME_STYLE}</head>"))
    response.headers.update(
        {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    )
    return response


if os.path.isdir(UI_DIST):
    router.mount("/", StaticFiles(directory=UI_DIST), name="paperflow_static")


class PaperFlowPlugin(AirflowPlugin):
    """Serves the PaperFlow visual builder inside the Airflow UI."""

    name = "paperflow_plugin"

    fastapi_apps = [
        {
            "app": router,
            "url_prefix": "/paperflow",
            "name": "PaperFlow Builder",
        }
    ]

    external_views = [
        {
            "name": "PaperFlow",
            "category": "Browse",
            "href": "paperflow/",
            "url_route": "paperflow",
            "destination": "nav",
        }
    ]
