/**
 * OpenAI GPT-4o Vision Integration for Image Analysis
 * 
 * Note: This is an exception to the "Kie.ai only" architecture because
 * Kie.ai does not offer image analysis/vision capabilities.
 */

export async function analyzeImageWithVision(params: {
  imageUrl: string;
  prompt?: string;
  model?: string;
}): Promise<{ analysis: string; model: string }> {
  const analysisPrompt = params.prompt || 
    "Analyze this image in detail. Describe what's happening in the picture, including: the main subjects, their actions and interactions, the setting/environment, notable objects or details, colors and composition, mood or atmosphere, and any text visible in the image. Provide a comprehensive analysis.";
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const model = params.model || 'gpt-4o';

  try {
    console.log(`Calling OpenAI Vision API with model: ${model}`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: params.imageUrl,
                  detail: 'high' // Request high-detail analysis
                } 
              }
            ]
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const errorMessage = errorData.error?.message || response.statusText;
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content;
    
    if (!analysis) {
      throw new Error('No analysis returned from OpenAI Vision API');
    }

    console.log(`✓ Image analysis completed successfully (${analysis.length} characters)`);

    return {
      analysis,
      model,
    };
  } catch (error: any) {
    console.error('OpenAI Vision API error:', error);
    
    // Normalize error messages for user-facing display
    let userMessage = 'Image analysis failed. Please try again.';
    
    if (error.message?.includes('API key')) {
      userMessage = 'Service configuration error. Please contact support.';
    } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      userMessage = 'Service is temporarily busy. Please try again in a moment.';
    } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      userMessage = 'Request timed out. Please try again.';
    } else if (error.message?.includes('Invalid image') || error.message?.includes('image_url')) {
      userMessage = 'Unable to process image. Please try a different image.';
    }
    
    throw new Error(userMessage);
  }
}
