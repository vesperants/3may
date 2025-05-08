import logging
import re
from typing import List, Dict, Any, Optional
from google.adk.agents import LlmAgent

# Import najir_expert_tool directly
from tools.najir_expert_tool import najir_expert_tool

# Set up logger
logger = logging.getLogger(__name__)

MODEL = "gemini-2.0-flash"

def process_selected_cases(
    question: str, 
    case_ids: List[str]
) -> str:
    """
    Process pre-selected cases from the UI.
    
    Args:
        question: User's question about the selected cases
        case_ids: List of pre-selected case IDs from the UI
        
    Returns:
        Formatted information about all selected cases
    """
    if not case_ids:
        return "No cases were selected. Please select cases from the search results first."
    
    logger.info(f"Processing {len(case_ids)} selected cases: {case_ids}")
    
    # Limit to 5 cases max for performance
    if len(case_ids) > 5:
        case_ids = case_ids[:5]
        logger.info(f"Limited to first 5 cases: {case_ids}")
    
    # Process each selected case using najir_expert_tool
    case_responses = []
    
    for case_id in case_ids:
        try:
            # Get the case title using najir_expert_tool
            case_title = najir_expert_tool(case_number=case_id)
            
            if case_title:
                case_responses.append(f"Case {case_id}:\nTitle: {case_title}")
            else:
                case_responses.append(f"Case {case_id}: Unable to retrieve information. Case may not exist.")
                
        except Exception as e:
            logger.exception(f"Error processing case {case_id}: {e}")
            case_responses.append(f"Case {case_id}: Error retrieving information.")
    
    # Format the combined response
    if len(case_responses) > 0:
        return "\n\n".join(case_responses)
    else:
        return "I wasn't able to retrieve information for any of the selected cases."

# Create the selected cases agent
selected_cases_agent = LlmAgent(
    name="selected_cases_agent",
    model=MODEL,
    instruction=(
        "You are the Selected Cases Agent specializing in processing cases that users have pre-selected "
        "from search results in the UI. "
        "When a user asks about 'selected cases', 'these cases', or similar phrases referring to "
        "cases they've chosen in the UI, use the process_selected_cases tool to retrieve information "
        "about those cases. Present the results clearly to the user."
        "\n\nImportant: You will receive the list of selected case IDs from the UI. "
        "Always use the process_selected_cases tool to handle these requests."
    ),
    description="Specialized agent for handling pre-selected cases from the search interface.",
    tools=[process_selected_cases],
)

logger.info("selected_cases_agent loaded with case processing capability.") 