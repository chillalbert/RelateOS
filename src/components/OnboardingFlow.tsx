import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTour } from '../context/TourContext';
import { db } from '../lib/firebase';
import { doc, getDocs, updateDoc, collection, query, where, addDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { getLocalDateString } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Camera, User, ArrowRight, ArrowLeft, 
  Check, Lock, Globe, Trophy, Music, Copy, Calendar,
  Sun, Moon, Loader2, ChevronRight, X, Heart, Shield
} from 'lucide-react';
import ConstellationView, { CONSTELLATION_NODES } from './ConstellationView';

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
    throw new Error('Google OAuth Client ID is not configured.');
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
          reject(new Error(err.message || 'OAuth client error.'));
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

// Compact constellation progress bar shown inside step views
function CompactConstellationIndicator({
  activeStepIndex,
  completedStepIndices,
}: {
  activeStepIndex: number;
  completedStepIndices: number[];
}) {
  return (
    <div className="space-y-1.5 mb-4">
      <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 dark:text-zinc-400 px-1">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-500 dark:text-emerald-400">
          <Sparkles size={12} /> Step {activeStepIndex + 1} of 7
        </span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {CONSTELLATION_NODES[activeStepIndex]?.label}
        </span>
      </div>

      <div className="relative w-full h-8 bg-zinc-100 dark:bg-zinc-900 rounded-xl px-4 flex items-center justify-between border border-zinc-200/80 dark:border-zinc-800">
        <svg className="absolute inset-0 w-full h-full pointer-events-none px-4" viewBox="0 0 300 24" preserveAspectRatio="none">
          <line x1="12" y1="12" x2="288" y2="12" stroke="#d4d4d8" className="dark:stroke-zinc-800" strokeWidth="2" strokeDasharray="3 3" />
          {activeStepIndex > 0 && (
            <motion.line
              x1="12"
              y1="12"
              x2={12 + (276 * activeStepIndex) / 6}
              y2="12"
              stroke="#10b981"
              strokeWidth="2.5"
              initial={{ x2: 12 }}
              animate={{ x2: 12 + (276 * activeStepIndex) / 6 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            />
          )}
        </svg>

        {CONSTELLATION_NODES.map((node, idx) => {
          const isCompleted = completedStepIndices.includes(idx);
          const isActive = idx === activeStepIndex;
          return (
            <div key={node.id} className="relative z-10 flex items-center justify-center">
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.25 : 1,
                }}
                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/40'
                    : isActive
                    ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20 shadow-md'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                }`}
              >
                {isCompleted ? (
                  <Check size={9} strokeWidth={3} />
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
                )}
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OnboardingFlow() {
  const { user, refreshUser } = useAuth();
  const { setTourStep } = useTour();

  // Mode: 'theme' -> 'constellation' -> 'step-content' (with zooming-in / zooming-out transitions)
  const [viewMode, setViewMode] = useState<'theme' | 'constellation' | 'step-content'>('theme');
  const [isZoomingIn, setIsZoomingIn] = useState(false);
  const [isZoomingOut, setIsZoomingOut] = useState(false);

  // 7 onboarding steps (index 0 to 6)
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [completedStepIndices, setCompletedStepIndices] = useState<number[]>([]);

  // Theme choice
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>(() => user?.appearance === 'dark' ? 'dark' : 'light');
  const [wantsTour, setWantsTour] = useState(false);

  useEffect(() => {
    if (selectedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [selectedTheme]);

  // Step 2: Profile
  const [name, setName] = useState(user?.name || '');
  const [customHandle, setCustomHandle] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState(user?.profile_picture_url || '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [handleChecking, setHandleChecking] = useState(false);
  const [handleError, setHandleError] = useState('');
  const [handleSuccess, setHandleSuccess] = useState(false);

  // Birthday month, day, optional birth_year
  const [bMonth, setBMonth] = useState<number>(() => {
    if (user?.birthday_month) return user.birthday_month;
    if (user?.birthday) {
      const parts = user.birthday.split('-');
      if (parts.length === 3) return parseInt(parts[1], 10);
    }
    return 6;
  });
  const [bDay, setBDay] = useState<number>(() => {
    if (user?.birthday_day) return user.birthday_day;
    if (user?.birthday) {
      const parts = user.birthday.split('-');
      if (parts.length === 3) return parseInt(parts[2], 10);
    }
    return 15;
  });
  const [bYear, setBYear] = useState<string>(() => {
    if (user?.birth_year) return user.birth_year.toString();
    if (user?.birthday) {
      const parts = user.birthday.split('-');
      if (parts.length === 3 && parts[0] !== '2000') return parts[0];
    }
    return '';
  });

  // Step 3: Interests
  const [sportsInput, setSportsInput] = useState('');
  const [sportsTeams, setSportsTeams] = useState<string[]>([]);
  const [favArtists, setFavArtists] = useState('');
  const [weekendActivities, setWeekendActivities] = useState('');
  const [anythingExtra, setAnythingExtra] = useState(user?.anything_extra || '');

  // Step 4: Privacy
  const [isPrivate, setIsPrivate] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 5: Calendar sync state
  const [importState, setImportState] = useState<'default' | 'loading' | 'success'>('default');
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  useEffect(() => {
    if (user?.custom_handle) {
      setCustomHandle(user.custom_handle);
      setHandleSuccess(true);
    } else if (user?.name) {
      const proposed = user.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      setCustomHandle(proposed);
    }
  }, [user]);

  const checkHandleUniqueness = async (handleToCheck: string): Promise<boolean> => {
    const cleanHandle = handleToCheck.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '');
    if (!cleanHandle) {
      setHandleError('Handle cannot be empty');
      setHandleSuccess(false);
      return false;
    }
    if (cleanHandle.length < 3) {
      setHandleError('Minimum 3 characters required');
      setHandleSuccess(false);
      return false;
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
        setHandleError('This handle is already taken');
        setHandleSuccess(false);
        return false;
      } else {
        setHandleSuccess(true);
        setHandleError('');
        return true;
      }
    } catch (err) {
      console.error(err);
      setHandleError('Unable to check handle.');
      setHandleSuccess(false);
      return false;
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
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      setProfilePicUrl(data.secure_url);
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      setUploadError('Failed to upload photo. Try again.');
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

  const handleSelectTheme = async (theme: 'light' | 'dark') => {
    setSelectedTheme(theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { appearance: theme });
    } catch (err) {
      console.error("Error setting appearance:", err);
    }
  };

  const saveProfileData = async () => {
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
        appearance: selectedTheme,
      });
      await refreshUser();
    } catch (err) {
      console.error('Saving profile data failed:', err);
    } finally {
      setIsSubmitting(false);
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
          throw new Error("Google authorization failed.");
        }
        const retryResult = await fetchApis(token);
        calRes = retryResult.calRes;
        peopleRes = retryResult.peopleRes;

        if (calRes.status === 401 || peopleRes.status === 401) {
          throw new Error("Google access expired. Please sign in again.");
        }
      }

      if (!calRes.ok || !peopleRes.ok) {
        throw new Error("Failed to fetch calendar data from Google.");
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
              updated_at: serverTimestamp(),
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
      if (savedCount > 0 && !user.initialTaskCompleted) {
        try {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, {
            initialTaskCompleted: true,
            initialTaskCompletedDate: getLocalDateString(),
            unlockedFeatures: arrayUnion('analytics')
          });
        } catch (e) {
          console.error("Error setting initialTaskCompleted in Google import:", e);
        }
      }
      setImportState('success');
    } catch (err: any) {
      console.error("Google Calendar API error:", err?.message || String(err));
      setImportError(err.message || "An error occurred during import.");
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
              updated_at: serverTimestamp(),
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
      if (savedCount > 0 && !user.initialTaskCompleted) {
        try {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, {
            initialTaskCompleted: true,
            initialTaskCompletedDate: getLocalDateString(),
            unlockedFeatures: arrayUnion('analytics')
          });
        } catch (e) {
          console.error("Error setting initialTaskCompleted in file import:", e);
        }
      }
      setImportState('success');
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "An error occurred while parsing the .ics file.");
      setImportState('default');
    }
  };

  const handleCompleteWithTour = async (wantsTour: boolean) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await saveProfileData();

      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        onboarding_completed: true,
        has_completed_onboarding: true,
        hasSeenTour: true,
        tourFinished: !wantsTour,
        postTourNudgeShown: !wantsTour ? true : false,
        appearance: selectedTheme
      });
      await refreshUser();

      if (wantsTour) {
        setTourStep(1);
      } else {
        setTourStep(null);
      }
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bio link preview string with hardcoded domain
  const bioLink = `https://relateosbday.netlify.app/u/${customHandle.trim().toLowerCase()}`;

  const copyBioLink = () => {
    navigator.clipboard.writeText(bioLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Zoom transitions between constellation and step content
  const triggerZoomToStep = () => {
    setIsZoomingIn(true);
    setTimeout(() => {
      setIsZoomingIn(false);
      setViewMode('step-content');
    }, 750);
  };

  const completeStepAndZoomNext = async (nextIndex?: number) => {
    if (activeStepIndex === 1) {
      if (!name.trim()) return;
      if (handleError) return;

      let isAvailable = handleSuccess;
      if (!isAvailable) {
        if (!customHandle.trim()) {
          setHandleError('Handle cannot be empty');
          return;
        }
        isAvailable = await checkHandleUniqueness(customHandle);
      }

      if (!isAvailable || handleError) {
        return;
      }
    }

    setIsZoomingOut(true);
    const completedIdx = activeStepIndex;
    if (!completedStepIndices.includes(completedIdx)) {
      setCompletedStepIndices([...completedStepIndices, completedIdx]);
    }

    setTimeout(() => {
      setIsZoomingOut(false);
      const target = nextIndex !== undefined ? nextIndex : activeStepIndex + 1;
      if (target <= 6) {
        setActiveStepIndex(target);
        setViewMode('constellation');
      }
    }, 500);
  };

  const goToPreviousStep = () => {
    if (activeStepIndex > 0) {
      setIsZoomingOut(true);
      setTimeout(() => {
        setIsZoomingOut(false);
        setActiveStepIndex(activeStepIndex - 1);
        setViewMode('constellation');
      }, 400);
    }
  };

  // FIRST-EVER SCREEN: Theme choice
  if (viewMode === 'theme') {
    const isLight = selectedTheme === 'light';
    return (
      <div className={`min-h-[100dvh] flex items-center justify-center p-3 sm:p-4 py-6 sm:py-8 overflow-y-auto select-none transition-colors duration-300 ${
        isLight ? 'bg-zinc-50 text-zinc-900' : 'bg-zinc-950 text-white'
      }`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`w-full max-w-md my-auto p-5 sm:p-8 rounded-[28px] sm:rounded-[32px] shadow-2xl space-y-6 relative overflow-hidden transition-colors duration-300 ${
            isLight ? 'bg-white border border-zinc-200 text-zinc-900 shadow-zinc-200/50' : 'bg-zinc-900 border border-zinc-800 text-white'
          }`}
        >
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <Sparkles size={13} />
              <span>RelateOS</span>
            </div>
            <h1 className={`text-2xl font-extrabold tracking-tight ${isLight ? 'text-zinc-900' : 'text-white'}`}>
              Choose your theme
            </h1>
            <p className={`text-xs font-normal max-w-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
              Select light mode or dark mode to set your app theme.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => handleSelectTheme('light')}
              className={`p-5 rounded-2xl border-2 text-left space-y-3 transition-all relative cursor-pointer ${
                isLight
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-950/60 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className={`p-2.5 rounded-xl inline-block ${isLight ? 'bg-emerald-500 text-white shadow-md' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                <Sun size={20} />
              </div>
              <div>
                <h3 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-white'}`}>Light mode</h3>
                <p className={`text-[11px] font-normal leading-normal mt-1 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  Clean white canvas with dark text.
                </p>
              </div>
              {isLight && (
                <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                  <Check size={10} strokeWidth={3} />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTheme('dark')}
              className={`p-5 rounded-2xl border-2 text-left space-y-3 transition-all relative cursor-pointer ${
                selectedTheme === 'dark'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-950/60 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <div className={`p-2.5 rounded-xl inline-block ${selectedTheme === 'dark' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                <Moon size={20} />
              </div>
              <div>
                <h3 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-white'}`}>Dark mode</h3>
                <p className={`text-[11px] font-normal leading-normal mt-1 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  Dark canvas with light text.
                </p>
              </div>
              {selectedTheme === 'dark' && (
                <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-zinc-950">
                  <Check size={10} strokeWidth={3} />
                </div>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setViewMode('constellation');
            }}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>
      </div>
    );
  }

  // CONSTELLATION ZOOM VIEW
  if (viewMode === 'constellation' || isZoomingIn) {
    return (
      <ConstellationView
        activeStepIndex={activeStepIndex}
        completedStepIndices={completedStepIndices}
        isZoomingIn={isZoomingIn}
        isZoomingOut={isZoomingOut}
        selectedTheme={selectedTheme}
        onEnterStep={triggerZoomToStep}
        onSelectNode={(index) => {
          setActiveStepIndex(index);
          triggerZoomToStep();
        }}
      />
    );
  }

  // STEP CONTENT VIEW
  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex items-center justify-center p-3 sm:p-4 py-6 sm:py-10 pt-[max(1rem,var(--sat))] overflow-y-auto select-none">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={isZoomingOut ? { scale: 0.8, opacity: 0 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg my-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-8 rounded-[28px] sm:rounded-[32px] shadow-2xl space-y-5 sm:space-y-6 relative overflow-hidden"
      >
        {/* Compact Constellation Indicator */}
        <CompactConstellationIndicator
          activeStepIndex={activeStepIndex}
          completedStepIndices={completedStepIndices}
        />

        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {activeStepIndex === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Welcome to RelateOS
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  RelateOS helps you remember birthdays, gift ideas, and key details for your friends.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0 mt-0.5">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Save dates and notes</h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Store birthdays, shoe sizes, coffee orders, and personal preferences in one organized place.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0 mt-0.5">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Get gift recommendations</h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Get gift ideas and birthday message suggestions tailored to your friends.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0 mt-0.5">
                    <Globe size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Share your wishlist</h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                      Share a public profile link so friends know what you like for your birthday.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => completeStepAndZoomNext(1)}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 1: Profile Card */}
          {activeStepIndex === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Your profile
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  Add your photo, full name, birthday, and handle.
                </p>
              </div>

              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-emerald-500/20 overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shadow-inner">
                    {profilePicUrl ? (
                      <img src={profilePicUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : name ? (
                      <div className="w-full h-full flex items-center justify-center bg-emerald-500 text-white text-2xl font-bold uppercase">
                        {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    ) : (
                      <User size={30} className="text-zinc-400 dark:text-zinc-500" />
                    )}
                    
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-bold">
                        <span>Uploading</span>
                      </div>
                    )}
                  </div>
                  
                  <label className="absolute bottom-0 right-0 p-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full shadow-md cursor-pointer hover:scale-105 transition-transform">
                    <Camera size={13} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleAvatarUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                {uploadError && <p className="text-red-500 text-[11px] font-medium">{uploadError}</p>}
              </div>

              {/* Input Fields */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 ml-0.5">Full name</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-200 dark:border-zinc-800"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 ml-0.5">Birthday</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={bMonth}
                      onChange={(e) => setBMonth(parseInt(e.target.value, 10))}
                      className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-200 dark:border-zinc-800"
                    >
                      {[
                        { val: 1, label: 'January' },
                        { val: 2, label: 'February' },
                        { val: 3, label: 'March' },
                        { val: 4, label: 'April' },
                        { val: 5, label: 'May' },
                        { val: 6, label: 'June' },
                        { val: 7, label: 'July' },
                        { val: 8, label: 'August' },
                        { val: 9, label: 'September' },
                        { val: 10, label: 'October' },
                        { val: 11, label: 'November' },
                        { val: 12, label: 'December' },
                      ].map((m) => (
                        <option key={m.val} value={m.val} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-1 text-xs">{m.label}</option>
                      ))}
                    </select>

                    <select
                      value={bDay}
                      onChange={(e) => setBDay(parseInt(e.target.value, 10))}
                      className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-200 dark:border-zinc-800"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-1 text-xs">{d}</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      placeholder="Year (optional)"
                      className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-200 dark:border-zinc-800"
                      value={bYear}
                      onChange={(e) => setBYear(e.target.value)}
                      min={1900}
                      max={new Date().getFullYear()}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 ml-0.5">Custom handle</label>
                  <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 rounded-xl p-0.5 border border-zinc-200 dark:border-zinc-800 min-w-0 overflow-hidden">
                    <span className="pl-2.5 sm:pl-3 text-zinc-400 dark:text-zinc-500 text-[11px] sm:text-xs font-mono truncate max-w-[110px] sm:max-w-none shrink select-all">
                      relateosbday.netlify.app/u/
                    </span>
                    <input
                      type="text"
                      required
                      className="flex-1 min-w-[60px] p-2.5 pl-0 bg-transparent border-none text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-0"
                      placeholder="username"
                      value={customHandle}
                      onChange={(e) => {
                        const cleanVal = e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, '');
                        setCustomHandle(cleanVal);
                        setHandleSuccess(false);
                      }}
                      onBlur={() => checkHandleUniqueness(customHandle)}
                    />
                    {customHandle && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomHandle('');
                          setHandleSuccess(false);
                        }}
                        className="p-1.5 mr-1 text-zinc-400 dark:text-zinc-500 hover:text-red-500 transition-colors shrink-0 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={handleChecking || !customHandle.trim()}
                      onClick={() => checkHandleUniqueness(customHandle)}
                      className="px-2.5 py-1 mr-1 bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {handleChecking ? 'Checking' : 'Check'}
                    </button>
                  </div>
                  {handleError && <p className="text-red-500 text-[11px] font-medium ml-1">{handleError}</p>}
                  {handleSuccess && <p className="text-emerald-500 text-[11px] font-medium ml-1 flex items-center gap-1"><Check size={11} /> Handle available.</p>}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs flex items-center justify-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={!name.trim() || !customHandle.trim() || handleChecking || !!handleError || !handleSuccess}
                  onClick={() => completeStepAndZoomNext(2)}
                  className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Interests */}
          {activeStepIndex === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Your interests
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  Add sports teams, music, and weekend activities so friends know what you like.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 ml-0.5">
                    Favorite sports teams (press Enter to add)
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-200 dark:border-zinc-800"
                    placeholder="e.g. Lakers, Real Madrid"
                    value={sportsInput}
                    onChange={(e) => setSportsInput(e.target.value)}
                    onKeyDown={handleAddSportTag}
                  />
                  {sportsTeams.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {sportsTeams.map((team, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md flex items-center gap-1"
                        >
                          {team}
                          <button 
                            type="button" 
                            onClick={() => removeSportTag(idx)} 
                            className="hover:text-red-500 font-bold ml-1 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 ml-0.5">
                    Favorite artists or genres
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none border border-zinc-200 dark:border-zinc-800"
                    placeholder="e.g. Drake, Indie Rock, Lofi"
                    value={favArtists}
                    onChange={(e) => setFavArtists(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 ml-0.5">
                    Weekend activities
                  </label>
                  <textarea
                    rows={2}
                    className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none border border-zinc-200 dark:border-zinc-800"
                    placeholder="e.g. Hiking, coding projects, visiting cafes"
                    value={weekendActivities}
                    onChange={(e) => setWeekendActivities(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 ml-0.5">
                    Additional notes
                  </label>
                  <textarea
                    rows={2}
                    className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none border border-zinc-200 dark:border-zinc-800"
                    placeholder="Shoe size, coffee preference, allergies, or gift ideas..."
                    value={anythingExtra}
                    onChange={(e) => setAnythingExtra(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs flex items-center justify-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => completeStepAndZoomNext(3)}
                  className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Privacy Shield */}
          {activeStepIndex === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Privacy settings
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  Choose whether your profile is public or private, and share your profile link.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`p-4 rounded-2xl border-2 text-left space-y-2 transition-all cursor-pointer ${
                    !isPrivate 
                      ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10' 
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl inline-block ${!isPrivate ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    <Globe size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-zinc-900 dark:text-white">Public profile</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      Anyone with your link can view your wishlist.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`p-4 rounded-2xl border-2 text-left space-y-2 transition-all cursor-pointer ${
                    isPrivate 
                      ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10' 
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl inline-block ${isPrivate ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    <Lock size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-zinc-900 dark:text-white">Private profile</h3>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      Only approved connections can see your details.
                    </p>
                  </div>
                </button>
              </div>

              {/* Bio Link Preview */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Profile link</span>
                  {copiedLink && <span className="text-[10px] font-bold text-emerald-500">Copied!</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate flex-1">
                    {bioLink}
                  </span>
                  <button
                    type="button"
                    onClick={copyBioLink}
                    className="p-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs flex items-center justify-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => completeStepAndZoomNext(4)}
                  className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Import Birthdays */}
          {activeStepIndex === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Import birthdays
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  Sync birthdays automatically from your Google Calendar or upload a .ics calendar file.
                </p>
              </div>

              {importState === 'loading' ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
                  <Loader2 size={32} className="animate-spin text-emerald-500" />
                  <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    Syncing calendar events...
                  </p>
                </div>
              ) : importState === 'success' ? (
                <div className="py-8 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                    <Check size={24} strokeWidth={3} />
                  </div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                    Import successful
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Added <span className="font-bold text-emerald-500">{importedCount}</span> contacts with birthdays to your account.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleStep5GoogleImport}
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                        <Calendar size={20} />
                      </div>
                      <div className="text-left">
                        <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Sync Google Calendar</h3>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Import birthday events automatically.</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <label className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
                        <User size={20} />
                      </div>
                      <div className="text-left">
                        <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Upload .ics calendar file</h3>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Select a calendar export file from your device.</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                    <input type="file" accept=".ics" className="hidden" onChange={handleStep5FileUpload} />
                  </label>

                  {importError && (
                    <p className="text-xs text-red-500 font-medium px-1 text-center">{importError}</p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs flex items-center justify-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => completeStepAndZoomNext(5)}
                  className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span>{importState === 'success' ? 'Continue' : 'Skip for now'}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 5: Choose Your Path */}
          {activeStepIndex === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Choose your path
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  Take a short guided tour or go straight to your dashboard.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setWantsTour(true);
                    completeStepAndZoomNext(6);
                  }}
                  className="p-5 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-xs text-zinc-900 dark:text-white">Take guided tour</h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Walk through key features step by step.</p>
                  </div>
                  <ChevronRight size={18} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWantsTour(false);
                    completeStepAndZoomNext(6);
                  }}
                  className="p-5 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer group"
                >
                  <div className="space-y-1">
                    <h3 className="font-bold text-xs text-zinc-900 dark:text-white">Explore on my own</h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Jump directly to your main dashboard.</p>
                  </div>
                  <ChevronRight size={18} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="px-4 py-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-xs flex items-center justify-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700"
                >
                  <ArrowLeft size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 6: Ready / Complete */}
          {activeStepIndex === 6 && (
            <motion.div
              key="step-6"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="space-y-6 text-center"
            >
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <Trophy size={32} />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Setup complete
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal max-w-xs mx-auto">
                  Your profile is ready. You can now track birthdays and manage gift notes.
                </p>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Name</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{name || 'User'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Handle</span>
                  <span className="font-mono font-bold text-emerald-500">@{customHandle || 'username'}</span>
                </div>
                {importedCount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 font-semibold">Imported contacts</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{importedCount} contacts</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleCompleteWithTour(wantsTour)}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>Start using RelateOS</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
