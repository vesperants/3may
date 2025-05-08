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

# Import sub-agents
sys.path.append(str(Path(__file__).parent))
try:
    from agents.najir_expert_agent import najir_expert_agent
    log.info("Imported najir_expert_agent")
except ImportError as e:
    log.warning(f"Failed to import najir_expert_agent: {e}")
    najir_expert_agent = None

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

# Import the multi_case_agent
try:
    from agents.multi_case_agent import multi_case_agent
    log.info("Imported multi_case_agent")
except ImportError as e:
    log.warning(f"Failed to import multi_case_agent: {e}")
    multi_case_agent = None

# Import the selected_cases_agent
try:
    from agents.selected_cases_agent import selected_cases_agent
    log.info("Imported selected_cases_agent")
except ImportError as e:
    log.warning(f"Failed to import selected_cases_agent: {e}")
    selected_cases_agent = None

# Import the case_details_agent
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
if najir_expert_agent:
    sub_agents.append(najir_expert_agent)
if multi_case_agent:
    sub_agents.append(multi_case_agent)
if selected_cases_agent:
    sub_agents.append(selected_cases_agent)
if case_details_agent:
    sub_agents.append(case_details_agent)

# Create the root agent with tools
root_agent = Agent(
    name="root_agent",
    model="gemini-2.0-flash",
    instruction="""
    You are a helpful, concise assistant that handles legal queries about Nepali Supreme Court cases.
    
    When a user asks a question, carefully analyze the request and route it to the appropriate specialist:
    
    1. For GREETINGS (e.g., "Hello", "Hi") - respond in a friendly manner or delegate to greeting_agent
    2. For FAREWELLS (e.g., "Goodbye", "See you") - respond with a polite goodbye or delegate to farewell_agent
    3. For CASE SEARCH requests (e.g., "Find cases about land dispute") - use the case_search_tool
    4. For SINGLE CASE details (e.g., "Tell me about case 1234") - delegate to najir_expert_agent
    5. For MULTIPLE CASE details (e.g., "Tell me about cases 1234, 5678") - delegate to multi_case_agent
    6. For SELECTED CASES from the UI - ALWAYS delegate to selected_cases_agent
    
    When the user mentions "selected cases", "these cases", or anything referring to cases they've selected in the UI,
    ALWAYS delegate to the selected_cases_agent. This agent specializes in processing pre-selected cases from the search interface.
    
    When the user mentions multiple case numbers in their query, delegate to multi_case_agent.
    
    Be concise and helpful in your responses.
    """,
    description="Root agent that handles legal queries with specialized tools",
    tools=[case_search_tool] if case_search_tool else [],
    sub_agents=sub_agents
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
if multi_case_agent:
    agent_runners["multi_case_agent"] = Runner(agent=multi_case_agent, app_name=APP, session_service=svc)
if selected_cases_agent:
    agent_runners["selected_cases_agent"] = Runner(agent=selected_cases_agent, app_name=APP, session_service=svc)
if case_details_agent:
    agent_runners["case_details_agent"] = Runner(agent=case_details_agent, app_name=APP, session_service=svc)

# Log the available agents
log.info(f"Available specialized agents: {len(agent_runners)}")
for agent_name in agent_runners:
    log.info(f"  - {agent_name}")
if case_search_tool:
    log.info("  - case_search_tool (used directly by root_agent)")

# Add support for detecting multiple case number requests
def contains_multiple_case_numbers(message: str) -> bool:
    """
    Check if the message contains multiple case numbers.
    Examples: 
    - "Tell me more about cases 1234, 5678, and 9876" 
    - "Tell me more about these cases: 1234, 5678"
    """
    # Common patterns for multiple case requests
    patterns = [
        r"cases?.*?(\d+)[,\s]+(\d+)",  # "cases 1234, 5678" or "case 1234, 5678"
        r"case.*?numbers?.*?(\d+)[,\s]+(\d+)",  # "case numbers 1234, 5678"
        r"these.*?cases:?\s+(\d+)[,\s]+(\d+)"  # "these cases: 1234, 5678"
    ]
    
    for pattern in patterns:
        if re.search(pattern, message, re.IGNORECASE):
            return True
    
    return False

def extract_case_numbers(message: str) -> List[str]:
    """Extract all case numbers from a message."""
    # Find all numbers with reasonable length (3+ digits) to be case numbers
    return re.findall(r'\b\d{3,}\b', message)

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
        log.info(f"route_to_agent called with {len(selected_case_ids)} selected case IDs: {selected_case_ids}")
    else:
        log.info("route_to_agent called without selected case IDs")
    
    # Check if it's a request about selected cases
    selected_case_keywords = [
        "selected cases", "these cases", "those cases", "the cases i selected", 
        "the selected cases", "the cases i chose", "the cases i've selected",
        "the cases i have selected"
    ]
    
    is_selected_cases_request = any(keyword.lower() in message.lower() for keyword in selected_case_keywords)
    
    # If the user is asking about selected cases AND we have selected_case_ids, handle directly
    if is_selected_cases_request:
        if selected_case_ids and len(selected_case_ids) > 0:
            log.info(f"Detected request about selected cases with {len(selected_case_ids)} case IDs")
            try:
                # Import the process_selected_cases tool
                from agents.selected_cases_agent import process_selected_cases
                
                # Call the tool directly
                result = process_selected_cases(
                    question=message,
                    case_ids=selected_case_ids
                )
                
                if result:
                    log.info(f"Successfully processed {len(selected_case_ids)} selected cases")
                    return result
                else:
                    log.warning("No result from process_selected_cases call")
                    # Continue with normal flow if direct handling fails
            except Exception as e:
                log.exception(f"Error in selected cases processing: {e}")
                # Continue with normal flow if direct handling fails
        else:
            log.info("User asked about selected cases but no cases were selected")
            return "I don't see any selected cases. Please select cases from the search results first, and then I can provide information about them."
    
    # Check if it's a case search query
    case_search_keywords = [
        "find cases", "search cases", "cases related to", "cases about", "find me cases",
        "search for cases", "looking for cases", "find legal cases", "case search",
        "खोज्नुहोस्", "खोज", "मुद्दा खोज्नुहोस्"  # Nepali search terms
    ]
    
    is_case_search = any(keyword.lower() in message.lower() for keyword in case_search_keywords)
    
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
            
            # Log the response structure for debugging
            log.info(f"Structured response type: {frontend_response['type']}")
            log.info(f"Structured response has {len(frontend_response['data'].get('cases', []))} cases")
            
            # Return the formatted JSON response
            json_response = json.dumps(frontend_response, ensure_ascii=False)
            log.info(f"Returning JSON response of length: {len(json_response)}")
            return json_response
        except Exception as e:
            log.exception(f"Error using case_search_tool directly: {e}")
            return f"I apologize, but I'm having trouble searching for cases. Please try again."
    
    # For non-case search queries, use the normal agent routing
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
        
        # Check if this is a response from multi_case_agent that got passed through
        if "Case " in routing_decision and "Title: " in routing_decision:
            log.info("Detected multi_case_agent response format, passing through")
            return routing_decision
        
        # If no agent tag is found, assume the root agent is handling it directly
        return routing_decision
    
    agent_name = agent_match.group(1)
    log.info(f"Root agent selected: {agent_name}")
    
    # Special handling for case_details_agent with selected case IDs
    if agent_name == "case_details_agent" and selected_case_ids and len(selected_case_ids) > 0:
        log.info(f"Handling case details directly with {len(selected_case_ids)} selected case IDs")
        try:
            # Import the case_details_tool directly
            from agents.case_details_agent import case_details_tool
            
            # Call the tool directly with the selected case IDs
            result = case_details_tool(
                question="Provide detailed information about these cases",
                case_ids=selected_case_ids
            )
            
            if result:
                log.info(f"Successfully processed case details for {len(selected_case_ids)} cases")
                return result
            else:
                log.warning("No result from direct case_details_tool call")
                
        except Exception as e:
            log.exception(f"Error calling case_details_tool directly: {e}")
            # Fall back to regular agent delegation below
    
    # Special handling for case_search_agent - use direct case_search_tool instead
    if agent_name == "case_search_agent" and case_search_tool:
        log.info("Redirecting case_search_agent request to direct case_search_tool")
        try:
            # Use the case_search_tool directly with the query
            search_results = case_search_tool(query=message)
            
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
            return json_response
        except Exception as e:
            log.exception(f"Error using case_search_tool directly: {e}")
            return f"I apologize, but I'm having trouble searching for cases. Please try again."
    
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
        
        # For missing case_search_agent, use direct case_search_tool if available
        if agent_name == "case_search_agent" and case_search_tool:
            log.info("Redirecting to direct case_search_tool")
            return route_to_agent(user_id, session_id, f"Search for cases about: {message}")
        
        # For missing najir_expert_agent, provide a helpful response
        if agent_name == "najir_expert_agent":
            return f"I'd like to help you with your legal question about Nepali Supreme Court cases, but that functionality is currently unavailable. Please try a different query or check back later."
        
        # For other missing agents, provide a generic response
        return f"I apologize, but I'm having trouble processing your request. Please try again."
    
    # Special handling for selected_cases_agent when we have selected_case_ids
    if agent_name == "selected_cases_agent":
        if selected_case_ids and len(selected_case_ids) > 0:
            log.info(f"Handling selected cases directly with {len(selected_case_ids)} case IDs")
            try:
                # Import the process_selected_cases tool
                from agents.selected_cases_agent import process_selected_cases
                
                # Call the tool directly
                result = process_selected_cases(
                    question=message,
                    case_ids=selected_case_ids
                )
                
                if result:
                    log.info(f"Successfully processed {len(selected_case_ids)} selected cases")
                    return result
                else:
                    log.warning("No result from process_selected_cases call")
            except Exception as e:
                log.exception(f"Error calling process_selected_cases directly: {e}")
                # Fall back to regular agent delegation
        else:
            log.info("Agent selected_cases_agent but no case IDs were provided")
            return "I don't see any selected cases. Please select cases from the search results first, and then I can provide information about them."
    
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
