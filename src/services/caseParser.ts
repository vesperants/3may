import { Case } from '@/components/CaseResultList';

// Message type identifiers
export const MESSAGE_TYPES = {
  CASE_SEARCH_RESULTS: 'CASE_SEARCH_RESULTS'
};

/**
 * Try to parse the text as JSON to see if it contains structured case data
 */
export function tryParseStructuredData(text: string): { type?: string; data?: { cases?: Case[] } } | null {
  try {
    // Try to parse the text as JSON
    const jsonData = JSON.parse(text);
    
    // Check if it has a type field that matches our case search results type
    if (jsonData && jsonData.type === MESSAGE_TYPES.CASE_SEARCH_RESULTS) {
      console.log('DEBUG - Found structured case search result data');
      return jsonData;
    }
    
    return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    // Not valid JSON or doesn't have our expected structure
    return null;
  }
}

/**
 * Checks if the text appears to be a case search result
 */
export function isCaseSearchResult(text: string): boolean {
  // Check if it's structured JSON data with the expected type
  const structuredData = tryParseStructuredData(text);
  return structuredData !== null && structuredData.type === MESSAGE_TYPES.CASE_SEARCH_RESULTS;
}

/**
 * Parses case search results from the agent's text response
 */
export function parseCaseResults(text: string): Case[] {
  // Parse structured data from JSON
  const structuredData = tryParseStructuredData(text);
  if (structuredData && structuredData.data && Array.isArray(structuredData.data.cases)) {
    console.log('DEBUG - Parsing structured case data:', structuredData.data.cases.length);
    return structuredData.data.cases;
  }
  
  // If not a valid structured response, return empty array
  return [];
}

/**
 * Formats a list of selected cases for querying
 */
export function formatSelectedCasesQuery(cases: Case[]): string {
  if (cases.length === 0) return '';
  
  if (cases.length === 1) {
    return `Tell me more about case number ${cases[0].id}`;
  }
  
  const caseIds = cases.map(c => c.id).join(', ');
  return `Tell me more about these cases: ${caseIds}`;
} 