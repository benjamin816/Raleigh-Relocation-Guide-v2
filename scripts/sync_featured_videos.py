#!/usr/bin/env python3
"""Generate featured videos JSON from a public/unlisted YouTube playlist feed.

This is designed for static hosting (GitHub Pages) where client-side direct fetches
from YouTube feeds are blocked by CORS.
"""

from __future__ import annotations

import json
import pathlib
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

PLAYLIST_ID = "PLybPdL80h3XvipcMYyTlpAuc6Ub6NaYXr"
WATCH_MORE_URL = "https://www.youtube.com/@living-in-raleigh-nc"
FEED_URL = f"https://www.youtube.com/feeds/videos.xml?playlist_id={PLAYLIST_ID}"
DEFAULT_SUBTEXT = "Thinking about moving to Raleigh, NC..."

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "assets" / "data" / "featured-videos.json"

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
}


def fetch_feed(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; RaleighVideoSync/1.0)",
            "Accept": "application/atom+xml,text/xml,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def text(node: ET.Element | None, xpath: str) -> str:
    if node is None:
        return ""
    child = node.find(xpath, NS)
    if child is None or child.text is None:
        return ""
    return child.text.strip()


def normalize_text(value: str) -> str:
    """Attempt to repair common UTF-8 mojibake sequences."""
    if not value:
        return value
    if "â" not in value and "ð" not in value:
        return value
    for source_encoding in ("cp1252", "latin-1"):
        try:
            repaired = value.encode(source_encoding, errors="strict").decode("utf-8", errors="strict")
            return repaired
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    return value


def parse_video_id(entry: ET.Element) -> str:
    video_id = text(entry, "yt:videoId")
    if video_id:
        return video_id

    full_id = text(entry, "atom:id")
    # Common shape: "yt:video:<id>"
    if full_id.startswith("yt:video:"):
        return full_id.split(":", 2)[-1]
    return ""


def parse_entries(xml_bytes: bytes) -> list[dict[str, str]]:
    root = ET.fromstring(xml_bytes)
    videos: list[dict[str, str]] = []

    for entry in root.findall("atom:entry", NS):
        video_id = parse_video_id(entry)
        if not video_id:
            continue

        title = normalize_text(text(entry, "atom:title")) or "Featured Video"
        published = text(entry, "atom:published") or text(entry, "atom:updated")

        videos.append(
            {
                "video_id": video_id,
                "title": title,
                "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "subtext": DEFAULT_SUBTEXT,
                "published": published,
            }
        )

    # Feed is usually newest first, but we sort defensively.
    videos.sort(key=lambda item: item.get("published", ""), reverse=True)
    return videos


def main() -> int:
    xml_bytes = fetch_feed(FEED_URL)
    videos = parse_entries(xml_bytes)

    payload = {
        "playlist_id": PLAYLIST_ID,
        "watch_more_url": WATCH_MORE_URL,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "videos": videos,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(videos)} videos to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
