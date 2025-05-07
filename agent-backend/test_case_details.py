#!/usr/bin/env python3
"""
Test script for the case_details_agent.
This script tests the ability to get details for selected cases.
"""
import sys
import os
import logging
import json
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Test function for case_details_agent
def test_case_details_agent():
    try:
        # Import the case_details_agent
        from agents.case_details_agent import case_details_tool, process_case_details
        
        # Test case IDs (replace with actual case IDs from your system)
        test_case_ids = ["9704", "9400", "11074", "20987"]
        
        log.info(f"Testing case_details_tool with {len(test_case_ids)} case IDs")
        
        # Test process_case_details for a single case
        log.info(f"Testing process_case_details with case ID {test_case_ids[0]}")
        single_result = process_case_details(
            case_id=test_case_ids[0],
            question="What is this case about?"
        )
        log.info(f"Single case result: {json.dumps(single_result, indent=2, ensure_ascii=False)}")
        
        # Test case_details_tool for multiple cases
        log.info(f"Testing case_details_tool with multiple cases")
        multi_result = case_details_tool(
            case_ids=test_case_ids,
            question="Provide a summary of each case"
        )
        
        # Print the first 500 characters of the result
        log.info(f"Multiple cases result (first 500 chars):\n{multi_result[:500]}...")
        
        return True
    except Exception as e:
        log.exception(f"Error testing case_details_agent: {e}")
        return False

# Test function for routing through root_agent
def test_route_to_agent():
    try:
        # Import route_to_agent
        from root_agent import route_to_agent
        
        # Test user ID and session ID
        user_id = "test_user"
        session_id = "test_session"
        
        # Test case IDs (replace with actual case IDs from your system)
        test_case_ids = ["9704", "9400"]
        
        # Test message
        message = "Tell me more about these selected cases"
        
        log.info(f"Testing route_to_agent with {len(test_case_ids)} selected case IDs")
        
        # Call route_to_agent with selected case IDs
        response = route_to_agent(
            user_id=user_id,
            session_id=session_id,
            message=message,
            selected_case_ids=test_case_ids
        )
        
        # Print the first 500 characters of the response
        log.info(f"route_to_agent response (first 500 chars):\n{response[:500]}...")
        
        return True
    except Exception as e:
        log.exception(f"Error testing route_to_agent: {e}")
        return False

if __name__ == "__main__":
    log.info("===== Testing Case Details Agent =====")
    
    # Test case_details_agent
    if test_case_details_agent():
        log.info("✅ case_details_agent test successful")
    else:
        log.error("❌ case_details_agent test failed")
    
    log.info("\n===== Testing Route To Agent with Case Details =====")
    
    # Test route_to_agent
    if test_route_to_agent():
        log.info("✅ route_to_agent test successful")
    else:
        log.error("❌ route_to_agent test failed") 