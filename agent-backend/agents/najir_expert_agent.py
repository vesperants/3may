import os
import logging
import google.generativeai as genai
from google.adk.agents import LlmAgent
from tools.title_finder_tool import title_finder_retriever

# Set up logger
logger = logging.getLogger(__name__)

MODEL = "gemini-2.0-flash"

# Najir expert tool: answers legal questions using only the case title
# All arguments are required (no defaults, for ADK compatibility)
def najir_expert_tool(
    case_number: str,
    project_id: str = "",
    location: str = "",
    engine_id: str = "",
    user_question: str = ""
) -> str:
    """
    Answers a legal question about a Nepali Supreme Court case using only the case title.
    Retrieves the title, then uses Gemini LLM (via google-generativeai) to answer the user's question based on the title only.
    If project_id, location, or engine_id are not provided (empty string), use environment variables as defaults.
    """
    # Use environment variables if arguments are not provided (empty string)
    project_id = project_id or os.getenv("PROJECT_ID", "vesp-a581d")
    location = location or os.getenv("LOCATION", "global")
    engine_id = engine_id or os.getenv("ENGINE_ID", "najir-search_1745733029866")

    # Step 1: Retrieve only the title
    title = title_finder_retriever(
        case_number=case_number,
        project_id=project_id,
        location=location,
        engine_id=engine_id
    )
    if not title:
        return f"Sorry, case {case_number} not found."

    # Step 2: Use Gemini (google-generativeai) to answer based on the title
    prompt = (
        f"You are a legal expert. The title of the Supreme Court decision {case_number} is:\n"
        f"{title}\n\n"
        f"Using only the information in the title, answer the following question:\n"
        f"{user_question}"
    )
    try:
        # Configure the API key (do this once per process)
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        model = genai.GenerativeModel(MODEL)
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.error(f"LLM error: {e}")
        return "Sorry, an internal error occurred."

# Najir expert agent definition
najir_expert_agent = LlmAgent(
    name="najir_expert_agent",
    model=MODEL,
    instruction=(
        "You are the Najir Expert. "
        "You answer questions about Nepali Supreme Court cases using ONLY the retrieved case title "
        "from the 'title_finder_retriever' tool."
    ),
    description="Legal expert using only case title for answers.",
    tools=[najir_expert_tool],
)

# Log agent initialization instead of printing
logger.info("najir_expert_agent loaded.") 