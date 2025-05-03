# agent-backend/app.py

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from agents.google_agent import run_agent  # Your agent function

app = FastAPI()

# Allow frontend requests (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/chat")
async def chat_with_agent(payload: dict):
    user_message = payload["message"]
    agent_response = run_agent(user_message)
    return {"reply": agent_response}