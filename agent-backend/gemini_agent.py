#!/usr/bin/env python3
"""
Send <message> for (user_id, conversation_id).

session_map.json stores

{ userId:
    { cid:
        { sid, title, updatedAt,
          log: [ {sender,text,ts}, … ] }
    }
}

stdout: reply text
"""
import sys, os, json, logging, pathlib, datetime
from dotenv import load_dotenv
from google.adk.agents   import Agent
from google.adk.runners  import Runner
from google.adk.sessions import VertexAiSessionService
from google.genai        import types
from google.genai.errors import ClientError

# ─── logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger(__name__)
# ─────────────────────────────────────────────────────────────────────

load_dotenv()
PROJ = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
LOC  = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
APP  = os.getenv("VERTEX_SESSION_APP_NAME")
MAP  = pathlib.Path(__file__).with_name("session_map.json")
if not PROJ or not APP:
    print("❌ env error")
    sys.exit(1)

agent = Agent(
    model="gemini-2.0-flash",
    name="conversational_agent",
    instruction="You are a helpful, concise assistant.",
)
svc = VertexAiSessionService(project=PROJ, location=LOC)
runner = Runner(agent=agent, app_name=APP, session_service=svc)

# ─── cache helpers ───────────────────────────────────────────────────
def load_map() -> dict:
    try:
        return json.loads(MAP.read_text())
    except Exception:
        return {}


def save_map(m: dict):
    MAP.write_text(json.dumps(m, indent=2))


def cached_session(uid: str, cid: str) -> str:
    """
    Ensure a Vertex session exists for (uid,cid) and return its session‑id.
    Upgrades older cache shapes in‑place.
    """
    cache = load_map()

    # root‑level legacy upgrade
    if isinstance(cache.get(uid), str):
        cache[uid] = {cid: {"sid": cache[uid]}}
        save_map(cache)

    user_cache = cache.setdefault(uid, {})
    entry = user_cache.setdefault(cid, {})

    # entry‑level legacy upgrade
    if isinstance(entry, str):
        entry = {"sid": entry}
        user_cache[cid] = entry
        save_map(cache)

    sid = entry.get("sid")
    if sid:
        try:
            svc.get_session(app_name=APP, user_id=uid, session_id=sid)
            return sid
        except ClientError:
            log.warning("cached %s invalid — creating new", sid)

    sess = svc.create_session(app_name=APP, user_id=uid)
    sid_new = getattr(sess, "id", None) or sess.get("id")
    entry["sid"] = sid_new
    user_cache[cid] = entry
    cache[uid] = user_cache
    save_map(cache)
    return sid_new


# ─── main chat routine ───────────────────────────────────────────────
def chat(uid: str, cid: str, msg: str) -> str:
    cache = load_map()
    user_cache = cache.setdefault(uid, {})
    entry = user_cache.setdefault(cid, {})

    sid = cached_session(uid, cid)

    # ---- send to agent ----------------------------------------------------
    content = types.Content(role="user", parts=[types.Part(text=msg)])
    reply = "Agent did not reply."
    for ev in runner.run(user_id=uid, session_id=sid, new_message=content):
        if (
            ev.is_final_response()
            and ev.author == agent.name
            and ev.content
            and ev.content.parts
        ):
            reply = ev.content.parts[0].text
            break

    # ---- update metadata & local log -------------------------------------
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    log_list = entry.get("log", [])
    log_list.append({"sender": "user", "text": msg, "ts": now_iso})
    log_list.append({"sender": "bot", "text": reply, "ts": now_iso})
    entry["log"] = log_list[-200:]  # keep last 200 turns
    entry["updatedAt"] = now_iso

    # give the chat a title if it still has a placeholder
    if not entry.get("title") or entry["title"].startswith(("Untitled", "New Chat")):
        entry["title"] = msg[:30]

    user_cache[cid] = entry
    cache[uid] = user_cache
    save_map(cache)

    return reply


# ─── CLI entry point ─────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("❌ need <user_id> <conversation_id> <message>")
        sys.exit(1)
    uid, cid = sys.argv[1:3]
    message = " ".join(sys.argv[3:]) or "(empty)"
    try:
        print(chat(uid, cid, message))
    except Exception as e:
        log.exception(e)
        print("❌ error")
        sys.exit(1)