import os
import logging
from typing import Optional, Dict, Any, List
from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine_v1

# Set up logger
logger = logging.getLogger(__name__)

# Environment variables for configuration
PROJECT_ID = os.getenv("GOOGLE_PROJECT", "vesp-a581d")
LOCATION = os.getenv("LOCATION", "global")
DATASTORE_ID = os.getenv("DATASTORE_ID", "najir-datastore_1745733081075")

# Add debug log for configuration
logger.debug(f"Using PROJECT_ID: {PROJECT_ID}, LOCATION: {LOCATION}, DATASTORE_ID: {DATASTORE_ID}")

def case_search_tool(query: str, page_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Search for relevant Supreme Court cases using Vertex AI Discovery Engine.
    Args:
        query (str): The user's search query (e.g., party name, topic).
        page_token (str, optional): Token for pagination (if needed).
    Returns:
        dict: A dictionary containing the search results and next page token (if any).
    """
    # Debug log for tracking
    logger.debug(f"case_search_tool called with query: '{query}', page_token: '{page_token}'")
    
    # Build the API endpoint and client options
    api_endpoint = f"{LOCATION}-discoveryengine.googleapis.com" if LOCATION != "global" else None
    client_options = ClientOptions(api_endpoint=api_endpoint) if api_endpoint else None
    client = discoveryengine_v1.SearchServiceClient(client_options=client_options)

    # Build the serving config path
    serving_config = (
        f"projects/{PROJECT_ID}/locations/{LOCATION}/dataStores/{DATASTORE_ID}/servingConfigs/default_config"
    )

    # Prepare the search request
    request = discoveryengine_v1.SearchRequest(
        serving_config=serving_config,
        query=query,
        page_size=10,  # Reduced page size for better performance
        **({"page_token": page_token} if page_token else {})
    )

    # Perform the search and collect results
    cases = []
    next_page_token = None
    
    try:
        response = client.search(request)
        
        # Process search results
        for result in response.results:
            # Extract case information
            if hasattr(result.document, 'struct_data') and result.document.struct_data:
                struct_data = result.document.struct_data
                
                # Extract relevant fields
                title = struct_data.get('title', 'No title available')
                case_id = struct_data.get('case_id', '')
                
                # If case_id is missing, try to extract from title
                if not case_id and title and 'निर्णय नं.' in title:
                    # Try to extract case ID from title
                    import re
                    match = re.search(r'निर्णय\s+नं\.\s+(\S+)', title)
                    if match:
                        case_id = match.group(1)
                
                # Create a case object with minimal required fields
                case = {
                    "id": case_id,
                    "title": title
                }
                cases.append(case)
        
        # Get next page token if available
        next_page_token = response.next_page_token if hasattr(response, 'next_page_token') else None
        
        # Log debug info
        logger.debug(f"Cases found: {len(cases)}")
        
        # Return a clean dictionary structure that the frontend expects
        return {
            "status": "success",
            "cases": cases,
            "totalCount": len(cases),
            "nextPageToken": next_page_token
        }

    except Exception as e:
        logger.error(f"Error in case_search_tool: {e}")
        return {
            "status": "error",
            "message": str(e),
            "cases": []
        }

# This tool can be used directly by the root agent