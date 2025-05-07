"""
DEPRECATED: This file is kept for reference but is no longer used.

The case_search_agent has been replaced by direct usage of case_search_tool in the root_agent.
This approach simplifies the architecture by:
1. Eliminating an unnecessary agent layer
2. Reducing complexity in handling JSON responses
3. Improving response reliability

See root_agent.py for the current implementation that uses case_search_tool directly.
"""

# This agent implementation has been deprecated
# The original implementation is kept below for reference only

"""
from google.adk.agents import Agent
from tools.case_search_tool import case_search_tool
import logging

# Set up logger
logger = logging.getLogger(__name__)

MODEL_GEMINI_2_0_FLASH = "gemini-2.0-flash"  # Use your model constant here

# SYSTEM_INSTRUCTIONS = """
# You are a legal case search assistant for the Supreme Court of Nepal.
# Your job is to search for relevant legal cases when users ask for them.

# When a user asks to search for cases:
# 1. Extract the key search terms from their query
# 2. Use the case_search_tool to retrieve relevant cases
# 3. Format the results in a clear JSON structure for the frontend
# 4. Return ONLY the JSON structure without any additional text

# DO NOT make up case information or add explanatory text outside the JSON.
# """

# Create the case search agent
# case_search_agent = Agent(
#     model=MODEL_GEMINI_2_0_FLASH,
#     name="case_search_agent",
#     instruction=SYSTEM_INSTRUCTIONS,
#     description="Searches for relevant legal cases using the case_search_tool",
#     tools=[case_search_tool],
# )

# Log agent creation rather than printing it
# logger.info(f"Sub-Agent '{case_search_agent.name}' created.")
# """

# # Set case_search_agent to None to explicitly indicate it's not used
# case_search_agent = None