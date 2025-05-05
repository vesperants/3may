import sys
import logging
from google.adk.agents import LlmAgent

# Set up logger
logger = logging.getLogger(__name__)

# Attempt to import the tool
try:
    from tools.farewell_tool import say_goodbye
    logger.info("Imported say_goodbye tool for farewell_agent.")
except ImportError as e:
    logger.error(f"Failed to import say_goodbye tool: {e}")
    say_goodbye = None


MODEL_GEMINI_2_0_FLASH = "gemini-2.0-flash"

# Define the farewell agent
farewell_agent = None
if say_goodbye:
    try:
        farewell_agent = LlmAgent(
            name="farewell_agent",
            model="gemini-2.0-flash",
            instruction=(
                "You are a polite, brief farewell agent for a legal AI assistant. "
                "Your goal is to say goodbye to users with short, professional closings. "
                "Keep your responses under 2 sentences."
            ),
            description="Provides polite farewells in Nepali and English.",
            tools=[say_goodbye],
        )
        logger.info(f"Farewell agent '{farewell_agent.name}' created.")
    except Exception as e:
        logger.error(f"Could not create Farewell agent instance. Error: {e}")
        farewell_agent = None
else:
    logger.warning("Farewell agent definition skipped because 'say_goodbye' tool is missing.")