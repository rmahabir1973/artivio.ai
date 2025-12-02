import { db } from '../db';
import { socialBrandKits } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { chatService } from '../chatService';

interface BrandAnalysisResult {
  brandVoice: {
    purpose?: string;
    audience?: string;
    tone?: string[];
    emotions?: string[];
    character?: string[];
    syntax?: string[];
    language?: string[];
  };
  businessOverview: {
    coreIdentity?: string;
    primaryPositioning?: string;
    secondaryPositioning?: string;
    tertiaryPositioning?: string;
    competitiveAdvantages?: string[];
  };
  customerDemographics: {
    primarySegments?: string[];
    ageRange?: string;
    location?: string;
    interests?: string[];
    painPoints?: string[];
    goals?: string[];
  };
  competitors: {
    local?: string[];
    national?: string[];
  };
  error?: string;
}

const BRAND_ANALYSIS_PROMPT = `You are an expert brand strategist and marketing analyst. Analyze the following website content and extract comprehensive brand insights.

Based on the website information provided, generate a detailed brand analysis including:

1. BRAND VOICE:
- Purpose: The core reason the brand exists (1-2 sentences)
- Target Audience: Who the brand speaks to (1-2 sentences)
- Tone: List 3-5 tone descriptors (e.g., "Professional", "Friendly", "Authoritative")
- Emotions: List 3-5 emotions the brand should evoke (e.g., "Trust", "Excitement", "Confidence")
- Character: List 2-3 brand personality traits (e.g., "Expert", "Mentor", "Innovator")
- Syntax: List 2-3 writing style preferences (e.g., "Short sentences", "Questions", "Story-driven")
- Language: List 2-3 language preferences (e.g., "Simple language", "Technical jargon OK", "Inclusive")

2. BUSINESS OVERVIEW:
- Core Identity: What the business fundamentally does (1-2 sentences)
- Primary Positioning: Main value proposition (1 sentence)
- Secondary Positioning: Supporting value proposition (1 sentence)
- Tertiary Positioning: Additional differentiator (1 sentence)
- Competitive Advantages: List 3-5 key advantages

3. CUSTOMER DEMOGRAPHICS:
- Primary Segments: List 2-4 main customer segments
- Age Range: Typical age range of customers
- Location: Geographic focus (local, regional, national, global)
- Interests: List 3-5 customer interests
- Pain Points: List 3-5 problems customers face
- Goals: List 3-5 things customers want to achieve

4. COMPETITORS:
- Local: List 2-3 potential local competitors (if applicable)
- National: List 2-3 potential national/major competitors

Respond ONLY with valid JSON in this exact format:
{
  "brandVoice": {
    "purpose": "string",
    "audience": "string",
    "tone": ["string"],
    "emotions": ["string"],
    "character": ["string"],
    "syntax": ["string"],
    "language": ["string"]
  },
  "businessOverview": {
    "coreIdentity": "string",
    "primaryPositioning": "string",
    "secondaryPositioning": "string",
    "tertiaryPositioning": "string",
    "competitiveAdvantages": ["string"]
  },
  "customerDemographics": {
    "primarySegments": ["string"],
    "ageRange": "string",
    "location": "string",
    "interests": ["string"],
    "painPoints": ["string"],
    "goals": ["string"]
  },
  "competitors": {
    "local": ["string"],
    "national": ["string"]
  }
}`;

export async function analyzeBrand(brandKitId: string): Promise<BrandAnalysisResult> {
  try {
    const brandKit = await db.query.socialBrandKits.findFirst({
      where: eq(socialBrandKits.id, brandKitId),
    });

    if (!brandKit) {
      throw new Error('Brand kit not found');
    }

    const websiteInfo = {
      name: brandKit.name,
      description: brandKit.visualIdentityDescription || '',
      businessOverview: brandKit.businessOverview || {},
      colors: brandKit.colors || [],
      fonts: brandKit.fonts || [],
    };

    const websiteContext = `
WEBSITE INFORMATION:
- Business Name: ${websiteInfo.name}
- Description: ${websiteInfo.description}
- Core Identity: ${(websiteInfo.businessOverview as any)?.coreIdentity || 'Not specified'}
- Brand Colors: ${websiteInfo.colors.join(', ') || 'Not specified'}
- Typography: ${websiteInfo.fonts.join(', ') || 'Not specified'}

Please analyze this brand and provide comprehensive insights.
`;

    const response = await chatService.chat(
      'deepseek',
      'deepseek-chat',
      [
        { role: 'system', content: BRAND_ANALYSIS_PROMPT },
        { role: 'user', content: websiteContext }
      ]
    );

    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let analysis: BrandAnalysisResult;
    try {
      analysis = JSON.parse(jsonStr) as BrandAnalysisResult;
    } catch (parseError) {
      console.error('[AIBrandAnalyzer] Failed to parse AI response:', parseError);
      return {
        brandVoice: {},
        businessOverview: {},
        customerDemographics: {},
        competitors: {},
        error: 'Failed to parse AI response. Please try again.',
      };
    }

    if (!analysis.brandVoice) analysis.brandVoice = {};
    if (!analysis.businessOverview) analysis.businessOverview = {};
    if (!analysis.customerDemographics) analysis.customerDemographics = {};
    if (!analysis.competitors) analysis.competitors = {};

    return analysis;
  } catch (error: any) {
    console.error('[AIBrandAnalyzer] Error analyzing brand:', error);
    return {
      brandVoice: {},
      businessOverview: {},
      customerDemographics: {},
      competitors: {},
      error: error.message,
    };
  }
}

export async function applyBrandAnalysis(brandKitId: string, analysis: BrandAnalysisResult): Promise<void> {
  try {
    const brandKit = await db.query.socialBrandKits.findFirst({
      where: eq(socialBrandKits.id, brandKitId),
    });

    if (!brandKit) {
      throw new Error('Brand kit not found');
    }

    const existingVoice = brandKit.brandVoice || {};
    const existingOverview = brandKit.businessOverview || {};
    const existingDemographics = brandKit.customerDemographics || {};
    const existingCompetitors = brandKit.competitors || {};

    const mergedVoice = {
      ...existingVoice,
      ...analysis.brandVoice,
      tone: analysis.brandVoice.tone || (existingVoice as any).tone,
      emotions: analysis.brandVoice.emotions || (existingVoice as any).emotions,
      character: analysis.brandVoice.character || (existingVoice as any).character,
      syntax: analysis.brandVoice.syntax || (existingVoice as any).syntax,
      language: analysis.brandVoice.language || (existingVoice as any).language,
    };

    const mergedOverview = {
      ...existingOverview,
      ...analysis.businessOverview,
      competitiveAdvantages: analysis.businessOverview.competitiveAdvantages || 
        (existingOverview as any).competitiveAdvantages,
    };

    const mergedDemographics = {
      ...existingDemographics,
      ...analysis.customerDemographics,
      primarySegments: analysis.customerDemographics.primarySegments || 
        (existingDemographics as any).primarySegments,
      interests: analysis.customerDemographics.interests || 
        (existingDemographics as any).interests,
      painPoints: analysis.customerDemographics.painPoints || 
        (existingDemographics as any).painPoints,
      goals: analysis.customerDemographics.goals || 
        (existingDemographics as any).goals,
    };

    const mergedCompetitors = {
      local: analysis.competitors.local || (existingCompetitors as any).local || [],
      national: analysis.competitors.national || (existingCompetitors as any).national || [],
    };

    await db
      .update(socialBrandKits)
      .set({
        brandVoice: mergedVoice,
        businessOverview: mergedOverview,
        customerDemographics: mergedDemographics,
        competitors: mergedCompetitors,
      })
      .where(eq(socialBrandKits.id, brandKitId));

    console.log(`[AIBrandAnalyzer] Successfully applied brand analysis to kit ${brandKitId}`);
  } catch (error: any) {
    console.error('[AIBrandAnalyzer] Error applying brand analysis:', error);
    throw error;
  }
}

export async function analyzeAndApplyBrand(brandKitId: string): Promise<BrandAnalysisResult> {
  const analysis = await analyzeBrand(brandKitId);
  
  if (!analysis.error) {
    await applyBrandAnalysis(brandKitId, analysis);
  }
  
  return analysis;
}
