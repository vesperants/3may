from google.adk.agents import Agent
from tools.weather_tool import get_weather
from agents.greeting_agent import greeting_agent
from agents.farewell_agent import farewell_agent
from agents.najir_expert_agent import najir_expert_agent
from agents.case_search_agent import case_search_agent

MODEL_GEMINI_2_0_FLASH = "gemini-2.0-flash"  # Use your model constant as needed

# Define the root agent with its sub-agents and weather tool
try:
    if greeting_agent and farewell_agent and najir_expert_agent and case_search_agent:
        root_agent = Agent(
            model=MODEL_GEMINI_2_0_FLASH,
            name="root_agent",
            instruction=(
                "You are the Root Agent. "
                "If the user greets, delegate to 'greeting_agent'. "
                "If the user says goodbye, delegate to 'farewell_agent'. "
                "If the user asks about the weather, use the 'get_weather' tool. "
                "If the user asks a legal question about a Nepali Supreme Court case, delegate to 'najir_expert_agent'. "
                "If the user wants to search for relevant Supreme Court cases (e.g., by party name, topic, etc.), delegate to 'case_search_agent'. "
                "Otherwise, respond that you cannot help."
            ),
            description="Coordinates greetings, farewells, weather info, legal case Q&A, and case search queries.",
            tools=[get_weather],
            sub_agents=[greeting_agent, farewell_agent, najir_expert_agent, case_search_agent],
        )
        print(f"✅ Root Agent '{root_agent.name}' created with sub-agents.")
    else:
        print("❌ Cannot create root agent: sub-agents missing.")
        root_agent = None
except Exception as e:
    print(f"❌ Could not create Root agent. Error: {e}")
    root_agent = None 