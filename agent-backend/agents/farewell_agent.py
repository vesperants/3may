import sys
from google.adk.agents import Agent

# Attempt to import the tool
try:
    from tools.farewell_tool import say_goodbye
    # Use stderr for logging status messages
    print("✅ Imported say_goodbye tool for farewell_agent.", file=sys.stderr)
except ImportError as e:
    print(f"❌ Failed to import say_goodbye tool: {e}", file=sys.stderr)
    say_goodbye = None


MODEL_GEMINI_2_0_FLASH = "gemini-2.0-flash"

# Define the farewell agent
farewell_agent = None
if say_goodbye:
    try:
        farewell_agent = Agent(
            model=MODEL_GEMINI_2_0_FLASH,
            name="farewell_agent",
            instruction=(
                "You are the Farewell Agent. Your ONLY task is to provide a polite goodbye message. "
                "Use the 'say_goodbye' tool when the user indicates they are leaving or ending the conversation "
                "(e.g., using words like 'bye', 'goodbye', 'thanks bye', 'see you'). "
                "Do not perform any other actions. Just say goodbye."
            ),
            description="Handles simple farewells and goodbyes using the 'say_goodbye' tool.",
            tools=[say_goodbye],
        )
    except Exception as e:
        print(f"❌ Could not create Farewell agent instance. Error: {e}", file=sys.stderr)
        farewell_agent = None
else:
     print("❌ Farewell agent definition skipped because 'say_goodbye' tool is missing.", file=sys.stderr)