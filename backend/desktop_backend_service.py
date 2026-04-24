import os
import json
from pathlib import Path

import uvicorn
from dotenv import load_dotenv


def _load_runtime_config() -> None:
    # Prefer colocated .env next to the executable/resources backend folder.
    base_dir = Path.cwd()
    env_file = base_dir / '.env'
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
    else:
        load_dotenv()

    # Optional desktop config can inject DATABASE_URL without rebuilding.
    config_candidates = [
        Path(os.getcwd()) / 'desktop-config.json',
        Path(sys.executable).resolve().parent / 'desktop-config.json' if getattr(sys, 'frozen', False) else None,
    ]
    for config_path in config_candidates:
        if not config_path or not config_path.exists():
            continue
        try:
            config = json.loads(config_path.read_text(encoding='utf-8'))
            database_url = config.get('databaseUrl') or config.get('DATABASE_URL')
            if database_url and not os.getenv('DATABASE_URL'):
                os.environ['DATABASE_URL'] = str(database_url)
            break
        except Exception:
            continue


# Import after config load so SQLAlchemy gets DATABASE_URL during module import.
import sys
_load_runtime_config()
from app.main import app as fastapi_app


if __name__ == "__main__":
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("PORT", os.getenv("BACKEND_PORT", "8000")))
    uvicorn.run(fastapi_app, host=host, port=port)
