# Example setup_agent_engine.py
import vertexai
from vertexai import agent_engines
import os
from dotenv import load_dotenv

load_dotenv() # Load project ID, location etc. from .env

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT_ID")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION")
STAGING_BUCKET = os.getenv("GOOGLE_CLOUD_STAGING_BUCKET") # Need staging bucket too

if not all([PROJECT_ID, LOCATION, STAGING_BUCKET]):
    print("Error: Ensure GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_LOCATION, and GOOGLE_CLOUD_STAGING_BUCKET are set in .env")
    exit(1)

print(f"Initializing Vertex AI SDK for project={PROJECT_ID}, location={LOCATION}, staging_bucket={STAGING_BUCKET}...")
vertexai.init(project=PROJECT_ID, location=LOCATION, staging_bucket=STAGING_BUCKET)
print("SDK Initialized.")

print("Creating Vertex AI Agent Engine instance...")
try:
    # You might add display_name etc. if needed
    agent_engine = agent_engines.create(display_name="MyChatbotSessionEngine")
    print("-----------------------------------------------------")
    print("✅ Vertex AI Agent Engine instance created successfully!")
    print(f"   Resource Name (Use this for VERTEX_SESSION_APP_NAME): {agent_engine.name}")
    print("-----------------------------------------------------")
except Exception as e:
    print(f"❌ Failed to create Agent Engine instance: {e}")