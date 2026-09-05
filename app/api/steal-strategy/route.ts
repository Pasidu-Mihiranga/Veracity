import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generateHuggingFaceJson } from '@/lib/agents/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

function jsonError(message: string, status: number, extra?: Record<string, any>) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface SuggestedLeader {
  name: string;
  tagline: string;
  whyModelThem: string;
}

export interface GrowthPlaybookResult {
  isRecognized: boolean;
  correctedCompanyName?: string;
  company: string;
  summary: string;
  leaderTeardown: {
    coreWedge: string;
    whyItWorked: string;
    keyMilestone: string;
  };
  growthLevers: {
    leverName: string;
    howToApplyNow: string;
    actionableTactics: string[];
  }[];
  executionTimeline: {
    phase: string;
    timeframe: string;
    title: string;
    objectives: string[];
    deliverables: string[];
  }[];
  keyMetrics: {
    metric: string;
    target: string;
    whyItMatters: string;
  }[];
  ethicalGuardrails: string;
}

interface ValidationAndRoadmapResponse extends GrowthPlaybookResult {
  isValidEntity: boolean;
  correctionSuggestion?: string;
  rejectionReason?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return jsonError('Not authenticated', 401);
  }

  let body: {
    mode?: 'suggest_leaders' | 'generate_roadmap';
    company?: string;
    market?: string;
    stage?: string;
    goal?: string;
    productDescription?: string;
    customContext?: string;
  };

  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const mode = body.mode ?? 'generate_roadmap';
  const market = (body.market ?? 'Business Software & Services').trim();
  const stage = (body.stage ?? 'Early Stage / Small Team (1-10 people)').trim();
  const goal = (body.goal ?? 'Get First 100 Paying Customers').trim();

  // ════════════════════════════════════════════════════════════════════════
  // MODE 1: Dynamically Suggest Best Benchmark Companies in Plain English
  // ════════════════════════════════════════════════════════════════════════
  if (mode === 'suggest_leaders') {
    const desc = (body.productDescription ?? body.customContext ?? '').trim();
    const systemPrompt = `You are a friendly business growth advisor. Return valid JSON only, no markdown.
Provide 5 real, successful companies in the user's field that are great examples to learn from.
Use simple, everyday English without technical jargon.`;

    const userPrompt = `Industry / Market: ${market}
${desc ? `Business Description: ${desc}\n` : ''}
Goal: ${goal}

Generate a JSON object:
{
  "leaders": [
    {
      "name": "Real Company Name",
      "tagline": "Short simple summary of what they do (e.g. Simple Online Invoicing & Bookkeeping)",
      "whyModelThem": "One friendly sentence on why their early growth is a great example to follow."
    }
  ]
}
Include 5 real, well-known companies.`;

    try {
      const data = await generateHuggingFaceJson<{ leaders: SuggestedLeader[] }>(systemPrompt, userPrompt, {
        maxNewTokens: 1500,
        temperature: 0.2,
      });

      if (!Array.isArray(data.leaders) || data.leaders.length === 0) {
        return jsonError('Could not find benchmark companies for this category', 502);
      }

      return new Response(JSON.stringify({ leaders: data.leaders }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Leader suggestion error:', err);
      return jsonError('Failed to suggest benchmark companies.', 500);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // MODE 2: Generate Plain-English, Step-by-Step Growth Plan
  // ════════════════════════════════════════════════════════════════════════
  const rawCompany = (body.company ?? '').trim();
  if (rawCompany.length < 2) {
    return jsonError('Please enter a company name (at least 2 characters)', 400);
  }

  const customContext = (body.customContext ?? '').trim();

  const systemPrompt = `You are a friendly, encouraging business coach and growth strategist.
You help small business owners, creators, and founders grow by learning from what worked for successful market leaders.

Crucial Language & Tone Guidelines:
1. Use 100% simple, everyday, friendly English.
2. DO NOT use technical engineering or developer jargon (avoid words like "reverse-engineering", "APIs", "PLG loops", "infrastructure", "wedge", "SDKs" unless the user's category specifically asks for it).
3. Explain everything like you're giving advice to a smart friend starting a business: focus on how to attract customers, how to price simply, and how to get people talking about the product.
4. Validate that "${rawCompany}" is a real, recognizable company. If it is random gibberish (e.g. "asdfg", "xyz123"), set "isValidEntity": false. If it is a slight typo (e.g. "Stripeee"), correct it in "correctedCompanyName".
5. Tailor all advice to their current stage: "${stage}" and goal: "${goal}".
6. Output valid JSON only, no markdown.`;

  const userPrompt = `Company to learn from: ${rawCompany}
Market / Field: ${market}
Current Team Size / Stage: ${stage}
Main Goal: ${goal}
${customContext ? `More details about the business: ${customContext}\n` : ''}

Generate JSON matching this exact structure:
{
  "isValidEntity": true,
  "correctedCompanyName": "Corrected Company Name or original",
  "rejectionReason": null,
  "isRecognized": true,
  "company": "Company Name",
  "summary": "2-3 clear, encouraging sentences explaining how ${rawCompany} became successful and how a ${stage} business in ${market} can use their best ideas to reach '${goal}'.",
  "leaderTeardown": {
    "coreWedge": "How they attracted their very first customers",
    "whyItWorked": "Why customers loved them and chose them over traditional options",
    "keyMilestone": "The key moment that made their business take off"
  },
  "growthLevers": [
    {
      "leverName": "Name of Growth Idea (e.g. Super-Fast Setup, Word-of-Mouth Referral, Simple Transparent Pricing)",
      "howToApplyNow": "Clear, friendly explanation of how to use this idea right now at ${stage}",
      "actionableTactics": [
        "Simple practical step 1 you can do this week",
        "Simple practical step 2 you can do this week",
        "Simple practical step 3 you can do this week"
      ]
    }
  ],
  "executionTimeline": [
    {
      "phase": "Phase 1",
      "timeframe": "Months 1–2",
      "title": "Getting Started & Finding First Customers",
      "objectives": ["Simple goal 1", "Simple goal 2"],
      "deliverables": ["First deliverable to launch", "First key offer to share"]
    },
    {
      "phase": "Phase 2",
      "timeframe": "Months 3–6",
      "title": "Growing Your Audience & Getting Regular Sales",
      "objectives": ["Simple goal 1", "Simple goal 2"],
      "deliverables": ["Key milestone to launch", "Key customer channel to grow"]
    },
    {
      "phase": "Phase 3",
      "timeframe": "Months 6–12",
      "title": "Scaling Up & Increasing Revenue",
      "objectives": ["Simple goal 1", "Simple goal 2"],
      "deliverables": ["Higher-tier offer to introduce", "Long-term customer retention plan"]
    }
  ],
  "keyMetrics": [
    {
      "metric": "Simple Metric Name (e.g. New Weekly Signups, Paying Customer Retention, Average Monthly Spend)",
      "target": "Realistic, encouraging target",
      "whyItMatters": "Why tracking this number helps you grow"
    }
  ],
  "ethicalGuardrails": "1-2 friendly sentences reminding the user to borrow the smart growth ideas and business models while bringing their own unique personality and genuine customer care."
}

If the company name is invalid/gibberish, return:
{
  "isValidEntity": false,
  "rejectionReason": "We couldn't find a recognized company named '${rawCompany}'. Please check the spelling or pick one of the recommended examples above.",
  "correctionSuggestion": "Name of closest known company if applicable"
}`;

  try {
    const data = await generateHuggingFaceJson<ValidationAndRoadmapResponse>(systemPrompt, userPrompt, {
      maxNewTokens: 4000,
      temperature: 0.25,
    });

    if (!data.isValidEntity && data.rejectionReason) {
      return jsonError(data.rejectionReason, 422, {
        correctionSuggestion: data.correctionSuggestion || null,
      });
    }

    if (!data.summary || !Array.isArray(data.growthLevers) || !Array.isArray(data.executionTimeline)) {
      return jsonError('Strategy plan generation was incomplete. Please try again.', 502);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Roadmap generation error:', err);
    return jsonError('Failed to generate growth plan. Please try again.', 500);
  }
}
