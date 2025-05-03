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
            "Your ONLY task is to search for relevant Supreme Court cases using the 'case_search_tool'. "
            "Do nothing else."
        ),
        description="Handles user queries to find relevant Supreme Court cases using the case_search_tool.",
        tools=[case_search_tool],
    )
    print(f"✅ Sub-Agent '{case_search_agent.name}' created.")
except Exception as e:
    print(f"❌ Could not create Case Search agent. Error: {e}")
    case_search_agent = None 