"""FastAPI backend — PDF objection processing service (Docker)."""

# config must be imported first so sys.path is extended before route imports
import config  # noqa: F401

from fastapi import FastAPI

from routes.process import router as process_router
from routes.stage3  import router as stage3_router
from routes.excel   import router as excel_router
from routes.chunks  import router as chunks_router

app = FastAPI()

app.include_router(process_router)
app.include_router(stage3_router)
app.include_router(excel_router)
app.include_router(chunks_router)


@app.get("/health")
def health():
    return {"ok": True}
