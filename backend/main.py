"""FastAPI backend — PDF objection processing service (Docker)."""

# config must be imported first so sys.path is extended before route imports
import config  # noqa: F401

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from routes.process import router as process_router
from routes.stage3  import router as stage3_router
from routes.excel   import router as excel_router
from routes.chunks  import router as chunks_router

app = FastAPI()

MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MB

@app.middleware('http')
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get('content-length')
    if content_length and int(content_length) > MAX_BODY_BYTES:
        return JSONResponse({'detail': 'Request body too large'}, status_code=413)
    return await call_next(request)

app.include_router(process_router)
app.include_router(stage3_router)
app.include_router(excel_router)
app.include_router(chunks_router)


@app.get('/health')
def health():
    return {'ok': True}
