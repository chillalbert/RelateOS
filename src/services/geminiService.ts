import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: process.env.GEMINI_API_KEY is automatically provided by the platform
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please ensure it is set in the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

async function callGemini(prompt: string, config?: any) {
  const ai = getAiClient();
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      ...config,
    },
  });

  return response.text;
}

export async function generateBirthdayMessage(params: {
  relationship: string;
  yearsKnown: number;
  memories: string[];
  tone: string;
  length: string;
  interests?: string;
  giftHistory?: string[];
}) {
  try {
    const memoriesText = params.memories.length > 0 
      ? `Use these specific details: ${params.memories.join(', ')}.` 
      : "No specific details provided. Keep it simple.";

    const interestsText = params.interests 
      ? `The person is interested in: ${params.interests}. Use Google Search to find a relevant joke, interesting fact, or recent news related to these interests to include in the message.`
      : "";

    const prompt = `
# TASK
Generate a birthday message for a ${params.relationship}. 
Years known: ${params.yearsKnown}.
${memoriesText}
${interestsText}
Past gifts: ${params.giftHistory?.join(', ') || 'None'}.

# OUTPUT FORMAT
Return a JSON object with "shortText" and "cardMessage".

# FOLLOW THIS WRITING STYLE:
• SHOULD use clear, simple language.
• SHOULD be spartan and informative.
• SHOULD use short, impactful sentences.
• SHOULD use active voice; avoid passive voice.
• SHOULD focus on practical, actionable insights.
• SHOULD use "you" and "your" to directly address the reader.
• AVOID using em dashes (-) anywhere in your response. Use only commas, periods, or other standard punctuation.
• AVOID constructions like " ...not just this, but also this".
• AVOID metaphors and clichés.
• AVOID generalizations.
• AVOID common setup language.
• AVOID output warnings or notes, just the output requested.
• AVOID unnecessary adjectives and adverbs.
• AVOID staccato stop start sentences.
• AVOID rhetorical questions.
• AVOID hashtags.
• AVOID semicolons.
• AVOID markdown.
• AVOID asterisks.
• AVOID these words: can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, enlightening, esteemed, shed light, craft, crafting, imagine, realm, game-changer, unlock, discover, skyrocket, abyss, not alone, in a world where, revolutionize, disruptive, utilize, utilizing, dive deep, tapestry, illuminate, unveil, pivotal, intricate, elucidate, hence, furthermore, realm, however, harness, exciting, groundbreaking, cutting-edge, remarkable, it, remains to be seen, glimpse into, navigating, landscape, stark, testament, in summary, in conclusion, moreover, boost, skyrocketing, opened up, powerful, inquiries, ever-evolving.

# IMPORTANT
If no specific details or interests are provided, the message should simply be "Happy Birthday".
If you find a joke or fact, integrate it naturally. If not, stick to a standard warm message.
Review your response and ensure no em dashes!
`;

    const text = await callGemini(prompt, { 
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }]
    });
    return JSON.parse(text || '{}');
  } catch (error) {
    console.error("AI Generation Error:", error);
    return { shortText: "Happy Birthday", cardMessage: "Happy Birthday. Have a great day." };
  }
}

export async function generateRecoveryPlan(params: {
  daysLate: number;
  relationship: string;
}) {
  try {
    const prompt = `
# TASK
I missed a birthday for a ${params.relationship} by ${params.daysLate} days. 
Generate a recovery plan. 

# OUTPUT FORMAT
Return a JSON object with "apologyMessage" and "recoveryGiftIdeas" (array of strings).

# FOLLOW THIS WRITING STYLE:
• SHOULD use clear, simple language.
• SHOULD be spartan and informative.
• SHOULD use short, impactful sentences.
• SHOULD use active voice; avoid passive voice.
• SHOULD focus on practical, actionable insights.
• SHOULD use "you" and "your" to directly address the reader.
• AVOID using em dashes (-) anywhere in your response. Use only commas, periods, or other standard punctuation.
• AVOID constructions like " ...not just this, but also this".
• AVOID metaphors and clichés.
• AVOID generalizations.
• AVOID common setup language.
• AVOID output warnings or notes, just the output requested.
• AVOID unnecessary adjectives and adverbs.
• AVOID staccato stop start sentences.
• AVOID rhetorical questions.
• AVOID hashtags.
• AVOID semicolons.
• AVOID markdown.
• AVOID asterisks.
• AVOID these words: can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, enlightening, esteemed, shed light, craft, crafting, imagine, realm, game-changer, unlock, discover, skyrocket, abyss, not alone, in a world where, revolutionize, disruptive, utilize, utilizing, dive deep, tapestry, illuminate, unveil, pivotal, intricate, elucidate, hence, furthermore, realm, however, harness, exciting, groundbreaking, cutting-edge, remarkable, it, remains to be seen, glimpse into, navigating, landscape, stark, testament, in summary, in conclusion, moreover, boost, skyrocketing, opened up, powerful, inquiries, ever-evolving.

# IMPORTANT
Review your response and ensure no em dashes!
`;

    const text = await callGemini(prompt, { responseMimeType: "application/json" });
    return JSON.parse(text || '{}');
  } catch (error) {
    console.error("AI Recovery Error:", error);
    return { 
      apologyMessage: "I missed your birthday. I am sorry.", 
      recoveryGiftIdeas: ["Handwritten note", "Coffee delivery", "Dinner treat"] 
    };
  }
}

export async function generateGiftSuggestions(params: {
  interests: string;
  budget: number;
  relationship: string;
  giftHistory?: string[];
}) {
  try {
    const prompt = `
# TASK
Suggest 3 gift ideas for a ${params.relationship} who is interested in ${params.interests}. 
Budget: $${params.budget}. 
Past gifts: ${params.giftHistory?.join(', ') || 'None'}.
DO NOT suggest items already in the past gift history.

# OUTPUT FORMAT
Return a JSON array of strings.

# FOLLOW THIS WRITING STYLE:
• SHOULD use clear, simple language.
• SHOULD be spartan and informative.
• SHOULD use short, impactful sentences.
• SHOULD use active voice; avoid passive voice.
• SHOULD focus on practical, actionable insights.
• SHOULD use "you" and "your" to directly address the reader.
• AVOID using em dashes (-) anywhere in your response. Use only commas, periods, or other standard punctuation.
• AVOID constructions like " ...not just this, but also this".
• AVOID metaphors and clichés.
• AVOID generalizations.
• AVOID common setup language.
• AVOID output warnings or notes, just the output requested.
• AVOID unnecessary adjectives and adverbs.
• AVOID staccato stop start sentences.
• AVOID rhetorical questions.
• AVOID hashtags.
• AVOID semicolons.
• AVOID markdown.
• AVOID asterisks.
• AVOID these words: can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, enlightening, esteemed, shed light, craft, crafting, imagine, realm, game-changer, unlock, discover, skyrocket, abyss, not alone, in a world where, revolutionize, disruptive, utilize, utilizing, dive deep, tapestry, illuminate, unveil, pivotal, intricate, elucidate, hence, furthermore, realm, however, harness, exciting, groundbreaking, cutting-edge, remarkable, it, remains to be seen, glimpse into, navigating, landscape, stark, testament, in summary, in conclusion, moreover, boost, skyrocketing, opened up, powerful, inquiries, ever-evolving.

# IMPORTANT
Review your response and ensure no em dashes!
`;

    const text = await callGemini(prompt, { responseMimeType: "application/json" });
    return JSON.parse(text || '[]');
  } catch (error) {
    console.error("AI Gift Suggestion Error:", error);
    return ["Book", "Personalized mug", "Gift card"];
  }
}
