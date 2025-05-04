from google.adk.agents import Agent
from tools.case_search_tool import case_search_tool

MODEL_GEMINI_2_0_FLASH = "gemini-2.0-flash"  # Use your model constant as needed

# Define the case search agent with its associated tool
try:
    case_search_agent = Agent(
        model=MODEL_GEMINI_2_0_FLASH,
        name="case_search_agent",
        instruction=(
            "You are the Case Search Agent. "
            "Your task is to search for relevant Supreme Court cases using the 'case_search_tool'. "
            "When you receive search results from the case_search_tool, format your response as follows:\n\n"
            "1. Start with 'Here are the cases related to your search:'\n"
            "2. Then list each case title in a numbered list\n"
            "3. End with 'Would you like to search for more cases?'\n\n"
            "Do not add any additional commentary or explanation about the JSON structure."
        ),
        description="Handles user queries to find relevant Supreme Court cases using the case_search_tool.",
        tools=[case_search_tool],
    )
    print(f"✅ Sub-Agent '{case_search_agent.name}' created.")
except Exception as e:
    print(f"❌ Could not create Case Search agent. Error: {e}")
    case_search_agent = None