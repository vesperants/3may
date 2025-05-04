#!/usr/bin/env python3
"""
Root agent implementation that routes queries to specialized sub-agents.
This implementation uses a simpler approach that doesn't require AgentTeam.
"""
import sys
import os
import logging
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

from google.adk.agents import Agent
from google.genai import types
from google.adk.runners import Runner
from google.adk.sessions import VertexAiSessionService
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
PROJ = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
LOC = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
APP = os.getenv("VERTEX_SESSION_APP_NAME")

if not all([PROJ, LOC, APP]):
    log.error("❌ Missing required environment variables")
    sys.exit(1)

# Create session service
svc = VertexAiSessionService(project=PROJ, location=LOC)

# Import sub-agents
sys.path.append(str(Path(__file__).parent))
try:
    from agents.najir_expert_agent import najir_expert_agent
    log.info("✅ Imported najir_expert_agent")
except ImportError as e:
    log.warning(f"❌ Failed to import najir_expert_agent: {e}")
    najir_expert_agent = None

try:
    from agents.greeting_agent import greeting_agent
    log.info("✅ Imported greeting_agent")
except ImportError as e:
    log.warning(f"❌ Failed to import greeting_agent: {e}")
    greeting_agent = None

try:
    from agents.farewell_agent import farewell_agent
    log.info("✅ Imported farewell_agent")
except ImportError as e:
    log.warning(f"❌ Failed to import farewell_agent: {e}")
    farewell_agent = None

try:
    from agents.case_search_agent import case_search_agent
    log.info("✅ Imported case_search_agent")
except ImportError as e:
    log.warning(f"❌ Failed to import case_search_agent: {e}")
    case_search_agent = None

# Create the root agent
root_agent = Agent(
    name="root_agent",
    model="gemini-2.0-flash",
    instruction="""
    You are a helpful, concise assistant that coordinates responses from specialized agents.
    
    When a user asks a question, you will determine which specialized agent should handle the query.
    
    Here are the specialized agents available to you:
    
    - najir_expert_agent: Answers specific legal questions about Nepali Supreme Court cases
      Use this agent when the user asks about a SPECIFIC CASE NUMBER or wants details about a particular case.
      Examples: "What is case 7821 about?", "Tell me about case 1234", "What did the court decide in case 5678?"
      
    - greeting_agent: Handles greetings and introductions
      Use this agent when the user is greeting or starting a conversation (e.g., "hello", "hi", etc.).
      
    - farewell_agent: Handles goodbyes and closing conversations
      Use this agent when the user is ending the conversation (e.g., "goodbye", "bye", etc.).
      
    - case_search_agent: Searches for legal cases related to keywords or topics
      Use this agent when the user wants to SEARCH for cases related to a topic, but doesn't have a specific case number.
      Examples: "Find cases about property disputes", "Search for cases related to inheritance", "Cases about sagar thapa"
    
    IMPORTANT: Your job is ONLY to identify which agent should handle the query by adding the agent name in square brackets at the beginning of your response. DO NOT try to answer the query yourself.
    
    Your response must start with one of these agent names in square brackets:
    [root_agent], [najir_expert_agent], [greeting_agent], [farewell_agent], [case_search_agent]
    
    For example:
    [greeting_agent]
    [najir_expert_agent]
    [case_search_agent]
    [root_agent]
    
    Only use [root_agent] if none of the specialized agents are suitable for the query.
    
    DO NOT add any explanation after the agent tag. Just provide the tag.
    """,
    description="Root agent that routes queries to specialized sub-agents"
)

# Create runners for each agent
root_runner = Runner(agent=root_agent, app_name=APP, session_service=svc)
agent_runners = {}

if najir_expert_agent:
    agent_runners["najir_expert_agent"] = Runner(agent=najir_expert_agent, app_name=APP, session_service=svc)
if greeting_agent:
    agent_runners["greeting_agent"] = Runner(agent=greeting_agent, app_name=APP, session_service=svc)
if farewell_agent:
    agent_runners["farewell_agent"] = Runner(agent=farewell_agent, app_name=APP, session_service=svc)
if case_search_agent:
    agent_runners["case_search_agent"] = Runner(agent=case_search_agent, app_name=APP, session_service=svc)

# Log the available agents
log.info(f"Available specialized agents: {len(agent_runners)}")
for agent_name in agent_runners:
    log.info(f"  - {agent_name}")

def route_to_agent(user_id: str, session_id: str, message: str) -> str:
    """
    Routes the user's message to the appropriate agent based on the root agent's decision.
    
    Args:
        user_id (str): The user ID
        session_id (str): The session ID
        message (str): The user's message
        
    Returns:
        str: The agent's response
    """
    # First, ask the root agent which specialized agent should handle this query
    content = types.Content(role="user", parts=[types.Part(text=message)])
    routing_decision = ""
    
    try:
        for ev in root_runner.run(user_id=user_id, session_id=session_id, new_message=content):
            if ev.is_final_response() and ev.content and ev.content.parts:
                routing_decision = ev.content.parts[0].text
                break
    except Exception as e:
        log.exception(f"Error getting routing decision: {e}")
        return f"I apologize, but I'm having trouble processing your request. Please try again."
    
    if not routing_decision:
        log.warning("No routing decision from root agent")
        return f"I apologize, but I'm having trouble processing your request. Please try again."
    
    # Extract the agent name from the routing decision
    agent_match = re.match(r'\[(.*?)\]', routing_decision)
    if not agent_match:
        log.warning(f"Root agent didn't specify an agent in the correct format: {routing_decision[:100]}...")
        # If no agent tag is found, assume the root agent is handling it directly
        return routing_decision
    
    agent_name = agent_match.group(1)
    log.info(f"Root agent selected: {agent_name}")
    
    # If the root agent decided to handle it directly
    if agent_name == "root_agent":
        # For root agent, generate a direct response
        try:
            direct_content = types.Content(role="user", parts=[types.Part(text=f"Please answer this question directly: {message}")])
            direct_response = ""
            for ev in root_runner.run(user_id=user_id, session_id=session_id, new_message=direct_content):
                if ev.is_final_response() and ev.content and ev.content.parts:
                    direct_response = ev.content.parts[0].text
                    break
            if direct_response:
                # Remove any agent tags from the direct response
                direct_response = re.sub(r'^\[.*?\]\s*', '', direct_response)
                return direct_response
        except Exception as e:
            log.exception(f"Error getting direct response from root agent: {e}")
        
        # Fallback generic response
        return "I'll do my best to help you with that."
    
    # Check if the selected agent exists
    if agent_name not in agent_runners:
        log.warning(f"Selected agent {agent_name} not available")
        
        # For missing case_search_agent, provide a helpful response
        if agent_name == "case_search_agent":
            return f"I'd be happy to search for cases related to '{message}', but the case search functionality is currently unavailable. Please try a different query or check back later."
        
        # For missing najir_expert_agent, provide a helpful response
        if agent_name == "najir_expert_agent":
            return f"I'd like to help you with your legal question about Nepali Supreme Court cases, but that functionality is currently unavailable. Please try a different query or check back later."
        
        # For other missing agents, provide a generic response
        return f"I apologize, but I'm having trouble processing your request. Please try again."
    
    # Route the query to the selected agent
    agent_runner = agent_runners[agent_name]
    agent_response = ""
    
    try:
        for ev in agent_runner.run(user_id=user_id, session_id=session_id, new_message=content):
            if ev.is_final_response() and ev.content and ev.content.parts:
                agent_response = ev.content.parts[0].text
                break
    except Exception as e:
        log.exception(f"Error getting response from {agent_name}: {e}")
        
        # Provide specific fallback responses based on the agent type
        if agent_name == "greeting_agent":
            return "Hello! How can I help you today?"
        elif agent_name == "farewell_agent":
            return "Goodbye! Have a great day!"
        else:
            return f"I apologize, but I'm having trouble processing your request. Please try again."
    
    if not agent_response:
        log.warning(f"No response from {agent_name}")
        
        # Provide specific fallback responses based on the agent type
        if agent_name == "greeting_agent":
            return "Hello! How can I help you today?"
        elif agent_name == "farewell_agent":
            return "Goodbye! Have a great day!"
        else:
            return f"I apologize, but I'm having trouble processing your request. Please try again."
    
    return agent_response

def get_root_agent():
    """
    Returns the root agent.
    """
    return root_agent
