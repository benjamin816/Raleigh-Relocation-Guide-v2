"""Copy the Test homepage and chat assets into the temporary main-site preview.

Run from the main checkout after fetching Test-branch. Delete this script,
its workflow, and PREVIEW_DIR when the chat is promoted to main.
"""

from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PREVIEW_DIR = "raleigh-chat-preview-7b60c5f1e2b94d0ca61fa28d73c43a91"
PREFIX = f"/{PREVIEW_DIR}"
PASSCODE_HASH = "1fb411001e1ce2be174232bb2c0f1353546d30c5cc7b38fa6938b6bbf49bc25a"
FILES = (
    "assets/css/styles.css",
    "assets/css/raleigh-chat.css",
    "assets/js/script.js",
    "assets/js/raleigh-chat-config.js",
    "assets/js/raleigh-chat-engine.js",
    "assets/js/raleigh-chat.js",
    "assets/data/featured-videos.json",
)


def source_file(ref: str, path: str) -> bytes:
    return subprocess.check_output(["git", "show", f"{ref}:{path}"], cwd=ROOT)


def write(path: str, data: bytes) -> None:
    target = ROOT / PREVIEW_DIR / path
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or target.read_bytes() != data:
        target.write_bytes(data)


def gate_markup() -> str:
    return f"""
  <style>
    body:not(.preview-unlocked) > :not(#preview-gate):not(script) {{ visibility: hidden !important; }}
    #preview-gate {{ position: fixed; inset: 0; z-index: 2147483647; display: grid;
      place-items: center; padding: 20px; background: #073f31; color: #fff;
      font: 16px/1.5 system-ui, sans-serif; }}
    body.preview-unlocked #preview-gate {{ display: none; }}
    #preview-gate form {{ width: min(100%, 380px); padding: 30px; border-radius: 18px;
      background: #fff; color: #17352b; box-shadow: 0 18px 50px #0005; }}
    #preview-gate h1 {{ font-size: 1.4rem; margin: 0 0 8px; }}
    #preview-gate p {{ margin: 0 0 20px; }}
    #preview-gate label {{ display: block; font-weight: 700; }}
    #preview-gate input {{ display: block; width: 100%; margin: 8px 0 14px; padding: 12px;
      border: 1px solid #a6bbaf; border-radius: 8px; font: inherit; }}
    #preview-gate button {{ border: 0; border-radius: 8px; padding: 12px 20px;
      color: #17352b; background: #d8ac36; font: 700 1rem system-ui; cursor: pointer; }}
    #preview-error {{ color: #9b2727; min-height: 1.5em; margin: 10px 0 0 !important; }}
  </style>
"""


def gate_body(version: str) -> str:
    return f"""
  <div id="preview-gate" role="dialog" aria-modal="true" aria-labelledby="preview-title">
    <form id="preview-form" autocomplete="off">
      <h1 id="preview-title">Living in Raleigh test preview</h1>
      <p>Enter the testing passcode to open the Test homepage.</p>
      <label for="preview-code">Passcode</label>
      <input id="preview-code" type="password" inputmode="numeric" required autofocus>
      <button type="submit">Open preview</button>
      <p id="preview-error" role="alert"></p>
    </form>
  </div>
  <script>
    (function () {{
      var key = "raleigh-test-chat-preview-access";
      var gate = document.getElementById("preview-gate");
      var form = document.getElementById("preview-form");
      var code = document.getElementById("preview-code");
      var error = document.getElementById("preview-error");
      function openPreview() {{
        document.body.classList.add("preview-unlocked");
        gate.hidden = true;
        window.__raleighPreviewMode = true;
        function loadSiteScript() {{
          var script = document.createElement("script");
          script.src = "{PREFIX}/assets/js/script.js?v={version}";
          document.body.appendChild(script);
        }}
        if (document.readyState === "loading")
          document.addEventListener("DOMContentLoaded", loadSiteScript, {{once:true}});
        else loadSiteScript();
      }}
      if (sessionStorage.getItem(key) === "ok") {{ openPreview(); return; }}
      form.addEventListener("submit", async function (event) {{
        event.preventDefault();
        var bytes = new TextEncoder().encode("raleigh-chat-preview-v1:" + code.value);
        var digest = await crypto.subtle.digest("SHA-256", bytes);
        var hex = Array.from(new Uint8Array(digest), function (byte) {{
          return byte.toString(16).padStart(2, "0");
        }}).join("");
        if (hex !== "{PASSCODE_HASH}") {{
          error.textContent = "That passcode did not match.";
          code.value = "";
          code.focus();
          return;
        }}
        sessionStorage.setItem(key, "ok");
        openPreview();
      }});
    }})();
  </script>
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-ref", default="origin/Test-branch")
    args = parser.parse_args()
    version = subprocess.check_output(
        ["git", "rev-parse", "--short=12", args.source_ref], cwd=ROOT, text=True
    ).strip()

    chat_images = subprocess.check_output(
        ["git", "ls-tree", "-r", "--name-only", args.source_ref, "assets/images/chat"],
        cwd=ROOT, text=True,
    ).splitlines()
    for path in (*FILES, *chat_images):
        data = source_file(args.source_ref, path)
        if path == "assets/js/script.js":
            content = data.decode("utf-8-sig")
            content = content.replace(
                "var analyticsTracker = (function () {",
                "var analyticsTracker = (function () {\n"
                "    if (window.__raleighPreviewMode) return {track:function(){},"
                "markPopupInteraction:function(){},markFormInteraction:function(){}};",
                1,
            )
            for asset in ("raleigh-chat.css", "raleigh-chat-config.js", "raleigh-chat-engine.js", "raleigh-chat.js"):
                content = content.replace(f'"/assets/{"css" if asset.endswith("css") else "js"}/{asset}',
                                          f'"{PREFIX}/assets/{"css" if asset.endswith("css") else "js"}/{asset}')
                content = re.sub(
                    rf'({re.escape(PREFIX)}/assets/(?:css|js)/{re.escape(asset)}\?v=)[^"\']+',
                    rf'\g<1>{version}', content,
                )
            content = content.replace('"/assets/data/featured-videos.json', f'"{PREFIX}/assets/data/featured-videos.json')
            data = content.encode("utf-8")
        elif path == "assets/js/raleigh-chat-config.js":
            data = data.replace(b'"/assets/images/chat/raleigh-guide-avatar.png"',
                                f'"{PREFIX}/assets/images/chat/raleigh-guide-avatar.png"'.encode())
        write(path, data)

    html = source_file(args.source_ref, "index.html").decode("utf-8-sig")
    html = re.sub(r'<meta name="robots"[^>]*>', '<meta name="robots" content="noindex,nofollow,noarchive">', html, count=1)
    html = re.sub(r'\s*<link rel="canonical"[^>]*>', "", html, count=1)
    html = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', "", html, count=1, flags=re.S)
    html = html.replace('href="assets/css/styles.css', f'href="{PREFIX}/assets/css/styles.css')
    html = re.sub(rf'({re.escape(PREFIX)}/assets/css/styles\.css\?v=)[^"\']+',
                  rf'\g<1>{version}', html)
    html = re.sub(r'\s*<script src="assets/js/script\.js[^>]*></script>', "", html, count=1)
    html = html.replace("</head>", gate_markup() + "</head>", 1)
    html = html.replace('<body class="page-home">', '<body class="page-home">' + gate_body(version), 1)
    write("index.html", html.encode("utf-8"))


if __name__ == "__main__":
    main()
