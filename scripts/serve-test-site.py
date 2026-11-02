"""Serve the TEST website and sibling calculator build for local review."""

from argparse import ArgumentParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import io
import re
from urllib.parse import unquote, urlsplit


SITE_ROOT = Path(__file__).resolve().parents[1]
CALCULATOR_DIST = SITE_ROOT.parent / "One-Stop-Rental-App" / "dist"


class TestSiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_ROOT), **kwargs)

    def do_POST(self):
        self.send_error(404)

    def end_headers(self):
        # Test changes must be visible without asking the owner to clear Chrome.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def send_head(self):
        target = Path(self.translate_path(self.path))
        if target.is_dir():
            target = target / "index.html"
        if target.is_file() and target.suffix.lower() == ".html":
            # Each page uses the current loader even if its authored query
            # version predates the chatbot. Only the local server rewrites it.
            version = (SITE_ROOT / "assets/js/script.js").stat().st_mtime_ns
            content = target.read_text(encoding="utf-8")
            content = re.sub(r'(src=["\'](?:/|(?:\.\./)*)?assets/js/script\.js)(?:\?[^"\']*)?(["\'])',
                             lambda match: f'{match[1]}?v=local-{version}{match[2]}', content)
            body = content.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        return super().send_head()

    def translate_path(self, path):
        pathname = unquote(urlsplit(path).path)
        if pathname == "/calculator" or pathname.startswith("/calculator/"):
            relative = pathname.removeprefix("/calculator").lstrip("/")
            target = (CALCULATOR_DIST / relative).resolve()
            if not target.is_relative_to(CALCULATOR_DIST.resolve()):
                return str(CALCULATOR_DIST / "__invalid_path__")
            return str(target)
        return super().translate_path(path)


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8777)
    args = parser.parse_args()
    if not (CALCULATOR_DIST / "index.html").is_file():
        raise SystemExit("Calculator build missing. Run npm run build in One-Stop-Rental-App first.")
    with ThreadingHTTPServer(("127.0.0.1", args.port), TestSiteHandler) as server:
        print(f"TEST site and calculator: http://127.0.0.1:{args.port}/", flush=True)
        server.serve_forever()
