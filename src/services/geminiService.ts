import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    // Try both process.env (for platform) and import.meta.env (for standard Vite/Netlify)
    const apiKey = process.env.GEMINI_API_KEY || (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY);
    
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      throw new Error("GEMINI_API_KEY is not set. Please add it to your environment variables (e.g., in Netlify dashboard).");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generateBirthdayMessage(params: {
  relationship: string;
  yearsKnown: number;
  memories: string[];
  tone: string;
  length: string;
}) {
  try {
    const ai = getAI();
    const prompt = `Generate a birthday message for a ${params.relationship}. 
    We have been friends for ${params.yearsKnown} years. 
    Some memories: ${params.memories.join(', ')}. 
    Tone: ${params.tone}. Length: ${params.length}.
    Return a JSON object with "shortText" and "cardMessage".`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || '{}');
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
    const ai = getAI();
    const prompt = `I missed a birthday for a ${params.relationship} by ${params.daysLate} days. 
    Generate a recovery plan. 
    Return a JSON object with "apologyMessage" and "recoveryGiftIdeas" (array of strings).`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || '{}');
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
}) {
  try {
    const ai = getAI();
    const prompt = `Suggest 3 gift ideas for a ${params.relationship} who is interested in ${params.interests}. 
    Budget: $${params.budget}. 
    Return a JSON array of strings.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("AI Gift Suggestion Error:", error);
    return ["A nice book", "A personalized mug", "A gift card"];
  }
}
