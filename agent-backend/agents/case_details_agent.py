#!/usr/bin/env python3
"""
Case Details Agent - Specialized agent for handling all case detail requests

This agent is designed to process:
1. Single case requests
2. Multiple case requests
3. Selected cases from the UI
"""
import logging
from google.adk.agents import Agent

# Set up logger
logger = logging.getLogger(__name__)

# Import the unified case_details_tool
try:
    from tools.case_details_tool import case_details_tool
    logger.info("✅ Successfully imported unified case_details_tool")
except ImportError as e:
    logger.error(f"❌ Failed to import case_details_tool: {e}")
    raise

MODEL = "gemini-2.0-flash"

# Create the case details agent
case_details_agent = Agent(
    name="case_details_agent",
    model=MODEL,
    instruction="""
    You are the Case Details Agent, specialized in providing information about legal cases.
    
    You handle THREE types of case detail requests:
    1. SINGLE CASE: When a user asks about one specific case (e.g., "Tell me about case 1234")
    2. MULTIPLE CASES: When a user mentions several cases (e.g., "Tell me about cases 1234, 5678")
    3. SELECTED CASES: When a user refers to cases they've selected in the UI (e.g., "Tell me about these selected cases")
    
    ALWAYS use the case_details_tool for ALL these scenarios. This tool will:
    - Extract case IDs from the query if they're mentioned (like "1234" or "076-WO-0945")
    - Process case IDs from "Selected case IDs:" or "User has selected cases: ..." in the message
    - Handle all the details of fetching and formatting case information
    
    IMPORTANT:
    - If the user message includes text like "Selected case IDs:" or "User has selected cases:", those are the cases you should focus on.
    - Respond directly to the user's question about these cases - don't mention they were selected from the UI.
    - Make sure you're explaining the details in the context of the user's specific question.
    
    If no case IDs are provided or found, explain that the user needs to specify case numbers or select cases.
    Be concise and factual in your responses, focusing on delivering the legal information.
    """,
    description="Provides comprehensive information about one or more legal cases (single, multiple, or selected)",
    tools=[case_details_tool],
)

# Log agent initialization
logger.info("✅ case_details_agent loaded successfully with unified case_details_tool") 