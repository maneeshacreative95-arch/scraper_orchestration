import asyncio
import json
import logging
import time
import requests
import websockets
from db_utils import (
    get_db_connection,
    BASE_URL,
    API_PORT,
    ORCHESTRATOR_WS_URL,
    RUNNER_ID,
    RUNNER_NAME,
    CLIENT_ID,
    SERVER_IP,
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("scrapper_runner")

# Global state tracking runner status ("idle" or "running")
RUNNER_STATE = {
    "status": "idle",
    "current_task": None
}

def get_next_unprocessed_category(portal_id):
    """
    Returns the first active category from KF_CATEGORY that has not been processed
    for the given portal_id in KFVENDOR_SCRAPE_LOG. Returns None if all completed.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT DISTINCT kc.SUB_CATEGORY 
            FROM KF_CATEGORY kc
            LEFT JOIN KFVENDOR_SCRAPE_LOG sl 
                ON sl.PORTAL_ID = %s 
               AND sl.CATEGORY = kc.SUB_CATEGORY 
               AND sl.COPIED_TO_DEST = 1
            WHERE kc.STATUS = 'ACTIVE' 
              AND kc.SUB_CATEGORY IS NOT NULL 
              AND kc.SUB_CATEGORY != ''
              AND sl.PORTAL_ID IS NULL
            LIMIT 1
        """, (portal_id,))
        row = cursor.fetchone()
        return row['SUB_CATEGORY'].strip() if row else None
    except Exception as e:
        logger.error(f"Error getting next unprocessed category: {e}")
        return None
    finally:
        cursor.close()
        conn.close()

def trigger_backend_scrape(emp_id, portal_id, category=None, city="", batch_id="auto_batch_1", total_contacts=1000, start_from=1, batch_size=1000):
    """
    Call the backend FastAPI /start-execution endpoint on local executable (127.0.0.1:7500).
    Returns the execution_id string on success, or None on failure.
    """
    url = f"{BASE_URL}/start-execution"
    payload = {
        "total_contacts": total_contacts,
        "user_id": emp_id,
        "start_from": start_from,
        "batch_size": batch_size,
        "basic_scraping_url": f"http://{SERVER_IP}:{API_PORT}",
        "contact_scraping_url": f"http://{SERVER_IP}:{API_PORT}",
        "social_scraping_url": f"http://{SERVER_IP}:7004",
        "leader_scraping_url": f"http://{SERVER_IP}:{API_PORT}",
        "run_basic": True,
        "run_contact": False,
        "run_social": False,
        "run_leader": False,
        "source_table": "kfvendor_source",
        "dest_table": "kf_vendor",
        "city": city or "",
        "portal_id": portal_id,
        "categories": [category] if category else [],
        "areas": [],
        "turbo_mode": True,
        "use_groq": False,
        "use_ollama": False,
        "use_llm": False,
        "ollama_model": "",
        "empty_only": False,
        "cookie_optional": True,
        "basic_options": ["company_name", "address", "phone", "google_maps_url", "website", "category"],
        "contact_options": [],
        "social_options": [],
        "leader_options": [],
        "force_recheck": False
    }

    try:
        logger.info(f"Triggering /start-execution on local backend for User {emp_id}, Portal {portal_id} ({city}), Category '{category}' (Range: {start_from} to {start_from + total_contacts - 1})...")
        response = requests.post(url, json=payload, timeout=300)
        if response.status_code == 200:
            data = response.json()
            execution_id = data.get("execution_id")
            logger.info(f"Local backend accepted execution. execution_id='{execution_id}'")
            return execution_id
        elif response.status_code == 400 and "already running" in response.text.lower():
            logger.warning("Local backend returned 400 'Scraper is already running'. Attempting reset via /stop-execution & /api/stop-scraper...")
            try:
                requests.post(f"{BASE_URL}/stop-execution", json={}, timeout=5)
                requests.post(f"{BASE_URL}/api/stop-scraper", json={"username": str(emp_id)}, timeout=5)
                time.sleep(2)
            except Exception as reset_err:
                logger.warning(f"Failed to send reset signals: {reset_err}")
            
            # Retry start execution after reset
            retry_resp = requests.post(url, json=payload, timeout=300)
            if retry_resp.status_code == 200:
                data = retry_resp.json()
                execution_id = data.get("execution_id")
                logger.info(f"Local backend accepted execution after reset! execution_id='{execution_id}'")
                return execution_id
            else:
                logger.error(f"Backend API error after reset retry: {retry_resp.status_code} - {retry_resp.text}")
                return None
        else:
            logger.error(f"Backend API error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Failed to connect to backend API: {e}")
        return None

async def send_heartbeat(websocket):
    """Sends a heartbeat every 5 seconds indicating whether runner is idle or running."""
    while True:
        try:
            heartbeat_payload = {
                "event": "heartbeat",
                "type": "heartbeat",
                "runner_id": RUNNER_ID,
                "status": RUNNER_STATE["status"]
            }
            await websocket.send(json.dumps(heartbeat_payload))
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Heartbeat send failed: {e}")
            break

async def send_ws_event(websocket, event_type, data):
    """Utility to send WebSocket JSON payload events to the Orchestrator."""
    payload = {
        "event": event_type,
        "type": event_type,
        "runner_id": RUNNER_ID,
        **data
    }
    try:
        await websocket.send(json.dumps(payload))
    except Exception as e:
        logger.error(f"Failed to send WS event '{event_type}': {e}")

def update_scrapper_processing(emp_id, portal_id, portal_name, status):
    """
    Inserts or updates the status of a scraping task in SCRAPPER_PROCESSING.
    Logs format: [DB] Inserted/Updated SCRAPPER_PROCESSING: PortalName (PortalID) -> STATUS
    """
    if not emp_id or not portal_id:
        return None
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT SP_ID
            FROM SCRAPPER_PROCESSING
            WHERE EMP_ID=%s AND PORTALID=%s
        """, (emp_id, portal_id))

        row = cursor.fetchone()

        if row:
            cursor.execute("""
                UPDATE SCRAPPER_PROCESSING
                SET STATUS=%s, UPDATE_DTM=NOW()
                WHERE SP_ID=%s
            """, (status, row[0]))
            conn.commit()
            sp_id = row[0]
            logger.info(f"[DB] Updated SCRAPPER_PROCESSING: {portal_name} ({portal_id}) -> {status}")
        else:
            cursor.execute("""
                INSERT INTO SCRAPPER_PROCESSING
                (EMP_ID, PORTALNAME, PORTALID, STATUS, INSRT_DTM, UPDATE_DTM)
                VALUES (%s,%s,%s,%s, NOW(), NOW())
            """, (emp_id, portal_name, portal_id, status))
            conn.commit()
            sp_id = cursor.lastrowid
            logger.info(f"[DB] Inserted SCRAPPER_PROCESSING: {portal_name} ({portal_id}) -> {status}")

        return sp_id
    except Exception as e:
        logger.error(f"[DB] Error updating SCRAPPER_PROCESSING for {portal_name} ({portal_id}): {e}")
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()

async def wait_for_execution_completion(websocket, execution_id, emp_id, sp_id, portal_id, city_id, category):
    """
    Polls the local backend at BASE_URL/executions until the execution is completed, failed, or stopped.
    Emits real-time progress events to the orchestrator WebSocket while scraping is active.
    """
    logger.info(f"Waiting for execution '{execution_id}' (Category: '{category}') to complete on local scraper backend...")
    poll_url = f"{BASE_URL}/executions"
    headers = {"X-User-Id": str(emp_id), "X-Firm-Id": "5"}

    while True:
        try:
            res = await asyncio.to_thread(requests.get, poll_url, headers=headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                exec_list = data.get("executions", [])
                target_exec = next((x for x in exec_list if str(x.get("execution_id")) == str(execution_id)), None)

                if target_exec:
                    status = (target_exec.get("status") or "running").lower()
                    progress = target_exec.get("progress", 0)
                    scraped_count = target_exec.get("scraped_count", 0)

                    # Emit progress update to orchestrator WebSocket
                    await send_ws_event(websocket, "progress", {
                        "sp_id": sp_id,
                        "portal_id": portal_id,
                        "city_id": city_id,
                        "category": category,
                        "execution_id": execution_id,
                        "progress": progress,
                        "scraped_count": scraped_count,
                        "status": status
                    })

                    if status in ("completed", "partial", "stopped", "failed"):
                        logger.info(f"Execution '{execution_id}' for '{category}' finished with status: {status.upper()}")
                        return status
                else:
                    # If execution not found in active list, check if any running
                    active_running = [x for x in exec_list if x.get("status") == "running"]
                    if not active_running:
                        logger.info(f"Execution '{execution_id}' finished on local backend.")
                        return "completed"
            await asyncio.sleep(4)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"Error checking execution status for '{execution_id}': {e}")
            await asyncio.sleep(5)

async def process_task(websocket, emp_id=1572, job_data=None):
    """Processes task categories and emits progress, execution_completed, and execution_failed WS events."""
    conn = await asyncio.to_thread(get_db_connection)
    cursor = conn.cursor(dictionary=True)
    sp_id = None
    portal_id = None
    portal_name = ""

    try:
        RUNNER_STATE["status"] = "running"

        # Use job_data from WS message if provided, otherwise fetch next task from DB
        if job_data:
            task = job_data
        else:
            if emp_id:
                cursor.execute("""
                    SELECT SP_ID, EMP_ID, PORTALNAME, PORTALID, STATUS 
                    FROM SCRAPPER_PROCESSING 
                    WHERE STATUS IN ('PENDING', 'PROCESSING') AND EMP_ID = %s
                    ORDER BY INSRT_DTM ASC 
                    LIMIT 1
                """, (emp_id,))
            else:
                cursor.execute("""
                    SELECT SP_ID, EMP_ID, PORTALNAME, PORTALID, STATUS 
                    FROM SCRAPPER_PROCESSING 
                    WHERE STATUS IN ('PENDING', 'PROCESSING') 
                    ORDER BY INSRT_DTM ASC 
                    LIMIT 1
                """)
            task = cursor.fetchone()

        if not task:
            logger.info(f"No PENDING or PROCESSING tasks found in SCRAPPER_PROCESSING{' for Employee ' + str(emp_id) if emp_id else ''}.")
            RUNNER_STATE["status"] = "idle"
            return

        portal_id = task.get('PORTALID') or task.get('portal_id')
        portal_name = task.get('PORTALNAME') or task.get('city') or ""
        emp_id = task.get('EMP_ID') or task.get('user_id') or emp_id

        total_contacts = task.get('total_contacts') or task.get('total_companies') or task.get('estimated_company_count') or 1000
        start_from = task.get('start_from') or task.get('start_offset') or 1
        batch_size = task.get('batch_size') or 1000
        city_id = task.get('city_id')

        # Synchronize SCRAPPER_PROCESSING table to 'PROCESSING' at task start
        sp_id = await asyncio.to_thread(update_scrapper_processing, emp_id, portal_id, portal_name, 'PROCESSING')
        if not sp_id:
            sp_id = task.get('SP_ID', int(time.time()))

        logger.info(f"Processing task ID {sp_id} for Portal {portal_id} - '{portal_name}' (Employee {emp_id}, Range: {start_from} to {start_from + total_contacts - 1})")

        # Determine categories to scrape (use Orchestrator job categories if provided, otherwise fetch next unprocessed from DB)
        job_categories = task.get('categories') if isinstance(task.get('categories'), list) else ([task.get('category')] if task.get('category') else [])
        job_categories = [c for c in job_categories if c and str(c).strip() and str(c).strip().lower() != 'general']
        categories_queue = list(job_categories) if job_categories else None

        # Process categories one by one
        while True:
            if categories_queue is not None:
                category_to_scrape = categories_queue.pop(0) if categories_queue else None
            else:
                category_to_scrape = await asyncio.to_thread(get_next_unprocessed_category, portal_id)

            if not category_to_scrape:
                logger.info(f"All categories for Portal {portal_id} are processed. Marking task {sp_id} as DONE.")
                await asyncio.to_thread(update_scrapper_processing, emp_id, portal_id, portal_name, 'DONE')
                await send_ws_event(websocket, "execution_completed", {
                    "sp_id": sp_id,
                    "portal_id": portal_id,
                    "portal_name": portal_name,
                    "city_id": city_id,
                    "status": "DONE"
                })
                break

            logger.info(f"Picked category '{category_to_scrape}'. Triggering backend scrape for city '{portal_name}'...")

            # Emit WS progress event (starting)
            await send_ws_event(websocket, "progress", {
                "sp_id": sp_id,
                "portal_id": portal_id,
                "city_id": city_id,
                "category": category_to_scrape,
                "status": "starting"
            })

            # Ensure SCRAPPER_PROCESSING is marked PROCESSING immediately before trigger_backend_scrape()
            await asyncio.to_thread(update_scrapper_processing, emp_id, portal_id, portal_name, 'PROCESSING')

            # Trigger execution with retry logic
            execution_id = None
            backoff_delays = [5, 10, 20]
            last_err_msg = "Unknown execution error"

            for attempt, delay in enumerate(backoff_delays, 1):
                execution_id = await asyncio.to_thread(
                    trigger_backend_scrape, 
                    emp_id, 
                    portal_id, 
                    category_to_scrape, 
                    portal_name, 
                    total_contacts=total_contacts,
                    start_from=start_from,
                    batch_size=batch_size
                )
                if execution_id:
                    break
                
                last_err_msg = f"Backend / ChromeDriver trigger failed (Attempt {attempt}/3). Retrying in {delay}s..."
                logger.warning(last_err_msg)
                await send_ws_event(websocket, "runner_recovering", {
                    "sp_id": sp_id,
                    "portal_id": portal_id,
                    "city_id": city_id,
                    "attempt": attempt,
                    "next_retry_sec": delay,
                    "reason": last_err_msg
                })
                await asyncio.sleep(delay)

            if not execution_id:
                logger.error(f"All retries failed for '{category_to_scrape}'. Updating DB to FAILED & emitting execution_failed event.")
                await asyncio.to_thread(update_scrapper_processing, emp_id, portal_id, portal_name, 'FAILED')
                await send_ws_event(websocket, "execution_failed", {
                    "sp_id": sp_id,
                    "portal_id": portal_id,
                    "city_id": city_id,
                    "category": category_to_scrape,
                    "error": f"Execution failed after 3 retries: {last_err_msg}"
                })
                await asyncio.sleep(5)
                continue

            # Wait for execution to finish on local backend before moving to next category
            final_status = await wait_for_execution_completion(
                websocket, execution_id, emp_id, sp_id, portal_id, city_id, category_to_scrape
            )

            # Emit completion event for category
            await send_ws_event(websocket, "execution_completed", {
                "sp_id": sp_id,
                "portal_id": portal_id,
                "city_id": city_id,
                "category": category_to_scrape,
                "execution_id": execution_id,
                "total_contacts": total_contacts,
                "status": final_status
            })
            await asyncio.sleep(2)

    except asyncio.CancelledError:
        logger.info("Task execution was cancelled/stopped by user action.")
        RUNNER_STATE["status"] = "idle"
        if emp_id and portal_id:
            try:
                await asyncio.to_thread(update_scrapper_processing, emp_id, portal_id, portal_name, 'CANCELLED')
            except Exception:
                pass
        try:
            await asyncio.to_thread(requests.post, f"{BASE_URL}/stop-execution", json={}, timeout=5)
        except Exception:
            pass
        await send_ws_event(websocket, "execution_stopped", {"status": "stopped"})
        raise
    except Exception as e:
        logger.error(f"Error running processing task: {e}")
        conn.rollback()
        if emp_id and portal_id:
            try:
                await asyncio.to_thread(update_scrapper_processing, emp_id, portal_id, portal_name, 'FAILED')
            except Exception:
                pass
        await send_ws_event(websocket, "execution_failed", {
            "error": str(e)
        })
    finally:
        cursor.close()
        conn.close()
        RUNNER_STATE["status"] = "idle"

async def ws_runner_loop():
    """Main WebSocket client loop: connects, registers, sends heartbeat, and listens for commands."""
    while True:
        try:
            logger.info(f"Connecting to Orchestrator WebSocket at {ORCHESTRATOR_WS_URL}...")
            async with websockets.connect(ORCHESTRATOR_WS_URL) as websocket:
                logger.info("Connected to Orchestrator WebSocket!")

                # Register runner
                register_payload = {
                    "event": "register",
                    "type": "register",
                    "runner_id": RUNNER_ID,
                    "runner_name": RUNNER_NAME,
                    "client_id": CLIENT_ID,
                    "server_ip": SERVER_IP,
                    "port": API_PORT
                }
                await websocket.send(json.dumps(register_payload))
                logger.info(f"Registered runner: {RUNNER_ID} ({RUNNER_NAME}) on port {API_PORT}")

                # Start heartbeat background task
                heartbeat_task = asyncio.create_task(send_heartbeat(websocket))
                active_task = None

                try:
                    # Message listening loop
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            event_name = data.get("event") or data.get("type") or data.get("action")
                            logger.info(f"Received WS message: {event_name} -> {data}")

                            if event_name in ("start_execution", "run_task"):
                                logger.info("Received execution job command from Orchestrator.")
                                if active_task and not active_task.done():
                                    logger.warning("Cancelling previous running task before starting new execution.")
                                    active_task.cancel()
                                active_task = asyncio.create_task(process_task(websocket, job_data=data.get("job_data")))

                            elif event_name in ("stop_execution", "cancel_task", "stop"):
                                logger.info("Received STOP command from Orchestrator!")
                                if active_task and not active_task.done():
                                    active_task.cancel()
                                    logger.info("Active task cancelled successfully.")
                                RUNNER_STATE["status"] = "idle"
                                try:
                                    await asyncio.to_thread(requests.post, f"{BASE_URL}/stop-execution", json={}, timeout=5)
                                except Exception as e:
                                    logger.warning(f"Backend stop-execution notice: {e}")
                                await send_ws_event(websocket, "execution_stopped", {"status": "stopped"})

                        except json.JSONDecodeError:
                            logger.warning(f"Received non-JSON message: {message}")
                        except Exception as e:
                            logger.error(f"Error handling WS message: {e}")

                finally:
                    if active_task and not active_task.done():
                        active_task.cancel()
                    heartbeat_task.cancel()

        except (websockets.exceptions.ConnectionClosedError, websockets.exceptions.WebSocketException, OSError) as e:
            logger.warning(f"WebSocket connection lost/failed: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"Unexpected error in WS loop: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)

def main():
    """Entry point to start async WebSocket runner loop."""
    try:
        asyncio.run(ws_runner_loop())
    except KeyboardInterrupt:
        logger.info("Runner stopped by user.")

if __name__ == "__main__":
    main()
