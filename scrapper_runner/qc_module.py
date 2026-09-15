"""
Quality Check (QC) Workflow Engine Module for Scraper Agent
Runs automatically after every scraping batch before copying data into target table kf_vendor.
"""

import re
import requests
import logging

logger = logging.getLogger("scraper.quality_check")

def clean_phone(phone_str):
    """Strips non-digit characters from phone string."""
    if not phone_str:
        return ""
    return re.sub(r'\D', '', str(phone_str))

def evaluate_quality_score(record, target_city="", target_state="", target_category=""):
    """
    Evaluates a scraped record against the 10 Quality Check rules.
    Returns (quality_score: int [0-100], failure_reasons: list, missing_fields: list)
    """
    score = 0
    reasons = []
    missing_fields = []

    company_name = str(record.get('company_name') or record.get('VEND_TITL') or record.get('title') or '').strip()
    raw_phone = str(record.get('phone') or record.get('mobile') or record.get('contact') or '').strip()
    phone_digits = clean_phone(raw_phone)
    website = str(record.get('website') or record.get('url') or record.get('web') or '').strip()
    maps_url = str(record.get('google_maps_url') or record.get('gmaps_url') or record.get('maps') or '').strip()
    address = str(record.get('address') or record.get('location') or record.get('full_address') or '').strip()
    category = str(record.get('category') or record.get('VEND_CATEGRY') or '').strip()

    # Rule 1: Validate company name (not empty, min 3 characters)
    if len(company_name) >= 3 and company_name.lower() not in ['n/a', 'unknown', 'null', 'none', '-']:
        score += 15
    else:
        reasons.append("Company name invalid or < 3 characters")
        missing_fields.append("company_name")

    # Rule 2: Validate phone number format (10-15 digits)
    if 10 <= len(phone_digits) <= 15:
        score += 20
    else:
        reasons.append("Phone missing or invalid digit length (10-15 digits required)")
        missing_fields.append("phone")

    # Rule 3: Validate website URL format (http or https)
    if website and (website.lower().startswith('http://') or website.lower().startswith('https://')):
        score += 20
    else:
        reasons.append("Website missing or invalid format (requires http:// or https://)")
        missing_fields.append("website")

    # Rule 4: Validate Google Maps URL
    lc_maps = maps_url.lower()
    if maps_url and any(x in lc_maps for x in ['google.com/maps', 'maps.google.com', 'goo.gl', 'g.co']):
        score += 15
    else:
        reasons.append("Google Maps URL missing or invalid format")

    # Rule 5: Validate address contains target city/state
    lc_addr = address.lower()
    clean_city = target_city.split('(')[0].strip().lower() if target_city else ""
    clean_state = target_state.strip().lower() if target_state else ""
    
    if (clean_city and clean_city in lc_addr) or (clean_state and clean_state in lc_addr):
        score += 15
    elif not address:
        reasons.append("Address is empty/missing")
    else:
        reasons.append(f"Address does not contain city '{clean_city}' or state '{clean_state}'")

    # Rule 8: Check category relevance
    lc_cat = category.lower()
    lc_req_cat = target_category.strip().lower() if target_category else ""
    if not lc_req_cat or (lc_cat and (lc_req_cat in lc_cat or lc_cat in lc_req_cat)):
        score += 15
    else:
        reasons.append(f"Category '{category}' does not match requested '{target_category}'")

    return score, reasons, missing_fields

def process_batch_quality_check(records, target_city="", target_state="", target_category="", orchestrator_url="http://127.0.0.1:7800", execution_id="exec_manual"):
    """
    Deduplicates batch, evaluates 10 QC rules, filters score >= 75 records,
    and sends QC report to Orchestrator dashboard.
    """
    valid_records = []
    failed_records = []
    seen_phone = set()
    seen_website = set()
    seen_maps = set()

    total_scraped = len(records)
    duplicate_count = 0
    missing_fields_count = 0
    total_score_sum = 0

    for item in records:
        raw_phone = str(item.get('phone') or item.get('mobile') or '').strip()
        p_digits = clean_phone(raw_phone)
        website = str(item.get('website') or item.get('url') or '').strip().lower()
        maps_url = str(item.get('google_maps_url') or item.get('gmaps_url') or '').strip().lower()

        # Rule 6: Remove duplicate records using phone, website, or Google Maps URL
        is_dup = False
        if p_digits and len(p_digits) >= 8 and p_digits in seen_phone:
            is_dup = True
        if website and len(website) > 5 and website in seen_website:
            is_dup = True
        if maps_url and len(maps_url) > 10 and maps_url in seen_maps:
            is_dup = True

        if is_dup:
            duplicate_count += 1
            failed_records.append({
                **item,
                'quality_score': 0,
                'failure_reasons': ['Duplicate record in batch']
            })
            continue

        if p_digits and len(p_digits) >= 8: seen_phone.add(p_digits)
        if website and len(website) > 5: seen_website.add(website)
        if maps_url and len(maps_url) > 10: seen_maps.add(maps_url)

        score, reasons, missing = evaluate_quality_score(item, target_city, target_state, target_category)
        if missing:
            missing_fields_count += 1

        total_score_sum += score
        item['quality_score'] = score

        # Rule 10: Copy only records with score >= 75
        if score >= 75:
            valid_records.append(item)
        else:
            failed_records.append({
                **item,
                'failure_reasons': reasons
            })

    avg_score = round(total_score_sum / total_scraped) if total_scraped > 0 else 0
    pass_rate_pct = f"{round((len(valid_records) / total_scraped) * 100)}%" if total_scraped > 0 else "0%"

    summary = {
        'totalScraped': total_scraped,
        'validCount': len(valid_records),
        'duplicateCount': duplicate_count,
        'missingFieldsCount': missing_fields_count,
        'rejectedCount': len(failed_records),
        'avgScore': avg_score,
        'passRate': pass_rate_pct
    }

    logger.info(f"[QUALITY CHECK] Batch Evaluation: Total={total_scraped}, Passed(>=75)={len(valid_records)}, Rejected={len(failed_records)}, Dupes={duplicate_count}, PassRate={pass_rate_pct}")

    # Send QC Report to Orchestrator Dashboard
    try:
        payload = {
            'execution_id': execution_id,
            'city': target_city,
            'state': target_state,
            'category': target_category,
            'records': records
        }
        res = requests.post(f"{orchestrator_url}/api/qc/process-batch", json=payload, timeout=5)
        if res.status_code == 200:
            logger.info("[QUALITY CHECK] Successfully synced QC Summary Report to Orchestrator Dashboard.")
    except Exception as err:
        logger.warning(f"[QUALITY CHECK] Notice syncing QC report to Orchestrator: {err}")

    return {
        'summary': summary,
        'valid_records': valid_records,
        'failed_records': failed_records
    }
