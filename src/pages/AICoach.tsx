import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Brain, 
  ArrowLeft, 
  Send, 
  Sparkles, 
  Copy, 
  Search, 
  Gift, 
  Plus, 
  Lock, 
  UserPlus, 
  MessageSquare,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { callCoachModel } from '../services/geminiService';
import { getDisplayName, getAIAccent } from '../lib/utils';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  action?: any;
  created_at?: any;
}

export default function AICoach() {
  const { user, firebaseUser } = useAuth();
  const accent = getAIAccent(user?.aiAccentColor);
  const navigate = useNavigate();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [inputText, setInputText] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAiThinking, setIsAiThinking] = React.useState(false);
  const [contactsContext, setContactsContext] = React.useState<any[]>([]);
  const [contextSummary, setContextSummary] = React.useState('');
  const [isPrivateMode, setIsPrivateMode] = React.useState(false);
  const [copiedIndex, setCopiedIndex] = React.useState<string | null>(null);

  // Dynamic suggestions
  const [suggestions, setSuggestions] = React.useState<string[]>([]);

  // 1. Fetch data on mount
  React.useEffect(() => {
    async function loadCoachData() {
      if (!firebaseUser) return;
      try {
        setIsLoading(true);

        const peopleRef = collection(db, 'people');
        const q = query(peopleRef, where('user_id', '==', firebaseUser.uid));
        const querySnapshot = await getDocs(q);

        const peopleData = await Promise.all(
          querySnapshot.docs.map(async (docSnap) => {
            const personId = docSnap.id;
            const data = docSnap.data();
            
            // fetch events
            let events: any[] = [];
            try {
              const eventsRef = collection(db, 'people', personId, 'events');
              const eventsSnap = await getDocs(eventsRef);
              events = eventsSnap.docs.map(eDoc => ({ id: eDoc.id, ...eDoc.data() }));
            } catch (e) {
              console.warn("Failed to fetch events for", personId, e);
            }

            // fetch memories (last 3 only, ordered by created_at desc)
            let memories: any[] = [];
            try {
              const memoriesRef = collection(db, 'people', personId, 'memories');
              // Note: if there is no composite index for user_id/created_at, we fall back to manual sorting
              const memoriesSnap = await getDocs(memoriesRef);
              memories = memoriesSnap.docs
                .map(mDoc => ({ id: mDoc.id, ...mDoc.data() } as any))
                .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0))
                .slice(0, 3);
            } catch (e) {
              console.warn("Failed to fetch memories for", personId, e);
            }

            return {
              id: personId,
              name: data.name || '',
              birthday: data.birthday || '',
              interests: data.interests || '',
              notes: data.notes || '',
              photo_url: data.photo_url || '',
              birthYearUnknown: !!data.birthYearUnknown,
              category: data.category || 'friend',
              friendshipScore: data.friendshipScore || data.relationshipScore || 0,
              events,
              memories
            };
          })
        );

        setContactsContext(peopleData);

        // Build Context Summary
        const N = peopleData.length;
        let summary = `The user has ${N} contacts. Here is a summary:\n`;
        peopleData.forEach((p, idx) => {
          const upcomingEventsStr = p.events && p.events.length > 0
            ? p.events.map((e: any) => `${e.title} on ${e.date}`).join(', ')
            : 'None';
          const recentMemoriesStr = p.memories && p.memories.length > 0
            ? p.memories.map((m: any) => m.content).join('; ')
            : 'None';
          
          summary += `${idx + 1}. Name: ${p.name}, Birthday: ${p.birthday}, Category: ${p.category}, Interests: ${p.interests || 'None'}, Notes: ${p.notes || 'None'}, Upcoming events: ${upcomingEventsStr}, Recent memories: ${recentMemoriesStr}\n`;
        });
        setContextSummary(`Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.\n\n${summary}`);

        // Call Gemini for the opening greeting
        const userName = getDisplayName(user) || 'Friend';
        const openingPrompt = `
System Context:
Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
${summary}

You are an AI relationship coach for a teenager. You know all their friends and contacts listed above. Be warm, casual, and genuinely helpful. Sound like a smart friend not a therapist.

Look at the contacts and their upcoming birthdays and events in the next 7 days. Open the conversation with a single short friendly message that:
1. Greets the user by name (passed in as "${userName}")
2. Mentions 2-3 of the most urgent upcoming things across their contacts in a natural conversational way
3. Ends with asking which one they want to focus on or if they want to talk about something else

Keep it under 4 sentences. Sound like a friend texting them.
Do NOT use bullet points or lists in this opening message.
Return plain text only, no JSON.
`;

        const welcomeText = await callCoachModel([{ role: 'user', parts: [{ text: openingPrompt }] }]);
        const firstMsg: Message = {
          id: 'welcome-' + Date.now(),
          sender: 'assistant',
          text: welcomeText || `Hey ${userName}! I'm scanning through your contacts and upcoming events. Let me know if you want to draft a customized message, get some gift ideas, or register a new contact!`
        };
        setMessages([firstMsg]);

        // Build dynamic suggestions based on urgent upcoming contacts or standard prompts
        const suggestedList: string[] = [];
        // Sort people by birthdays or upcoming events
        const sortedPeople = [...peopleData].slice(0, 2);
        sortedPeople.forEach(p => {
          suggestedList.push(p.name);
        });
        suggestedList.push("How do I show up for someone?");
        suggestedList.push("Something else");
        setSuggestions(suggestedList);

      } catch (err) {
        console.error("Error loading coach:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCoachData();
  }, [firebaseUser, user]);

  const cleanJsonString = (str: string): string => {
    let cleaned = str.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    return cleaned.trim();
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Mental Health detection
  const detectMentalHealth = (txt: string): boolean => {
    const words = ["anxious", "depressed", "sad", "lonely", "hurt", "scared", "overwhelmed", "stressed", "crying", "hopeless", "worthless", "numb", "empty", "panic", "afraid"];
    const phrases = ["don't know what to do", "feel like giving up", "nobody cares", "i hate myself", "falling apart"];
    
    const lowercase = txt.toLowerCase();
    
    const wordDetected = words.some(w => new RegExp(`\\b${w}\\b`).test(lowercase));
    const phraseDetected = phrases.some(p => lowercase.includes(p));
    
    return wordDetected || phraseDetected;
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend) return;

    if (!customText) {
      setInputText('');
    }

    // Check mental health trigger
    const mhDetected = detectMentalHealth(textToSend);
    let updatedPrivateMode = isPrivateMode;
    if (mhDetected && !isPrivateMode) {
      setIsPrivateMode(true);
      updatedPrivateMode = true;
    }

    // Add user message
    const userMsg: Message = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: textToSend
    };
    
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Save normal messages to Firestore
    if (!updatedPrivateMode && firebaseUser) {
      try {
        const chatRef = collection(db, 'users', firebaseUser.uid, 'coach_messages');
        await addDoc(chatRef, {
          text: textToSend,
          sender: 'user',
          created_at: serverTimestamp()
        });
      } catch (err) {
        console.warn("Could not save user message to Firestore:", err);
      }
    }

    setIsAiThinking(true);

    try {
      // Setup payload for Gemini
      const systemInstruction = `You are an AI relationship coach for a teenager. Respond ONLY in valid JSON format. Your response must be a JSON object with two keys: 'reply' (warm, casual, friendly plain-text response, under 4 sentences) and 'action' (optional action details). Do not include any markdown block surrounding the JSON. Check system context and user query.`;
      
      const contents = [
        {
          role: 'user',
          parts: [{ text: `System Context:\n${contextSummary}` }]
        },
        ...updatedMessages.map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.action ? JSON.stringify({ reply: m.text, action: m.action }) : m.text }]
        })),
        {
          role: 'user',
          parts: [{ text: textToSend + "\n\nProvide the JSON response according to specifications." }]
        }
      ];

      // Format custom instruction with MH triggers or generic prompt
      const promptGuidelines = `
You know all their friends and contacts listed above. Be warm, casual, and genuinely helpful. Sound like a smart friend not a therapist.

${updatedPrivateMode ? "The user may be experiencing emotional distress. Respond with warmth and genuine care. Do not give clinical advice. Do not suggest seeking help unless they bring it up. Just be present and listen. Sound like a caring friend." : ""}

Respond ONLY in valid JSON format. Your response must be a JSON object with this shape:
{
  "reply": "plain text conversational reply (warm, friendly, under 4 sentences)",
  "action": null | {
    "type": "createContact" | "generateMessage" | "giftSuggestions" | "profileSummary",
    "contactData": {
      "name": "full name",
      "birthday": "March 15 or 1990-03-15", // formatted YYYY-MM-DD or 1900-MM-DD if no year is known
      "birthYearUnknown": true
    },
    "messageData": {
      "recipientName": "string",
      "shortText": "Complete text message option",
      "cardMessage": "Complete card message option"
    },
    "giftData": [
       { "title": "Gift name", "price": "Estimated price", "reason": "Why this gift matches them", "searchUrl": "https://www.google.com/search?q=query" }
    ],
    "summaryData": {
       "name": "string",
       "summaryText": "Brief warm summary about them"
    }
  }
}

Guidelines for Actions:
- Populate "action" ONLY if the user's latest message has a clear intent:
  1. Generate Message: if user asks to write/send a copy of a text/card message to a contact.
  2. Gift Suggestions: if user asks for gift ideas for a contact.
  3. Create Contact: if user mentions meeting someone new with a name and birthday (e.g. "I met Jake his birthday is March 15" -> extract name "Jake" and birthday "1900-03-15", set birthYearUnknown: true).
  4. Profile Summary: if user asks "tell me about Jake" or "what do I know about Sarah".

Do NOT output \`\`\`json \`\`\` blocks, return only the raw JSON.
`;

      const aiResponseRaw = await callCoachModel(contents, {
        systemInstruction: systemInstruction + "\nGuidelines:\n" + promptGuidelines,
        responseMimeType: "application/json"
      });

      const parsedResponse = JSON.parse(cleanJsonString(aiResponseRaw));
      
      const aiReply = parsedResponse?.reply || "I'm not sure how to answer that, but I'm here for you!";
      const aiAction = parsedResponse?.action;

      const aiMsg: Message = {
        id: 'msg-' + Date.now() + '-ai',
        sender: 'assistant',
        text: aiReply,
        action: aiAction
      };

      setMessages(prev => [...prev, aiMsg]);

      // Save assistant message to Firestore if not private
      if (!updatedPrivateMode && firebaseUser) {
        try {
          const chatRef = collection(db, 'users', firebaseUser.uid, 'coach_messages');
          await addDoc(chatRef, {
            text: aiReply,
            sender: 'assistant',
            action: aiAction || null,
            created_at: serverTimestamp()
          });
        } catch (err) {
          console.warn("Could not save assistant message to Firestore:", err);
        }
      }

      // Execute Action client-side if it is Create Contact
      if (aiAction && aiAction.type === 'createContact' && firebaseUser) {
        const contactData = aiAction.contactData;
        if (contactData && contactData.name) {
          try {
            const peopleRef = collection(db, 'people');
            await addDoc(peopleRef, {
              user_id: firebaseUser.uid,
              name: contactData.name,
              birthday: contactData.birthday || '1900-01-01',
              birthYearUnknown: contactData.birthYearUnknown !== undefined ? contactData.birthYearUnknown : true,
              category: 'friend',
              importance: 5,
              friendshipScore: 0,
              notes: '',
              interests: '',
              nickname: '',
              photo_url: '',
              created_at: serverTimestamp()
            });

            // Append confirmation directly to chat
            const confirmMsg: Message = {
              id: 'msg-auto-created-' + Date.now(),
              sender: 'assistant',
              text: `Added ${contactData.name} to your contacts! 🎉`
            };
            setMessages(prev => [...prev, confirmMsg]);
          } catch (createErr) {
            console.error("Failed to auto-create contact in Firestore:", createErr);
          }
        }
      }

    } catch (err) {
      console.error("Failed to generate coach response:", err);
      // fallback message
      const fallbackMsg: Message = {
        id: 'msg-err-' + Date.now(),
        sender: 'assistant',
        text: "Hey! Something went wrong in processing, but I'm listening. Tell me more!"
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsAiThinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950">
        <motion.div 
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className={`p-5 rounded-full mb-4 ${accent.bgLight}`}
        >
          <Brain className={`${accent.text} w-12 h-12`} />
        </motion.div>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 select-none animate-pulse">
          Scanning your relationships...
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen transition-all duration-500 ${isPrivateMode ? 'bg-zinc-950/95 dark:bg-zinc-950' : 'bg-zinc-50 dark:bg-zinc-950'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b flex justify-between items-center px-4 py-4 ${
        isPrivateMode 
          ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200' 
          : 'bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-900 text-zinc-900 dark:text-white'
      }`}>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            title="Back"
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Brain className={`${accent.text} w-5 h-5 animate-pulse`} />
              <h1 className="text-lg font-black tracking-tight">AI Coach</h1>
          </div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-7">
            Conversations not stored on our servers
          </p>
        </div>
        </div>

        {isPrivateMode && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-1.5 bg-zinc-800/80 border border-zinc-700/50 px-3 py-1 rounded-full text-xs font-bold ${accent.text}`}
          >
            <Lock size={12} />
            <span>Private mode</span>
          </motion.div>
        )}
      </header>

      {/* Chat Area */}
      <div className={`flex-1 overflow-y-auto px-4 py-6 space-y-6 ${isPrivateMode ? 'brightness-90 transition-all' : ''}`}>
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div 
              key={msg.id}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
            >
              {/* Main message text */}
              <div className={`p-4 text-sm leading-relaxed ${
                msg.sender === 'user' 
                  ? `${accent.bgSolid} text-white rounded-[20px] rounded-tr-sm` 
                  : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border border-zinc-100 dark:border-zinc-800 rounded-[20px] rounded-tl-sm shadow-sm'
              }`}>
                {msg.text}
              </div>

              {/* Action content cards */}
              {msg.action && (
                <div className="mt-3 w-full space-y-3">
                  {/* GENERATE MESSAGE CARD */}
                  {msg.action.type === 'generateMessage' && msg.action.messageData && (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 shadow-md space-y-4 max-w-sm">
                      <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-850 pb-2">
                        <MessageSquare className={`${accent.text} w-4 h-4`} />
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Suggested for {msg.action.messageData.recipientName || 'Friend'}</span>
                      </div>
                      
                      {msg.action.messageData.shortText && (
                        <div className="space-y-1 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl relative group">
                          <p className="text-[10px] font-bold text-zinc-400 tracking-wider">SHORT TEXT</p>
                          <p className="text-sm text-zinc-700 dark:text-zinc-300 pr-8">{msg.action.messageData.shortText}</p>
                          <button 
                            type="button"
                            title="Copy short text"
                            onClick={() => copyToClipboard(msg.action.messageData.shortText, msg.id + '-short')}
                            className="absolute right-2 top-2 p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                          >
                            {copiedIndex === msg.id + '-short' ? <Check size={14} className={accent.text} /> : <Copy size={14} />}
                          </button>
                        </div>
                      )}

                      {msg.action.messageData.cardMessage && (
                        <div className="space-y-1 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl relative group">
                          <p className="text-[10px] font-bold text-zinc-400 tracking-wider">CARD MESSAGE</p>
                          <p className="text-sm text-zinc-700 dark:text-zinc-300 pr-8">{msg.action.messageData.cardMessage}</p>
                          <button 
                            type="button"
                            title="Copy card message"
                            onClick={() => copyToClipboard(msg.action.messageData.cardMessage, msg.id + '-card')}
                            className="absolute right-2 top-2 p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                          >
                            {copiedIndex === msg.id + '-card' ? <Check size={14} className={accent.text} /> : <Copy size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* GIFT IDEAS SUGGESTIONS */}
                  {msg.action.type === 'giftSuggestions' && msg.action.giftData && (
                    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-1 max-w-sm">
                      {msg.action.giftData.map((gift: any, gIdx: number) => (
                        <div key={gIdx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                              <Gift className={`${accent.text} w-4 h-4`} />
                              {gift.title}
                            </h4>
                            <span className={`text-xs font-black ${accent.text}`}>{gift.price}</span>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">{gift.reason}</p>
                          {gift.searchUrl && (
                            <a 
                              href={gift.searchUrl} 
                              target="_blank" 
                              rel="noreferrer referrer" 
                              className={`inline-flex items-center gap-1 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 hover:${accent.text} mt-2 transition-colors`}
                            >
                              <Search size={10} />
                              Search online
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PROFILE SUMMARY */}
                  {msg.action.type === 'profileSummary' && msg.action.summaryData && (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 shadow-md max-w-sm space-y-2">
                      <p className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className={`${accent.text} w-4 h-4 animate-spin`} />
                        Summary profile: {msg.action.summaryData.name}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {msg.action.summaryData.summaryText}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isAiThinking && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex max-w-[85%] mr-auto items-start"
          >
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 rounded-[20px] rounded-tl-sm shadow-sm flex items-center gap-1.5">
              <span className={`w-2 h-2 ${accent.bgSolid} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
              <span className={`w-2 h-2 ${accent.bgSolid} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
              <span className={`w-2 h-2 ${accent.bgSolid} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Suggestion Options (only show after opening message is generated when conversation starts, or generally) */}
      {messages.length === 1 && suggestions.length > 0 && !isAiThinking && (
        <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-900 flex gap-2 overflow-x-auto scrollbar-none">
          {suggestions.map((sug, sIdx) => {
            let label = sug;
            if (sug !== "Something else" && sug !== "How do I show up for someone?") {
              label = `Help me with ${sug}`;
            }
            return (
              <button 
                key={sIdx} 
                onClick={() => {
                  setInputText(label);
                  handleSendMessage(label);
                }}
                className={`whitespace-nowrap px-3.5 py-2 rounded-full border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex items-center gap-1 bg-white dark:bg-zinc-900 hover:${accent.text}`}
              >
                {sug === "Something else" ? <Sparkles size={11} className="text-zinc-400" /> : <Brain size={11} className={accent.text} />}
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Input Bar */}
      <div className={`p-4 pb-28 border-t sticky bottom-0 ${
        isPrivateMode 
          ? 'bg-zinc-950 border-zinc-850' 
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-900'
      }`}>
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 max-w-2xl mx-auto"
        >
          <input 
            type="text" 
            placeholder={isPrivateMode ? "Type chat privately (not saved)..." : "Ask or tell your coach something new..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isAiThinking}
            className={`flex-1 bg-zinc-100 dark:bg-zinc-800 border-none rounded-full px-5 py-3 text-sm focus:ring-2 ${accent.focusRing} text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none`}
          />
          <button 
            type="submit" 
            disabled={isAiThinking || !inputText.trim()}
            className={`p-3 text-white rounded-full transition-colors disabled:opacity-50 flex items-center justify-center shrink-0 ${accent.bgSolid} ${accent.bgSolidHover} disabled:hover:${accent.bgSolid}`}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
      <Navigation />
    </div>
  );
}
