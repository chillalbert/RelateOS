import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generateBirthdayMessage(params: {
  relationship: string;
  yearsKnown: number;
  memories: string[];
  tone: string;
  length: string;
}) {
  const prompt = `
    Generate a birthday message for a ${params.relationship} I've known for ${params.yearsKnown} years.
    Context/Memories: ${params.memories.join(', ')}
    Tone: ${params.tone}
    Length: ${params.length}
    
    Provide the response in JSON format with the following fields:
    - shortText: A quick SMS style message.
    - instagramCaption: A caption for a post.
    - cardMessage: A longer, more thoughtful message for a physical card.
    - voiceScript: A script for a voice message.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shortText: { type: Type.STRING },
            instagramCaption: { type: Type.STRING },
            cardMessage: { type: Type.STRING },
            voiceScript: { type: Type.STRING },
          },
          required: ["shortText", "instagramCaption", "cardMessage", "voiceScript"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("AI Generation Error:", error);
    return null;
  }
}

export async function generateRecoveryPlan(params: {
  daysLate: number;
  relationship: string;
}) {
  const prompt = `
    I missed a birthday for a ${params.relationship} by ${params.daysLate} days.
    Generate a "Late but Legendary" recovery plan.
    
    Provide the response in JSON format with:
    - apologyMessage: A sincere but charming apology.
    - recoveryGiftIdeas: 3 gift ideas that make up for being late.
    - followUpPlan: A 48-hour checklist to fix the relationship.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            apologyMessage: { type: Type.STRING },
            recoveryGiftIdeas: { type: Type.ARRAY, items: { type: Type.STRING } },
            followUpPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["apologyMessage", "recoveryGiftIdeas", "followUpPlan"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("AI Recovery Error:", error);
    return null;
  }
}

export async function generateGiftSuggestions(params: {
  interests: string;
  budget: number;
  relationship: string;
}) {
  const prompt = `
    Find the best gift ideas for a ${params.relationship} with these interests: ${params.interests}.
    The current budget is $${params.budget}.
    
    Provide the response in JSON format with:
    - suggestions: An array of objects, each with:
      - title: Name of the product.
      - price: Estimated price.
      - reason: Why it's a good fit.
      - searchUrl: A Google Search URL to find/buy this product.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  price: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  searchUrl: { type: Type.STRING },
                },
                required: ["title", "price", "reason", "searchUrl"]
              }
            }
          },
          required: ["suggestions"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("AI Gift Suggestion Error:", error);
    return null;
  }
}
