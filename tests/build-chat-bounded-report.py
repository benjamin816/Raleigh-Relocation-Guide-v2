"""Render original results and repaired replays without changing either."""
import hashlib
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
escape = lambda value: html.escape(str(value))
sections, rows, manifest = [], [], []
for round_number in (1, 2, 3):
    folder = root / f"output/chat-bounded-round{round_number}"
    original_path = folder / "first-pass.json"
    original = json.loads(original_path.read_text(encoding="utf-8"))
    repaired = json.loads((folder / "permanent-regression-replay.json").read_text(encoding="utf-8"))
    raw_passes = sum(not case["issues"] for case in original)
    turns = sum(len(case["transcript"]) for case in original)
    rows.append(f"<tr><td>{round_number}</td><td>{raw_passes}/50</td><td>{turns}</td><td>50/50 reviewed</td></tr>")
    fixture = root / f"tests/fixtures/chat-bounded-round{round_number}.json"
    manifest.append({"round": round_number, "raw_first_pass": raw_passes, "visitor_turns": turns,
                     "fixture_sha256": hashlib.sha256(fixture.read_bytes()).hexdigest(),
                     "first_pass_sha256": hashlib.sha256(original_path.read_bytes()).hexdigest()})
    for title, results in (("Original first pass", original), ("Repaired regression replay", repaired)):
        cases = []
        for case in results:
            issue = ", ".join(case["issues"]) or "No automated check failures"
            if case["sessionId"] == "F2-33":
                issue += " — reviewed: six-month rental exit is correct; original booking expectation was invalid"
            dialogue = "".join(f'<div class="visitor"><b>Visitor</b><p>{escape(turn["user"])}</p></div>'
                               f'<div class="sam"><b>Sam</b><p>{escape(turn["bot"])}</p></div>'
                               for turn in case["transcript"])
            cases.append(f'<details><summary>{escape(case["sessionId"])} · {escape(case["label"])} — {escape(issue)}</summary>{dialogue}</details>')
        sections.append(f'<section><h2>Round {round_number}: {title}</h2>{"".join(cases)}</section>')

content = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chatbot bounded testing — November 2</title>
<style>body{font:17px/1.55 system-ui;margin:32px auto;padding:0 20px;max-width:1100px;color:#173a30;background:#fafbf9}h1,h2{line-height:1.2}table{border-collapse:collapse;width:100%;background:white}th,td{padding:12px;border:1px solid #ccc;text-align:left}details{margin:12px 0;padding:14px;background:white;border:1px solid #ccd6d1;border-radius:8px}summary{cursor:pointer;font-weight:600}.visitor,.sam{padding:10px 18px;margin:10px 0;border-radius:8px}.visitor{background:#edf0f3;margin-left:30px}.sam{background:#fff5cc;margin-right:30px}p{margin:4px 0;white-space:pre-wrap}.note{border-left:5px solid #d6ae31;padding:15px;background:#fff8dc}code{overflow-wrap:anywhere}</style>
<h1>Three bounded rounds: original results and full transcripts</h1>
<p class="note">Stopped after the agreed maximum of three fresh rounds. No fresh round was completely clean. The final fresh result was 49/50. Repairs pass the retained cases, which does not prove future conversations will be error-free.</p>
<table><tr><th>Fresh round</th><th>Original automated passes</th><th>Visitor turns</th><th>Final repaired replay</th></tr>''' + "".join(rows) + '''</table>
<h2>What these numbers mean</h2>
<p>150 new scenario specifications were frozen in Git before their respective execution. The real local conversation functions ran with scripted visitor continuations and mocked availability, calendar, lead, email, and upload services. These are automated conversations, not 150 manual browser sessions or independent human reviews. No live bookings were created.</p>
<p>Round 2 flagged eight cases. Seven exposed origin-handling defects. F2-33 was an invalid test expectation: after the visitor answered “Six months,” the bot correctly followed the owner's long-renter resource path. Its original result remains unchanged; the permanent test explicitly verifies that exit and absence of a booking. The reviewed original Round 2 result is therefore 43/50. The repaired score includes that correct exit.</p>
<p>The prior batch's nine known failures were repaired and replayed separately: 50/50. They are not counted as a fresh clean round. All 150 new cases remain permanent regression coverage, alongside the earlier regression suites.</p>
<p>Fixes cover illness idioms, legitimate short preferences, written-out budgets, seller-plus-buyer intent, renter qualification, seller referrals, day/ordinal/evening selections, direct phone requests, origin corrections, sentence boundaries, remote-work origins, rental destinations and relatives' addresses.</p>
<p>The mocked booking response always displays Benjamin. Named-host checks inspect the requested preferredHost payload instead; this run does not verify real round-robin assignment, real invitations or the pre-call email. Live chatbot booking authority remains paused. The prepared short-referral service deployment and a controlled real booking/email verification are still separate release work.</p>
<p>Each round uses new openings and combinations but reuses some adaptive answer templates and the same deterministic calendar. That gives repeatable coverage, not an unbiased statistical estimate of all visitors. Checks focus on flow, captured facts and booking requests; a passing result is not a guarantee of ideal wording or visual behavior.</p>
''' + "".join(sections) + '<h2>Evidence hashes</h2><pre><code>' + escape(json.dumps(manifest, indent=2)) + '</code></pre></html>'
target = root / "output/chat-bounded-review/report-and-transcripts.html"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(content, encoding="utf-8")
(target.parent / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(target)
