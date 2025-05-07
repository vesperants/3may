#!/usr/bin/env python3
"""
Test script for session state handling with selected case IDs.
"""
import sys
import os
import logging
import json
import time
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Test function for session state
def test_session_state():
    try:
        # Import necessary components
        from google.adk.sessions import VertexAiSessionService
        import os
        
        # Get environment variables
        PROJ = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
        LOC = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        APP = os.getenv("VERTEX_SESSION_APP_NAME")
        
        if not all([PROJ, LOC, APP]):
            log.error("❌ Missing required environment variables")
            return False
        
        # Create session service
        svc = VertexAiSessionService(project=PROJ, location=LOC)
        
        # Create a test user and session ID
        user_id = "test_user_state"
        session_id = f"test_session_state_{int(time.time())}"  # Unique session ID
        
        # Create a new session
        session = svc.create_session(app_name=APP, user_id=user_id)
        log.info(f"Created new session: {session.id}")
        
        # Define test case IDs
        test_case_ids = ["9704", "9400"]
        
        # Store selected case IDs in session state
        state_dict = {"selected_case_ids": test_case_ids}
        svc.set_session_state(app_name=APP, user_id=user_id, session_id=session.id, state=state_dict)
        log.info(f"Updated session with selected case IDs: {test_case_ids}")
        
        # Retrieve the session to verify
        updated_session = svc.get_session(app_name=APP, user_id=user_id, session_id=session.id)
        stored_case_ids = updated_session.state.get("selected_case_ids", [])
        
        if stored_case_ids == test_case_ids:
            log.info(f"✅ Successfully retrieved selected case IDs from session: {stored_case_ids}")
            return True
        else:
            log.error(f"❌ Retrieved case IDs don't match: {stored_case_ids} vs {test_case_ids}")
            return False
            
    except Exception as e:
        log.exception(f"Error testing session state: {e}")
        return False

# Test the case_details_agent with session state
def test_case_details_with_state():
    try:
        import time
        from google.adk.sessions import VertexAiSessionService
        from google.adk.agents import Agent
        from google.adk.runners import Runner
        from google.genai import types
        
        # Import the case_details_agent
        from agents.case_details_agent import case_details_agent
        
        # Get environment variables
        PROJ = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
        LOC = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        APP = os.getenv("VERTEX_SESSION_APP_NAME")
        
        if not all([PROJ, LOC, APP]):
            log.error("❌ Missing required environment variables")
            return False
        
        # Create session service
        svc = VertexAiSessionService(project=PROJ, location=LOC)
        
        # Create a test user and session ID
        user_id = "test_user_details"
        session_id = f"test_session_details_{int(time.time())}"  # Unique session ID
        
        # Create a new session
        session = svc.create_session(app_name=APP, user_id=user_id)
        log.info(f"Created new session: {session.id}")
        
        # Store test case IDs in session state
        test_case_ids = ["9704", "9400"]
        state_dict = {"selected_case_ids": test_case_ids}
        svc.set_session_state(app_name=APP, user_id=user_id, session_id=session.id, state=state_dict)
        log.info(f"Updated session with selected case IDs: {test_case_ids}")
        
        # Create a runner for the case_details_agent
        runner = Runner(agent=case_details_agent, app_name=APP, session_service=svc)
        
        # Send a message to the case_details_agent
        message = "Give me details about the selected cases"
        content = types.Content(role="user", parts=[types.Part(text=message)])
        
        log.info(f"Sending message to case_details_agent: {message}")
        response = ""
        
        # Run the agent
        for ev in runner.run(user_id=user_id, session_id=session.id, new_message=content):
            if ev.is_final_response() and ev.content and ev.content.parts:
                response = ev.content.parts[0].text
                break
        
        # Check if the response contains case details
        if response and "Case Details" in response:
            log.info(f"✅ Received proper response from case_details_agent")
            log.info(f"Response preview: {response[:300]}...")
            return True
        else:
            log.error(f"❌ case_details_agent didn't properly use session state for case IDs")
            log.info(f"Response: {response}")
            return False
            
    except Exception as e:
        log.exception(f"Error testing case_details_agent with session state: {e}")
        return False

if __name__ == "__main__":
    log.info("===== Testing Session State for Selected Case IDs =====")
    
    # Import time module
    import time
    
    # Test session state
    if test_session_state():
        log.info("✅ Session state test successful")
    else:
        log.error("❌ Session state test failed")
    
    log.info("\n===== Testing Case Details Agent with Session State =====")
    
    # Test case_details_agent with session state
    if test_case_details_with_state():
        log.info("✅ Case details agent test with session state successful")
    else:
        log.error("❌ Case details agent test with session state failed") 