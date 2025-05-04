#!/usr/bin/env python3
"""
Test script for the root agent implementation.
"""
import sys
import os
import logging
from dotenv import load_dotenv
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Import the root agent
try:
    from root_agent import route_to_agent
    
    # Get environment variables
    PROJ = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
    LOC = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    APP = os.getenv("VERTEX_SESSION_APP_NAME")
    
    if not all([PROJ, LOC, APP]):
        log.error("❌ Missing required environment variables")
        sys.exit(1)
    
    # Test messages to try
    test_messages = [
        "Hello, how are you today?",
        "I need information about case number 123456",
        "Can you search for cases related to property disputes?",
        "Goodbye, thank you for your help!"
    ]
    
    # Create a test user and session ID
    user_id = "test_user"
    session_id = "test_session"
    
    # Test each message
    for i, message in enumerate(test_messages):
        log.info(f"\n--- Test {i+1}: '{message}' ---")
        
        # Route the message to the appropriate agent
        reply = route_to_agent(user_id=user_id, session_id=session_id, message=message)
        
        log.info(f"Response: {reply}")
    
except ImportError as e:
    log.error(f"❌ Failed to import required modules: {e}")
    sys.exit(1)
except Exception as e:
    log.exception(f"❌ Error testing root agent: {e}")
    sys.exit(1)
