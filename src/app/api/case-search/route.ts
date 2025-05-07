import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { query, pageToken } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Construct request to send to Python backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const endpoint = `${backendUrl}/case-search`;

    // Call the Python backend that will use case_search_tool
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        page_token: pageToken || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error from backend:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch search results' },
        { status: response.status }
      );
    }

    // Get the search results from the backend
    const data = await response.json();
    
    // Return formatted response to the frontend
    return NextResponse.json({
      cases: data.cases || [],
      totalCount: data.totalCount || 0,
      nextPageToken: data.nextPageToken || null,
    });
  } catch (error) {
    console.error('Error in case-search API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 