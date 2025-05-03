import os
import sys
import google.generativeai as genai
from google.adk.agents import LlmAgent

# Attempt tool import
try:
    from tools.title_finder_tool import title_finder_retriever
    # Use stderr for logging status messages
    print("✅ Imported title_finder_retriever tool for najir_expert_agent.", file=sys.stderr)
except ImportError as e:
     print(f"❌ Failed to import title_finder_retriever tool: {e}", file=sys.stderr)
     title_finder_retriever = None

MODEL_GEMINI_2_0_FLASH = "gemini-2.0-flash"

# --- Najir Expert Tool Definition ---
# (Tool's internal prints already use stderr, no changes needed here)
def najir_expert_tool(
    case_number: str,
    project_id: str = "",
    location: str = "",
    engine_id: str = "",
    user_question: str = ""
) -> str:
    """
    Answers a legal question about a Nepali Supreme Court case using ONLY the case title.
    (Internal prints use stderr)
    """
    # Use stderr for logging tool execution start
    print(f"--- Tool: najir_expert_tool called for case: {case_number} ---", file=sys.stderr)

    if not title_finder_retriever:
        return "❌ Error: title_finder_retriever tool is not available."
    if not user_question:
         return "❌ Error: user_question argument is required for najir_expert_tool."
    if not case_number:
         return "❌ Error: case_number argument is required for najir_expert_tool."

    project_id = project_id or os.getenv("PROJECT_ID")
    location = location or os.getenv("LOCATION", "global")
    engine_id = engine_id or os.getenv("ENGINE_ID")

    if not all([project_id, engine_id]):
         missing_env = [v for v, val in [("PROJECT_ID", project_id), ("ENGINE_ID", engine_id)] if not val]
         return f"❌ Configuration Error: Missing environment variables or arguments: {', '.join(missing_env)}"

    # Use stderr for logging internal steps
    print(f" Calling title_finder_retriever with: case={case_number}, proj={project_id}, loc={location}, engine={engine_id}", file=sys.stderr)
    title = title_finder_retriever(
        case_number=case_number,
        project_id=project_id,
        location=location,
        engine_id=engine_id
    )

    if not title:
        print(f" Title not found for case {case_number}.", file=sys.stderr)
        return f"Case {case_number} was not found in the search engine."
    elif isinstance(title, dict) and "error" in title:
         print(f" Error retrieving title: {title.get('error')}", file=sys.stderr)
         return f"An error occurred while searching for case {case_number}: {title.get('error')}"

    # Use stderr for logging internal steps
    print(f" Title found: '{title[:100]}...'", file=sys.stderr)

    prompt = (
        f"You are a Nepali legal assistant. You have been provided ONLY with the title of a Supreme Court decision.\n"
        f"Case Number: {case_number}\n"
        f"Case Title: {title}\n\n"
        f"Based *strictly* on the information available in the title provided above, answer the following user question concisely:\n"
        f"User Question: {user_question}\n\n"
        f"If the title does not contain enough information to answer the question, explicitly state that the title is insufficient to answer."
    )
    # Use stderr for logging internal steps
    print(f" Generating LLM response based on title...", file=sys.stderr)
    try:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return "❌ Configuration Error: GOOGLE_API_KEY not set for najir_expert_tool."
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(MODEL_GEMINI_2_0_FLASH)
        response = model.generate_content(prompt)
        # Use stderr for logging internal steps
        print(f" LLM response generated.", file=sys.stderr)
        return response.text
    except Exception as e:
        print(f"❌ LLM generation error in najir_expert_tool: {e}", file=sys.stderr)
        return "Sorry, an internal error occurred while analyzing the case title."

# --- Najir Expert Agent Definition ---
najir_expert_agent = None
if najir_expert_tool and title_finder_retriever:
    try:
        najir_expert_agent = LlmAgent(
            name="najir_expert_agent",
            model=MODEL_GEMINI_2_0_FLASH,
            instruction=(
                "You are the Najir Expert agent. Your task is to answer specific legal questions about a Nepali Supreme Court case. "
                "To do this, you MUST use the 'najir_expert_tool'. "
                "This tool requires the 'case_number' and the 'user_question'. "
                "The tool internally retrieves ONLY the case title and uses an LLM to answer the question based *solely* on that title. "
                "Pass the user's question and the identified case number to the tool. Relay the tool's response directly to the user."
                "Do not attempt to answer the question yourself without using the tool."
            ),
            description="Answers specific user questions about a Supreme Court case by analyzing ONLY its retrieved title using the najir_expert_tool.",
            tools=[najir_expert_tool],
        )
    except Exception as e:
        print(f"❌ Could not create Najir Expert agent instance. Error: {e}", file=sys.stderr)
        najir_expert_agent = None
else:
    print("❌ Najir Expert agent definition skipped due to missing tool dependencies.", file=sys.stderr)