# agent-backend/app.py

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import logging
import os
import uuid
from tools.case_search_tool import case_search_tool

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# Try to import najir_expert_tool
try:
    from agents.najir_expert_agent import najir_expert_tool
    logger.info("Imported najir_expert_tool")
except ImportError as e:
    logger.warning(f"Failed to import najir_expert_tool: {e}")
    najir_expert_tool = None

# Create FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a session ID generator
def generate_session_id():
    return str(uuid.uuid4())

# Define request models
class ChatRequest(BaseModel):
    message: str
    selected_case_ids: Optional[List[str]] = None
    
class SearchRequest(BaseModel):
    query: str
    page_token: Optional[str] = None

class CaseDetailsRequest(BaseModel):
    case_ids: List[str]
    question: str

@app.get("/health")
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}

@app.post("/case-search")
def search_cases(request: SearchRequest):
    """
    Endpoint to search for cases using the case_search_tool.
    
    Returns:
    {
        "cases": [{id, title, ...}],
        "totalCount": number,
        "nextPageToken": string or null
    }
    """
    try:
        # Extract query and page_token
        query = request.query
        page_token = request.page_token
        
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
        
        # Log the request
        logger.info(f"Case search request: query='{query}', page_token='{page_token}'")
        
        # Call the case_search_tool
        search_results = case_search_tool(query=query, page_token=page_token)
        
        # Log the response
        logger.info(f"Case search found {len(search_results.get('cases', []))} results")
        
        # Return the search results
        return search_results
    
    except Exception as e:
        logger.exception(f"Error in case search endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search cases: {str(e)}")

@app.post("/case-details")
def get_case_details(request: CaseDetailsRequest):
    """
    Endpoint to get details for multiple cases using najir_expert_tool.
    
    Returns:
    {
        "case_details": [
            {
                "case_id": "123",
                "title": "Case title",
                "details": "Expert response about the case"
            },
            ...
        ]
    }
    """
    try:
        case_ids = request.case_ids
        question = request.question
        
        # Check if najir_expert_tool is available
        if not najir_expert_tool:
            raise HTTPException(status_code=500, detail="Najir expert tool is not available")
        
        # Log the request
        logger.info(f"Case details request: {len(case_ids)} cases, question='{question}'")
        
        # Process each case
        case_details = []
        for case_id in case_ids:
            try:
                # First get the case title using the title_finder tool
                # This is usually done inside najir_expert_tool, but we need the title to include in response
                # Assuming najir_expert_agent.title_finder_retriever is available, otherwise handle error
                try:
                    from tools.title_finder_tool import title_finder_retriever
                    title = title_finder_retriever(case_number=case_id)
                except ImportError:
                    title = "Title not available" 
                
                # Call najir_expert_tool for this case
                details = najir_expert_tool(
                    case_number=case_id,
                    user_question=question
                )
                
                # Add to results
                case_details.append({
                    "case_id": case_id,
                    "title": title,
                    "details": details
                })
                
                logger.info(f"Processed case {case_id} with najir_expert_tool")
                
            except Exception as case_error:
                logger.error(f"Error processing case {case_id}: {case_error}")
                # Add error message but continue processing other cases
                case_details.append({
                    "case_id": case_id,
                    "title": "Error",
                    "details": f"Could not process case: {str(case_error)}"
                })
        
        # Return all case details
        return {"case_details": case_details}
    
    except Exception as e:
        logger.exception(f"Error in case details endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get case details: {str(e)}")

@app.post("/chat")
async def chat(request: ChatRequest):
    """Chat endpoint to interact with the agent."""
    try:
        user_message = request.message
        selected_case_ids = request.selected_case_ids
        
        # More detailed logging of the request
        logger.info(f"Chat request: message='{user_message}'")
        if selected_case_ids:
            logger.info(f"Chat request with {len(selected_case_ids)} selected cases: {selected_case_ids}")
        else:
            logger.info("Chat request with NO selected case IDs")
        
        # Import the root_agent routing function
        try:
            from root_agent import route_to_agent
            
            # Generate a user_id and session_id if needed
            # For simplicity, we're using UUIDs but in production you'd use persistent IDs
            user_id = str(uuid.uuid4())
            session_id = str(uuid.uuid4())
            
            # Route the message to the appropriate agent
            logger.info(f"Calling route_to_agent with selected_case_ids: {selected_case_ids}")
            agent_response = route_to_agent(
                user_id=user_id, 
                session_id=session_id,
                message=user_message,
                selected_case_ids=selected_case_ids
            )
            logger.info(f"Got response of length {len(agent_response) if agent_response else 0}")
            
            return {"reply": agent_response}
        except ImportError as e:
            logger.error(f"Failed to import route_to_agent: {e}")
            return {"reply": "I'm sorry, the agent system is currently unavailable."}
    except Exception as e:
        logger.exception(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Main entry point
if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("DEBUG", "False").lower() == "true"
    
    logger.info(f"Starting server on port {port}, debug={debug}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=debug)