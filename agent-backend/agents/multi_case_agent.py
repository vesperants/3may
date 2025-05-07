import logging
import re
from typing import List, Dict, Any, Optional
from google.adk.agents import LlmAgent
from google.genai import types

# Import najir_expert_tool directly
from tools.najir_expert_tool import najir_expert_tool

# Set up logger
logger = logging.getLogger(__name__)

MODEL = "gemini-2.0-flash"

def process_multiple_cases(case_query: str) -> str:
    """
    Process multiple case numbers by extracting them from the query
    and looking up each case's details.
    
    Args:
        case_query: User query containing multiple case numbers
        
    Returns:
        Formatted information about all requested cases
    """
    # Extract case numbers
    case_numbers = re.findall(r'\b\d{3,}\b', case_query)
    
    if not case_numbers:
        return "I couldn't find any valid case numbers in your query. Please provide specific case numbers."
    
    logger.info(f"Processing {len(case_numbers)} case numbers: {case_numbers}")
    
    # Limit to 5 cases max
    if len(case_numbers) > 5:
        case_numbers = case_numbers[:5]
        logger.info(f"Limited to first 5 cases: {case_numbers}")
    
    # Process each case directly using the najir_expert_tool
    case_responses = []
    
    for case_number in case_numbers:
        try:
            # Get the case title using najir_expert_tool
            case_title = najir_expert_tool(case_number=case_number)
            
            if case_title:
                case_responses.append(f"Case {case_number}:\nTitle: {case_title}")
            else:
                case_responses.append(f"Case {case_number}: Unable to retrieve information. Case may not exist.")
                
        except Exception as e:
            logger.exception(f"Error processing case {case_number}: {e}")
            case_responses.append(f"Case {case_number}: Error retrieving information.")
    
    # Format the combined response
    if len(case_responses) > 0:
        return "\n\n".join(case_responses)
    else:
        return "I wasn't able to retrieve information for any of the requested cases."

# Create multi-case agent that will handle batch processing
multi_case_agent = LlmAgent(
    name="multi_case_agent",
    model=MODEL,
    instruction=(
        "You are the Multi-Case Agent specializing in processing multiple legal case numbers at once. "
        "When a user requests information about multiple cases (e.g., 'Give me details about cases 1234, 5678'), "
        "use the process_multiple_cases tool to extract the case numbers and retrieve information "
        "for each case. Present the results clearly to the user."
        "\n\nImportant: Always use the process_multiple_cases tool for ANY request involving multiple cases."
    ),
    description="Specialized agent for handling requests about multiple legal cases simultaneously.",
    tools=[process_multiple_cases],
)

logger.info("multi_case_agent loaded with direct case processing capability.") 