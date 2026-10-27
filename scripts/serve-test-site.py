"""Serve this static site and the sibling calculator build for local TEST review."""

from argparse import ArgumentParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


SITE_ROOT = Path(__file__).resolve().parents[1]
CALCULATOR_DIST = SITE_ROOT.parent / "One-Stop-Rental-App" / "dist"


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


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8777)
    args = parser.parse_args()
    if not (CALCULATOR_DIST / "index.html").is_file():
        raise SystemExit("Calculator build missing. Run npm run build in One-Stop-Rental-App first.")
    with ThreadingHTTPServer(("127.0.0.1", args.port), TestSiteHandler) as server:
        print(f"TEST site and calculator: http://127.0.0.1:{args.port}/", flush=True)
        server.serve_forever()
