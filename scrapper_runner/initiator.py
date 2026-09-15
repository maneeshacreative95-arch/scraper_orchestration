import random
import logging
from db_utils import get_db_connection, BASE_URL

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("scrapper_auto_initiator")

DEFAULT_EMP_ID = 1572

def queue_random_portals(limit=5):
    """Randomly pick active portals that haven't been picked yet and assign them to the default employee."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Fetch active, unpicked portals
        cursor.execute("SELECT PORTALNAME, PORTALID FROM SCRAPPER_PORTAL_LIST WHERE STATUS = 'ACTIVE' AND IS_PICKED = 0")
        portals = cursor.fetchall()
        
        if not portals:
            logger.warning("No active and unpicked portals found in SCRAPPER_PORTAL_LIST.")
            return []

        # Determine how many portals to pick
        sample_size = min(len(portals), limit)
        selected_portals = random.sample(portals, sample_size)
        
        queued_items = []
        for portal in selected_portals:
            emp_id = DEFAULT_EMP_ID
            
            # Insert into SCRAPPER_PROCESSING
            cursor.execute("""
                INSERT INTO SCRAPPER_PROCESSING (EMP_ID, PORTALNAME, PORTALID, STATUS)
                VALUES (%s, %s, %s, 'PENDING')
            """, (emp_id, portal['PORTALNAME'], portal['PORTALID']))
            
            # Mark portal as picked so it won't be picked again
            cursor.execute("""
                UPDATE SCRAPPER_PORTAL_LIST 
                SET IS_PICKED = 1 
                WHERE PORTALID = %s
            """, (portal['PORTALID'],))
            
            queued_items.append({
                "emp_id": emp_id,
                "portal_name": portal['PORTALNAME'],
                "portal_id": portal['PORTALID']
            })
            
        conn.commit()
        logger.info(f"Successfully queued {len(queued_items)} portals and updated IS_PICKED status.")
        return queued_items
    except Exception as e:
        logger.error(f"Error queuing random portals: {e}")
        conn.rollback()
        return []
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    # Test random selection and insertion
    queued = queue_random_portals(limit=3)
    for q in queued:
        print(f"Queued: Employee {q['emp_id']} -> Portal {q['portal_name']} ({q['portal_id']})")
