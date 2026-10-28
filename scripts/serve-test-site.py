"""Serve this static site and the sibling calculator build for local TEST review."""

from argparse import ArgumentParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from threading import Lock
from urllib.parse import unquote, urlsplit


SITE_ROOT = Path(__file__).resolve().parents[1]
CALCULATOR_DIST = SITE_ROOT.parent / "One-Stop-Rental-App" / "dist"
CHAT_CONFIG = SITE_ROOT / "assets" / "js" / "raleigh-chat-config.js"
CONFIG_LOCK = Lock()
LOCAL_PATH = re.compile(r"^/(?!/)[a-zA-Z0-9_/-]*$")


def publish_chat_config():
    """Share editor saves through Test-branch without including unrelated files."""
    def git(*args, timeout=45):
        return subprocess.run(["git", *args], cwd=SITE_ROOT, capture_output=True,
                              text=True, timeout=timeout, check=False)

    try:
        branch = git("branch", "--show-current")
        if branch.returncode or branch.stdout.strip() != "Test-branch":
            return False, "Saved locally. The site is not on Test-branch, so the shared preview was not updated."
        fetched = git("fetch", "origin", "Test-branch")
        if fetched.returncode:
            return False, "Saved locally. Could not check the remote Test branch; the shared preview was not updated."
        head = git("rev-parse", "HEAD").stdout.strip()
        remote = git("rev-parse", "origin/Test-branch").stdout.strip()
        if not head or head != remote:
            return False, "Saved locally. Test-branch changed elsewhere; ask Codex to sync before the shared preview updates."
        changed = git("status", "--porcelain", "--", "assets/js/raleigh-chat-config.js")
        if changed.returncode:
            return False, "Saved locally. Could not check the flow file for sharing."
        if not changed.stdout.strip():
            return True, "Already shared with Ricardo's preview."
        committed = git("commit", "--only", "-m", "Update Test chat flow from editor", "--",
                        "assets/js/raleigh-chat-config.js")
        if committed.returncode:
            return False, "Saved locally. Could not commit the flow edit to Test-branch."
        pushed = git("push", "origin", "Test-branch", timeout=60)
        if pushed.returncode:
            return False, "Saved locally. Could not push Test-branch; the shared preview was not updated."
        return True, "Shared with Ricardo's preview. It may take a few minutes to refresh."
    except (OSError, subprocess.TimeoutExpired):
        return False, "Saved locally. Sharing timed out; the preview may still show the previous version."


def read_current_chat_config():
    source = CHAT_CONFIG.read_text(encoding="utf-8")
    marker = "window.RaleighChatConfig = "
    if marker not in source:
        raise ValueError("The current chat configuration could not be read.")
    return json.loads(source.split(marker, 1)[1].strip().removesuffix(";"))


def validate_chat_config(config):
    if not isinstance(config, dict):
        raise ValueError("The flow configuration must be an object.")
    for field in ("title", "welcome", "fallback", "contactPrompt", "contactConsentPrompt"):
        if not isinstance(config.get(field), str) or not 1 <= len(config[field]) <= 2000:
            raise ValueError(f"Invalid {field}.")
    for field in ("unknownQuestion", "safetyWarning", "safetyEnd"):
        if not isinstance(config.get(field), str) or not 1 <= len(config[field]) <= 1000:
            raise ValueError(f"Invalid {field}.")
    origins = config.get("originAcknowledgements")
    if not isinstance(origins, dict) or not all(
        isinstance(origins.get(place), str) and 1 <= len(origins[place]) <= 500
        for place in ("ohio", "new york")
    ):
        raise ValueError("Invalid origin acknowledgements.")
    days = config.get("conversationMemoryDays")
    if not isinstance(days, int) or not 1 <= days <= 365:
        raise ValueError("Memory must be between 1 and 365 days.")
    links = config.get("bookingLinks")
    if not isinstance(links, dict) or not all(
        isinstance(links.get(key), str) and LOCAL_PATH.fullmatch(links[key])
        for key in ("general", "investing")
    ):
        raise ValueError("Booking links must be local paths.")
    if not isinstance(config.get("investorContactUrl"), str) or not LOCAL_PATH.fullmatch(config["investorContactUrl"]):
        raise ValueError("Investor contact link must be a local path.")
    bridge = config.get("bookingBridgeUrl", "")
    if not isinstance(bridge, str) or (bridge and not re.fullmatch(r"https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec", bridge)):
        raise ValueError("Booking bridge must be a deployed Google Apps Script URL.")
    for field in ("bookingChoicePrompt", "bookingEmailPrompt", "bookingPhonePrompt", "bookingNamePrompt"):
        if not isinstance(config.get(field), str) or not 1 <= len(config[field]) <= 500:
            raise ValueError(f"Invalid {field}.")
    if not isinstance(config.get("investorQuestionUrl"), str) or not LOCAL_PATH.fullmatch(config["investorQuestionUrl"]):
        raise ValueError("Investor question link must be a local path.")
    topic_ids = ("buying", "selling", "relocating", "investing")
    topics = config.get("topics")
    if not isinstance(topics, list) or [topic.get("id") for topic in topics if isinstance(topic, dict)] != list(topic_ids):
        raise ValueError("The four conversation paths must be present.")
    flows = config.get("flows")
    if not isinstance(flows, dict) or set(flows) != set(topic_ids):
        raise ValueError("The four conversation flows must be present.")
    for topic_id in topic_ids:
        flow = flows[topic_id]
        if not isinstance(flow, dict) or flow.get("booking") not in ("general", "investing"):
            raise ValueError(f"Invalid {topic_id} booking destination.")
        for field in ("intro", "finish"):
            if not isinstance(flow.get(field), str) or not 1 <= len(flow[field]) <= 2000:
                raise ValueError(f"Invalid {topic_id} {field}.")
        keywords = flow.get("keywords")
        if not isinstance(keywords, list) or not 1 <= len(keywords) <= 60 or not all(
            isinstance(word, str) and 1 <= len(word) <= 80 for word in keywords
        ):
            raise ValueError(f"Invalid {topic_id} intent keywords.")
        questions = flow.get("questions")
        if not isinstance(questions, list) or len(questions) > 24 or not all(
            isinstance(question, dict) and isinstance(question.get("text"), str)
            and 1 <= len(question["text"]) <= 500
            and isinstance(question.get("key", ""), str) and len(question.get("key", "")) <= 40
            and question.get("when", "") in ("", "local", "out", "renting", "owning", "combined", "solo",
                                               "family", "newJob", "rentalClarificationNeeded", "outNeedsPriorities",
                                               "areaReasonNeeded", "prioritySingle", "priorityPrice", "priorityFinancingNeeded", "budgetNeeded", "budgetKnown")
            and isinstance(question.get("alternatives", []), list) and len(question.get("alternatives", [])) <= 3
            and all(isinstance(text, str) and 1 <= len(text) <= 500 for text in question.get("alternatives", []))
            for question in questions
        ):
            raise ValueError(f"Invalid {topic_id} questions.")
        secondary = flow.get("secondaryLink")
        if secondary and (
            not isinstance(secondary, dict) or not isinstance(secondary.get("label"), str)
            or not isinstance(secondary.get("href"), str) or not LOCAL_PATH.fullmatch(secondary["href"])
        ):
            raise ValueError(f"Invalid {topic_id} secondary link.")
        resource = flow.get("resourceLink")
        if not isinstance(resource, dict) or not isinstance(resource.get("label"), str) or not 1 <= len(resource["label"]) <= 100 or not isinstance(resource.get("href"), str) or not LOCAL_PATH.fullmatch(resource["href"]):
            raise ValueError(f"Invalid {topic_id} resource link.")
        if topic_id == "selling":
            if not isinstance(flow.get("combinedIntro"), str) or not 1 <= len(flow["combinedIntro"]) <= 1000:
                raise ValueError("Invalid selling and buying opening.")
            if not isinstance(flow.get("finishNextSummer"), str) or not 1 <= len(flow["finishNextSummer"]) <= 2000:
                raise ValueError("Invalid next-summer selling close.")
    faq = config.get("faq")
    if not isinstance(faq, list) or len(faq) > 40 or not all(
        isinstance(item, dict) and isinstance(item.get("answer"), str) and 1 <= len(item["answer"]) <= 1000
        and isinstance(item.get("keywords"), list) and 1 <= len(item["keywords"]) <= 20
        and all(isinstance(word, str) and 1 <= len(word) <= 80 for word in item["keywords"])
        for item in faq
    ):
        raise ValueError("Invalid common answers.")
    contact_questions = config.get("contactQuestions")
    if not isinstance(contact_questions, list) or [item.get("key") for item in contact_questions if isinstance(item, dict)] != ["name", "email", "phone", "question"]:
        raise ValueError("Contact questions are incomplete.")
    if not all(isinstance(item.get("prompt"), str) and 1 <= len(item["prompt"]) <= 500
               and isinstance(item.get("retry"), str) and 1 <= len(item["retry"]) <= 500
               for item in contact_questions):
        raise ValueError("Invalid contact prompts.")
    if config.get("avatar") != "/assets/images/chat/raleigh-guide-avatar.png" or config.get("excludedPaths") != ["/consult/", "/2026/"]:
        raise ValueError("Protected widget settings cannot be changed here.")


class TestSiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_ROOT), **kwargs)

    def translate_path(self, path):
        pathname = unquote(urlsplit(path).path)
        if pathname == "/calculator" or pathname.startswith("/calculator/"):
            relative = pathname.removeprefix("/calculator").lstrip("/")
            target = (CALCULATOR_DIST / relative).resolve()
            if not target.is_relative_to(CALCULATOR_DIST.resolve()):
                return str(CALCULATOR_DIST / "__invalid_path__")
            return str(target)
        return super().translate_path(path)

    def do_POST(self):
        if urlsplit(self.path).path != "/__test/chat-config":
            self.send_error(404)
            return
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin", "")
        expected_origin = f"http://127.0.0.1:{self.server.server_port}"
        if host != f"127.0.0.1:{self.server.server_port}" or origin != expected_origin:
            self.send_error(403, "Local editor only")
            return
        if self.headers.get_content_type() != "application/json":
            self.send_error(415, "JSON required")
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 1 <= size <= 100_000:
                raise ValueError("The flow file is too large.")
            edits = json.loads(self.rfile.read(size))
            if not isinstance(edits, dict):
                raise ValueError("The flow configuration must be an object.")
            with CONFIG_LOCK:
                config = read_current_chat_config()
                editable = ("title", "welcome", "fallback", "conversationMemoryDays", "contactPrompt",
                            "contactConsentPrompt", "contactQuestions", "bookingLinks", "investorContactUrl",
                            "investorQuestionUrl", "bookingChoicePrompt", "bookingEmailPrompt", "bookingPhonePrompt",
                            "bookingNamePrompt", "flows", "faq")
                for field in editable:
                    if field in edits:
                        config[field] = edits[field]
                validate_chat_config(config)
                source = "// Raleigh chat conversation configuration. Edit in tools/chat-flow-editor/.\n"
                source += "window.RaleighChatConfig = " + json.dumps(config, ensure_ascii=False, indent=2) + ";\n"
                with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="\n", dir=CHAT_CONFIG.parent, prefix=".raleigh-chat-", suffix=".tmp", delete=False) as pending:
                    pending.write(source)
                    pending_path = Path(pending.name)
                try:
                    os.replace(pending_path, CHAT_CONFIG)
                finally:
                    pending_path.unlink(missing_ok=True)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"ok": False, "error": str(error)})
            return
        shared, note = publish_chat_config()
        self.send_json(200, {"ok": True, "saved": "assets/js/raleigh-chat-config.js",
                             "shared": shared, "note": note})

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8777)
    args = parser.parse_args()
    if not (CALCULATOR_DIST / "index.html").is_file():
        raise SystemExit("Calculator build missing. Run npm run build in One-Stop-Rental-App first.")
    with ThreadingHTTPServer(("127.0.0.1", args.port), TestSiteHandler) as server:
        print(f"TEST site and calculator: http://127.0.0.1:{args.port}/", flush=True)
        server.serve_forever()
