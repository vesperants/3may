#!/usr/bin/env python3
"""
Return chat history for (user_id, conversation_id).

• Prefers the cached `log` list in session_map.json.
• Falls back to Vertex session events if no log exists.
"""
import sys, os, json, logging, pathlib, re
from dotenv import load_dotenv
from google.adk.sessions import VertexAiSessionService
from google.genai.errors import ClientError

# ── logging ───────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)
log = logging.getLogger(__name__)
# ──────────────────────────────────────────────────────────────────────

load_dotenv()
PROJ = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
LOC  = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
APP  = os.getenv("VERTEX_SESSION_APP_NAME")
MAP  = pathlib.Path(__file__).with_name("session_map.json")
if not PROJ or not APP:
    print("[]"); sys.exit(1)

svc = VertexAiSessionService(project=PROJ, location=LOC)
MAIN_PREFIX = re.compile(r"^[^\s]+-main\s+", re.IGNORECASE)  # legacy strip

# ── helpers ───────────────────────────────────────────────────────────
def load_map():      return json.loads(MAP.read_text() or "{}") if MAP.exists() else {}
def save_map(m):     MAP.write_text(json.dumps(m, indent=2))

def cached_session(uid:str,cid:str):
    cache=load_map()
    if isinstance(cache.get(uid),str):  # root legacy
        cache[uid]={cid:{"sid":cache[uid]}}; save_map(cache)
    user_cache=cache.setdefault(uid,{})
    entry=user_cache.setdefault(cid,{})
    if isinstance(entry,str):
        entry={"sid":entry}; user_cache[cid]=entry; save_map(cache)

    sid=entry.get("sid")
    if sid:
        try: return svc.get_session(app_name=APP,user_id=uid,session_id=sid)
        except ClientError: log.warning("cached %s invalid — new",sid)

    sess=svc.create_session(app_name=APP,user_id=uid)
    entry["sid"]=getattr(sess,"id",None)or sess.get("id")
    user_cache[cid]=entry; cache[uid]=user_cache; save_map(cache)
    return sess

def clean(t:str)->str: return MAIN_PREFIX.sub("",t,count=1)

# ── main history function ─────────────────────────────────────────────
def history(uid:str,cid:str):
    sess = cached_session(uid,cid)
    cache = load_map()
    entry = cache.get(uid, {}).get(cid, {})

    # prefer cached log
    if isinstance(entry, dict) and entry.get("log"):
        return [
            {"sender":item["sender"],"text":item["text"],"id":f"c{i}"}
            for i,item in enumerate(entry["log"])
        ]

    # fallback to Vertex events
    out=[]
    for i,ev in enumerate(getattr(sess,"events",[])):
        if not (ev.content and ev.content.parts): continue
        txt = ev.content.parts[0].text
        if ev.author=="user": out.append({"sender":"user","text":clean(txt),"id":f"v{i}"})
        else:                 out.append({"sender":"bot", "text":txt,       "id":f"v{i}"})
    return out

# ── CLI entry ─────────────────────────────────────────────────────────
if __name__=="__main__":
    if len(sys.argv)<3: print("[]"); sys.exit(1)
    uid,cid=sys.argv[1:3]
    try: print(json.dumps(history(uid,cid)))
    except Exception as e:
        log.exception(e); print("[]"); sys.exit(1)