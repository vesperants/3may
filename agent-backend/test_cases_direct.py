#!/usr/bin/env python3
"""
Test script for directly testing the case details handling,
bypassing the agent system to isolate the issue.
"""
import sys
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

# Test the direct case details handling
def test_direct_details():
    try:
        # Import the case_details_tool directly
        from agents.case_details_agent import case_details_tool
        
        # Sample case IDs that should work
        test_case_ids = ["9704", "9400"]
        
        log.info(f"Testing case_details_tool with case IDs: {test_case_ids}")
        
        # Call the tool directly
        result = case_details_tool(
            question="Test query for case details",
            case_ids=test_case_ids
        )
        
        if result:
            log.info("✅ Got result successfully!")
            log.info(f"Result length: {len(result)} characters")
            log.info(f"Result first 100 characters: {result[:100]}...")
            return True
        else:
            log.error("❌ No result returned from case_details_tool")
            return False
            
    except Exception as e:
        log.exception(f"Error in direct test: {e}")
        return False

# Test the full flow with gemini_agent.chat function
def test_via_chat():
    try:
        # Import the chat function
        from gemini_agent import chat
        
        # Sample parameters
        test_user_id = "test_user"
        test_cid = "test_cid"
        test_message = "tell me more about the selected cases"
        test_case_ids = ["9704", "9400"]
        
        log.info(f"Testing chat function with:")
        log.info(f"  - user_id: {test_user_id}")
        log.info(f"  - cid: {test_cid}")
        log.info(f"  - message: {test_message}")
        log.info(f"  - case_ids: {test_case_ids}")
        
        # Call the chat function directly
        result = chat(
            uid=test_user_id,
            cid=test_cid,
            msg=test_message,
            selected_case_ids=test_case_ids
        )
        
        if result:
            log.info("✅ Got result from chat function!")
            log.info(f"Result length: {len(result)} characters")
            log.info(f"Result first 100 characters: {result[:100]}...")
            return True
        else:
            log.error("❌ No result returned from chat function")
            return False
            
    except Exception as e:
        log.exception(f"Error in chat test: {e}")
        return False

# Test command line argument handling
def test_cli_args():
    try:
        import subprocess
        
        # Sample parameters
        test_user_id = "test_user"
        test_cid = "test_cid"
        test_message = "tell me more about the selected cases"
        test_case_ids = ["9704", "9400"]
        json_case_ids = json.dumps(test_case_ids)
        
        log.info(f"Testing CLI with:")
        log.info(f"  - Arguments: {[test_user_id, test_cid, test_message, json_case_ids]}")
        
        # Construct command (adjust path as needed)
        cmd = [
            "python",
            "gemini_agent.py",
            test_user_id,
            test_cid,
            test_message,
            json_case_ids
        ]
        
        log.info(f"Running command: {' '.join(cmd)}")
        
        # Run the command
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        log.info(f"Command exit code: {result.returncode}")
        log.info(f"STDOUT: {result.stdout}")
        log.info(f"STDERR: {result.stderr}")
        
        return result.returncode == 0
            
    except Exception as e:
        log.exception(f"Error in CLI test: {e}")
        return False

if __name__ == "__main__":
    log.info("===== Testing Direct Case Details =====")
    direct_result = test_direct_details()
    log.info(f"Direct test result: {'✅ PASS' if direct_result else '❌ FAIL'}")
    
    log.info("\n===== Testing Via Chat Function =====")
    chat_result = test_via_chat()
    log.info(f"Chat function test result: {'✅ PASS' if chat_result else '❌ FAIL'}")
    
    log.info("\n===== Testing CLI Arguments =====")
    cli_result = test_cli_args()
    log.info(f"CLI test result: {'✅ PASS' if cli_result else '❌ FAIL'}") 