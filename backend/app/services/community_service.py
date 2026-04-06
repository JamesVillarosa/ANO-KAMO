import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.crud import get_rising_submissions, graduate_submission, mark_submission_inactive

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash-lite"
API_BASE = "https://generativelanguage.googleapis.com/v1beta"

# How often the Evolution Loop runs (seconds)
EVOLUTION_INTERVAL = 60
# Days of inactivity before marking as "inactive"
STALE_DAYS = 30


class CommunityService:
    """AI-driven Linguistic Gatekeeper for community-submitted terms."""

    @staticmethod
    def scan_term(
        term: str,
        meaning: str,
        origin: str = "",
        sample_sentence: str = "",
    ) -> dict:
        """
        Initial Popularity Scan using Gemini.
        Returns: {"popularity": "popular"|"rising"|"unknown", "reasoning": "..."}
        """
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.warning("No GEMINI_API_KEY — defaulting to 'rising'")
            return {"popularity": "rising", "reasoning": "API key not available, defaulting to rising."}

        prompt = (
            f'Evaluate the Filipino slang term "{term}" '
            f'(meaning: "{meaning}"'
            f'{f", region: {origin}" if origin else ""}'
            f'{f", example: {sample_sentence}" if sample_sentence else ""}'
            f"). "
            f"Is this term widely used in Filipino digital culture (social media, messaging, everyday speech)? "
            f'Reply ONLY with JSON: {{"popularity": "popular"|"rising"|"unknown", "reasoning": "brief explanation"}}'
        )

        try:
            url = f"{API_BASE}/models/{MODEL}:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 200,
                    "responseMimeType": "application/json",
                },
            }

            with httpx.Client(timeout=12.0) as client:
                response = client.post(url, json=payload)

            if response.status_code != 200:
                logger.error(f"Gemini scan error {response.status_code}: {response.text[:200]}")
                return {"popularity": "rising", "reasoning": f"API error {response.status_code}"}

            result = response.json()
            raw = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            logger.info(f"Popularity scan for '{term}': {raw}")

            parsed = json.loads(raw)
            popularity = parsed.get("popularity", "rising")
            reasoning = parsed.get("reasoning", "")

            if popularity not in ("popular", "rising", "unknown"):
                popularity = "rising"

            return {"popularity": popularity, "reasoning": reasoning}

        except Exception as e:
            logger.error(f"Scan error for '{term}': {e}")
            return {"popularity": "rising", "reasoning": f"Scan failed: {type(e).__name__}"}

    @staticmethod
    def rescan_term(term: str, meaning: str, last_scanned: Optional[datetime] = None) -> dict:
        """
        Evolution Loop re-scan: Check if a 'rising' term has gained popularity.
        Returns: {"popularity": "popular"|"rising"|"declining", "reasoning": "..."}
        """
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return {"popularity": "rising", "reasoning": "No API key"}

        since = last_scanned.strftime("%Y-%m-%d") if last_scanned else "initial scan"
        prompt = (
            f'Re-evaluate the Filipino slang term "{term}" (meaning: "{meaning}"). '
            f"Has its usage in Filipino digital culture (social media, messaging) "
            f"increased beyond standard thresholds since {since}? "
            f'Reply ONLY with JSON: {{"popularity": "popular"|"rising"|"declining", "reasoning": "brief explanation"}}'
        )

        try:
            url = f"{API_BASE}/models/{MODEL}:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 200,
                    "responseMimeType": "application/json",
                },
            }

            with httpx.Client(timeout=12.0) as client:
                response = client.post(url, json=payload)

            if response.status_code != 200:
                return {"popularity": "rising", "reasoning": f"API error {response.status_code}"}

            result = response.json()
            raw = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            logger.info(f"Rescan for '{term}': {raw}")

            parsed = json.loads(raw)
            return {
                "popularity": parsed.get("popularity", "rising"),
                "reasoning": parsed.get("reasoning", ""),
            }

        except Exception as e:
            logger.error(f"Rescan error for '{term}': {e}")
            return {"popularity": "rising", "reasoning": f"Rescan failed: {type(e).__name__}"}


async def evolution_loop():
    """
    Background worker: periodically re-scans 'rising' terms.
    - Graduates to 'popular' if popularity surges.
    - Marks as 'inactive' if stale for 30+ days and declining.
    """
    logger.info("Evolution Loop started")
    while True:
        try:
            await asyncio.sleep(EVOLUTION_INTERVAL)
            db = SessionLocal()
            try:
                rising = get_rising_submissions(db)
                if not rising:
                    continue

                logger.info(f"Evolution Loop: scanning {len(rising)} rising terms")
                for sub in rising:
                    result = CommunityService.rescan_term(
                        term=sub.phrase,
                        meaning=sub.proposed_translation,
                        last_scanned=sub.last_scanned,
                    )
                    popularity = result.get("popularity", "rising")
                    reasoning = result.get("reasoning", "")

                    if popularity == "popular":
                        graduate_submission(db, sub.id, reasoning=reasoning)
                        logger.info(f"GRADUATED: '{sub.phrase}' -> popular ({reasoning})")

                    elif popularity == "declining":
                        # Check if stale for STALE_DAYS
                        created = sub.created_at or datetime.utcnow()
                        if datetime.utcnow() - created > timedelta(days=STALE_DAYS):
                            mark_submission_inactive(db, sub.id, reasoning=reasoning)
                            logger.info(f"INACTIVE: '{sub.phrase}' -> inactive ({reasoning})")
                        else:
                            # Still within grace period, just update scan time
                            sub.last_scanned = datetime.utcnow()
                            sub.ai_reasoning = reasoning
                            db.commit()
                    else:
                        # Still rising, update scan time
                        sub.last_scanned = datetime.utcnow()
                        sub.ai_reasoning = reasoning
                        db.commit()

                    # Rate limit: wait between scans
                    await asyncio.sleep(2)

            finally:
                db.close()

        except asyncio.CancelledError:
            logger.info("Evolution Loop cancelled")
            break
        except Exception as e:
            logger.error(f"Evolution Loop error: {e}")
            await asyncio.sleep(10)
