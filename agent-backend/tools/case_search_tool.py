import os
import json
from typing import Optional, Dict, Any
from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine_v1
from google.protobuf.json_format import MessageToDict

# Environment variables for configuration
PROJECT_ID = os.getenv("GOOGLE_PROJECT", "vesp-a581d")
LOCATION = os.getenv("LOCATION", "global")
DATASTORE_ID = os.getenv("DATASTORE_ID", "najir-datastore_1745733081075")

# Add debug print for configuration
print(f"[DEBUG] Using PROJECT_ID: {PROJECT_ID}, LOCATION: {LOCATION}, DATASTORE_ID: {DATASTORE_ID}")

def case_search_tool(query: str, page_token: Optional[str] = None) -> str:
    """
    Search for relevant Supreme Court cases using Vertex AI Discovery Engine.
    Args:
        query (str): The user's search query (e.g., party name, topic).
        page_token (str, optional): Token for pagination (if needed).
    Returns:
        str: A JSON string containing the search results and next page token (if any).
    """
    # Debug print for tracking
    print(f"[DEBUG] case_search_tool called with query: '{query}', page_token: '{page_token}'")
    
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
        page_size=10,
        **({"page_token": page_token} if page_token else {})
    )

    # Perform the search and collect results
    results = []
    next_page_token = None
    try:
        response = client.search(request)
        
        # Process search results
        for result in response.results:
            # Extract just the title for simplicity and reliability
            if hasattr(result.document, 'struct_data') and result.document.struct_data:
                title = result.document.struct_data.get('title', 'No title available')
                results.append({"title": title})
        
        # Get next page token if available
        next_page_token = response.next_page_token if hasattr(response, 'next_page_token') else None
        
        # Print debug info
        print(f"[DEBUG] Results found: {len(results)}")
        
        # Create response object with just the essential data
        response_data = {
            "status": "success",
            "count": len(results),
            "results": results,
            "next_page_token": next_page_token
        }
        
        # Convert to JSON and return
        json_response = json.dumps(response_data, ensure_ascii=False)
        return json_response

    except Exception as e:
        print(f"[DEBUG] Error in case_search_tool: {e}")
        # Return error info as JSON string
        error_response = {
            "status": "error",
            "message": str(e),
            "results": []
        }
        return json.dumps(error_response, ensure_ascii=False)

# This tool can be used by a specialized agent to handle case search queries.