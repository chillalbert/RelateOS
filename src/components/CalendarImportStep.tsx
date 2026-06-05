import React from 'react';
import { motion } from 'motion/react';
import { Calendar, Check, Loader2, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface CalendarImportStepProps {
  onComplete: () => void;
  firebaseUserId: string;
}

function cleanName(summary: string): string {
  if (!summary) return "";
  let s = summary
    .replace(/birthdays?/gi, '')
    .replace(/'s/gi, '')
    .replace(/\bof\b/gi, '')
    .replace(/\bfor\b/gi, '')
    .replace(/\bmy\b/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parseIcsText(text: string) {
  const unfoldedText = text.replace(/\r?\n[ \t]/g, '');
  const blocks = unfoldedText.split('BEGIN:VEVENT');
  const contacts: { name: string; birthday: string }[] = [];

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    
    let summary = '';
    const summaryMatch = block.match(/^SUMMARY[;:][^\r\n]*/mi);
    if (summaryMatch) {
      const parts = summaryMatch[0].split(':');
      parts.shift();
      summary = parts.join(':').trim();
    }

    let dtstart = '';
    const dtstartMatch = block.match(/^DTSTART[;:][^\r\n]*/mi);
    if (dtstartMatch) {
      const parts = dtstartMatch[0].split(':');
      parts.shift();
      dtstart = parts.join(':').trim();
    }

    let categories = '';
    const categoriesMatch = block.match(/^CATEGORIES[;:][^\r\n]*/mi);
    if (categoriesMatch) {
      const parts = categoriesMatch[0].split(':');
      parts.shift();
      categories = parts.join(':').trim();
    }

    const isBirthdayCategory = categories.toLowerCase().includes('birthday');
    const isBirthdaySummary = summary.toLowerCase().includes('birthday');

    if ((isBirthdayCategory || isBirthdaySummary) && summary && dtstart) {
      const cleanedName = cleanName(summary);
      if (!cleanedName) continue;

      const digitsMatch = dtstart.match(/\d{8}/);
      if (digitsMatch) {
        const digits = digitsMatch[0];
        const birthdayDate = `${digits.substring(0, 4)}-${digits.substring(4, 6)}-${digits.substring(6, 8)}`;
        contacts.push({ name: cleanedName, birthday: birthdayDate });
      }
    }
  }
  return contacts;
}

export default function CalendarImportStep({ onComplete, firebaseUserId }: CalendarImportStepProps) {
  const { signInWithGoogle } = useAuth();
  const [state, setState] = React.useState<'default' | 'loading' | 'success'>('default');
  const [count, setCount] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Stable ref so the useEffect doesn't re-run due to onComplete identity changing
  const onCompleteRef = React.useRef(onComplete);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Success auto-complete
  React.useEffect(() => {
    if (state === 'success') {
      const timer = setTimeout(() => {
        onCompleteRef.current();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const saveContactsToFirestore = async (
    contactsList: {
      name: string;
      birthday: string;
      birthYearUnknown: boolean;
      photo_url?: string;
      notes?: string;
    }[]
  ) => {
    if (contactsList.length === 0) {
      throw new Error("No birthday events found in your calendar.");
    }
    const peopleRef = collection(db, 'people');
    let savedCount = 0;

    await Promise.all(
      contactsList.map(async (contact) => {
        try {
          await addDoc(peopleRef, {
            user_id: firebaseUserId,
            name: contact.name,
            birthday: contact.birthday,
            birthYearUnknown: contact.birthYearUnknown,
            category: 'friend',
            importance: 5,
            friendshipScore: 0,
            notes: contact.notes || '',
            interests: '',
            nickname: '',
            photo_url: contact.photo_url || '',
            created_at: serverTimestamp(),
            reminder_settings: {
              "30_days": true,
              "7_days": true,
              "morning": true
            }
          });
          savedCount++;
        } catch (e) {
          console.error("Error saving contact: ", e);
        }
      })
    );

    setCount(savedCount);
    setState('success');
  };

  const handleGoogleImport = async () => {
    setErrorMessage(null);
    setState('loading');
    try {
      let token = localStorage.getItem('gcal_token');
      if (!token) {
        token = await signInWithGoogle();
      }
      if (!token) {
        throw new Error("Failed to get Google authorization token.");
      }

      const fetchApis = async (t: string) => {
        const [calRes, peopleRes] = await Promise.all([
          fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&maxResults=500&fields=items(summary,start)`,
            { headers: { Authorization: `Bearer ${t}` } }
          ),
          fetch(
            `https://people.googleapis.com/v1/people/me/connections?personFields=names,birthdays,photos,phoneNumbers,biographies&pageSize=1000`,
            { headers: { Authorization: `Bearer ${t}` } }
          )
        ]);
        return { calRes, peopleRes };
      };

      let { calRes, peopleRes } = await fetchApis(token);

      if (calRes.status === 401 || peopleRes.status === 401) {
        localStorage.removeItem('gcal_token');
        token = await signInWithGoogle();
        if (!token) {
          throw new Error("Google API unauthorized and authentication failed.");
        }
        const retryResult = await fetchApis(token);
        calRes = retryResult.calRes;
        peopleRes = retryResult.peopleRes;
      }

      if (!calRes.ok) {
        throw new Error(`Google Calendar API error: ${calRes.statusText}`);
      }
      if (!peopleRes.ok) {
        throw new Error(`Google People API error: ${peopleRes.statusText}`);
      }

      const calData = await calRes.json();
      const peopleData = await peopleRes.json();

      // STEP 2 — Parse Calendar results
      const calendarMap = new Map<string, { birthday: string; birthYearUnknown: boolean }>();
      const calendarItems = calData.items || [];
      calendarItems.forEach((item: any) => {
        if (item.summary && item.summary.toLowerCase().includes('birthday')) {
          const cleanedName = cleanName(item.summary);
          let bday = item.start?.date;
          if (!bday && item.start?.dateTime) {
            bday = item.start.dateTime.substring(0, 10);
          }
          if (cleanedName && bday && /^\d{4}-\d{2}-\d{2}$/.test(bday)) {
            const birthdayStr = `1900${bday.substring(4)}`;
            calendarMap.set(cleanedName.toLowerCase(), {
              birthday: birthdayStr,
              birthYearUnknown: true
            });
          }
        }
      });

      // STEP 3 — Parse Contacts results
      const contactsMap = new Map<string, { birthday?: string; birthYearUnknown?: boolean; photo_url: string; notes: string; displayName: string }>();
      const connections = peopleData.connections || [];
      connections.forEach((person: any) => {
        const displayName = person.names?.[0]?.displayName;
        if (!displayName) return;

        // Birthday parsing
        const bdayObj = person.birthdays?.[0]?.date;
        let birthdayStr: string | undefined;
        let birthYearUnknown: boolean | undefined;

        if (bdayObj) {
          const { year, month, day } = bdayObj;
          if (month && day) {
            const monthStr = String(month).padStart(2, '0');
            const dayStr = String(day).padStart(2, '0');
            if (year && year !== 0) {
              birthdayStr = `${year}-${monthStr}-${dayStr}`;
              birthYearUnknown = false;
            } else {
              birthdayStr = `1900-${monthStr}-${dayStr}`;
              birthYearUnknown = true;
            }
          }
        }

        // Photo parsing
        let photo_url = person.photos?.[0]?.url || '';
        if (photo_url.toLowerCase().includes('default')) {
          photo_url = '';
        }

        // Notes parsing
        const notes = person.biographies?.[0]?.value || '';

        contactsMap.set(displayName.toLowerCase(), {
          birthday: birthdayStr,
          birthYearUnknown,
          photo_url,
          notes,
          displayName
        });
      });

      // STEP 4 — Merge both maps into final contacts list
      const finalList: {
        name: string;
        birthday: string;
        birthYearUnknown: boolean;
        photo_url: string;
        notes: string;
      }[] = [];

      // Start with all entries from the Calendar map
      for (const [key, calEntry] of calendarMap.entries()) {
        const contactEntry = contactsMap.get(key);
        const nameTitleCased = cleanName(key);
        
        if (contactEntry) {
          const hasPrefYear = contactEntry.birthday && contactEntry.birthYearUnknown === false;
          const birthdayStr = hasPrefYear ? contactEntry.birthday! : calEntry.birthday;
          const birthYearUnknown = hasPrefYear ? false : calEntry.birthYearUnknown;
          
          finalList.push({
            name: nameTitleCased,
            birthday: birthdayStr,
            birthYearUnknown,
            photo_url: contactEntry.photo_url,
            notes: contactEntry.notes
          });
        } else {
          finalList.push({
            name: nameTitleCased,
            birthday: calEntry.birthday,
            birthYearUnknown: calEntry.birthYearUnknown,
            photo_url: '',
            notes: ''
          });
        }
      }

      // Add Contacts entries that have a birthday but are NOT already in the Calendar map
      for (const [key, contactEntry] of contactsMap.entries()) {
        if (!calendarMap.has(key)) {
          if (contactEntry.birthday) {
            const nameTitleCased = cleanName(contactEntry.displayName);
            finalList.push({
              name: nameTitleCased,
              birthday: contactEntry.birthday,
              birthYearUnknown: contactEntry.birthYearUnknown ?? true,
              photo_url: contactEntry.photo_url,
              notes: contactEntry.notes
            });
          }
        }
      }

      // STEP 5 — Write merged results to Firestore 'people' collection
      await saveContactsToFirestore(finalList);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An error occurred while importing from Google.");
      setState('default');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = event.target.files?.[0];
    if (!file) return;

    setState('loading');
    try {
      const text = await file.text();
      const list = parseIcsText(text).map(c => ({ ...c, birthYearUnknown: false }));
      await saveContactsToFirestore(list);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An error occurred while parsing and importing the .ics file.");
      setState('default');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={() => state === 'default' && onComplete()}
      />

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[40px] p-10 text-center space-y-8 shadow-2xl overflow-hidden"
      >
        {state === 'default' && (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto rotate-12 shadow-xl shadow-emerald-500/20">
              <Calendar size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Import Your Friends</h2>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm px-2">
                Sync birthdays instantly from your calendars. Choose an option below to fill RelateOS with your favorite people.
              </p>
            </div>

            {errorMessage && (
              <div className="text-xs text-red-500 font-bold bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                {errorMessage}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5 text-center">
                <button
                  onClick={handleGoogleImport}
                  className="w-full py-4 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-2xl font-bold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-3 hover:opacity-90"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Sync Google Contacts & Calendar
                </button>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium px-4">
                  Import birthdays and profile photos from your Google account in one tap
                </p>
              </div>
            </div>

            <button
              onClick={onComplete}
              className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-bold text-xs tracking-wider uppercase pt-2 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
              Skip for now <ChevronRight size={14} />
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="space-y-8 py-4">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-3xl mx-auto animate-pulse flex items-center justify-center">
                <Loader2 size={24} className="text-zinc-400 dark:text-zinc-600 animate-spin" />
              </div>
              <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl mx-auto animate-pulse" />
              <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl mx-auto animate-pulse" />
            </div>
            <div className="space-y-3 px-4">
              {[20, 28, 24].map((w, i) => (
                <div key={i} className="h-12 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-full animate-pulse flex items-center px-4 justify-between">
                  <div className="flex gap-3 items-center">
                    <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                    <div className={`h-3 w-${w} bg-zinc-200 dark:bg-zinc-700 rounded`} />
                  </div>
                  <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-700 rounded" />
                </div>
              ))}
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm tracking-wide">
              Importing your friends...
            </p>
          </div>
        )}

        {state === 'success' && (
          <div className="space-y-6 py-4">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto scale-110 shadow-xl shadow-emerald-500/20">
              <Check size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Success!</h2>
              <p className="text-zinc-500 dark:text-zinc-400 font-semibold text-sm">
                Imported <span className="text-emerald-500 dark:text-emerald-400 font-black text-base">{count}</span> friends successfully.
              </p>
            </div>

            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest animate-pulse">
              Initializing your dashboard...
            </p>

            {/* Manual fallback button in case auto-close doesn't fire */}
            <button
              onClick={() => onCompleteRef.current()}
              className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:opacity-90 transition-opacity"
            >
              Go to Dashboard →
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
