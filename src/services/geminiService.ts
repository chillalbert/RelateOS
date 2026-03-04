async function callGemini(prompt: string, config?: any) {
  // For mobile (Capacitor), we need an absolute URL.
  // For web, a relative URL is more reliable in the preview environment.
  const isCapacitor = (window as any).Capacitor?.isNative;
  const appUrl = process.env.APP_URL;
  const baseUrl = (isCapacitor && appUrl) ? appUrl : "";
  
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, config }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to generate content");
  }

  const data = await response.json();
  return data.text;
}

export async function generateBirthdayMessage(params: {
  relationship: string;
  yearsKnown: number;
  memories: string[];
  tone: string;
  length: string;
}) {
  try {
    const prompt = `Generate a birthday message for a ${params.relationship}. 
    We have been friends for ${params.yearsKnown} years. 
    Some memories: ${params.memories.join(', ')}. 
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
}) {
  try {
    const prompt = `Suggest 3 gift ideas for a ${params.relationship} who is interested in ${params.interests}. 
    Budget: $${params.budget}. 
    Return a JSON array of strings.`;

    const text = await callGemini(prompt, { responseMimeType: "application/json" });
    return JSON.parse(text || '[]');
  } catch (error) {
    console.error("AI Gift Suggestion Error:", error);
    return ["A nice book", "A personalized mug", "A gift card"];
  }
}
