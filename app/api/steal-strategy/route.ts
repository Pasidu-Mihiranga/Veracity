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

export interface LeaderEvolutionStage {
  stageName: string;
  teamOrScale: string;
  howTheyOperated: string;
  whatTheyMastered: string;
  isCurrentLevelForUser: boolean;
}

export interface ExecutionPhase {
  id: string;
  phase: string;
  timeframe: string;
  title: string;
  objectives: string[];
  deliverables: { id: string; text: string; done?: boolean }[];
  weeklyActions: { id: string; text: string; done?: boolean }[];
}

export interface CompanyTimelineMilestone {
  stepNumber: number;
  yearOrTimeframe: string;
  categoryTag: string;
  badgeColor: 'orange' | 'amber' | 'rose' | 'pink' | 'purple' | 'blue' | 'cyan' | 'emerald' | 'lime' | 'yellow';
  title: string;
  description: string;
}

export interface GrowthPlaybookResult {
  id?: string;
  createdAt?: string;
  isRecognized: boolean;
  correctedCompanyName?: string;
  company: string;
  market: string;
  stage: string;
  goal: string;
  summary: string;
  companyMilestones?: CompanyTimelineMilestone[];
  evolutionStages: {
    stages: LeaderEvolutionStage[];
    breakthroughMove: string;
  };
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
  executionTimeline: ExecutionPhase[];
  keyMetrics: {
    id: string;
    metric: string;
    target: string;
    actual?: string;
    whyItMatters: string;
  }[];
  ethicalGuardrails: string;
  progressFeedback?: string;
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
    mode?: 'suggest_leaders' | 'generate_roadmap' | 'adapt_roadmap';
    company?: string;
    market?: string;
    stage?: string;
    goal?: string;
    productDescription?: string;
    customContext?: string;
    completedTasks?: string[];
    actualMetrics?: { metric: string; actual: string; target: string }[];
    weeklyNotes?: string;
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
Use simple, everyday English without technical jargon. Do not use emojis anywhere.`;

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
  // MODE 2 & 3: Generate / Adapt Plain-English, Step-by-Step Growth Plan
  // ════════════════════════════════════════════════════════════════════════
  const rawCompany = (body.company ?? '').trim();
  if (rawCompany.length < 2) {
    return jsonError('Please enter a company name (at least 2 characters)', 400);
  }

  const customContext = (body.customContext ?? '').trim();
  const isAdaptive = mode === 'adapt_roadmap';

  const systemPrompt = `You are a friendly, encouraging business coach and growth strategist.
You help small business owners, creators, and founders grow by learning from what worked for successful market leaders.

Crucial Language & Tone Guidelines:
1. Use 100% simple, everyday, friendly English.
2. DO NOT use emojis anywhere in your text.
3. DO NOT use technical engineering or developer jargon (avoid words like "reverse-engineering", "APIs", "PLG loops", "infrastructure", "wedge", "SDKs" unless the user's category specifically asks for it).
4. Explain everything like you're giving advice to a smart friend starting a business: focus on how to attract customers, how to price simply, and how to get people talking about the product.
5. Validate that "${rawCompany}" is a real, recognizable company. If it is random gibberish (e.g. "asdfg", "xyz123"), set "isValidEntity": false. If it is a slight typo (e.g. "Stripeee"), correct it in "correctedCompanyName".
6. Tailor all advice to their current stage: "${stage}" and goal: "${goal}".
${isAdaptive ? '7. This is an ADAPTIVE RECALIBRATION: Review the completed tasks and real-world metrics provided by the user. Give encouraging progress feedback, remove completed items, and provide next-level steps.' : ''}
8. Output valid JSON only, no markdown.`;

  const userPrompt = `Company to learn from: ${rawCompany}
Market / Field: ${market}
Current Team Size / Stage: ${stage}
Main Goal: ${goal}
${customContext ? `More details about the business: ${customContext}\n` : ''}
${isAdaptive ? `Completed Milestones So Far:\n${(body.completedTasks ?? []).map(t => `- ${t}`).join('\n') || 'None completed yet'}\n` : ''}
${isAdaptive && body.actualMetrics?.length ? `Actual Metric Numbers Logged by User:\n${body.actualMetrics.map(m => `- ${m.metric}: Target was ${m.target}, Actual achieved is ${m.actual}`).join('\n')}\n` : ''}
${isAdaptive && body.weeklyNotes ? `User Feedback & Current Bottleneck: ${body.weeklyNotes}\n` : ''}

Generate JSON matching this exact structure:
{
  "isValidEntity": true,
  "correctedCompanyName": "Corrected Company Name or original",
  "rejectionReason": null,
  "isRecognized": true,
  "company": "Company Name",
  "summary": "2-3 clear, encouraging sentences explaining how ${rawCompany} became successful and how a ${stage} business in ${market} can use their best ideas to reach '${goal}'.",
  ${isAdaptive ? '"progressFeedback": "2-3 encouraging sentences celebrating their completed tasks, analyzing their actual numbers, and giving a clear solution to their bottleneck.",' : ''}
  "companyMilestones": [
    {
      "stepNumber": 1,
      "yearOrTimeframe": "Year or Time (e.g. 2010)",
      "categoryTag": "Foundation",
      "badgeColor": "orange",
      "title": "Foundation & Core Idea",
      "description": "How the founder started ${rawCompany} and tested their first concept."
    },
    {
      "stepNumber": 2,
      "yearOrTimeframe": "Year or Time (e.g. 2011)",
      "categoryTag": "First Product",
      "badgeColor": "amber",
      "title": "First Version & Early Users",
      "description": "How they launched their first simple product to solve one painful problem."
    },
    {
      "stepNumber": 3,
      "yearOrTimeframe": "Year or Time (e.g. 2013)",
      "categoryTag": "Early Traction",
      "badgeColor": "rose",
      "title": "Finding Product-Market Fit",
      "description": "The key marketing or product decision that brought their first 1,000 paying users."
    },
    {
      "stepNumber": 4,
      "yearOrTimeframe": "Year or Time (e.g. 2016)",
      "categoryTag": "Expansion",
      "badgeColor": "purple",
      "title": "Scaling & Growing the Offer",
      "description": "Expanding into new services or customer tiers to accelerate growth."
    },
    {
      "stepNumber": 5,
      "yearOrTimeframe": "Year or Time (e.g. 2020 to Present)",
      "categoryTag": "Market Leader",
      "badgeColor": "blue",
      "title": "Industry Standard & Dominance",
      "description": "How they achieved long-term brand trust and market leadership."
    }
  ],
  "evolutionStages": {
    "stages": [
      {
        "stageName": "Stage 1: Getting Started & Finding First Users",
        "teamOrScale": "1–3 people / Launch",
        "howTheyOperated": "How ${rawCompany} operated when they were small (e.g. manual phone calls, hands-on customer onboarding)",
        "whatTheyMastered": "The key lesson they mastered at this stage",
        "isCurrentLevelForUser": true
      },
      {
        "stageName": "Stage 2: Gaining Traction & Repeat Buyers",
        "teamOrScale": "10–50 people",
        "howTheyOperated": "How ${rawCompany} scaled to their first 1,000 to 10,000 customers",
        "whatTheyMastered": "The core systems and word-of-mouth channels they unlocked",
        "isCurrentLevelForUser": false
      },
      {
        "stageName": "Stage 3: Market Leader & Nationwide Scale",
        "teamOrScale": "100+ people",
        "howTheyOperated": "How ${rawCompany} became the industry standard today",
        "whatTheyMastered": "Long-term brand trust and network effects",
        "isCurrentLevelForUser": false
      }
    ],
    "breakthroughMove": "The single most important breakthrough idea that allowed ${rawCompany} to jump from Stage 1 to Stage 2."
  },
  "leaderTeardown": {
    "coreWedge": "How they attracted their very first customers",
    "whyItWorked": "Why customers loved them and chose them over traditional options",
    "keyMilestone": "The key moment that made their business take off"
  },
  "growthLevers": [
    {
      "leverName": "1. Simple & Frictionless Value Proposition",
      "howToApplyNow": "How ${rawCompany} removed friction for early users and how you can do the same at ${stage}.",
      "actionableTactics": [
        "Identify the one essential task your users want solved and make it free or frictionless to try.",
        "Remove mandatory upfront setup steps so users experience value within 2 minutes.",
        "Talk directly to your first 10 active users to refine your core promise."
      ]
    },
    {
      "leverName": "2. Organic Word-of-Mouth & Referral Engine",
      "howToApplyNow": "How ${rawCompany} turned early satisfied buyers into their best marketing channel.",
      "actionableTactics": [
        "Add a natural share or invite mechanism right after a user achieves a positive outcome.",
        "Publish transparent, helpful case studies or behind-the-scenes lessons in your niche.",
        "Offer a direct perk (credit, bonus feature, or gift) for peer referrals."
      ]
    },
    {
      "leverName": "3. Transparent Pricing & Value-Driven Upgrades",
      "howToApplyNow": "How ${rawCompany} structured simple pricing tiers to convert free/trial users into long-term paying customers.",
      "actionableTactics": [
        "Create 2 to 3 crystal-clear pricing tiers with no hidden fees or confusing terms.",
        "Tie higher pricing tiers to direct business growth (usage, team seats, or advanced features).",
        "Offer an annual discount or risk-free guarantee to increase upfront cash flow."
      ]
    },
    {
      "leverName": "4. Customer Retention & Community Delight",
      "howToApplyNow": "How ${rawCompany} built lasting customer loyalty and reduced churn.",
      "actionableTactics": [
        "Send personal welcome notes and hands-on onboarding tips to every new subscriber.",
        "Check in with customers who haven't logged in recently with proactive helpful guidance.",
        "Build a simple feedback board or community group where customers feel heard."
      ]
    }
  ],
  "executionTimeline": [
    {
      "id": "phase-1",
      "phase": "Phase 1",
      "timeframe": "Months 1–2",
      "title": "Getting Started & Finding First Customers",
      "objectives": ["Simple goal 1", "Simple goal 2"],
      "deliverables": [
        { "id": "p1-d1", "text": "First deliverable to launch" },
        { "id": "p1-d2", "text": "First key offer to share" }
      ],
      "weeklyActions": [
        { "id": "p1-w1", "text": "Reach out to 20 potential customers and ask what frustrates them" },
        { "id": "p1-w2", "text": "Create a risk-free trial or return policy to remove buying hesitation" }
      ]
    },
    {
      "id": "phase-2",
      "phase": "Phase 2",
      "timeframe": "Months 3–6",
      "title": "Growing Your Audience & Getting Regular Sales",
      "objectives": ["Simple goal 1", "Simple goal 2"],
      "deliverables": [
        { "id": "p2-d1", "text": "Key milestone to launch" },
        { "id": "p2-d2", "text": "Key customer channel to grow" }
      ],
      "weeklyActions": [
        { "id": "p2-w1", "text": "Collect feedback and written testimonials from your first 10 buyers" },
        { "id": "p2-w2", "text": "Set up a simple word-of-mouth referral incentive" }
      ]
    },
    {
      "id": "phase-3",
      "phase": "Phase 3",
      "timeframe": "Months 6–12",
      "title": "Scaling Up & Increasing Revenue",
      "objectives": ["Simple goal 1", "Simple goal 2"],
      "deliverables": [
        { "id": "p3-d1", "text": "Higher-tier offer to introduce" },
        { "id": "p3-d2", "text": "Long-term customer retention plan" }
      ],
      "weeklyActions": [
        { "id": "p3-w1", "text": "Offer loyalty packages or subscriptions for repeat buyers" },
        { "id": "p3-w2", "text": "Expand into adjacent product categories based on customer requests" }
      ]
    }
  ],
  "keyMetrics": [
    {
      "id": "metric-1",
      "metric": "Weekly Customer Conversations",
      "target": "20 per week",
      "whyItMatters": "Talking directly to potential buyers teaches you what they really want."
    },
    {
      "id": "metric-2",
      "metric": "New Paying Customers",
      "target": "5–10 per week",
      "whyItMatters": "Proves that people find enough value to pay for your solution."
    },
    {
      "id": "metric-3",
      "metric": "Customer Referrals",
      "target": "2–3 per month",
      "whyItMatters": "Indicates high satisfaction and helps you grow without spending on ads."
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

    // Ensure at least 3-4 rich growth levers
    if (data.growthLevers.length < 3) {
      const fallbackLevers = [
        {
          leverName: 'Simple & Frictionless Value Proposition',
          howToApplyNow: `Focus on the one core problem ${rawCompany} solved brilliantly, removing all unnecessary friction for new users.`,
          actionableTactics: [
            'Make your initial onboarding fast and simple with zero confusion.',
            'Deliver visible customer value within the first 3 minutes of use.',
            'Interview early trial users to learn exactly which feature they value most.'
          ]
        },
        {
          leverName: 'Organic Word-of-Mouth & Referral Loops',
          howToApplyNow: `Incentivize happy customers to naturally share your product with their friends and colleagues.`,
          actionableTactics: [
            'Prompt for a referral or review right after a customer reaches a positive milestone.',
            'Share transparent build-in-public updates and practical guides in your niche.',
            'Provide double-sided referral incentives (e.g. discount or perk for both parties).'
          ]
        },
        {
          leverName: 'Transparent Pricing & Value-Driven Upgrades',
          howToApplyNow: `Structure simple, clear tiers that make buying a no-brainer decision for early customers.`,
          actionableTactics: [
            'Offer a straightforward starter tier with clear feature boundaries.',
            'Align premium pricing with business growth metrics (seats, volume, or speed).',
            'Offer a money-back satisfaction guarantee to eliminate buying hesitation.'
          ]
        }
      ];

      for (const fb of fallbackLevers) {
        if (data.growthLevers.length < 3) {
          data.growthLevers.push(fb);
        }
      }
    }

    // Attach metadata
    data.id = `${rawCompany.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    data.createdAt = new Date().toISOString();
    data.company = data.company || rawCompany;
    data.market = market;
    data.stage = stage;
    data.goal = goal;

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Roadmap generation error:', err);
    return jsonError('Failed to generate growth plan. Please try again.', 500);
  }
}
