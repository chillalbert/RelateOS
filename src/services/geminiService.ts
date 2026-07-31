import { GoogleGenAI } from "@google/genai";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

let cachedApiKey: string | null = null;

function cleanKey(key: any): string {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  // Handle common "empty" values that might be stringified
  if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '' || trimmed === '""' || trimmed === "''") return '';
  return trimmed;
}

export async function initializeGeminiKey() {
  if (cachedApiKey) return cachedApiKey;
  
  try {
    console.log("[GeminiService] Attempting to fetch API key from Firestore...");
    const docRef = doc(db, "secrets", "gemini_api_key");
    const secretDoc = await getDoc(docRef);
    
    if (secretDoc.exists()) {
      const data = secretDoc.data();
      // Read value from any standard field naming pattern
      const val = cleanKey(data?.value || data?.apiKey || data?.key || data?.api_key || data?.secret);
      
      if (val) {
        cachedApiKey = val;
        console.log(`[GeminiService] Successfully loaded API key from Firestore (starts with ${val.substring(0, 4)}...)`);
        return cachedApiKey;
      } else {
        console.warn("[GeminiService] Firestore secret 'gemini_api_key' exists but value fields are empty. Checked: value, apiKey, key, api_key, secret.", data);
      }
    } else {
      console.warn("[GeminiService] Firestore document 'secrets/gemini_api_key' does not exist.");
    }
  } catch (error: any) {
    console.error("[GeminiService] Error fetching Gemini API key from Firestore. This might be a Firestore permission (rules) or database configuration issue.");
    console.error("[GeminiService] Full error trace:", {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack,
      errObj: error
    });
  }
  return null;
}

// Initialize the Gemini API client
async function callGemini(prompt: string, config?: any) {
  let apiKey = '';
  let source = 'None';
  
  // 1. Check Firebase Storage (Highest Priority override)
  apiKey = cleanKey(await initializeGeminiKey());
  if (apiKey) source = 'Firebase';
  
  // 2. Check Environment (AI Studio / Netlify Env Vars)
  if (!apiKey) {
    apiKey = cleanKey(process.env.GEMINI_API_KEY);
    if (apiKey) source = 'process.env.GEMINI_API_KEY';
  }

  if (!apiKey) {
    apiKey = cleanKey((import.meta as any).env?.VITE_GEMINI_API_KEY);
    if (apiKey) source = 'import.meta.env.VITE_GEMINI_API_KEY';
  }

  if (!apiKey) {
    apiKey = cleanKey((import.meta as any).env?.GEMINI_API_KEY);
    if (apiKey) source = 'import.meta.env.GEMINI_API_KEY';
  }
  
  // 3. Check Browser Storage (Manual setup/Testing)
  if (!apiKey) {
    apiKey = cleanKey(localStorage.getItem('GEMINI_API_KEY'));
    if (apiKey) source = 'LocalStorage';
  }

  if (apiKey) {
    console.log(`[GeminiService] Using API Key (starts with ${apiKey.substring(0, 4)}...) from: ${source}`);
  } else {
    console.warn("[GeminiService] No valid API Key found in any source (Firestore, Env, LocalStorage).");
  }

  const getDemoResponse = async (prompt: string) => {
    console.warn("[GeminiService] Running in Demo Mode with mock responses.");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (prompt.includes("birthday message")) {
      return JSON.stringify({
        shortText: "Happy Birthday! Hope you have an amazing day!",
        cardMessage: "Wishing you a day filled with joy and a year ahead full of wonderful adventures. You deserve the best, and I hope this year brings you everything you've been working towards!"
      });
    }
    
    if (prompt.includes("recovery plan")) {
      return JSON.stringify({
        apologyMessage: "I'm so sorry I missed your big day! I hope it was as amazing as you are. Let's celebrate properly soon!",
        recoveryGiftIdeas: ["Surprise Coffee Delivery", "Handwritten Letter", "Dinner on me"]
      });
    }

    if (prompt.includes("gift ideas")) {
      return JSON.stringify([
        { title: "Customized Photo Album", price: "$30", reason: "Great for preserving memories.", searchUrl: "https://google.com/search?q=custom+photo+album" },
        { title: "Premium Coffee Bean Set", price: "$25", reason: "Perfect for a coffee lover.", searchUrl: "https://google.com/search?q=premium+coffee+beans" },
        { title: "Noise-Canceling Headphones", price: "$150", reason: "High quality audio experience.", searchUrl: "https://google.com/search?q=noise+canceling+headphones" }
      ]);
    }

    return "This is a demo response because the Gemini API key is not configured or has been revoked.";
  };

  if (!apiKey || apiKey.trim() === '') {
    return getDemoResponse(prompt);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        ...config,
        systemInstruction: "The current year is 2026. " + (config?.systemInstruction || ""),
      },
    });

    if (!response || !response.text) {
      throw new Error("Empty response from Gemini API");
    }

    return response.text;
  } catch (error: any) {
    console.error("[GeminiService] API Call Error:", error);
    // Handle leaked/revoked key error specifically
    if (error?.message?.includes("leaked") || error?.message?.includes("403") || error?.message?.includes("API_KEY_INVALID")) {
      console.error("[GeminiService] Gemini API Key has been revoked or is invalid. Falling back to Demo Mode.");
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
  reflection?: string;
}) {
  try {
    let prompt = `
You are a warm, emotionally intelligent birthday message writer. Your job is to generate two versions of a personalized birthday message:
1. A "Short Text": This MUST be a complete, natural message you would send over iMessage or WhatsApp. It should be punchy, warm, and feel like a real person sent it. Use emojis naturally. DO NOT truncate the message. It should be a full thought. End the message naturally with a period or emoji, never in the middle of a sentence.
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

    if (params.reflection && params.reflection.trim() !== '') {
      prompt += `\n- Yearly reflection about this person: ${params.reflection}\n`;
    }

    const text = await callGemini(prompt, { responseMimeType: "application/json" });
    const result = JSON.parse(text || '{}');
    return { 
      shortText: result.shortText || `Happy Birthday ${params.name}! Hope you have the best day!`, 
      cardMessage: result.cardMessage || `Happy Birthday ${params.name}! Wishing you an incredible year ahead filled with joy and success.` 
    };
  } catch (error) {
    console.error("AI Generation Error:", error);
    return { 
      shortText: `Happy Birthday ${params.name}!`, 
      cardMessage: `Happy Birthday ${params.name}! Have an amazing day.` 
    };
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
- "searchUrl": A Google Search URL for the gift (e.g. "https://www.google.com/search?q=gift+name"). MAKE SURE THE PRICE IS ACCURATE TO THE GOOGLE SEARCH RESULTS. THE GOAL IS TO MAKE IT AS CHEAP AS POSSIBLE BUT WITH THE BEST QUALITY, SO DO RESEARCH IF NEEDED.

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
• SHOULD sound like a human. NO GRAMMATICAL MISTAKES but needs to sound like a human.

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

export function parseCoachResponse(rawInput: string): { reply: string; action: any } {
  if (!rawInput || typeof rawInput !== 'string') {
    return { reply: "I'm listening! How can I help you today?", action: null };
  }

  const trimmed = rawInput.trim();

  const extractValidObj = (obj: any) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      if (typeof obj.reply === 'string' && obj.reply.trim() !== '') {
        return { reply: obj.reply.trim(), action: obj.action || null };
      }
      if (typeof obj.text === 'string' && obj.text.trim() !== '') {
        return { reply: obj.text.trim(), action: obj.action || null };
      }
    }
    return null;
  };

  // 1. Direct JSON parse
  try {
    const direct = extractValidObj(JSON.parse(trimmed));
    if (direct) return direct;
  } catch {
    // Continue
  }

  // 2. Strip markdown code fences
  let cleaned = trimmed;
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  try {
    const parsedCleaned = extractValidObj(JSON.parse(cleaned));
    if (parsedCleaned) return parsedCleaned;
  } catch {
    // Continue
  }

  // 3. Extract outermost {...} block
  const jsonBlockMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonBlockMatch) {
    try {
      const parsedBlock = extractValidObj(JSON.parse(jsonBlockMatch[0]));
      if (parsedBlock) return parsedBlock;
    } catch {
      // Continue
    }
  }

  // 4. Regex extraction for "reply" field specifically if JSON has syntax errors
  const replyRegex = /"reply"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"action"|\})/i;
  const matchReply = cleaned.match(replyRegex);
  if (matchReply && matchReply[1]) {
    const extractedReply = matchReply[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
    if (extractedReply) {
      return { reply: extractedReply, action: null };
    }
  }

  // 5. Fallback: treat the entire raw output as the reply text
  let fallbackText = cleaned;
  if (fallbackText.startsWith('{') && fallbackText.endsWith('}')) {
    fallbackText = fallbackText
      .replace(/^\{\s*"reply"\s*:\s*"/i, '')
      .replace(/"\s*,\s*"action"[\s\S]*\}$/i, '')
      .replace(/"\s*\}$/i, '')
      .trim();
  }

  return {
    reply: fallbackText || "I'm listening! Tell me more.",
    action: null
  };
}

export async function callCoachModel(contents: any[], config?: any) {
  let apiKey = '';
  apiKey = cleanKey(await initializeGeminiKey());
  if (!apiKey) {
    apiKey = cleanKey(process.env.GEMINI_API_KEY);
  }
  if (!apiKey) {
    apiKey = cleanKey((import.meta as any).env?.VITE_GEMINI_API_KEY);
  }
  if (!apiKey) {
    apiKey = cleanKey((import.meta as any).env?.GEMINI_API_KEY);
  }
  if (!apiKey) {
    apiKey = cleanKey(localStorage.getItem('GEMINI_API_KEY'));
  }

  if (!apiKey || apiKey.trim() === '') {
    return "Hey! I'm your AI Relationship Coach. I can help you draft messages, brainstorm gift ideas, remember key dates, or give advice about your friends. (Running in Demo Mode: Please add a real Gemini API key in Settings to unlock actual AI interactions!)";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        ...config,
        systemInstruction: "The current year is 2026. " + (config?.systemInstruction || ""),
      },
    });

    if (!response || !response.text) {
      throw new Error("Empty response from Gemini API");
    }

    return response.text;
  } catch (error: any) {
    console.error("[GeminiService] Coach API Call Error:", error);
    if (error?.message?.includes("leaked") || error?.message?.includes("403") || error?.message?.includes("API_KEY_INVALID")) {
      return "{\"reply\": \"Hey! It looks like there's an issue with the Gemini API key (invalid or revoked). I'm running in offline/demo mode. Tell me, how can I help you show up for your friends today?\", \"action\": null}";
    }
    throw error;
  }
}

export async function generateSparkQuestions(params: {
  name: string;
  interests: string;
  notes: string;
  plannerNotes?: string;
  questionDepth?: 'light' | 'medium' | 'deep';
}) {
  const depth = params.questionDepth || 'light';
  try {
    let depthGuidance = '';
    if (depth === 'light') {
      depthGuidance = `
Question Depth Level: LIGHT (Fun, silly, surface-level)
- Focus explicitly on fun, silly, lighthearted surface-level questions that are easy and casual to answer.
- Avoid deep personal feelings or emotional intimacy. Keep it 100% fun, relaxed, and not awkward for anyone.
- Examples: "What's ${params.name}'s most-used emoji?", "What is ${params.name}'s go-to coffee order?", "If ${params.name} was a movie character, who would they be?", "What's ${params.name}'s ultimate comfort food?"
`;
    } else if (depth === 'medium') {
      depthGuidance = `
Question Depth Level: MEDIUM (Mix of fun and slightly more personal/reflective)
- Provide a balanced mix of fun trivia and slightly more personal or reflective questions about memories, preferences, and milestones.
- Examples: "What's the best trip or outing you've ever shared with ${params.name}?", "What is ${params.name}'s absolute dream travel destination?", "Which recent milestone of ${params.name} made you proudest?", "What's a song that instantly reminds you of ${params.name}?"
`;
    } else if (depth === 'deep') {
      depthGuidance = `
Question Depth Level: DEEP (Meaningful, sentimental, and heartwarming)
- Focus on deeper, sentimental, appreciative, and meaningful questions about friendship, impact, gratitude, and cherished moments.
- Keep questions tasteful, warm, and appropriate — never invasive or uncomfortable.
- Examples: "What's a moment ${params.name} made you feel truly supported?", "What is something inspiring or admirable about ${params.name}?", "What is a core memory with ${params.name} that you will never forget?", "What quality in ${params.name} do you appreciate the most?"
`;
    }

    const prompt = `
Generate 4-5 custom trivia/question suggestions about the birthday person named ${params.name}.
These questions will be asked to their friends in a "Who Knows Them Best?" game.

Recipient Information:
- Name: ${params.name}
- Interests: ${params.interests}
- Notes: ${params.notes}
- Party Planner Notes: ${params.plannerNotes || 'None'}

${depthGuidance}

Return a JSON array of strings, where each string is a distinct question. Do not return any other text or explanation. Only the JSON array of strings.
`;

    const text = await callGemini(prompt, { responseMimeType: "application/json" });
    const questions = JSON.parse(text || '[]');
    if (Array.isArray(questions) && questions.length > 0) {
      return questions;
    }
    throw new Error("Invalid format returned from Gemini");
  } catch (error) {
    console.error("AI Spark Question Generation Error:", error);
    if (depth === 'deep') {
      return [
        `What's a moment ${params.name} made you feel truly supported or cared for?`,
        `What is something inspiring or admirable about ${params.name}?`,
        `What is a core memory with ${params.name} that you'll always cherish?`,
        `What trait or quality in ${params.name} do you value the most?`
      ];
    } else if (depth === 'medium') {
      return [
        `What's the best trip or outing you've ever shared with ${params.name}?`,
        `If ${params.name} could master any skill overnight, what would it be?`,
        `What is ${params.name}'s absolute dream travel destination?`,
        `What is a song that instantly reminds you of ${params.name}?`
      ];
    }
    return [
      `What is ${params.name}'s go-to coffee or snack order?`,
      `What is ${params.name}'s most-used emoji in group chats?`,
      `If ${params.name} was a movie character, who would they be?`,
      `What is ${params.name}'s most surprising or funny habit?`
    ];
  }
}

export async function generateEnrichedAINotes(params: {
  name: string;
  interests?: string;
  notes?: string;
  category?: string;
}) {
  try {
    const prompt = `
Generate a concise, thoughtful AI Profile Notebook summary for a ${params.category || 'friend'} named ${params.name}.
Context:
- Interests: ${params.interests || 'None listed'}
- Current Notes: ${params.notes || 'None'}

Formatting:
Return 3-4 bullet points highlighting:
1. Core Bonding Themes & Hobbies
2. Meaningful Gesture / Gift Inspiration
3. Suggested Next Check-in Idea

Keep it warm, practical, and clear.
`;
    const text = await callGemini(prompt);
    return text || `✨ AI Enriched Insights for ${params.name}:\n• Interests: ${params.interests || 'General'}\n• Gesture Idea: Plan a casual check-in based on their preferences.\n• Focus: Deepen friendship through consistent small moments.`;
  } catch (err) {
    console.error("AI Profile Enrichment Error:", err);
    return `✨ AI Enriched Insights for ${params.name}:\n• Interests: ${params.interests || 'General'}\n• Gesture Idea: Plan a casual check-in based on their preferences.\n• Focus: Deepen friendship through consistent small moments.`;
  }
}

