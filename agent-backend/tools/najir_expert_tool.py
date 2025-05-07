from typing import Optional
from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine_v1

# These can be set from environment variables or .env for flexibility
import os
PROJECT_ID = os.getenv("PROJECT_ID", "vesp-a581d")
LOCATION_ID = os.getenv("LOCATION", "global")
ENGINE_ID = os.getenv("ENGINE_ID", "najir-search_1745733029866")

def arabic_to_devanagari(numstr: str) -> str:
    """
    Convert Arabic numerals to Devanagari numerals (for Nepali case numbers).
    """
    digits_map = str.maketrans("0123456789", "०१२३४५६७८९")
    return numstr.translate(digits_map)

def retrieve_case_title(
    case_number: str,
    project_id: str,
    location: str,
    engine_id: str
) -> Optional[str]:
    """
    Retrieve the title of a Supreme Court case by case number using Google Discovery Engine.
    """
    nepali_number = arabic_to_devanagari(case_number)
    api_endpoint = f"{location}-discoveryengine.googleapis.com" if location != "global" else None
    client_options = ClientOptions(api_endpoint=api_endpoint) if api_endpoint else None
    client = discoveryengine_v1.SearchServiceClient(client_options=client_options)
    serving_config = (
        f"projects/{project_id}/locations/{location}/collections/default_collection/"
        f"engines/{engine_id}/servingConfigs/default_config"
    )
    request = discoveryengine_v1.SearchRequest(
        serving_config=serving_config,
        query=nepali_number,
        page_size=5,
    )
    for resp in client.search(request):
        data = resp.document.struct_data
        if "decision_no" in data and data["decision_no"] == nepali_number:
            return data["title"]
    return None

def najir_expert_tool(
    case_number: str,
    project_id: str = PROJECT_ID,
    location: str = LOCATION_ID,
    engine_id: str = ENGINE_ID
) -> str:
    """
    Retrieve case details by case number.
    
    Args:
        case_number (str): The case number to search for
        project_id (str, optional): Google Cloud project ID
        location (str, optional): Location for Discovery Engine
        engine_id (str, optional): Discovery Engine ID
        
    Returns:
        str: The title of the case if found, empty string if not found
    """
    title = retrieve_case_title(case_number, project_id, location, engine_id)
    if not title:
        return ""  # Empty string signifies "not found"
    return title 