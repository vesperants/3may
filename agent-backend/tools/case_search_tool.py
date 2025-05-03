import os
from typing import Optional, Dict, Any
from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine_v1

# Environment variables for configuration
PROJECT_ID = os.getenv("GOOGLE_PROJECT", "vesp-a581d")
LOCATION = os.getenv("LOCATION", "global")
DATASTORE_ID = os.getenv("DATASTORE_ID", "najir-datastore_1745733081075")

# Add debug print for configuration
print(f"[DEBUG] Using PROJECT_ID: {PROJECT_ID}, LOCATION: {LOCATION}, DATASTORE_ID: {DATASTORE_ID}")

def case_search_tool(query: str, page_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Search for relevant Supreme Court cases using Vertex AI Discovery Engine.
    Args:
        query (str): The user's search query (e.g., party name, topic).
        page_token (str, optional): Token for pagination (if needed).
    Returns:
        dict: A dictionary containing the search results and next page token (if any).
    """
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

    # Add this before the try block
    print(f"[DEBUG] case_search_tool called with query: '{query}', page_token: '{page_token}'")

    # Perform the search and collect results
    results = []
    next_page_token = None
    try:
        response = client.search(request)
        for resp in response:
            # Extract relevant fields from each result
            data = resp.document.struct_data
            results.append({
                "title": data.get("title", ""),
                # Add more fields as needed
            })
        # The next_page_token is available on the response object
        next_page_token = response.next_page_token if hasattr(response, 'next_page_token') else None

        # Inside the try block, before returning results
        print(f"[DEBUG] Results found: {len(results)}")
        for r in results:
            print(f"[DEBUG] Case: {r}")

    except Exception as e:
        # Inside the except block, before returning error
        print(f"[DEBUG] Error in case_search_tool: {e}")
        # Return error info in a structured way
        return {"error": str(e), "results": []}

    return {"results": results, "next_page_token": next_page_token}

# This tool can be used by a specialized agent to handle case search queries. 