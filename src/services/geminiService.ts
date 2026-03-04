import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: process.env.GEMINI_API_KEY is automatically provided by the platform
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
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
  giftHistory?: string[];
}) {
  try {
    const prompt = `Generate a birthday message for a ${params.relationship}. 
    We have been friends for ${params.yearsKnown} years. 
    Some memories: ${params.memories.join(', ')}. 
    Past gifts given: ${params.giftHistory?.join(', ') || 'None recorded'}.
    Tone: ${params.tone}. Length: ${params.length}.
    Return a JSON object with "shortText" and "cardMessage".`;

    const text = await callGemini(prompt, { responseMimeType: "application/json" });
    return JSON.parse(text || '{}');
  } catch (error) {
    console.error("AI Generation Error:", error);
    return { shortText: "Happy Birthday!", cardMessage: "Wishing you a wonderful day filled with joy and happiness!" };
  }
}

export async function generateRecoveryPlan(params: {
  daysLate: number;
  relationship: string;
}) {
  try {
    const prompt = `I missed a birthday for a ${params.relationship} by ${params.daysLate} days. 
    Generate a recovery plan. 
    Return a JSON object with "apologyMessage" and "recoveryGiftIdeas" (array of strings).`;

    const text = await callGemini(prompt, { responseMimeType: "application/json" });
    return JSON.parse(text || '{}');
  } catch (error) {
    console.error("AI Recovery Error:", error);
    return { 
      apologyMessage: "I am so sorry I missed your birthday!", 
      recoveryGiftIdeas: ["A heartfelt handwritten note", "A surprise coffee delivery", "A dinner treat"] 
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
    const prompt = `Suggest 3 gift ideas for a ${params.relationship} who is interested in ${params.interests}. 
    Budget: $${params.budget}. 
    Past gifts given: ${params.giftHistory?.join(', ') || 'None recorded'}.
    DO NOT suggest items already in the past gift history.
    Return a JSON array of strings.`;

    const text = await callGemini(prompt, { responseMimeType: "application/json" });
    return JSON.parse(text || '[]');
  } catch (error) {
    console.error("AI Gift Suggestion Error:", error);
    return ["A nice book", "A personalized mug", "A gift card"];
  }
}
