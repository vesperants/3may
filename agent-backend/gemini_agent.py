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

# Import the root agent
try:
    from root_agent import route_to_agent
    USE_ROOT_AGENT = True
    log = logging.getLogger(__name__)
    log.info("✅ Using root agent for routing")
except ImportError as e:
    USE_ROOT_AGENT = False
    log = logging.getLogger(__name__)
    log.warning(f"❌ Failed to import root agent: {e}. Using single agent instead.")

# ─── logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
# ─────────────────────────────────────────────────────────────────────

load_dotenv()
PROJ = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
LOC  = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
APP  = os.getenv("VERTEX_SESSION_APP_NAME")
MAP  = pathlib.Path(__file__).with_name("session_map.json")
if not PROJ or not APP:
    print("❌ env error")
    sys.exit(1)

# Create a fallback single agent if root agent is not available
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
def chat(uid: str, cid: str, msg: str, selected_case_ids: list = None) -> str:
    log.info("=============== BACKEND DEBUG ===============")
    log.info(f"Chat function called with:")
    log.info(f"  - uid: {uid}")
    log.info(f"  - cid: {cid}")
    log.info(f"  - msg: {msg}")
    log.info(f"  - selected_case_ids: {selected_case_ids}")
    log.info("===========================================")
    
    cache = load_map()
    user_cache = cache.setdefault(uid, {})
    entry = user_cache.setdefault(cid, {})

    sid = cached_session(uid, cid)

    # If selected_case_ids are provided, store them in the session state
    if selected_case_ids and len(selected_case_ids) > 0:
        log.info(f"Received {len(selected_case_ids)} selected case IDs: {selected_case_ids}")
        
        # # COMMENTED OUT: Let route_to_agent handle selected cases delegation instead
        # # If this is a request for details about selected cases, handle it directly
        # if "selected cases" in msg.lower() or "details" in msg.lower():
        #     log.info("=============== DIRECT HANDLING DEBUG ===============")
        #     log.info(f"Detected request for case details in message: '{msg}'")
        #     log.info(f"Selected case IDs available: {selected_case_ids}")
        #     log.info("===================================================")
        #     
        #     log.info("Direct handling of case details request")
        #     try:
        #         # Import the case_details_tool directly
        #         log.info("Importing case_details_tool...")
        #         from agents.case_details_agent import case_details_tool
        #         
        #         # Call the tool directly with the selected case IDs
        #         log.info(f"Calling case_details_tool with case_ids={selected_case_ids}...")
        #         result = case_details_tool(
        #             question=f"Provide detailed information about these cases: {msg}",
        #             case_ids=selected_case_ids
        #         )
        #         
        #         if result:
        #             log.info(f"Successfully processed details for {len(selected_case_ids)} cases")
        #             log.info(f"Result length: {len(result)} characters")
        #             log.info(f"First 100 chars of result: {result[:100]}...")
        #             
        #             # Check if this is a markdown response that needs to be wrapped
        #             if result.startswith("# Case Details"):
        #                 log.info("Wrapping case details response in structured JSON format")
        #                 # Create a structured response with type CASE_DETAILS
        #                 structured_response = {
        #                     "type": "CASE_DETAILS",
        #                     "text": "Case details information",
        #                     "data": {
        #                         "content": result,
        #                         "case_ids": selected_case_ids
        #                     }
        #                 }
        #                 return json.dumps(structured_response)
        #             
        #             return result
        #         else:
        #             log.warning("No result from direct case_details_tool call")
        #     except Exception as e:
        #         log.exception(f"Error calling case_details_tool directly: {e}")
        # else:
        #     log.info("Selected case IDs provided but not a details request")

    # ---- send to agent ----------------------------------------------------
    reply = "Agent did not reply."
    
    if USE_ROOT_AGENT:
        try:
            # Use the root agent for routing
            log.info(f"Routing to agent with message: {msg[:50]}...")
            if selected_case_ids:
                log.info(f"Case IDs selected: {selected_case_ids}")
                reply = route_to_agent(user_id=uid, session_id=sid, message=msg, selected_case_ids=selected_case_ids)
            else:
                reply = route_to_agent(user_id=uid, session_id=sid, message=msg)
            log.info(f"Root agent response (first 100 chars): {reply[:100]}...")
            
            # Handle structured responses (especially case search results)
            try:
                # Attempt to parse the reply as JSON
                json_data = json.loads(reply)
                if isinstance(json_data, dict) and 'type' in json_data:
                    log.info(f"✅ Received structured response with type: {json_data['type']}")
                    
                    # Update the local log with the structured response
                    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
                    log_list = entry.get("log", [])
                    log_list.append({"sender": "user", "text": msg, "ts": now_iso})
                    log_list.append({"sender": "bot", "text": reply, "structured": True, "ts": now_iso})
                    entry["log"] = log_list[-200:]  # keep last 200 turns
                    entry["updatedAt"] = now_iso
                    
                    # Update title if needed
                    if not entry.get("title") or entry["title"].startswith(("Untitled", "New Chat")):
                        entry["title"] = msg[:30]
                    
                    user_cache[cid] = entry
                    cache[uid] = user_cache
                    save_map(cache)
                    
                    # Return the JSON as is - it will be parsed and rendered correctly by the frontend
                    return reply
            except json.JSONDecodeError:
                # Not a structured JSON response, continue with normal processing
                log.info("Response is not a valid JSON, handling as regular text")
                
            # If we're here, it's not a structured JSON response or there was an error
            # Check if reply contains case search results in text (fallback handling)
            if "case search results" in reply.lower() or "निर्णय नं" in reply:
                log.info("Detected case search results in text response")
        except Exception as e:
            log.exception(f"Error using root agent: {e}")
            log.info("Falling back to single agent")
            # Fall back to the single agent if there's an error
            content = types.Content(role="user", parts=[types.Part(text=msg)])
            for ev in runner.run(user_id=uid, session_id=sid, new_message=content):
                if (
                    ev.is_final_response()
                    and ev.author == agent.name
                    and ev.content
                    and ev.content.parts
                ):
                    reply = ev.content.parts[0].text
                    break
    else:
        # Use the single agent
        content = types.Content(role="user", parts=[types.Part(text=msg)])
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
    
    # Check if the reply is a structured JSON string with a 'type' field
    try:
        # Try to parse the reply as JSON
        json_reply = json.loads(reply)
        if isinstance(json_reply, dict) and 'type' in json_reply:
            # It's a structured response, preserve the JSON format
            log_list.append({"sender": "bot", "text": reply, "structured": True, "ts": now_iso})
            log.info(f"Detected structured response with type: {json_reply['type']}")
        else:
            # It's JSON but not our structured format, treat as regular text
            log_list.append({"sender": "bot", "text": reply, "ts": now_iso})
    except json.JSONDecodeError:
        # Not JSON, treat as regular text
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
    log.info("=============== CLI ENTRY POINT DEBUG ===============")
    log.info(f"CLI args: {sys.argv}")
    
    if len(sys.argv) < 4:
        log.error("❌ Missing required arguments")
        print("❌ need <user_id> <conversation_id> <message>")
        sys.exit(1)
    uid, cid = sys.argv[1:3]
    
    # Check if there's a JSON string of case IDs as the last argument
    selected_case_ids = None
    if len(sys.argv) > 4 and sys.argv[-1].startswith('[') and sys.argv[-1].endswith(']'):
        try:
            selected_case_ids = json.loads(sys.argv[-1])
            log.info(f"Detected selected case IDs in command line: {selected_case_ids}")
            # Remove the case IDs JSON from the arguments
            message = " ".join(sys.argv[3:-1]) or "(empty)"
            log.info(f"Message after removing case IDs: {message}")
        except json.JSONDecodeError as e:
            log.error(f"Failed to parse JSON case IDs: {e}")
            # Not valid JSON, treat as part of the message
            message = " ".join(sys.argv[3:]) or "(empty)"
            log.info(f"Treating all remaining args as message: {message}")
    else:
        message = " ".join(sys.argv[3:]) or "(empty)"
        log.info(f"No case IDs found, message: {message}")
    
    log.info("====================================================")
    
    try:
        print(chat(uid, cid, message, selected_case_ids))
    except Exception as e:
        log.exception(e)
        print("❌ error")
        sys.exit(1)