"""启动入口：python run_server.py 或 python -m uvicorn engine.api.server:app。"""
import os

from .api.server import app

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("DEAI_HOST", "0.0.0.0")
    port = int(os.environ.get("DEAI_PORT", "8765"))
    uvicorn.run(app, host=host, port=port)
