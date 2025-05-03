from google.adk.agents import Agent
from tools.greeting_tool import say_hello

MODEL_GEMINI_2_0_FLASH = "gemini-2.0-flash"  # Use your model constant as needed

# Define the greeting agent with its associated tool
try:
    greeting_agent = Agent(
        model=MODEL_GEMINI_2_0_FLASH,
        name="greeting_agent",
        instruction="You are the Greeting Agent. Your ONLY task is to provide a friendly greeting using the 'say_hello' tool. Do nothing else.",
        description="Handles simple greetings and hellos using the 'say_hello' tool.",
        tools=[say_hello],
    )
    print(f"✅ Sub-Agent '{greeting_agent.name}' created.")
except Exception as e:
    print(f"❌ Could not create Greeting agent. Error: {e}")
    greeting_agent = None 