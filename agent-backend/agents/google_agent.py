#!/usr/bin/env python3
"""
Simple wrapper for the gemini_agent.py chat function.
"""
import sys
import os
import logging
from pathlib import Path

# Add parent directory to path to import gemini_agent
sys.path.append(str(Path(__file__).parent.parent))
from gemini_agent import chat

# ─── logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger(__name__)
# ─────────────────────────────────────────────────────────────────────

def run_agent(message, user_id="default_user", conversation_id="default_conversation"):
    """
    Run the agent with the given message.
    
    Args:
        message (str): The user's message
        user_id (str): User identifier
        conversation_id (str): Conversation identifier
        
    Returns:
        str: The agent's response
    """
    try:
        log.info(f"Running agent for message: {message[:30]}...")
        response = chat(user_id, conversation_id, message)
        return response
    except Exception as e:
        log.exception(f"Error running agent: {e}")
        return "Sorry, I encountered an error processing your request."
