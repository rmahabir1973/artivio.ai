/**
 * Frontend utility to parse detailed error messages from backend
 */

export interface DetailedError {
  _type?: string;
  message: string;
  recommendation: string;
  errorType: string;
  raw?: string;
}

export function parseDetailedError(errorMessage: string | null | undefined): DetailedError | null {
  if (!errorMessage) return null;
  
  try {
    const parsed = JSON.parse(errorMessage);
    
    // Check if it's a detailed error object
    if (parsed._type === 'DETAILED_ERROR' && parsed.message && parsed.recommendation) {
      return {
        message: parsed.message,
        recommendation: parsed.recommendation,
        errorType: parsed.errorType || 'UNKNOWN',
        raw: parsed.raw,
        _type: 'DETAILED_ERROR'
      };
    }
  } catch (e) {
    // Not JSON - just return as plain text
  }
  
  return null;
}

export function getErrorDisplay(errorMessage: string | null | undefined) {
  const detailedError = parseDetailedError(errorMessage);
  
  if (detailedError) {
    return {
      title: 'Generation Failed',
      message: detailedError.message,
      recommendation: detailedError.recommendation,
      isDetailed: true
    };
  }
  
  return {
    title: 'Generation Failed',
    message: errorMessage || 'An unknown error occurred',
    recommendation: null,
    isDetailed: false
  };
}
