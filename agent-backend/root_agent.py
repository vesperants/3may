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

# Import the case_search_tool directly
try:
    from tools.case_search_tool import case_search_tool
    log.info("Imported case_search_tool")
except ImportError as e:
    log.warning(f"Failed to import case_search_tool: {e}")
    case_search_tool = None

# Create the root agent with tools
root_agent = Agent(
    name="root_agent",
    model="gemini-2.0-flash",
    instruction="""
    You are a helpful, concise assistant that handles legal queries about Nepali Supreme Court cases.
    
    When a user asks a question, you will:
    1. For greetings - respond in a friendly manner
    2. For farewells - respond with a polite goodbye
    3. For case search requests - use the case_search_tool to find relevant cases
    4. For specific case questions - provide information about those specific cases
    
    When searching for cases:
    - Use the case_search_tool to find cases related to the user's query
    - Return the search results in a structured format that can be properly displayed in the user interface
    - The frontend requires results in a specific format with 'cases' array containing objects with 'id' and 'title' fields
    
    Be concise and helpful in your responses.
    """,
    description="Root agent that handles legal queries with specialized tools",
    tools=[case_search_tool] if case_search_tool else []
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
    
    # For non-case search queries, use the original routing logic
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
    
    # Special handling for multiple case numbers with najir_expert_agent
    if agent_name == "najir_expert_agent" and contains_multiple_case_numbers(message):
        log.info("Detected multiple case numbers request")
        case_numbers = extract_case_numbers(message)
        if len(case_numbers) > 0:
            log.info(f"Found case numbers: {case_numbers}")
            
            # Process individual cases
            case_responses = []
            
            for i, case_number in enumerate(case_numbers[:5]):  # Limit to 5 cases max
                try:
                    single_case_content = types.Content(role="user", parts=[types.Part(text=f"Tell me about case {case_number}")])
                    case_response = ""
                    for ev in agent_runners[agent_name].run(user_id=user_id, session_id=session_id, new_message=single_case_content):
                        if ev.is_final_response() and ev.content and ev.content.parts:
                            case_response = ev.content.parts[0].text
                            break
                    
                    case_responses.append(f"Case {case_number}:\n{case_response}")
                except Exception as e:
                    log.exception(f"Error getting response for case {case_number}: {e}")
                    case_responses.append(f"Case {case_number}: Unable to retrieve information for this case.")
            
            # Format the combined response without the debug header
            return "\n\n".join(case_responses)
    
    # Special handling for case_search_agent - use direct case_search_tool instead
    if agent_name == "case_search_agent" and case_search_tool:
        log.info("Redirecting case_search_agent request to direct case_search_tool")
        try:
            # Use the case_search_tool directly with the query
            search_results = case_search_tool(query=message)
            
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
