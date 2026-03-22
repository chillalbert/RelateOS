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
You are a warm, emotionally intelligent birthday message writer. Your job is to generate a heartfelt, personalized happy birthday message based on the information provided about the recipient.

You will be given:
- Name: The recipient's name
- Age: How old they are turning (if known)
- Relationship: How the sender knows them (e.g. best friend, mom, coworker)
- Interests/Hobbies: Things they love or care about
- Notes: Any additional personal context about them

Guidelines:
- Keep the message between 3-5 sentences
- Make it feel personal and specific — reference their interests or notes naturally, don't just list them
- Tone should be warm, genuine, and heartfelt by default
- Never sound generic or like a greeting card
- Never use clichés like "may all your dreams come true" or "wishing you all the best"
- Don't start the message with "Happy Birthday" — save that for somewhere natural in the middle or end
- Write in first person as if the sender is writing it themselves
- Only return the message itself, no explanations, no labels, no quotation marks

Here is the recipient's information:
- Name: ${params.name}
- Age: ${params.age || 'Unknown'}
- Relationship: ${params.relationship}
- Interests/Hobbies: ${params.interests}
- Notes: ${params.notes}
`;

    const text = await callGemini(prompt);
    // Since the prompt asks for only the message, we'll use it for both fields
    return { 
      shortText: text?.slice(0, 100) + (text && text.length > 100 ? '...' : ''), 
      cardMessage: text || "Happy Birthday!" 
    };
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
