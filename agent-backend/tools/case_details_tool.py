#!/usr/bin/env python3
"""
Unified Case Details Tool
Handles all case detail requests: single case, multiple cases, and selected cases.
"""
import logging
import re
import concurrent.futures
from typing import List, Dict, Any, Optional
import json

# Set up logger
logger = logging.getLogger(__name__)

# Import the najir_expert_tool
try:
    from tools.najir_expert_tool import najir_expert_tool
    logger.info("Successfully imported najir_expert_tool")
except ImportError as e:
    logger.error(f"Failed to import najir_expert_tool: {e}")
    raise

# Try to import the title_finder_retriever if available
try:
    from tools.title_finder_tool import title_finder_retriever
    logger.info("Successfully imported title_finder_retriever")
    has_title_finder = True
except ImportError:
    logger.warning("title_finder_retriever not available, will use najir_expert_tool for titles")
    has_title_finder = False

def extract_case_ids(query: str) -> List[str]:
    """
    Extract case IDs from a query string.
    
    Args:
        query: The query string
    
    Returns:
        List of case ID strings
    """
    case_ids = []
    
    # Check for selected case IDs in the message (from UI selection)
    selected_patterns = [
        r'Selected case IDs:\s*(\[.*?\])',  # JSON format: Selected case IDs: ["1234", "5678"]
        r'User has selected cases:\s*(.*?)(?:$|\))',  # Plain text: User has selected cases: 1234, 5678
    ]
    
    for pattern in selected_patterns:
        match = re.search(pattern, query)
        if match:
            selected_text = match.group(1)
            logger.info(f"Found selected case IDs mention: {selected_text}")
            
            # Handle JSON array format
            if selected_text.startswith('[') and selected_text.endswith(']'):
                try:
                    json_ids = json.loads(selected_text)
                    if isinstance(json_ids, list):
                        case_ids.extend([str(case_id) for case_id in json_ids])
                        logger.info(f"Extracted {len(case_ids)} case IDs from JSON format")
                        return case_ids  # Return these as priority
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse JSON case IDs: {selected_text}")
            
            # Handle comma-separated format
            else:
                comma_ids = [id_str.strip() for id_str in selected_text.split(',')]
                if comma_ids:
                    case_ids.extend(comma_ids)
                    logger.info(f"Extracted {len(case_ids)} case IDs from comma format")
                    return case_ids  # Return these as priority
    
    # If no selected IDs found, look for case IDs in the text
    
    # Check for Nepali case format (e.g., 076-WO-0945)
    nepali_format = re.findall(r'\b\d{3,3}-[A-Z]{2,2}-\d{4,4}\b', query)
    if nepali_format:
        case_ids.extend(nepali_format)
    
    # Find all numbers with reasonable length (3+ digits) to be case numbers
    # This regex matches both Arabic (0-9) and Devanagari (०-९) numerals
    numeric_ids = re.findall(r'\b\d{3,}\b', query)
    if numeric_ids:
        case_ids.extend(numeric_ids)
    
    # Find all Devanagari numerals (०-९) with length 3+ digits
    devanagari_ids = re.findall(r'\b[०-९]{3,}\b', query)
    if devanagari_ids:
        logger.info(f"Found {len(devanagari_ids)} Devanagari case IDs: {devanagari_ids}")
        case_ids.extend(devanagari_ids)
    
    return case_ids

def get_case_info(case_id: str, question: str = "") -> Dict[str, str]:
    """
    Get information about a single case.
    
    Args:
        case_id: The case ID
        question: Question about the case
    
    Returns:
        Dictionary with case_id, title, and details
    """
    logger.info(f"Getting info for case {case_id}")
    
    try:
        # Get the case title
        if has_title_finder:
            title = title_finder_retriever(case_number=case_id)
            if not title:
                title = f"Case {case_id}"
        else:
            # Use najir_expert_tool to get title if title_finder not available
            title = najir_expert_tool(case_number=case_id)
            if not title:
                title = f"Case {case_id}"
        
        # Get case details using najir_expert_tool
        # Note: Current najir_expert_tool only returns title, this will be enhanced later
        details = najir_expert_tool(case_number=case_id)
        
        return {
            "case_id": case_id,
            "title": title,
            "details": details if details else f"Information for case {case_id} not available"
        }
    except Exception as e:
        logger.exception(f"Error getting info for case {case_id}: {e}")
        return {
            "case_id": case_id,
            "title": f"Case {case_id}",
            "details": f"Error retrieving information: {str(e)}"
        }

def format_case_results(results: List[Dict[str, str]]) -> str:
    """
    Format the case results into a readable response.
    
    Args:
        results: List of case result dictionaries
    
    Returns:
        Formatted string with all case information
    """
    if not results:
        return "No case information available."
    
    # For a single case, provide a simple format
    if len(results) == 1:
        result = results[0]
        return f"# {result['title']} (Case ID: {result['case_id']})\n\n{result['details']}"
    
    # For multiple cases, use a section for each case
    formatted_response = "# Case Details\n\n"
    for result in results:
        formatted_response += f"## {result['title']} (Case ID: {result['case_id']})\n\n"
        formatted_response += f"{result['details']}\n\n"
        formatted_response += "---\n\n"
    
    return formatted_response

def case_details_tool(
    question: str = "Provide information about these cases",
    case_ids: Optional[List[str]] = None
) -> str:
    """
    Unified tool to get detailed information about one or more cases.
    
    This tool handles:
    1. Single case requests
    2. Multiple case requests
    3. Selected cases from the UI
    
    Args:
        question: Question about the case(s)
        case_ids: List of case IDs to process (optional)
    
    Returns:
        Formatted response with details about all cases
    """
    logger.info(f"case_details_tool called with: question='{question}'")
    
    # Log case IDs explicitly passed to the tool
    if case_ids and len(case_ids) > 0:
        logger.info(f"===== CASE DETAILS TOOL: EXPLICIT CASE IDS =====")
        logger.info(f"Received {len(case_ids)} explicit case IDs:")
        for i, case_id in enumerate(case_ids):
            logger.info(f"  {i+1}. Explicit Case ID: {case_id}")
        logger.info(f"==============================================")
    else:
        logger.info("No explicit case IDs provided, will extract from question")
    
    # Extract case IDs from the question if not provided
    if not case_ids or len(case_ids) == 0:
        extracted_ids = extract_case_ids(question)
        
        if extracted_ids:
            logger.info(f"===== CASE DETAILS TOOL: EXTRACTED CASE IDS =====")
            logger.info(f"Extracted {len(extracted_ids)} case IDs from question:")
            for i, case_id in enumerate(extracted_ids):
                logger.info(f"  {i+1}. Extracted Case ID: {case_id}")
            logger.info(f"===============================================")
            
            case_ids = extracted_ids
        else:
            logger.warning("No case IDs provided or found in question")
            return "I couldn't find any case IDs. Please specify case numbers or select cases from the search results."
    
    # Limit to 10 cases maximum
    if len(case_ids) > 10:
        logger.info(f"Limiting from {len(case_ids)} to 10 cases")
        case_ids = case_ids[:10]
    
    results = []
    
    # Process cases concurrently for better performance, but with timeout protection
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:  # Reduced from 5 to 3 workers
        # Create a list of future objects
        future_to_case = {
            executor.submit(get_case_info, case_id, question): case_id
            for case_id in case_ids
        }
        
        # Process results as they complete, with timeout protection
        for future in concurrent.futures.as_completed(future_to_case):
            case_id = future_to_case[future]
            try:
                # Add a timeout of 15 seconds per case to prevent hanging
                result = future.result(timeout=15)
                results.append(result)
                logger.info(f"Completed processing for case {case_id}")
            except concurrent.futures.TimeoutError:
                logger.error(f"Timeout processing case {case_id} after 15 seconds")
                results.append({
                    "case_id": case_id,
                    "title": f"Case {case_id}",
                    "details": "Timed out while retrieving information. This case may be unavailable or require more processing time."
                })
            except Exception as e:
                logger.exception(f"Error in future for case {case_id}: {e}")
                results.append({
                    "case_id": case_id,
                    "title": f"Case {case_id}",
                    "details": f"Failed to process case: {str(e)}"
                })
    
    # Sort results based on original order of case_ids
    sorted_results = []
    for case_id in case_ids:
        found = False
        for result in results:
            if result.get("case_id") == case_id:
                sorted_results.append(result)
                found = True
                break
        if not found:
            # Backup if a case somehow didn't get processed at all
            sorted_results.append({
                "case_id": case_id,
                "title": f"Case {case_id}",
                "details": "No information could be retrieved for this case."
            })
    
    # Format and return the results
    return format_case_results(sorted_results) 