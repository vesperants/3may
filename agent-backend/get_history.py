#!/usr/bin/env python3
"""
Return chat history for <user_id> with the '…-main ' prefix stripped
from user messages that were stored by earlier runs.
"""
import sys, os, json, logging, pathlib, re
from dotenv import load_dotenv
from google.adk.sessions import VertexAiSessionService
from google.genai.errors import ClientError

# ── logging ────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)
# ────────────────────────────────────────────────────────────

load_dotenv()
PROJ = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
LOC  = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
APP  = os.getenv("VERTEX_SESSION_APP_NAME")
MAP  = pathlib.Path(__file__).with_name("session_map.json")

if not PROJ or not APP:
    print("[]"); sys.exit(1)

svc = VertexAiSessionService(project=PROJ, location=LOC)

# Regex strips any leading "<anything>-main " once.
MAIN_PREFIX = re.compile(r"^[^\s]+-main\s+", re.IGNORECASE)

def load_map():
    try: return json.loads(MAP.read_text())
    except Exception: return {}
def save_map(m): MAP.write_text(json.dumps(m))

def cached_session(uid: str):
    cache = load_map()
    sid = cache.get(uid)
    if sid:
        try:
            return svc.get_session(app_name=APP, user_id=uid, session_id=sid)
        except ClientError:
            log.warning(f"cached {sid} invalid — create new")
    sess = svc.create_session(app_name=APP, user_id=uid)
    sid_new = getattr(sess, "id", None) or sess.get("id")
    cache[uid] = sid_new; save_map(cache)
    return sess

def clean(text: str) -> str:
    """remove '<something>-main ' prefix once, if present"""
    return MAIN_PREFIX.sub("", text, count=1)

def history(uid: str):
    sess = cached_session(uid)
    out=[]
    for i, ev in enumerate(getattr(sess,"events",[])):
        if not (ev.content and ev.content.parts):
            continue
        txt = ev.content.parts[0].text
        if ev.author=="user":
            out.append({"sender":"user","text":clean(txt),"id":f"h{i}"})
        else:
            out.append({"sender":"bot","text":txt,"id":f"h{i}"})
    return out

# ── main ────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv)<2: print("[]"); sys.exit(1)
    uid=sys.argv[1]
    try: print(json.dumps(history(uid)))
    except Exception as e:
        log.exception(e); print("[]"); sys.exit(1)