export async function generateBirthdayMessage(params: {
  relationship: string;
  yearsKnown: number;
  memories: string[];
  tone: string;
  length: string;
}, token: string) {
  try {
    const res = await fetch('/api/ai/birthday-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('AI Generation Failed');
    return await res.json();
  } catch (error) {
    console.error("AI Generation Error:", error);
    return null;
  }
}

export async function generateRecoveryPlan(params: {
  daysLate: number;
  relationship: string;
}, token: string) {
  try {
    const res = await fetch('/api/ai/recovery-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('AI Recovery Failed');
    return await res.json();
  } catch (error) {
    console.error("AI Recovery Error:", error);
    return null;
  }
}

export async function generateGiftSuggestions(params: {
  interests: string;
  budget: number;
  relationship: string;
}, token: string) {
  try {
    const res = await fetch('/api/ai/gift-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('AI Gift Suggestion Failed');
    return await res.json();
  } catch (error) {
    console.error("AI Gift Suggestion Error:", error);
    return null;
  }
}
