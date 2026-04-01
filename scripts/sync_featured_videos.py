#!/usr/bin/env python3
"""Generate featured videos JSON feeds for home and suburb pages.

Homepage feed is sourced from a fixed playlist ID.
Suburb feeds are sourced by matching suburb page slugs to YouTube playlist titles
from the channel playlists page (for example: "north-raleigh").
"""

from __future__ import annotations

import json
import pathlib
import re
import urllib.request
import xml.etree.ElementTree as ET
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any

PRIMARY_PLAYLIST_ID = "PLybPdL80h3XvipcMYyTlpAuc6Ub6NaYXr"
CHANNEL_URL = "https://www.youtube.com/@living-in-raleigh-nc"
WATCH_MORE_URL = CHANNEL_URL
CHANNEL_PLAYLISTS_URL = f"{CHANNEL_URL}/playlists"
DEFAULT_SUBTEXT = "Thinking about moving to Raleigh, NC..."

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPLORE_AREA_DIR = ROOT / "explore-the-area"
OUT_PATH = ROOT / "assets" / "data" / "featured-videos.json"
OUT_SUBURB_DIR = ROOT / "assets" / "data" / "featured-videos"

# Manual overrides let us support unlisted playlists that do not appear on the
# channel's public /playlists page.
MANUAL_SUBURB_PLAYLIST_IDS: dict[str, str] = {
    "cary": "PLybPdL80h3XvFJRDLowLXaP_uDoibfaHt",
    "raleigh": "PLybPdL80h3XsclSgZPVBPCZX2LW9HhH0-",
    "apex": "PLybPdL80h3XuWZB95BbC2pe-wspLWO0pv",
    "wake-forest": "PLybPdL80h3XtKnazS__YppgjwM6W2FZzz",
}

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}


def fetch_url(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; RaleighVideoSync/1.1)",
            "Accept": "application/atom+xml,text/xml,text/html,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def fetch_feed_for_playlist(playlist_id: str) -> bytes:
    feed_url = f"https://www.youtube.com/feeds/videos.xml?playlist_id={playlist_id}"
    return fetch_url(feed_url)


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
            return value.encode(source_encoding, errors="strict").decode("utf-8", errors="strict")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    return value


def parse_subtext(entry: ET.Element) -> str:
    description = normalize_text(text(entry, "media:group/media:description"))
    if not description:
        return DEFAULT_SUBTEXT

    for line in description.splitlines():
        first_line = line.strip()
        if first_line:
            return first_line

    return DEFAULT_SUBTEXT


def parse_video_id(entry: ET.Element) -> str:
    video_id = text(entry, "yt:videoId")
    if video_id:
        return video_id

    full_id = text(entry, "atom:id")
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
        subtext = parse_subtext(entry)
        published = text(entry, "atom:published") or text(entry, "atom:updated")

        videos.append(
            {
                "video_id": video_id,
                "title": title,
                "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "subtext": subtext,
                "published": published,
            }
        )

    videos.sort(key=lambda item: item.get("published", ""), reverse=True)
    return videos


def parse_yt_initial_data(html: str) -> dict[str, Any]:
    marker = "var ytInitialData = "
    start = html.find(marker)
    if start < 0:
        return {}
    start += len(marker)
    end = html.find(";</script>", start)
    if end < 0:
        return {}

    try:
        return json.loads(html[start:end])
    except json.JSONDecodeError:
        return {}


def walk_json(node: Any):
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from walk_json(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk_json(value)


def extract_title_from_node(node: dict[str, Any]) -> str:
    lockup_title = (
        node.get("metadata", {})
        .get("lockupMetadataViewModel", {})
        .get("title", {})
        .get("content", "")
    )
    if isinstance(lockup_title, str) and lockup_title.strip():
        return lockup_title.strip()

    title = node.get("title")
    if isinstance(title, dict):
        simple_text = title.get("simpleText", "")
        if isinstance(simple_text, str) and simple_text.strip():
            return simple_text.strip()
        runs = title.get("runs")
        if isinstance(runs, list):
            combined = "".join(
                part.get("text", "") for part in runs if isinstance(part, dict) and isinstance(part.get("text"), str)
            ).strip()
            if combined:
                return combined

    if isinstance(title, str) and title.strip():
        return title.strip()

    return ""


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def fetch_channel_playlists() -> list[dict[str, str]]:
    html = fetch_url(CHANNEL_PLAYLISTS_URL).decode("utf-8", errors="replace")
    data = parse_yt_initial_data(html)
    if not data:
        return []

    unique_pairs: "OrderedDict[tuple[str, str], None]" = OrderedDict()
    for node in walk_json(data):
        playlist_id = node.get("contentId")
        if not isinstance(playlist_id, str) or not playlist_id.startswith("PL"):
            continue
        title = extract_title_from_node(node)
        if not title:
            continue
        unique_pairs[(title, playlist_id)] = None

    return [{"title": title, "playlist_id": playlist_id} for (title, playlist_id) in unique_pairs.keys()]


def get_suburb_slugs() -> list[str]:
    if not EXPLORE_AREA_DIR.exists():
        return []

    slugs = []
    for path in sorted(EXPLORE_AREA_DIR.iterdir()):
        if path.is_dir() and (path / "index.html").exists():
            slugs.append(path.name)
    return slugs


def build_suburb_playlist_lookup(playlists: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    lookup: dict[str, dict[str, str]] = {}
    for playlist in playlists:
        key = normalize_key(playlist.get("title", ""))
        if key and key not in lookup:
            lookup[key] = playlist

    for suburb_slug, playlist_id in MANUAL_SUBURB_PLAYLIST_IDS.items():
        key = normalize_key(suburb_slug)
        if not key or not playlist_id:
            continue
        lookup[key] = {
            "title": suburb_slug,
            "playlist_id": playlist_id,
        }

    return lookup


def write_json(path: pathlib.Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def make_payload(
    *,
    playlist_id: str,
    watch_more_url: str,
    videos: list[dict[str, str]],
    generated_at: str,
    playlist_title: str = "",
    slug: str = "",
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "playlist_id": playlist_id,
        "watch_more_url": watch_more_url,
        "generated_at": generated_at,
        "videos": videos,
    }
    if playlist_title:
        payload["playlist_title"] = playlist_title
    if slug:
        payload["slug"] = slug
    return payload


def main() -> int:
    generated_at = datetime.now(timezone.utc).isoformat()

    primary_videos = parse_entries(fetch_feed_for_playlist(PRIMARY_PLAYLIST_ID))
    primary_payload = make_payload(
        playlist_id=PRIMARY_PLAYLIST_ID,
        watch_more_url=WATCH_MORE_URL,
        videos=primary_videos,
        generated_at=generated_at,
    )
    write_json(OUT_PATH, primary_payload)
    print(f"Wrote {len(primary_videos)} videos to {OUT_PATH}")

    suburbs = get_suburb_slugs()
    if not suburbs:
        return 0

    try:
        channel_playlists = fetch_channel_playlists()
    except Exception as exc:
        print(f"Warning: could not load channel playlists ({exc})")
        channel_playlists = []

    playlist_lookup = build_suburb_playlist_lookup(channel_playlists)

    for slug in suburbs:
        playlist = playlist_lookup.get(normalize_key(slug))
        output_path = OUT_SUBURB_DIR / f"{slug}.json"

        if not playlist:
            empty_payload = make_payload(
                playlist_id="",
                watch_more_url=WATCH_MORE_URL,
                videos=[],
                generated_at=generated_at,
                slug=slug,
            )
            write_json(output_path, empty_payload)
            print(f"No matching playlist for '{slug}' -> wrote empty feed")
            continue

        playlist_id = playlist["playlist_id"]
        playlist_title = playlist["title"]
        playlist_url = f"https://www.youtube.com/playlist?list={playlist_id}"

        try:
            videos = parse_entries(fetch_feed_for_playlist(playlist_id))
        except Exception as exc:
            print(f"Warning: failed to fetch playlist '{playlist_title}' ({playlist_id}): {exc}")
            videos = []

        payload = make_payload(
            playlist_id=playlist_id,
            watch_more_url=playlist_url,
            videos=videos,
            generated_at=generated_at,
            playlist_title=playlist_title,
            slug=slug,
        )
        write_json(output_path, payload)
        print(f"Wrote {len(videos)} videos for '{slug}' to {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
