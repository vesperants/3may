import sys
import logging
from google.adk.agents import LlmAgent

# Set up logger
logger = logging.getLogger(__name__)

# Attempt to import the tool
try:
    from tools.say_hello_tool import say_hello
    logger.info("Imported say_hello tool for greeting_agent.")
except ImportError as e:
    logger.error(f"Failed to import say_hello tool: {e}")
    say_hello = None

MODEL_GEMINI_2_0_FLASH = "gemini-2.0-flash"

# Define the greeting agent
greeting_agent = None
if say_hello:
    try:
        greeting_agent = LlmAgent(
            name="greeting_agent",
            model="gemini-2.0-flash",
            instruction=(
                "You are a friendly, brief greeter for a legal AI assistant. "
                "Your goal is to welcome users with short, professional greetings. "
                "Keep your responses under 2 sentences."
            ),
            description="Provides friendly greetings in Nepali and English.",
            tools=[say_hello],
        )
        logger.info(f"Greeting agent '{greeting_agent.name}' created.")
    except Exception as e:
        logger.error(f"Could not create Greeting agent instance. Error: {e}")
        greeting_agent = None
else:
    logger.warning("Greeting agent definition skipped because 'say_hello' tool is missing.")