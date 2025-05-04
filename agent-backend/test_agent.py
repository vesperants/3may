#!/usr/bin/env python3
"""
Simple test script to verify that the agent backend is working correctly
with Google ADK and Generative AI imports.
"""
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Test Google ADK imports
try:
    from google.adk.agents import Agent
    from google.adk.runners import Runner
    from google.adk.sessions import VertexAiSessionService
    print("✅ Google ADK imports successful")
except ImportError as e:
    print(f"❌ Google ADK import error: {e}")

# Test Google Generative AI imports
try:
    import google.generativeai as genai
    from google.genai import types
    print("✅ Google Generative AI imports successful")
except ImportError as e:
    print(f"❌ Google Generative AI import error: {e}")

# Test environment variables
print("\nChecking environment variables:")
required_vars = [
    "GOOGLE_CLOUD_PROJECT_ID",
    "GOOGLE_CLOUD_LOCATION",
    "VERTEX_SESSION_APP_NAME",
    "GOOGLE_API_KEY"
]

for var in required_vars:
    value = os.getenv(var)
    if value:
        # Show only first few characters if it's an API key
        display_value = value[:10] + "..." if "KEY" in var else value
        print(f"✅ {var}: {display_value}")
    else:
        print(f"❌ {var} not set")

# Test Vertex AI configuration
print("\nTesting Vertex AI configuration:")
try:
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    app_name = os.getenv("VERTEX_SESSION_APP_NAME")
    
    if all([project_id, location, app_name]):
        print(f"✅ Vertex AI configuration looks good")
        print(f"  Project ID: {project_id}")
        print(f"  Location: {location}")
        print(f"  App Name: {app_name}")
    else:
        print("❌ Missing Vertex AI configuration variables")
except Exception as e:
    print(f"❌ Error checking Vertex AI configuration: {e}")

# Test Gemini API configuration
print("\nTesting Gemini API configuration:")
try:
    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
        print("✅ Gemini API configured successfully")
        
        # List available models (this doesn't make an API call yet)
        print("  Available models will be accessible")
    else:
        print("❌ GOOGLE_API_KEY not set")
except Exception as e:
    print(f"❌ Error configuring Gemini API: {e}")

print("\nTest complete. If all checks passed, your agent-backend should be properly configured.")
