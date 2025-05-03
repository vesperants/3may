from google.adk.agents import Agent
from tools.farewell_tool import say_goodbye

MODEL_GEMINI_2_0_FLASH = "gemini-2.0-flash"  # Use your model constant as needed

# Define the farewell agent with its associated tool
try:
    farewell_agent = Agent(
        model=MODEL_GEMINI_2_0_FLASH,
        name="farewell_agent",
        instruction="You are the Farewell Agent. Your ONLY task is to provide a polite goodbye message using the 'say_goodbye' tool. Do not perform any other actions.",
        description="Handles simple farewells and goodbyes using the 'say_goodbye' tool.",
        tools=[say_goodbye],
    )
    print(f"✅ Sub-Agent '{farewell_agent.name}' created.")
except Exception as e:
    print(f"❌ Could not create Farewell agent. Error: {e}")
    farewell_agent = None 