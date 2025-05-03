import sys
from google.adk.agents import Agent

# Attempt to import the tool
try:
    from tools.greeting_tool import say_hello
    # Use stderr for logging status messages
    print("✅ Imported say_hello tool for greeting_agent.", file=sys.stderr)
except ImportError as e:
    print(f"❌ Failed to import say_hello tool: {e}", file=sys.stderr)
    say_hello = None

MODEL_GEMINI_2_0_FLASH = "gemini-2.0-flash"

# Define the greeting agent
greeting_agent = None
if say_hello:
    try:
        greeting_agent = Agent(
            model=MODEL_GEMINI_2_0_FLASH,
            name="greeting_agent",
            instruction=(
                "You are the Greeting Agent. Your ONLY task is to provide a friendly greeting to the user. "
                "Use the 'say_hello' tool to generate the greeting. "
                "Do not engage in any other conversation or tasks. Just greet."
            ),
            description="Handles simple greetings and hellos using the 'say_hello' tool.",
            tools=[say_hello],
        )
    except Exception as e:
        print(f"❌ Could not create Greeting agent instance. Error: {e}", file=sys.stderr)
        greeting_agent = None
else:
    print("❌ Greeting agent definition skipped because 'say_hello' tool is missing.", file=sys.stderr)