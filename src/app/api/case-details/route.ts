import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { caseIds, question } = body;

    if (!caseIds || !Array.isArray(caseIds) || caseIds.length === 0) {
      return NextResponse.json(
        { error: 'Case IDs are required' },
        { status: 400 }
      );
    }

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Limit to 10 cases
    const selectedCases = caseIds.slice(0, 10);

    // Construct request to send to Python backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const endpoint = `${backendUrl}/case-details`;

    // Call the Python backend that will use najir_expert_agent
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        case_ids: selectedCases,
        question: question,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error from backend:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch case details' },
        { status: response.status }
      );
    }

    // Get the case details from the backend
    const data = await response.json();
    
    // Return formatted response to the frontend
    return NextResponse.json({
      caseDetails: data.case_details || [],
    });
  } catch (error) {
    console.error('Error in case-details API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 