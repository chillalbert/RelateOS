import { GoogleGenAI } from "@google/genai";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

let cachedApiKey: string | null = null;

export async function initializeGeminiKey() {
  if (cachedApiKey) return cachedApiKey;
  
  try {
    const secretDoc = await getDoc(doc(db, "secrets", "gemini_api_key"));
    if (secretDoc.exists()) {
      cachedApiKey = secretDoc.data().value;
      return cachedApiKey;
    }
  } catch (error) {
    console.error("Error fetching Gemini API key from Firestore:", error);
  }
  return null;
}

// Initialize the Gemini API client
// Note: process.env.GEMINI_API_KEY is automatically provided by the platform
async function callGemini(prompt: string, config?: any) {
  let apiKey = '';
  
  // 1. Check Firebase Storage (Highest Priority - allows you to override platform keys)
  apiKey = await initializeGeminiKey() || '';
  
  // 2. Check Environment (AI Studio / Netlify Env Vars)
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  }
  
  // 3. Check Browser Storage (Manual setup for Netlify/Testing)
  if (!apiKey) {
    apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
  }

  if (apiKey) {
    const source = cachedApiKey ? "Firebase" : "Environment/Storage";
    console.log(`Using Gemini API Key (starts with ${apiKey.substring(0, 4)}...) from: ${source}`);
  }

  const getDemoResponse = async (prompt: string) => {
    console.warn("Running in Demo Mode with mock responses.");
    await new Promise(resolve => setTimeout(resolve, 1000));
    // ... (rest of demo logic remains same)

    if (prompt.includes("birthday message")) {
      return JSON.stringify({
        shortText: "Happy Birthday! 🎂",
        cardMessage: "Wishing you a day filled with joy and a year ahead full of wonderful adventures. You deserve the best!"
      });
    }
    
    if (prompt.includes("recovery plan")) {
      return JSON.stringify({
        apologyMessage: "I'm so sorry I missed your big day! I hope it was as amazing as you are.",
        recoveryGiftIdeas: ["Surprise Coffee Delivery", "Handwritten Letter", "Dinner on me"]
      });
    }

    if (prompt.includes("gift ideas")) {
      return JSON.stringify([
        "Customized Photo Album",
        "Premium Coffee Bean Set",
        "Noise-Canceling Headphones"
      ]);
    }

    return "This is a demo response because the Gemini API key is not configured or has been revoked.";
  };

  if (!apiKey) {
    return getDemoResponse(prompt);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        ...config,
      },
    });

    return response.text;
  } catch (error: any) {
    // Handle leaked/revoked key error specifically
    if (error?.message?.includes("leaked") || error?.message?.includes("403")) {
      console.error("Gemini API Key has been revoked or is invalid. Falling back to Demo Mode.");
      return getDemoResponse(prompt);
    }
    throw error;
  }
}

export async function generateBirthdayMessage(params: {
  name: string;
  age?: string | number;
  relationship: string;
  interests: string;
  notes: string;
}) {
  try {
    const prompt = `
You are a warm, emotionally intelligent birthday message writer. Your job is to generate two versions of a personalized birthday message:
1. A "Short Text": This should be like a message you would send over iMessage or WhatsApp. It should be punchy, warm, and feel like a real person sent it. Use emojis naturally.
2. A "Card Message": This is a slightly longer, more heartfelt version (3-5 sentences) suitable for a physical card or a long-form digital note.

Guidelines:
- Make it feel personal and specific — reference their interests or notes naturally.
- Tone should be warm, genuine, and heartfelt.
- Never sound generic or like a greeting card.
- Never use clichés like "may all your dreams come true".
- Don't start with "Happy Birthday" — save it for the middle or end.
- Write in first person.
- Return the result as a JSON object with keys "shortText" and "cardMessage".

Recipient Info:
- Name: ${params.name}
- Age: ${params.age || 'Unknown'}
- Relationship: ${params.relationship}
- Interests: ${params.interests}
- Notes: ${params.notes}
`;

    const text = await callGemini(prompt, { responseMimeType: "application/json" });
    const result = JSON.parse(text || '{}');
    return { 
      shortText: result.shortText || "Happy Birthday! 🎂", 
      cardMessage: result.cardMessage || "Happy Birthday! Have an amazing day." 
    };
  } catch (error) {
    console.error("AI Generation Error:", error);
    return { shortText: "Happy Birthday! 🎂", cardMessage: "Happy Birthday. Have a great day." };
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
Return a JSON array of objects. Each object must have:
- "title": The name of the gift.
- "price": Estimated price (e.g. "$25").
- "reason": Why this is a good gift based on the interests.
- "searchUrl": A Google Search URL for the gift (e.g. "https://www.google.com/search?q=gift+name").

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
