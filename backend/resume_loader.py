import io
import os
import re
import time
import requests
from pathlib import Path
from pypdf import PdfReader
from dotenv import load_dotenv

# Ensure environment variables are loaded
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_PATH)

# In-memory cached text and raw PDF bytes
_CACHED_RESUME_TEXT = None
_CACHED_RESUME_PDF = None
_CACHE_UPDATED_AT = 0.0
RESUME_CACHE_TTL_SECONDS = 900


def extract_file_id(drive_url_or_id: str) -> str:
    """Extracts file ID from any standard Google Drive share link or returns raw ID."""
    match = re.search(r"/d/([a-zA-Z0-9_-]+)", drive_url_or_id)
    if match:
        return match.group(1)
    match_id = re.search(r"id=([a-zA-Z0-9_-]+)", drive_url_or_id)
    if match_id:
        return match_id.group(1)
    return drive_url_or_id.strip()


def fetch_resume_from_drive(drive_url_or_id: str) -> tuple[str, bytes]:
    """
    Downloads the PDF from Google Drive, extracts text via pypdf,
    and updates in-memory cache.
    """
    global _CACHED_RESUME_TEXT, _CACHED_RESUME_PDF, _CACHE_UPDATED_AT

    file_id = extract_file_id(drive_url_or_id)
    session = requests.Session()

    # Primary download URL
    url = f"https://drive.google.com/uc?export=download&id={file_id}"
    headers = {"User-Agent": "Mozilla/5.0"}
    response = session.get(url, headers=headers, timeout=20)

    # Handle Google Drive virus warning/confirmation interstitial if prompted
    for key, value in response.cookies.items():
        if key.startswith("download_warning"):
            params = {"id": file_id, "confirm": value}
            response = session.get(url, params=params, headers=headers, timeout=20)
            break

    # If user provided a Google Docs link, export format as txt directly
    if b"%PDF" not in response.content[:10]:
        doc_export_url = f"https://docs.google.com/document/d/{file_id}/export?format=txt"
        doc_resp = session.get(doc_export_url, headers=headers, timeout=15)
        if doc_resp.status_code == 200 and len(doc_resp.text.strip()) > 30:
            _CACHED_RESUME_TEXT = doc_resp.text.strip()
            _CACHED_RESUME_PDF = None
            _CACHE_UPDATED_AT = time.monotonic()
            return _CACHED_RESUME_TEXT, b""

        raise ValueError(
            f"Failed to fetch valid PDF or Doc from Google Drive. Status: {response.status_code}. "
            "Ensure the file permission is set to 'Anyone with the link can view'."
        )

    pdf_bytes = response.content
    pdf_reader = PdfReader(io.BytesIO(pdf_bytes))

    extracted_pages = []
    for page in pdf_reader.pages:
        text = page.extract_text()
        if text:
            extracted_pages.append(text)

    full_text = "\n\n".join(extracted_pages).strip()

    if not full_text:
        raise ValueError("Could not extract any text from the downloaded PDF.")

    _CACHED_RESUME_TEXT = full_text
    _CACHED_RESUME_PDF = pdf_bytes
    _CACHE_UPDATED_AT = time.monotonic()

    return _CACHED_RESUME_TEXT, _CACHED_RESUME_PDF


def sync_drive_resume() -> str:
    """
    Called by backend/resume.py and /resume/sync endpoint.
    Reads GOOGLE_DRIVE_RESUME_URL or GOOGLE_DRIVE_FILE_ID from environment.
    """
    drive_url = (
        os.getenv("GOOGLE_DRIVE_RESUME_URL")
        or os.getenv("GOOGLE_DRIVE_FILE_ID")
        or os.getenv("DRIVE_RESUME_URL")
        or ""
    )

    if not drive_url:
        return ""

    try:
        text, _ = fetch_resume_from_drive(drive_url)
        return text
    except Exception:
        return ""


def get_current_resume_text() -> str:
    """Returns cached text and refreshes it periodically from the configured source."""
    global _CACHED_RESUME_TEXT
    cache_is_fresh = time.monotonic() - _CACHE_UPDATED_AT < RESUME_CACHE_TTL_SECONDS
    if _CACHED_RESUME_TEXT and cache_is_fresh:
        return _CACHED_RESUME_TEXT

    text = sync_drive_resume()
    return text or _CACHED_RESUME_TEXT or ""


def get_current_resume_pdf() -> bytes | None:
    return _CACHED_RESUME_PDF