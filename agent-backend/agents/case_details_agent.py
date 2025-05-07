#!/usr/bin/env python3
"""
Case Details Agent - Specialized agent for handling detailed information about multiple cases.

This agent is designed to process multiple selected case IDs, retrieve information about each case,
and format the results in a structured way for the user.
"""
import os
import logging
import json
import concurrent.futures
from google.adk.agents import Agent, LlmAgent
from google.genai import types
from typing import Optional, List

# Set up logger
logger = logging.getLogger(__name__)

# Try to import the najir_expert_tool
try:
    from agents.najir_expert_agent import najir_expert_tool
    logger.info("✅ Successfully imported najir_expert_tool")
except ImportError as e:
    logger.error(f"❌ Failed to import najir_expert_tool: {e}")
    raise

# Try to import the title_finder_retriever
try:
    from tools.title_finder_tool import title_finder_retriever
    logger.info("✅ Successfully imported title_finder_retriever")
except ImportError as e:
    logger.error(f"❌ Failed to import title_finder_retriever: {e}")
    raise

MODEL = "gemini-2.0-flash"

def process_case_details(
    case_id: str,
    question: str = "Provide detailed information about this case"
) -> dict:
    """
    Process details for a single case.
    
    Args:
        case_id (str): The case ID to process
        question (str): The specific question to ask about the case
        
    Returns:
        dict: A dictionary containing the case_id, title, and details
    """
    logger.info(f"Processing details for case {case_id}")
    
    try:
        # Get environment variables for Vertex parameters
        project_id = os.getenv("PROJECT_ID", "vesp-a581d")
        location = os.getenv("LOCATION", "global")
        engine_id = os.getenv("ENGINE_ID", "najir-search_1745733029866")
        
        # First get the case title
        title = title_finder_retriever(
            case_number=case_id,
            project_id=project_id,
            location=location,
            engine_id=engine_id
        )
        
        if not title:
            return {
                "case_id": case_id,
                "title": "Case not found",
                "details": f"Unable to find case with ID {case_id}"
            }
        
        # Get detailed information using najir_expert_tool
        details = najir_expert_tool(
            case_number=case_id,
            user_question=question,
            project_id=project_id,
            location=location,
            engine_id=engine_id
        )
        
        return {
            "case_id": case_id,
            "title": title,
            "details": details
        }
    except Exception as e:
        logger.exception(f"Error processing case {case_id}: {e}")
        return {
            "case_id": case_id,
            "title": "Error",
            "details": f"An error occurred while processing case {case_id}: {str(e)}"
        }

def case_details_tool(
    question: str = "Provide detailed information about these cases",
    case_ids: Optional[List[str]] = None
) -> str:
    """
    Tool to get detailed information about multiple cases.
    
    Args:
        question (str): Question to ask about each case
        case_ids (Optional[List[str]]): List of case IDs to process
        
    Returns:
        str: Formatted response with details about all cases
    """
    logger.info("=============== CASE_DETAILS_TOOL DEBUG ===============")
    logger.info(f"case_details_tool called with:")
    logger.info(f"  - question: {question}")
    logger.info(f"  - case_ids: {case_ids}")
    logger.info("===========================================")
    
    # Try to extract case IDs from the incoming message context if not directly provided
    if not case_ids or len(case_ids) == 0:
        try:
            # Get the current callback context
            from google.adk.tools.callback_context import get_current_callback_context
            callback_context = get_current_callback_context()
            
            if callback_context and callback_context.request:
                # Look for case IDs in the message parts
                for content in callback_context.request.contents:
                    for part in content.parts:
                        if hasattr(part, "text") and part.text:
                            # Check for a line with "Selected case IDs:" followed by a JSON array
                            if "Selected case IDs:" in part.text:
                                import re
                                import json
                                # Try to extract the JSON array
                                match = re.search(r'Selected case IDs: (\[.*?\])', part.text)
                                if match:
                                    try:
                                        extracted_ids = json.loads(match.group(1))
                                        if isinstance(extracted_ids, list) and len(extracted_ids) > 0:
                                            logger.info(f"Extracted {len(extracted_ids)} case IDs from message context")
                                            case_ids = extracted_ids
                                    except Exception as e:
                                        logger.error(f"Error parsing case IDs from context: {e}")
                            
                            # Also look for explicit case IDs in the message
                            elif "cases:" in part.text.lower():
                                # Extract case numbers mentioned in the request
                                import re
                                case_id_matches = re.findall(r'\b\d{4,5}\b', part.text)
                                if case_id_matches:
                                    logger.info(f"Found {len(case_id_matches)} case IDs in the message text")
                                    case_ids = case_id_matches
        except Exception as e:
            logger.error(f"Error extracting case IDs from message context: {e}")
    
    # Check if we have any case IDs to process
    if not case_ids or not isinstance(case_ids, list) or len(case_ids) == 0:
        return "No case IDs provided. Please select cases first."
    
    logger.info(f"Processing details for {len(case_ids)} cases")
    
    # Limit to 10 cases maximum
    case_ids = case_ids[:10]
    
    results = []
    
    # Process cases concurrently for better performance
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        # Create a list of future objects
        future_to_case = {
            executor.submit(process_case_details, case_id, question): case_id
            for case_id in case_ids
        }
        
        # Process results as they complete
        for future in concurrent.futures.as_completed(future_to_case):
            case_id = future_to_case[future]
            try:
                result = future.result()
                results.append(result)
                logger.info(f"Completed processing for case {case_id}")
            except Exception as e:
                logger.exception(f"Error in future for case {case_id}: {e}")
                results.append({
                    "case_id": case_id,
                    "title": "Error",
                    "details": f"Failed to process case: {str(e)}"
                })
    
    # Sort results based on original order of case_ids
    sorted_results = []
    for case_id in case_ids:
        for result in results:
            if result.get("case_id") == case_id:
                sorted_results.append(result)
                break
    
    # Format the response in markdown
    formatted_response = "# Case Details\n\n"
    for result in sorted_results:
        formatted_response += f"## {result['title']} (Case ID: {result['case_id']})\n\n"
        formatted_response += f"{result['details']}\n\n"
        formatted_response += "---\n\n"
    
    return formatted_response

# Create the case details agent
case_details_agent = Agent(
    name="case_details_agent",
    model=MODEL,
    instruction="""
    You are the Case Details Agent, specialized in providing detailed information about multiple legal cases.
    
    When a user requests details about selected cases:
    1. Extract any case IDs mentioned in the message or context
    2. Use the case_details_tool with these case IDs to get comprehensive information
    3. Return the formatted information with proper hierarchical structure
    4. Highlight key points from each case
    
    IMPORTANT: Always call the case_details_tool with the case IDs either from the explicit case_ids parameter
    or from those mentioned in the message context. The tool will extract case IDs from the message if needed.
    
    DO NOT respond without calling the case_details_tool first, as it needs to process the selected cases.

    If no cases are selected or found, instruct the user to select cases from search results first.
    """,
    description="Provides comprehensive details about multiple selected legal cases",
    tools=[case_details_tool],
)

# Log agent initialization
logger.info("✅ case_details_agent loaded successfully") 