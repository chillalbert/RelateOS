import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';
import { db } from '../lib/firebase';
import { doc, getDocs, updateDoc, collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Camera, User, ArrowRight, ArrowLeft, 
  Check, Lock, Globe, Trophy, Music, Copy, Calendar,
  Sun, Moon, Loader2, ChevronRight
} from 'lucide-react';

const loadGsiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Google Identity Services script load timeout.'));
      }, 10000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any).google?.accounts?.oauth2) {
        resolve();
      } else {
        reject(new Error('Google Identity Services failed to initialize.'));
      }
    };
    script.onerror = () => {
      reject(new Error('Failed to load Google Identity Services script.'));
    };
    document.head.appendChild(script);
  });
};

const getGoogleAccessToken = async (): Promise<string> => {
  await loadGsiScript();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '777157828577-ofrlgg4tq9egusgmi2j1lhu04m572a43.apps.googleusercontent.com';
  if (!clientId) {
    throw new Error('Google OAuth Client ID is not configured. Please define VITE_GOOGLE_CLIENT_ID in your settings or environment variables.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/contacts.readonly',
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(`OAuth error: ${response.error_description || response.error}`));
          } else if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('No access token returned from Google.'));
          }
        },
        error_callback: (err: any) => {
          reject(new Error(err.message || 'OAuth client initialization or authorization error.'));
        }
      });
      client.requestAccessToken();
    } catch (err: any) {
      reject(err);
    }
  });
};

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

export default function OnboardingFlow() {
  const { user, refreshUser } = useAuth();
  const { setTourStep } = useTour();
  const [step, setStep] = React.useState(1);

  // Step 1: About You
  const [name, setName] = React.useState(user?.name || '');
  const [customHandle, setCustomHandle] = React.useState('');
  const [profilePicUrl, setProfilePicUrl] = React.useState(user?.profile_picture_url || '');
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState('');
  const [handleChecking, setHandleChecking] = React.useState(false);
  const [handleError, setHandleError] = React.useState('');
  const [handleSuccess, setHandleSuccess] = React.useState(false);

  // Separate birthday month, day, optional birth_year
  const [bMonth, setBMonth] = React.useState<number>(() => {
    if (user?.birthday_month) return user.birthday_month;
    if (user?.birthday) {
      const parts = user.birthday.split('-');
      if (parts.length === 3) return parseInt(parts[1], 10);
    }
    return 6;
  });
  const [bDay, setBDay] = React.useState<number>(() => {
    if (user?.birthday_day) return user.birthday_day;
    if (user?.birthday) {
      const parts = user.birthday.split('-');
      if (parts.length === 3) return parseInt(parts[2], 10);
    }
    return 15;
  });
  const [bYear, setBYear] = React.useState<string>(() => {
    if (user?.birth_year) return user.birth_year.toString();
    if (user?.birthday) {
      const parts = user.birthday.split('-');
      if (parts.length === 3 && parts[0] !== '2000') return parts[0];
    }
    return '';
  });

  // Step 2: Your Social Vibes
  const [sportsInput, setSportsInput] = React.useState('');
  const [sportsTeams, setSportsTeams] = React.useState<string[]>([]);
  const [favArtists, setFavArtists] = React.useState('');
  const [weekendActivities, setWeekendActivities] = React.useState('');
  const [anythingExtra, setAnythingExtra] = React.useState(user?.anything_extra || '');

  // Step 3: Privacy
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Step 5: Calendar sync state
  const [importState, setImportState] = React.useState<'default' | 'loading' | 'success'>('default');
  const [importedCount, setImportedCount] = React.useState(0);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [googleToken, setGoogleToken] = React.useState<string | null>(null);

  // Load existing handle if any
  React.useEffect(() => {
    if (user?.custom_handle) {
      setCustomHandle(user.custom_handle);
      setHandleSuccess(true);
    } else if (user?.name) {
      const proposed = user.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      setCustomHandle(proposed);
    }
  }, [user]);

  // Handle unique handle check
  const checkHandleUniqueness = async (handleToCheck: string) => {
    const cleanHandle = handleToCheck.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '');
    if (!cleanHandle) {
      setHandleError('Handle cannot be empty');
      setHandleSuccess(false);
      return;
    }
    if (cleanHandle.length < 3) {
      setHandleError('Min 3 characters required');
      setHandleSuccess(false);
      return;
    }

    setHandleChecking(true);
    setHandleError('');
    setHandleSuccess(false);

    try {
      const usersRef = collection(db, 'users');
      const q1 = query(usersRef, where('custom_handle', '==', cleanHandle));
      const q2 = query(usersRef, where('handle', '==', cleanHandle));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const otherUserWithHandle = snap1.docs.find(d => d.id !== user?.id) || snap2.docs.find(d => d.id !== user?.id);

      if (otherUserWithHandle) {
        setHandleError('This handle is already taken 😔');
      } else {
        setHandleSuccess(true);
      }
    } catch (err) {
      console.error(err);
      setHandleError('Error verifying handle.');
    } finally {
      setHandleChecking(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dffkrlv1k';
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'relateos_uploads';

      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('upload_preset', uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: uploadData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image to Cloudinary');
      }

      const data = await response.json();
      setProfilePicUrl(data.secure_url);
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setUploadError('Failed to upload avatar. Try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddSportTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.keyCode === 13 || e.key === ',') {
      e.preventDefault();
      const tag = sportsInput.trim().replace(/,/g, '');
      if (tag && !sportsTeams.includes(tag)) {
        setSportsTeams([...sportsTeams, tag]);
      }
      setSportsInput('');
    }
  };

  const removeSportTag = (indexToRemove: number) => {
    setSportsTeams(sportsTeams.filter((_, i) => i !== indexToRemove));
  };

  const handleNextStep = async () => {
    if (step === 2) {
      if (!name.trim()) return;
      if (!customHandle.trim()) {
        setHandleError('Please provide a custom username handle!');
        return;
      }
      
      if (!handleSuccess) {
        await checkHandleUniqueness(customHandle);
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const saveStep1To3Data = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', user.id);
      const cleanHandle = customHandle.toLowerCase().trim().replace(/[^a-z0-9_\-]/g, '');
      const finalProfilePic = profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=10b981&color=fff&size=256&bold=true`;

      const formattedMonth = String(bMonth).padStart(2, '0');
      const formattedDay = String(bDay).padStart(2, '0');
      const formattedYear = bYear ? String(bYear).padStart(4, '0') : '2000';
      const finalBirthday = `${formattedYear}-${formattedMonth}-${formattedDay}`;

      await updateDoc(userRef, {
        name,
        birthday: finalBirthday,
        birthday_month: Number(bMonth),
        birthday_day: Number(bDay),
        birth_year: bYear ? Number(bYear) : '',
        blocked_uids: user?.blocked_uids || [],
        custom_handle: cleanHandle,
        handle: cleanHandle,
        profile_picture_url: finalProfilePic,
        fav_sports_teams: sportsTeams.join(','),
        fav_artists: favArtists.trim(),
        weekend_activities: weekendActivities.trim(),
        anything_extra: anythingExtra.trim(),
        is_private: isPrivate,
      });
      await refreshUser();
      setStep(5);
    } catch (err) {
      console.error('Saving intermediate profile failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTheme = async (theme: 'light' | 'dark') => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { appearance: theme });
    } catch (err) {
      console.error("Error setting appearance:", err);
    }
  };

  const handleStep5GoogleImport = async () => {
    if (!user) return;
    setImportError(null);
    setImportState('loading');
    try {
      let token = googleToken;
      if (!token) {
        token = await getGoogleAccessToken();
        setGoogleToken(token);
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
        setGoogleToken(null);
        token = await getGoogleAccessToken();
        setGoogleToken(token);
        if (!token) {
          throw new Error("Google API unauthorized and authentication failed.");
        }
        const retryResult = await fetchApis(token);
        calRes = retryResult.calRes;
        peopleRes = retryResult.peopleRes;

        if (calRes.status === 401 || peopleRes.status === 401) {
          throw new Error("Google authorization has expired or been revoked. Please reconnect and authorize again.");
        }
      }

      if (!calRes.ok) {
        let details = "";
        try {
          const errText = await calRes.text();
          try {
            const errObj = JSON.parse(errText);
            details = errObj.error?.message || errObj.message || errText;
          } catch (_) {
            details = errText;
          }
        } catch (_) {}
        const errMsg = `Google Calendar API error: ${calRes.status} ${calRes.statusText} ${details}`.trim();
        throw new Error(errMsg);
      }
      if (!peopleRes.ok) {
        let details = "";
        try {
          const errText = await peopleRes.text();
          try {
            const errObj = JSON.parse(errText);
            details = errObj.error?.message || errObj.message || errText;
          } catch (_) {
            details = errText;
          }
        } catch (_) {}
        const errMsg = `Google People API error: ${peopleRes.status} ${peopleRes.statusText} ${details}`.trim();
        throw new Error(errMsg);
      }

      const calData = await calRes.json();
      const peopleData = await peopleRes.json();

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

      const contactsMap = new Map<string, { birthday?: string; birthYearUnknown?: boolean; photo_url: string; notes: string; displayName: string }>();
      const connections = peopleData.connections || [];
      connections.forEach((person: any) => {
        const displayName = person.names?.[0]?.displayName;
        if (!displayName) return;

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

        let photo_url = person.photos?.[0]?.url || '';
        if (photo_url.toLowerCase().includes('default')) {
          photo_url = '';
        }

        const notes = person.biographies?.[0]?.value || '';

        contactsMap.set(displayName.toLowerCase(), {
          birthday: birthdayStr,
          birthYearUnknown,
          photo_url,
          notes,
          displayName
        });
      });

      const finalList: {
        name: string;
        birthday: string;
        birthYearUnknown: boolean;
        photo_url: string;
        notes: string;
      }[] = [];

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

      if (finalList.length === 0) {
        throw new Error("No birthday events found in your Google account.");
      }

      const peopleRef = collection(db, 'people');
      let savedCount = 0;

      await Promise.all(
        finalList.map(async (contact) => {
          try {
            await addDoc(peopleRef, {
              user_id: user.id,
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

      setImportedCount(savedCount);
      setImportState('success');
    } catch (err: any) {
      console.error("Google Calendar API error:", err?.message || JSON.stringify(err) || String(err));
      setImportError(err.message || "An error occurred while importing from Google.");
      setImportState('default');
    }
  };

  const handleStep5FileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    setImportError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    setImportState('loading');
    try {
      const text = await file.text();
      const list = parseIcsText(text).map(c => ({ ...c, birthYearUnknown: false }));
      if (list.length === 0) {
        throw new Error("No birthday events found in your .ics file.");
      }
      
      const peopleRef = collection(db, 'people');
      let savedCount = 0;

      await Promise.all(
        list.map(async (contact) => {
          try {
            await addDoc(peopleRef, {
              user_id: user.id,
              name: contact.name,
              birthday: contact.birthday,
              birthYearUnknown: contact.birthYearUnknown,
              category: 'friend',
              importance: 5,
              friendshipScore: 0,
              notes: '',
              interests: '',
              nickname: '',
              photo_url: '',
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

      setImportedCount(savedCount);
      setImportState('success');
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "An error occurred while parsing and importing the .ics file.");
      setImportState('default');
    }
  };

  const handleCompleteWithTour = async (wantsTour: boolean) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (wantsTour) {
        setTourStep(1);
      } else {
        setTourStep(null);
      }

      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        onboarding_completed: true,
        has_completed_onboarding: true,
        hasSeenTour: true
      });
      await refreshUser();
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const bioLink = `${window.location.origin}/u/${customHandle.trim().toLowerCase()}`;

  const copyBioLink = () => {
    navigator.clipboard.writeText(bioLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4 pt-[var(--sat)] select-none">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-8 rounded-[36px] shadow-xl space-y-6 relative overflow-hidden">
        
        {/* Step indicators */}
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
            <Sparkles size={12} className="animate-pulse" /> Step {step} of 7
          </span>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((s) => (
              <div 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-350 ${
                  s === step ? 'w-8 bg-emerald-500' : s < step ? 'w-2 bg-emerald-500/40' : 'w-2 bg-zinc-200 dark:bg-zinc-800'
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6 text-center"
            >
              <div className="space-y-4 py-4 flex flex-col items-center">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center shadow-sm">
                  <Sparkles size={40} className="animate-pulse" />
                </div>
                
                <div className="space-y-2 mt-2">
                  <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Welcome to RelateOS 🪐</h2>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Your Relationship Intelligence Hub</p>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 p-6 rounded-2xl text-left space-y-4">
                <p className="text-sm text-zinc-650 dark:text-zinc-350 leading-relaxed font-medium">
                  Welcome to RelateOS! Here's the deal: the stuff you're about to fill in (your birthday, favorite teams, what you're into) helps RelateOS actually be useful instead of just another app that reminds you it's someone's birthday and leaves you scrambling.
                </p>
                <p className="text-sm text-zinc-650 dark:text-zinc-350 leading-relaxed font-medium">
                  Every friend you add gets their own profile page too, kind of like a running notebook for that relationship. You can jot down notes, log memories, track gift ideas, and RelateOS uses all of it to suggest things like what to get them or what to say when their birthday rolls around. The more you fill in, the better it gets at actually helping.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer"
              >
                Let's go <ArrowRight size={14} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Create Your Profile Card ⚡</h2>
                <p className="text-xs text-zinc-400 font-semibold">Let's build your RelateOS visual identity card.</p>
              </div>

              {/* Upload & Preview */}
              <div className="flex flex-col items-center space-y-2 py-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-emerald-500/20 overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center transition-all shadow-inner">
                    {profilePicUrl ? (
                      <img src={profilePicUrl} alt="Onboarding avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : name ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-emerald-500 to-teal-500 text-white text-3xl font-black uppercase">
                        {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    ) : (
                      <User size={36} className="text-zinc-400" />
                    )}
                    
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[9px] font-black uppercase tracking-wider">
                        <span>Uploading...</span>
                      </div>
                    )}
                  </div>
                  
                  <label className="absolute bottom-0 right-0 p-2 bg-zinc-950 dark:bg-white dark:text-zinc-900 text-white rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform">
                    <Camera size={14} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleAvatarUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                {uploadError && <p className="text-red-500 text-[10px] font-bold">{uploadError}</p>}
                {profilePicUrl && (
                  <button 
                    type="button" 
                    onClick={() => setProfilePicUrl('')}
                    className="text-[9px] font-black uppercase tracking-wider text-red-500 hover:underline"
                  >
                    Delete Photo
                  </button>
                )}
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5">Full name</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs font-semibold text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-150 dark:border-zinc-800"
                    placeholder="e.g. Smayan Sri"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5 flex items-center gap-1">
                    <Calendar size={11} /> Birthday
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={bMonth}
                      onChange={(e) => setBMonth(parseInt(e.target.value, 10))}
                      className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-[11px] font-bold text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-150 dark:border-zinc-800"
                    >
                      {[
                        { val: 1, label: 'Jan' },
                        { val: 2, label: 'Feb' },
                        { val: 3, label: 'Mar' },
                        { val: 4, label: 'Apr' },
                        { val: 5, label: 'May' },
                        { val: 6, label: 'Jun' },
                        { val: 7, label: 'Jul' },
                        { val: 8, label: 'Aug' },
                        { val: 9, label: 'Sep' },
                        { val: 10, label: 'Oct' },
                        { val: 11, label: 'Nov' },
                        { val: 12, label: 'Dec' },
                      ].map((m) => (
                        <option key={m.val} value={m.val} className="dark:bg-zinc-850 p-2 text-xs">{m.label}</option>
                      ))}
                    </select>

                    <select
                      value={bDay}
                      onChange={(e) => setBDay(parseInt(e.target.value, 10))}
                      className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-[11px] font-bold text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-150 dark:border-zinc-800"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d} className="dark:bg-zinc-850 p-2 text-xs">{d}</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      placeholder="Year (Optional)"
                      className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-[11px] font-bold text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-150 dark:border-zinc-800"
                      value={bYear}
                      onChange={(e) => setBYear(e.target.value)}
                      min={1900}
                      max={new Date().getFullYear()}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5">Custom Handle / URL Link</label>
                  <div className="flex items-center bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-0.5 border border-zinc-150 dark:border-zinc-800 min-w-0">
                    <span className="pl-3 text-zinc-400 text-xs font-bold font-mono truncate min-w-0 shrink">https://relateosbday.netlify.app/u/</span>
                    <input
                      type="text"
                      required
                      className="flex-1 min-w-[50px] p-3 pl-1 bg-transparent border-none text-xs font-bold text-zinc-950 dark:text-white outline-none focus:ring-0"
                      placeholder="smayan"
                      value={customHandle}
                      onChange={(e) => {
                        const cleanVal = e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, '');
                        setCustomHandle(cleanVal);
                        setHandleSuccess(false);
                      }}
                      onBlur={() => checkHandleUniqueness(customHandle)}
                    />
                    <button
                      type="button"
                      disabled={handleChecking || !customHandle.trim()}
                      onClick={() => checkHandleUniqueness(customHandle)}
                      className="px-3 py-1.5 mr-1 bg-zinc-250 dark:bg-zinc-700 text-[10px] font-black uppercase rounded-lg text-zinc-650 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-650 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      {handleChecking ? 'Checking...' : 'Verify'}
                    </button>
                  </div>
                  {handleError && <p className="text-red-500 text-[10px] font-bold ml-1">{handleError}</p>}
                  {handleSuccess && <p className="text-emerald-500 text-[10px] font-bold ml-1 flex items-center gap-1">✓ Beautiful! Handle is unique.</p>}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-250 border border-zinc-200 dark:border-zinc-750 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={!name.trim() || !customHandle.trim() || handleChecking || !!handleError}
                  onClick={handleNextStep}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer"
                >
                  Continue to Vibes <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Your Social Vibes ⚡</h2>
                <p className="text-xs text-zinc-400 font-semibold">Tell your circle what you're currently jamming to.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5 flex items-center gap-1">
                    <Trophy size={11} /> Favorite Sports Teams (Press Enter or comma to add)
                  </label>
                  <input
                    type="text"
                    enterKeyHint="done"
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs font-semibold text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-150 dark:border-zinc-800"
                    placeholder="e.g. Lakers, Real Madrid, Warriors"
                    value={sportsInput}
                    onChange={(e) => setSportsInput(e.target.value)}
                    onKeyDown={handleAddSportTag}
                  />
                  {sportsTeams.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sportsTeams.map((team, idx) => (
                        <span 
                          key={idx} 
                          className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 rounded-lg flex items-center gap-1 shadow-sm"
                        >
                          {team}
                          <button 
                            type="button" 
                            onClick={() => removeSportTag(idx)} 
                            className="hover:text-red-500 font-extrabold ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5 flex items-center gap-1">
                    <Music size={11} /> Favorite Artists or Music Genre
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs font-semibold text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-150 dark:border-zinc-800"
                    placeholder="e.g. Drake, Billie Eilish, Synthwave, Lofi"
                    value={favArtists}
                    onChange={(e) => setFavArtists(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5">My Favorite Thing to Do on a Weekend is...</label>
                  <textarea
                    rows={2}
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none border border-zinc-150 dark:border-zinc-800"
                    placeholder="e.g. coding late-night tracks, record vintage vinyl, hike with friends"
                    value={weekendActivities}
                    onChange={(e) => setWeekendActivities(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 ml-0.5">Anything Extra</label>
                  <textarea
                    rows={2}
                    className="w-full p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-xs text-zinc-950 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none border border-zinc-150 dark:border-zinc-800"
                    placeholder="Random fun facts, clothing/shoe sizes, allergies, or coffee preferences..."
                    value={anythingExtra}
                    onChange={(e) => setAnythingExtra(e.target.value)}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-250 border border-zinc-200 dark:border-zinc-750 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer"
                >
                  Configure Privacy <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Choose Your Privacy Shield 🛡️</h2>
                <p className="text-xs text-zinc-400 font-semibold">Select how you want to share your birthday and vibes link.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`p-5 rounded-[24px] border-2 text-left space-y-3 transition-all relative ${
                    !isPrivate 
                      ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10' 
                      : 'border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className={`p-2 rounded-xl inline-block ${!isPrivate ? 'bg-emerald-500 text-white shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    <Globe size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[13px] text-zinc-900 dark:text-white">Go Public ⚡</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mt-1">
                      Bio link active. Friends can visit your page to add their info and view your social vibes!
                    </p>
                  </div>
                  {!isPrivate && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`p-5 rounded-[24px] border-2 text-left space-y-3 transition-all relative ${
                    isPrivate 
                      ? 'border-zinc-900 dark:border-white bg-zinc-950/5 dark:bg-white/5' 
                      : 'border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className={`p-2 rounded-xl inline-block ${isPrivate ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[13px] text-zinc-900 dark:text-white">Go Private 🔒</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mt-1">
                      Completely offline. Only you can view or manage your space. Public route is locked down.
                    </p>
                  </div>
                  {isPrivate && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {!isPrivate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-150 dark:border-zinc-750 rounded-2xl space-y-2 overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">Your Public URL Invite URL</span>
                      <button 
                        type="button"
                        onClick={copyBioLink}
                        className="text-[10px] uppercase font-black tracking-wider text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={11} /> {copiedLink ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 truncate bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-inner">
                      {bioLink}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {isPrivate && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-850 border border-dashed border-zinc-200 dark:border-zinc-750 rounded-2xl text-center">
                  <p className="text-xs font-bold text-zinc-500">
                    🔒 Security Locked: Friends visiting `/u/{customHandle}` will be blocked with a privacy shield.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-250 border border-zinc-200 dark:border-zinc-750 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={saveStep1To3Data}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer"
                >
                  {isSubmitting ? 'Securing...' : 'Continue to Theme ⚡'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Choose Your Theme 🪐</h2>
                <p className="text-xs text-zinc-400 font-semibold">Select your preferred app theme style.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Light Mode */}
                <button
                  type="button"
                  onClick={() => handleSelectTheme('light')}
                  className={`p-6 rounded-[24px] border-2 text-left space-y-4 transition-all relative cursor-pointer ${
                    user?.appearance === 'light' || !user?.appearance
                      ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10'
                      : 'border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className={`p-3 rounded-2xl inline-block ${user?.appearance === 'light' || !user?.appearance ? 'bg-emerald-500 text-white shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    <Sun size={24} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">Light Mode</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mt-1">
                      Clean off-white canvas with deep charcoal accents.
                    </p>
                  </div>
                  {(user?.appearance === 'light' || !user?.appearance) && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>

                {/* Dark Mode */}
                <button
                  type="button"
                  onClick={() => handleSelectTheme('dark')}
                  className={`p-6 rounded-[24px] border-2 text-left space-y-4 transition-all relative cursor-pointer ${
                    user?.appearance === 'dark'
                      ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10'
                      : 'border-zinc-150 dark:border-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <div className={`p-3 rounded-2xl inline-block ${user?.appearance === 'dark' ? 'bg-emerald-500 text-white shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    <Moon size={24} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">Dark Mode</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mt-1">
                      Cosmic slate-colored dark background for night owls.
                    </p>
                  </div>
                  {user?.appearance === 'dark' && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-250 border border-zinc-200 dark:border-zinc-750 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/15 cursor-pointer"
                >
                  Continue to Import <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div
              key="step-6"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6"
            >
              {importState === 'default' && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Import Your Friends 🎂</h2>
                    <p className="text-xs text-zinc-400 font-semibold">Sync birthdays instantly from your calendars. Choose an option below to fill RelateOS with your favorite people.</p>
                  </div>

                  {importError && (
                    <div className="text-xs text-red-500 font-bold bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                      {importError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={handleStep5GoogleImport}
                      className="w-full py-4 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-2xl font-bold text-xs tracking-wide transition shadow-lg flex items-center justify-center gap-3 hover:opacity-90 cursor-pointer"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                      </svg>
                      Sync Google Contacts & Calendar
                    </button>

                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-150 dark:border-zinc-750">
                      <div className="text-left space-y-0.5">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">Import calendar file (.ics)</p>
                        <p className="text-[10px] text-zinc-400">Select an ICS file</p>
                      </div>
                      <label className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 text-[10px] font-black uppercase rounded-lg cursor-pointer">
                        Upload
                        <input
                          type="file"
                          accept=".ics"
                          className="hidden"
                          onChange={handleStep5FileUpload}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-250 border border-zinc-200 dark:border-zinc-750 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(7)}
                      className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-250 text-zinc-500 dark:text-zinc-300 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      Skip For Now <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {importState === 'loading' && (
                <div className="text-center space-y-4 py-8">
                  <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-3xl mx-auto animate-pulse flex items-center justify-center">
                    <Loader2 size={24} className="text-zinc-400 dark:text-zinc-600 animate-spin" />
                  </div>
                  <h3 className="text-lg font-black tracking-tight">Syncing contacts...</h3>
                  <p className="text-xs text-zinc-400 px-8">We are securely retrieving birthdays and profile photos from your Google account. This may take a moment.</p>
                </div>
              )}

              {importState === 'success' && (
                <div className="text-center space-y-6 py-6">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto scale-110 shadow-xl shadow-emerald-500/20">
                    <Check size={32} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Import complete! 🎉</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-semibold">
                      Successfully imported <span className="text-emerald-500 dark:text-emerald-400 font-black text-base">{importedCount}</span> birthday connection{importedCount === 1 ? '' : 's'}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(7)}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    Continue <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {step === 7 && (
            <motion.div
              key="step-7"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6"
            >
              <div className="space-y-2 text-center pb-2">
                <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 mb-4">
                  <Sparkles size={32} />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Choose Your Path 🗺️</h2>
                <p className="text-xs text-zinc-400 font-semibold px-4">You're all set! Tell us how you'd like to get started with RelateOS.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  type="button"
                  onClick={() => handleCompleteWithTour(true)}
                  className="p-6 rounded-[24px] border-2 text-left space-y-3 transition-all relative cursor-pointer border-zinc-150 dark:border-zinc-800 hover:border-emerald-500 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10"
                >
                  <div className="p-2.5 rounded-xl inline-block bg-emerald-500 text-white shadow-md">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[13px] text-zinc-900 dark:text-white">Take a Quick Tour 🚀</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mt-1">
                      Highly recommended! A step-by-step interactive walkthrough highlighting key RelateOS workspace features.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleCompleteWithTour(false)}
                  className="p-6 rounded-[24px] border-2 text-left space-y-3 transition-all relative cursor-pointer border-zinc-150 dark:border-zinc-800 hover:border-zinc-900 dark:hover:border-white hover:bg-zinc-50/50"
                >
                  <div className="p-2.5 rounded-xl inline-block bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md">
                    <Globe size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[13px] text-zinc-900 dark:text-white">Explore on My Own 🕊️</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mt-1">
                      Skip the tour. Drop me straight into the main workspace dashboard to begin.
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-250 border border-zinc-200 dark:border-zinc-750 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
