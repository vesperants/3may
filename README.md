# Najir Legal Assistant

A legal assistant application that uses Google's Agent Development Kit (ADK) to provide information about Nepali Supreme Court cases. The application uses a root agent to route queries to specialized sub-agents based on the type of query.

## Features

- **Root Agent**: Routes queries to specialized sub-agents based on the user's input
- **Specialized Agents**:
  - **Najir Expert Agent**: Answers questions about specific Nepali Supreme Court cases
  - **Case Search Agent**: Searches for legal cases related to keywords or topics
  - **Greeting Agent**: Handles greetings and introductions
  - **Farewell Agent**: Handles goodbyes and closing conversations
- **Firebase Authentication**: Secure user authentication
- **Session Management**: Maintains conversation history across sessions

## Prerequisites

- Node.js (v18 or higher)
- Python 3.10 or higher
- Google Cloud account with Vertex AI enabled
- Firebase project

## Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/najir-legal-assistant.git
   cd najir-legal-assistant
   ```

2. Create a `.env` file in the root directory with the following variables:
   ```
   # Google Cloud Configuration
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_CLOUD_LOCATION=us-central1
   VERTEX_SESSION_APP_NAME=your-vertex-session-app-name
   GOOGLE_API_KEY=your-google-api-key
   
   # Firebase Configuration (for the frontend)
   NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-firebase-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-firebase-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id
   
   # Firebase Admin SDK (for the backend)
   FIREBASE_SERVICE_ACCOUNT=your-firebase-service-account-json
   ```

## Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd agent-backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the backend server:
   ```bash
   uvicorn app:app --reload
   ```
   The backend server will run at http://127.0.0.1:8000.

## Frontend Setup

1. Navigate back to the root directory:
   ```bash
   cd ..
   ```

2. Install the required Node.js packages:
   ```bash
   npm install
   ```

3. Start the frontend development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at http://localhost:3000.

## Using the Application

1. Open http://localhost:3000 in your web browser
2. Log in with your Firebase credentials
3. Start a conversation with the agent
4. Try different types of queries:
   - **Case Search**: "Find cases related to property disputes"
   - **Specific Case Questions**: "What is case 7821 about?"
   - **Greetings**: "Hello", "Hi"
   - **Farewells**: "Goodbye", "Bye"

## Agent Architecture

The application uses a root agent to route queries to specialized sub-agents:

1. **Root Agent**: Analyzes the user's query and decides which specialized agent should handle it
2. **Najir Expert Agent**: Answers questions about specific case numbers
3. **Case Search Agent**: Searches for cases related to keywords or topics
4. **Greeting Agent**: Handles greetings and introductions
5. **Farewell Agent**: Handles goodbyes and closing conversations

## Troubleshooting

- **Missing Dependencies**: If you encounter import errors, make sure all required packages are installed
- **Session Management**: Ensure that session IDs are valid to avoid `INVALID_ARGUMENT` errors
- **API Keys**: Verify that all API keys and environment variables are correctly set
- **Firebase Authentication**: Check Firebase console for authentication issues

## License

This project is licensed under the MIT License - see the LICENSE file for details.
