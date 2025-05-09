#!/usr/bin/env python3
"""
Root agent implementation that routes queries to specialized sub-agents.
This implementation uses a simpler approach that doesn't require AgentTeam.
"""
import sys
import os
import logging
import re
import json
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

# Import required tools and agents
sys.path.append(str(Path(__file__).parent))

# Import greeting and farewell agents (if needed)
try:
    from agents.greeting_agent import greeting_agent
    log.info("Imported greeting_agent")
except ImportError as e:
    log.warning(f"Failed to import greeting_agent: {e}")
    greeting_agent = None

try:
    from agents.farewell_agent import farewell_agent
    log.info("Imported farewell_agent")
except ImportError as e:
    log.warning(f"Failed to import farewell_agent: {e}")
    farewell_agent = None

# Import the case_details_agent (unified for all case detail requests)
try:
    from agents.case_details_agent import case_details_agent
    log.info("Imported case_details_agent")
except ImportError as e:
    log.warning(f"Failed to import case_details_agent: {e}")
    case_details_agent = None

# Import the case_search_tool directly
try:
    from tools.case_search_tool import case_search_tool
    log.info("Imported case_search_tool")
except ImportError as e:
    log.warning(f"Failed to import case_search_tool: {e}")
    case_search_tool = None

# Create list of available sub-agents
sub_agents = []
if greeting_agent:
    sub_agents.append(greeting_agent)
if farewell_agent:
    sub_agents.append(farewell_agent)
if case_details_agent:
    sub_agents.append(case_details_agent)

# Create the root agent with tools
root_agent = Agent(
    name="root_agent",
    model="gemini-2.0-flash",
    instruction="""
    You are a helpful, concise assistant that handles legal queries about Nepali Supreme Court cases.
    
    When a user asks a question, carefully analyze the request and route it appropriately:
    
    1. For GREETINGS (e.g., "Hello", "Hi") - respond in a friendly manner or delegate to greeting_agent
    2. For FAREWELLS (e.g., "Goodbye", "See you") - respond with a polite goodbye or delegate to farewell_agent
    3. For CASE SEARCH requests - use the case_search_tool:
       - When the user wants to find cases about a topic (e.g., "Find cases about land dispute", "Search for cases related to divorce")
       - When the user is looking for cases matching certain criteria
       - ANY request that asks to discover or find cases
    4. For ALL CASE DETAIL requests - ALWAYS delegate to case_details_agent:
       - Single case details (e.g., "Tell me about case 1234", "What is case 076-WO-0945 about?")
       - Multiple case details (e.g., "Tell me about cases 1234, 5678", "Compare cases 1234 and 5678")
       - Selected cases from UI (e.g., "Tell me about these selected cases", "Summarize these cases")
       - ANYTHING related to getting information about specific cases
    
    IMPORTANT: For ANY request with selected cases from the UI, always delegate to case_details_agent.
    The case_details_agent can handle both specific case IDs mentioned in the query AND selected case IDs.
    
    Be concise and helpful in your responses.
    
    WHEN DELEGATING:
    - Use this format: [agent_name] Your response here
    - Example: [case_details_agent] Tell me about these cases
    """,
    description="Root agent that handles legal queries with specialized tools",
    tools=[case_search_tool] if case_search_tool else [],
    sub_agents=sub_agents
)

# Create runners for each agent
root_runner = Runner(agent=root_agent, app_name=APP, session_service=svc)
agent_runners = {}

if greeting_agent:
    agent_runners["greeting_agent"] = Runner(agent=greeting_agent, app_name=APP, session_service=svc)
if farewell_agent:
    agent_runners["farewell_agent"] = Runner(agent=farewell_agent, app_name=APP, session_service=svc)
if case_details_agent:
    agent_runners["case_details_agent"] = Runner(agent=case_details_agent, app_name=APP, session_service=svc)

# Log the available agents
log.info(f"Available specialized agents: {len(agent_runners)}")
for agent_name in agent_runners:
    log.info(f"  - {agent_name}")
if case_search_tool:
    log.info("  - case_search_tool (used directly by root_agent)")

def route_to_agent(user_id: str, session_id: str, message: str, selected_case_ids: list = None) -> str:
    """
    Routes the user's message to the appropriate agent based on the root agent's decision.
    
    Args:
        user_id (str): The user ID
        session_id (str): The session ID
        message (str): The user's message
        selected_case_ids (list, optional): List of case IDs if user has selected cases
        
    Returns:
        str: The agent's response
    """
    # Log selected case IDs if available
    if selected_case_ids and len(selected_case_ids) > 0:
        log.info(f"===== ROUTE TO AGENT: SELECTED CASES =====")
        log.info(f"route_to_agent received {len(selected_case_ids)} selected case IDs:")
        for i, case_id in enumerate(selected_case_ids):
            log.info(f"  {i+1}. Case ID: {case_id}")
        log.info(f"=========================================")
        
        # If user has selected cases, force delegation to case_details_agent regardless of message
        # This is a key improvement - ensuring selected cases are always handled by case_details_agent
        message_with_ids = message
        if not any(phrase in message.lower() for phrase in ["selected cases", "these cases"]):
            # Format the selected case IDs as a JSON array string for better parsing
            case_ids_json = json.dumps(selected_case_ids)
            message_with_ids = f"{message} (Selected case IDs: {case_ids_json})"
            log.info(f"Modified message with selected case IDs: {message_with_ids}")
        
        if case_details_agent and "case_details_agent" in agent_runners:
            log.info(f"Directly delegating to case_details_agent due to selected_case_ids")
            try:
                # Prepare user content for agent, explicitly including selected case IDs
                content = types.Content(
                    role="user", 
                    parts=[types.Part(text=message_with_ids)]
                )
                
                # Get the response from the case details agent
                agent_runner = agent_runners["case_details_agent"]
                agent_response = ""
                
                for ev in agent_runner.run(user_id=user_id, session_id=session_id, new_message=content):
                    if ev.is_final_response() and ev.content and ev.content.parts:
                        agent_response = ev.content.parts[0].text
                        break
                
                log.info(f"Got response from case_details_agent of length: {len(agent_response)}")
                if "I couldn't find any case IDs" in agent_response:
                    log.warning(f"case_details_agent failed to extract case IDs despite being provided: {selected_case_ids}")
                    
                    # As a fallback, directly pass the case IDs to the case_details_tool
                    try:
                        from tools.case_details_tool import case_details_tool
                        log.info(f"Attempting direct call to case_details_tool with case_ids={selected_case_ids}")
                        direct_response = case_details_tool(
                            question=message,
                            case_ids=selected_case_ids
                        )
                        log.info(f"Direct case_details_tool response length: {len(direct_response)}")
                        return direct_response
                    except Exception as tool_error:
                        log.exception(f"Error calling case_details_tool directly: {tool_error}")
                
                return agent_response
            except Exception as e:
                log.exception(f"Error delegating to case_details_agent: {e}")
                return f"I apologize, but I'm having trouble retrieving case details. Please try again."
    else:
        log.info("route_to_agent called without selected case IDs")
    
    # Check if it's a case search query
    case_search_keywords = [
        "find cases", "search cases", "cases related to", "cases about", "find me cases",
        "search for cases", "looking for cases", "find legal cases", "case search",
        "खोज्नुहोस्", "खोज", "मुद्दा खोज्नुहोस्"  # Nepali search terms
    ]
    
    is_case_search = any(keyword.lower() in message.lower() for keyword in case_search_keywords)
    
    # Handle case search directly with case_search_tool
    if is_case_search and case_search_tool:
        log.info("Detected case search query, using case_search_tool directly")
        try:
            # Use the case_search_tool directly with the query
            search_results = case_search_tool(query=message)
            log.info(f"Case search found {len(search_results.get('cases', []))} results")
            
            # Extract the search query for better UI experience
            query_match = None
            for keyword in case_search_keywords:
                if keyword.lower() in message.lower():
                    # Try to extract what comes after the keyword
                    pattern = re.compile(f"{re.escape(keyword)}\\s+(.*?)(?:$|\\.|\\?)", re.IGNORECASE)
                    match = pattern.search(message)
                    if match:
                        query_match = match.group(1).strip()
                        break
            
            # Add the query to the results
            if query_match:
                search_results["query"] = query_match
            
            # Format the response for the frontend
            frontend_response = {
                "type": "CASE_SEARCH_RESULTS",
                "text": "Here are the cases related to your search:",
                "data": search_results
            }
            
            # Return the formatted JSON response
            json_response = json.dumps(frontend_response, ensure_ascii=False)
            log.info(f"Returning JSON response of length: {len(json_response)}")
            return json_response
        except Exception as e:
            log.exception(f"Error using case_search_tool directly: {e}")
            return f"I apologize, but I'm having trouble searching for cases. Please try again."
    
    # For all other queries, get routing decision from root agent
    # Prepare user content for agent
    content = types.Content(role="user", parts=[types.Part(text=message)])
    
    # Get the routing decision from the root agent
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
        # For root agent, return the response without the tag
        direct_response = re.sub(r'^\[.*?\]\s*', '', routing_decision)
        return direct_response
    
    # Check if the selected agent exists
    if agent_name not in agent_runners:
        log.warning(f"Selected agent {agent_name} not available")
        return f"I apologize, but I'm having trouble processing your request. Please try again."
    
    # Route the query to the selected agent
    agent_runner = agent_runners[agent_name]
    agent_response = ""
    
    try:
        for ev in agent_runner.run(user_id=user_id, session_id=session_id, new_message=content):
            if ev.is_final_response() and ev.content and ev.content.parts:
                agent_response = ev.content.parts[0].text
                break
                
        # Check if the response is a structured JSON response with a 'type' field
        # If it is, we should preserve it exactly as is
        try:
            json_response = json.loads(agent_response)
            if isinstance(json_response, dict) and 'type' in json_response:
                log.info(f"Detected structured response from {agent_name} with type: {json_response['type']}")
                return agent_response  # Return the JSON string directly
        except json.JSONDecodeError:
            # Not a structured JSON response, continue with normal processing
            pass
                
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
