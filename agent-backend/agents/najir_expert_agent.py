import os
import logging
import google.generativeai as genai
from google.adk.agents import LlmAgent
from tools.najir_expert_tool import najir_expert_tool

# Set up logger
logger = logging.getLogger(__name__)

MODEL = "gemini-2.0-flash"

# Najir expert tool: answers legal questions using only the case title
# All arguments are required (no defaults, for ADK compatibility)


# Najir expert agent definition
najir_expert_agent = LlmAgent(
    name="najir_expert_agent",
    model=MODEL,
    instruction=(
        "You are the Najir Expert. "
        "You answer questions about Nepali Supreme Court cases using ONLY the retrieved case title "
        "from the 'najir_expert_tool'. "
        "When asked about a case, extract the case number and use the tool to retrieve the case title. "
        "Only respond based on the information retrieved by the tool."
    ),
    description="Legal expert using the retrieved case details for answers.",
    tools=[najir_expert_tool],
)

# Log agent initialization instead of printing
logger.info("najir_expert_agent loaded.") 