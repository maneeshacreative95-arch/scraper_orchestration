import os
import logging
from dotenv import load_dotenv
import mysql.connector

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("scrapper_db_utils")

# Load environment variables
local_env = os.path.abspath(os.path.join(os.path.dirname(__file__), ".env"))
if os.path.exists(local_env):
    load_dotenv(local_env)


# DB Configuration
DB_HOST = os.getenv("MYSQL_HOST", "88.150.227.117")
DB_USER = os.getenv("MYSQL_USER", "nrktrn_web_admin")
DB_PASS = os.getenv("MYSQL_PASSWORD", "GOeg&*$*657")
DB_NAME = os.getenv("MYSQL_DATABASE", "nrkindex_trn")
DB_PORT = int(os.getenv("MYSQL_PORT", 3306))
API_PORT = int(os.getenv("PORT", 7500))
BASE_URL = os.getenv("BASE_URL", f"http://127.0.0.1:{API_PORT}")

# WebSocket & Orchestrator Configuration
ORCHESTRATOR_WS_URL = os.getenv("ORCHESTRATOR_WS_URL", "wss://myblocks.in:7800")
RUNNER_ID = os.getenv("RUNNER_ID", "runner_1572")
RUNNER_NAME = os.getenv("RUNNER_NAME", "Manisha (Local PC)")
CLIENT_ID = os.getenv("CLIENT_ID", "1572")
SERVER_IP = os.getenv("SERVER_IP", "myblocks.in")

def get_db_connection():
    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME,
        port=DB_PORT,
        charset="utf8mb4",
        use_pure=True
    )


