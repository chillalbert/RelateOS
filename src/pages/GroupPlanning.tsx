import React from 'react';
import {
  useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useAuth } from '../context/AuthContext';
import {
  MapPin, CheckSquare, User, 
 ArrowLeft, 
 Users, 
 Plus, 
 Vote, 
 DollarSign, 
 Shield, 
 ChevronUp, 
 ChevronDown,
 MoreHorizontal,
 Sparkles, HelpCircle, 
 ExternalLink,
 Lock,
 Unlock,
 X,
 MessageSquare,
 Gift,
 Image as ImageIcon,
 Heart,
 Share2,
 Send,
 Music,
 Camera,
 BarChart2,
 Calendar,
 Clock,
 Trash2,
 Settings,
 Sliders,
 Brain,
 Copy,
 Check,
 Key,
 Pencil,
 Gamepad2,
 Bot,
 LayoutDashboard,
 Palette,
 Eye,
 EyeOff,
 PartyPopper,
 Disc,
 Play,
 Volume2,
 ThumbsUp,
 Flame
} from 'lucide-react';
import {
   motion, AnimatePresence } from 'motion/react';
import Navigation from '../components/Navigation';
import HelpTip from '../components/HelpTip';
import {
   generateGiftSuggestions, generateNeutralizedNote, callCoachModel } from '../services/geminiService';
import {
   triggerSystemNotification } from '../lib/pushManager';
import {
   db } from '../lib/firebase';
import {
   
 doc, 
 getDoc, 
 updateDoc, 
 setDoc,
 collection, 
 addDoc, 
 onSnapshot, 
 query, 
 where, 
 serverTimestamp, 
 arrayUnion, 
 getDocs,
 orderBy,
 deleteDoc,
 deleteField,
 arrayRemove
} from 'firebase/firestore';
import {
   cn, getDaysUntil, isBirthdayToday, formatTime as utilsFormatTime } from '../lib/utils';

const CHARS_JOIN_CODE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function getRandom6Char(): string {
 let res = '';
 for (let i = 0; i < 6; i++) {
 res += CHARS_JOIN_CODE.charAt(Math.floor(Math.random() * CHARS_JOIN_CODE.length));
 }
 return res;
}

export async function generateUniqueJoinCode(): Promise<string> {
 const groupsRef = collection(db, 'rooms');
 for (let attempt = 0; attempt < 5; attempt++) {
 const code = `PARTY-${getRandom6Char()}`;
 const q = query(groupsRef, where('join_code', '==', code));
 const snapshot = await getDocs(q);
 if (snapshot.empty) {
 return code;
 }
 }
 return `PARTY-${getRandom6Char()}`;
}

export async function checkJoinCodeAvailable(
 rawCode: string,
 excludeRoomId?: string
): Promise<{ available: boolean; error?: string; normalized: string; cleaned: string }> {
 const cleaned = rawCode.trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9-_]/g, '');
 const normalized = cleaned.toLowerCase();

 if (cleaned.length < 3) {
 return {
 available: false,
 error: 'Join code must be at least 3 characters',
 normalized,
 cleaned
 };
 }

 if (cleaned.length > 20) {
 return {
 available: false,
 error: 'Join code must be 20 characters or fewer',
 normalized,
 cleaned
 };
 }

 try {
 const groupsRef = collection(db, 'rooms');
 
 // Check normalized_join_code
 const snapNorm = await getDocs(query(groupsRef, where('normalized_join_code', '==', normalized)));
 const conflictingNormDocs = snapNorm.docs.filter(d => d.id !== excludeRoomId);
 if (conflictingNormDocs.length > 0) {
 return {
 available: false,
 error: 'This code is already in use — try another',
 normalized,
 cleaned
 };
 }

 // Check exact join_code
 const snapJoin = await getDocs(query(groupsRef, where('join_code', '==', cleaned)));
 const conflictingJoinDocs = snapJoin.docs.filter(d => d.id !== excludeRoomId);
 if (conflictingJoinDocs.length > 0) {
 return {
 available: false,
 error: 'This code is already in use — try another',
 normalized,
 cleaned
 };
 }

 // Check uppercase join_code
 const snapJoinUpper = await getDocs(query(groupsRef, where('join_code', '==', cleaned.toUpperCase())));
 const conflictingUpperDocs = snapJoinUpper.docs.filter(d => d.id !== excludeRoomId);
 if (conflictingUpperDocs.length > 0) {
 return {
 available: false,
 error: 'This code is already in use — try another',
 normalized,
 cleaned
 };
 }

 // Check exact invite_code
 const snapInvite = await getDocs(query(groupsRef, where('invite_code', '==', cleaned)));
 const conflictingInviteDocs = snapInvite.docs.filter(d => d.id !== excludeRoomId);
 if (conflictingInviteDocs.length > 0) {
 return {
 available: false,
 error: 'This code is already in use — try another',
 normalized,
 cleaned
 };
 }

 return { available: true, normalized, cleaned };
 } catch (err) {
 console.error("Error checking join code availability:", err);
 return { available: false, error: 'Error checking code availability. Please try again.', normalized, cleaned };
 }
}

function SparkSurpriseCard({ surprise }: { surprise: any }) {
 const questions = surprise.questions || [];
 const responses = surprise.responses || [];
 const isGuessWho = surprise.guess_who ?? true;

 // Extract unique names of people who submitted responses
 const candidates = React.useMemo(() => {
 return Array.from(new Set(responses.map((r: any) => r.user_name).filter(Boolean))) as string[];
 }, [responses]);

 // Keep track of guess state: responseId -> guessed name
 const [guesses, setGuesses] = React.useState<Record<string, string>>({});
 // Keep track of whether a response's guess has been locked in / revealed
 const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});

 const handleGuessChange = (responseId: string, guessedName: string) => {
 if (!guessedName) return;
 setGuesses(prev => ({ ...prev, [responseId]: guessedName }));
 setRevealed(prev => ({ ...prev, [responseId]: true }));
 };

 return (
 <div className="space-y-6">
 <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
 <Sparkles className="text-indigo-500 animate-pulse" size={20} />
 <div>
 <h4 className="font-extrabold text-zinc-900 dark:text-zinc-50 text-sm">
 AI Spark Game Compiled Results
 </h4>
 <p className="text-[10px] text-zinc-400 font-medium">
 {isGuessWho 
 ? "‍ Guess Who! The answers are anonymous. Try to match each response with its author!" 
 : " Compilation of all questions and matching user answers."}
 </p>
 </div>
 </div>

 <div className="space-y-6">
 {questions.map((q: any, qIdx: number) => {
 const qResponses = responses.filter((r: any) => r.question_id === q.id);
 
 if (qResponses.length === 0) return null;

 return (
 <div key={q.id || qIdx} className="space-y-3">
 <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
 <span className="text-[10px] font-black tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">Question {qIdx + 1}</span>
 <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 mt-0.5">{q.text}</p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2 border-l-2 border-indigo-100 dark:border-indigo-900/40">
 {qResponses.map((r: any, rIdx: number) => {
 const isAnsRevealed = revealed[r.id];
 const guessedName = guesses[r.id];
 const isCorrect = guessedName === r.user_name;

 return (
 <div 
 key={r.id || rIdx}
 className={cn(
 "p-4 rounded-2xl transition-all duration-300 flex flex-col justify-between border",
 isGuessWho 
 ? isAnsRevealed
 ? isCorrect
 ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-500/40"
 : "bg-rose-50/30 dark:bg-rose-950/10 border-rose-500/40"
 : "bg-zinc-50/40 dark:bg-zinc-900/20 border-zinc-100 dark:border-zinc-800/80"
 : "bg-zinc-50/40 dark:bg-zinc-900/20 border-zinc-100 dark:border-zinc-800/80"
 )}
 >
 <div className="space-y-1">
 <p className="text-sm text-zinc-700 dark:text-zinc-200 font-medium leading-relaxed italic">
 "{r.answer_text}"
 </p>
 </div>

 <div className="mt-4 pt-3 border-t border-dashed border-zinc-100 dark:border-zinc-800/80">
 {isGuessWho ? (
 <div className="space-y-2">
 {isAnsRevealed ? (
 <div className="flex flex-col gap-1 text-xs">
 {isCorrect ? (
 <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
 Correct!
 </span>
 ) : (
 <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
 Not quite!
 </span>
 )}
 <span className="text-zinc-500 dark:text-zinc-400">
 Real author: <strong className="text-zinc-800 dark:text-zinc-200">{r.user_name}</strong>
 </span>
 {!isCorrect && (
 <span className="text-[10px] text-zinc-400">
 You guessed: {guessedName}
 </span>
 )}
 </div>
 ) : (
 <div className="flex flex-col gap-1">
 <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
 Who answered this?
 </label>
 <select
 value=""
 onChange={(e) => handleGuessChange(r.id, e.target.value)}
 className="w-full text-xs p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-100"
 >
 <option value="">Select a friend...</option>
 {candidates.map((name: string) => (
 <option key={name} value={name}>
 {name}
 </option>
 ))}
 </select>
 </div>
 )}
 </div>
 ) : (
 <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block text-right">
 — {r.user_name}
 </span>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
}

export default function GroupPlanning() {
 const { id } = useParams();
 const [searchParams] = useSearchParams();
 const personId = searchParams.get('personId');
 const { firebaseUser, user } = useAuth();
 const navigate = useNavigate();

 const [recipientEmail, setRecipientEmail] = React.useState('');
 const [defaultRoomName, setDefaultRoomName] = React.useState('');

 React.useEffect(() => {
 const fetchRecipientInfo = async () => {
 if (!personId) return;
 try {
 const { getDoc, doc, collection, query, where, getDocs } = await import('firebase/firestore');
 const personDoc = await getDoc(doc(db, 'people', personId));
 if (personDoc.exists()) {
 const pData = personDoc.data();
 const pName = pData.name || 'Someone';
 
 setDefaultRoomName(`${pName}'s Birthday Surprise`);
 
 if (pData.email) {
 setRecipientEmail(pData.email);
 return;
 }
 if (pData.host_uid) {
 const userDoc = await getDoc(doc(db, 'users', pData.host_uid));
 if (userDoc.exists() && userDoc.data().email) {
 setRecipientEmail(userDoc.data().email);
 return;
 }
 }

 // Search the users collection directly for match by name
 const usersRef = collection(db, 'users');
 const usersQuery = query(usersRef, where('name', '==', pName));
 const usersSnap = await getDocs(usersQuery);
 if (!usersSnap.empty) {
 const matchedUser = usersSnap.docs[0].data();
 if (matchedUser.email) {
 setRecipientEmail(matchedUser.email);
 return;
 }
 }
 }
 } catch (err) {
 console.error("Error auto-filling surprise recipient email:", err);
 }
 };

 fetchRecipientInfo();
 }, [personId]);
 
 const [group, setGroup] = React.useState<any>(null);
 const [loading, setLoading] = React.useState(true);
 const [hasDismissedPublishHint, setHasDismissedPublishHint] = React.useState(false);
  const lastTapRef = React.useRef<{ [key: string]: number }>({});
  const [sendToLockerEnabled, setSendToLockerEnabled] = React.useState(true);
  const [keepInPersonEnabled, setKeepInPersonEnabled] = React.useState(false);
  const [guessWhoEnabled, setGuessWhoEnabled] = React.useState(true);
  const [customLockerNote, setCustomLockerNote] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'planning' | 'guests' | 'vault' | 'chat'>('planning');

 // Room Type Selection State
 const [roomType, setRoomType] = React.useState<'select' | 'birthday' | 'party'>('select');

 // Party creation form states
 const [partyName, setPartyName] = React.useState('');
 const [partyPersonName, setPartyPersonName] = React.useState('');
 const [partyDate, setPartyDate] = React.useState('');
 const [partyTime, setPartyTime] = React.useState('');
 const [selectedVibe, setSelectedVibe] = React.useState(' House Party');
 const [guestCount, setGuestCount] = React.useState('');
 const [partyNotes, setPartyNotes] = React.useState('');
 const [roomStructure, setRoomStructure] = React.useState<'flat' | 'roles'>('flat');

 // Party active tab state
 const [partyActiveTab, setPartyActiveTab] = React.useState<'setup' | 'plan' | 'polls' | 'guests' | 'vibes' | 'photos' | 'chat' | 'settings' | 'trivia' | 'ai_assistant' | 'guest_room'>('setup');

  React.useEffect(() => {
    if (!isCrewAdminOrMod && partyActiveTab !== 'guest_room' && partyActiveTab !== 'photos') {
      setPartyActiveTab('guest_room');
    }
  }, [isCrewAdminOrMod, partyActiveTab]);

 const [isTabMenuOpen, setIsTabMenuOpen] = React.useState(false);

 // Planner AI Chat States
 const [plannerAiMessages, setPlannerAiMessages] = React.useState<any[]>([]);
 const [newPlannerAiText, setNewPlannerAiText] = React.useState('');
 const [isPlannerAiThinking, setIsPlannerAiThinking] = React.useState(false);
 const plannerAiEndRef = React.useRef<HTMLDivElement>(null);

 // Member names cache
 const [memberNames, setMemberNames] = React.useState<{[uid: string]: string}>({});

 // Room Edit & settings states
 const [editRoomName, setEditRoomName] = React.useState('');
 const [editRoomNotes, setEditRoomNotes] = React.useState('');
 const [isSavingRoomDetails, setIsSavingRoomDetails] = React.useState(false);
 const [editPlannerNotes, setEditPlannerNotes] = React.useState('');
 const [isSavingPlannerNotes, setIsSavingPlannerNotes] = React.useState(false);
 const [editPartyDate, setEditPartyDate] = React.useState('');
 const [isSavingPartyDate, setIsSavingPartyDate] = React.useState(false);
 const [editVisibility, setEditVisibility] = React.useState<{not_going: string, undecided: string, going: string}>({
   not_going: 'none',
   undecided: 'limited',
   going: 'full'
 });
 const [editPhotoAccess, setEditPhotoAccess] = React.useState<string>('guests_can_add');
 const [editQuestionDepth, setEditQuestionDepth] = React.useState<'light' | 'medium' | 'deep'>('light');

 // Birthday Questions and Responses states
 const [birthdayQuestions, setBirthdayQuestions] = React.useState<any[]>([]);
 const [birthdayResponses, setBirthdayResponses] = React.useState<any[]>([]);
 const [newQuestionText, setNewQuestionText] = React.useState('');
 const [isProposingQuestion, setIsProposingQuestion] = React.useState(false);
 const [isGeneratingAIQuestions, setIsGeneratingAIQuestions] = React.useState(false);
 const [recipientGuesses, setRecipientGuesses] = React.useState<{[responseId: string]: string}>({});
 const [responsesLockDate, setResponsesLockDate] = React.useState('');
 const [isSavingLockDate, setIsSavingLockDate] = React.useState(false);

 // Trivia active form states
 const [userAnswers, setUserAnswers] = React.useState<{[questionId: string]: string}>({});
 const [isSavingAnswers, setIsSavingAnswers] = React.useState<{[questionId: string]: boolean}>({});
 const [isSendingToVaults, setIsSendingToVaults] = React.useState(false);

 // Subcollections for Party room
 const [tasks, setTasks] = React.useState<any[]>([]);
 const [polls, setPolls] = React.useState<any[]>([]);
 const [photos, setPhotos] = React.useState<any[]>([]);
 const [contributions, setContributions] = React.useState<any[]>([]);
 const [datePolls, setDatePolls] = React.useState<any[]>([]);
 const [newPollDate, setNewPollDate] = React.useState('');
 const [newPollTime, setNewPollTime] = React.useState('');
 const [showAddDatePoll, setShowAddDatePoll] = React.useState(false);

 // Plan tab states
 const [partyThemes, setPartyThemes] = React.useState<any[]>([]);
 const [isGeneratingThemes, setIsGeneratingThemes] = React.useState(false);
 const [newTaskTitle, setNewTaskTitle] = React.useState('');
 const [newTaskAssignee, setNewTaskAssignee] = React.useState('');
 const [isEditingBudget, setIsEditingBudget] = React.useState(false);
 const [customBudget, setCustomBudget] = React.useState('');
 const [partyVenues, setPartyVenues] = React.useState<any[]>([]);
 const [isGeneratingVenues, setIsGeneratingVenues] = React.useState(false);

 // Custom planning entry forms states
 const [showCustomThemeForm, setShowCustomThemeForm] = React.useState(false);
 const [customThemeName, setCustomThemeName] = React.useState('');
 const [customThemeCost, setCustomThemeCost] = React.useState('');
 const [customThemeDecorations, setCustomThemeDecorations] = React.useState('');
 const [customThemeVibe, setCustomThemeVibe] = React.useState('');
 const [customThemeFood, setCustomThemeFood] = React.useState('');

 const [showCustomVenueForm, setShowCustomVenueForm] = React.useState(false);
 const [customVenueType, setCustomVenueType] = React.useState('');
 const [customVenueCost, setCustomVenueCost] = React.useState('');
 const [customVenueWhy, setCustomVenueWhy] = React.useState('');
 const [customVenueTips, setCustomVenueTips] = React.useState('');

 const [showCustomPlaylistForm, setShowCustomPlaylistForm] = React.useState(false);
 const [customPlaylistVibe, setCustomPlaylistVibe] = React.useState('');
 const [customPlaylistHype, setCustomPlaylistHype] = React.useState('');
 const [customPlaylistMid, setCustomPlaylistMid] = React.useState('');
 const [customPlaylistChill, setCustomPlaylistChill] = React.useState('');

 // Polls tab states
 const [newPollQuestion, setNewPollQuestion] = React.useState('');
 const [newPollOptions, setNewPollOptions] = React.useState<string[]>(['', '']);
 const [showPollForm, setShowPollForm] = React.useState(false);

 // Vibes tab states
 const [playlistConcept, setPlaylistConcept] = React.useState<any>(null);
 const [isGeneratingPlaylist, setIsGeneratingPlaylist] = React.useState(false);
 const [showAddTrackForm, setShowAddTrackForm] = React.useState(false);
 const [newTrackTitle, setNewTrackTitle] = React.useState('');
 const [newTrackArtist, setNewTrackArtist] = React.useState('');
 const [newTrackCategory, setNewTrackCategory] = React.useState<'hype' | 'anthem' | 'chill' | 'highlight'>('anthem');
 const [newTrackWhy, setNewTrackWhy] = React.useState('');
 const [playlistCategoryFilter, setPlaylistCategoryFilter] = React.useState<'all' | 'hype' | 'anthem' | 'chill' | 'highlight'>('all');
 const [copiedTracklist, setCopiedTracklist] = React.useState(false);

 // Photos tab states
 const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
 const [partyMemory, setPartyMemory] = React.useState('');
 const [isGeneratingMemory, setIsGeneratingMemory] = React.useState(false);
 
 // Attendance and Admin Settings states
 const [createRequiresAttendance, setCreateRequiresAttendance] = React.useState(false);
 const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
 const [editingItemType, setEditingItemType] = React.useState<'theme' | 'venue' | 'playlist' | 'game' | null>(null);

 // Game Ideas state
 const [partyGameIdeas, setPartyGameIdeas] = React.useState<any[]>([]);
 const [isGeneratingGameIdeas, setIsGeneratingGameIdeas] = React.useState(false);
 const [showCustomGameForm, setShowCustomGameForm] = React.useState(false);
 const [customGameName, setCustomGameName] = React.useState('');
 const [customGameDescription, setCustomGameDescription] = React.useState('');
 const [customGameDuration, setCustomGameDuration] = React.useState('');
 const [customGameMaterials, setCustomGameMaterials] = React.useState('');

 const [editGameName, setEditGameName] = React.useState('');
 const [editGameDescription, setEditGameDescription] = React.useState('');
 const [editGameDuration, setEditGameDuration] = React.useState('');
 const [editGameMaterials, setEditGameMaterials] = React.useState('');

 const [editThemeName, setEditThemeName] = React.useState('');
 const [editThemeCost, setEditThemeCost] = React.useState('');
 const [editThemeVibe, setEditThemeVibe] = React.useState('');
 const [editThemeDecorations, setEditThemeDecorations] = React.useState('');
 const [editThemeFood, setEditThemeFood] = React.useState('');

 const [editVenueType, setEditVenueType] = React.useState('');
 const [editVenueWhy, setEditVenueWhy] = React.useState('');
 const [editVenueTips, setEditVenueTips] = React.useState('');
 const [editVenueCost, setEditVenueCost] = React.useState('');

 const [editPlaylistVibe, setEditPlaylistVibe] = React.useState('');
 
 // Form states
 const [newIdea, setNewIdea] = React.useState('');
 const [isContributingBoard, setIsContributingBoard] = React.useState(false);
 const [contributionAmountBoard, setContributionAmountBoard] = React.useState('25');
 const [isContributingSidebar, setIsContributingSidebar] = React.useState(false);
 const [contributionAmountSidebar, setContributionAmountSidebar] = React.useState('25');
 const [aiSuggestions, setAiSuggestions] = React.useState<any[]>([]);
 const [isGeneratingSuggestions, setIsGeneratingSuggestions] = React.useState(false);
  const [isPartyRoom, setIsPartyRoom] = React.useState(false);
  const [codeNameInput, setCodeNameInput] = React.useState('');
 // Custom Join Code states for room creation
 const [birthdayJoinCode, setBirthdayJoinCode] = React.useState('');
 const [partyJoinCode, setPartyJoinCode] = React.useState('');
 const [createCodeError, setCreateCodeError] = React.useState('');
 const [isCheckingCode, setIsCheckingCode] = React.useState(false);

 // Party Setup edit join code states
 const [editJoinCode, setEditJoinCode] = React.useState('');
 const [isEditingJoinCode, setIsEditingJoinCode] = React.useState(false);
 const [editJoinCodeError, setEditJoinCodeError] = React.useState('');
 const [isSavingJoinCode, setIsSavingJoinCode] = React.useState(false);
 const [editJoinCodeSuccess, setEditJoinCodeSuccess] = React.useState(false);
 
  // Vault states
  const [showSurpriseForm, setShowSurpriseForm] = React.useState(false);
  const [newSurprise, setNewSurprise] = React.useState({ type: 'message', content: '' });
  const [surprises, setSurprises] = React.useState<any[]>([]);
  const [linkCopied, setLinkCopied] = React.useState(false);

  // Full-party tab state
  const [partyPlaylistUrl, setPartyPlaylistUrl] = React.useState('');
  const [newTriviaQuestion, setNewTriviaQuestion] = React.useState('');
  const [editableJoinCode, setEditableJoinCode] = React.useState('');
  const [isGeneratingTrivia, setIsGeneratingTrivia] = React.useState(false);

  // Guest Private AI Note state
  const [guestNoteText, setGuestNoteText] = React.useState('');
  const [isSavingGuestNote, setIsSavingGuestNote] = React.useState(false);
  const [guestNoteSavedSuccess, setGuestNoteSavedSuccess] = React.useState(false);

  // Planner Ideas for AI toggle state
  const [plannerNotesTab, setPlannerNotesTab] = React.useState<'my_notes' | 'group_wide'>('my_notes');
  const [groupNeutralizedNotes, setGroupNeutralizedNotes] = React.useState<string[]>([]);
  const [isLoadingGroupNotes, setIsLoadingGroupNotes] = React.useState(false);

  React.useEffect(() => {
    if (!id || !firebaseUser) return;
    const fetchGuestPrivateNote = async () => {
      try {
        const noteSnap = await getDoc(doc(db, 'rooms', id, 'guest_ai_notes_private', firebaseUser.uid));
        if (noteSnap.exists()) {
          setGuestNoteText(noteSnap.data()?.raw_text || '');
        }
      } catch (err) {
        console.error("Error loading guest private AI note:", err);
      }
    };
    fetchGuestPrivateNote();
  }, [id, firebaseUser]);

  const handleSaveGuestAiNote = async () => {
    if (!id || !firebaseUser) return;
    const trimmed = guestNoteText.trim();
    setIsSavingGuestNote(true);
    setGuestNoteSavedSuccess(false);
    try {
      // 1. Write raw text to guest_ai_notes_private/{uid}
      const privateRef = doc(db, 'rooms', id, 'guest_ai_notes_private', firebaseUser.uid);
      await setDoc(privateRef, {
        raw_text: trimmed,
        user_id: firebaseUser.uid,
        updated_at: serverTimestamp()
      });

      // 2. Neutralize note via Gemini
      const neutralizedText = trimmed ? await generateNeutralizedNote(trimmed) : '';

      // 3. Write neutralized text to guest_ai_notes_neutralized/{uid}
      const neutralizedRef = doc(db, 'rooms', id, 'guest_ai_notes_neutralized', firebaseUser.uid);
      await setDoc(neutralizedRef, {
        neutralized_text: neutralizedText,
        user_id: firebaseUser.uid,
        updated_at: serverTimestamp()
      });

      setGuestNoteSavedSuccess(true);
      setTimeout(() => setGuestNoteSavedSuccess(false), 2500);
    } catch (err) {
      console.error("Error saving guest AI note:", err);
    } finally {
      setIsSavingGuestNote(false);
    }
  };

  const fetchGroupNeutralizedNotes = async () => {
    if (!id) return;
    setIsLoadingGroupNotes(true);
    try {
      const snap = await getDocs(collection(db, 'rooms', id, 'guest_ai_notes_neutralized'));
      const notes: string[] = [];
      snap.docs.forEach(docSnap => {
        const text = docSnap.data()?.neutralized_text;
        if (text && text.trim()) {
          notes.push(text.trim());
        }
      });
      setGroupNeutralizedNotes(notes);
    } catch (err) {
      console.error("Error fetching group neutralized notes:", err);
    } finally {
      setIsLoadingGroupNotes(false);
    }
  };

  const venues = partyVenues;
  const gameProposals = partyGameIdeas;
  const photoDumpImages = photos;
  const triviaQuestions = birthdayQuestions;



  const handleSavePlaylistUrl = async () => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'rooms', id), { playlist_url: partyPlaylistUrl });
    } catch (e) {
      console.error(e);
    }
  };



  const handleGenerateTrivia = async () => {
    setIsGeneratingTrivia(true);
    setTimeout(() => setIsGeneratingTrivia(false), 1200);
  };

  const handlePublishTriviaToLocker = async (questionId: string) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'rooms', id, 'birthday_questions', questionId), {
        is_published: true
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTriviaQuestion = async () => {
    if (!id || !newTriviaQuestion.trim() || !firebaseUser) return;
    try {
      await addDoc(collection(db, 'rooms', id, 'birthday_questions'), {
        question_text: newTriviaQuestion.trim(),
        created_by: firebaseUser.uid,
        created_at: serverTimestamp()
      });
      setNewTriviaQuestion('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleRequiresAttendance = async () => {
    if (!id || !group) return;
    try {
      await updateDoc(doc(db, 'rooms', id), {
        requires_attendance: !group.requires_attendance
      });
    } catch (e) {
      console.error(e);
    }
  };
 const [copiedCode, setCopiedCode] = React.useState(false);
 const [ideas, setIdeas] = React.useState<any[]>([]);

 // Chat states
 const [chatMessages, setChatMessages] = React.useState<any[]>([]);
 const [newMessageText, setNewMessageText] = React.useState('');
 const [isSparkTyping, setIsSparkTyping] = React.useState(false);
 const messagesEndRef = React.useRef<HTMLDivElement>(null);
 const [selectedChatChannel, setSelectedChatChannel] = React.useState<'admin_planner' | 'everyone'>('everyone');

   const isLockDatePassed = React.useMemo(() => {
    if (!group?.responses_lock_date) return false;
    const lockTime = new Date(group.responses_lock_date).getTime();
    return !isNaN(lockTime) && Date.now() > lockTime;
  }, [group?.responses_lock_date]);

  const handlePublishQuestion = async (questionId: string) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'rooms', id, 'birthday_questions', questionId), {
        published: true
      });
    } catch (err) { console.error('Error publishing question:', err); }
  };

  const isPlannerOrAdmin = React.useMemo(() => {
 if (!group || !firebaseUser) return false;
 const isFlat = group.room_structure === 'flat';
 const userRole = group.roles?.[firebaseUser.uid] || 'guest';
 return isFlat || userRole === 'admin' || userRole === 'planner' || group.created_by === firebaseUser.uid || group.admins?.includes(firebaseUser.uid);
 }, [group, firebaseUser]);

 // Image Upload states
 const [selectedImageFile, setSelectedImageFile] = React.useState<File | null>(null);
 const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
 const [isUploadingImage, setIsUploadingImage] = React.useState(false);
 const hasSentBirthdayPush = React.useRef(false);

 // Notify crew states
 const [showNotifyCrewModal, setShowNotifyCrewModal] = React.useState(false);
  const [adminTypedMessage, setAdminTypedMessage] = React.useState('');
  const [isSendingNotifyCrew, setIsSendingNotifyCrew] = React.useState(false);

  const handleSendNotifyCrew = async (msg: string) => {
    if (!id || !msg.trim() || !firebaseUser) return;
    setIsSendingNotifyCrew(true);
    try {
      const alertsRef = collection(db, 'rooms', id, 'alerts');
      await addDoc(alertsRef, {
        message: msg,
        sender_id: firebaseUser.uid,
        created_at: serverTimestamp()
      });
      setShowNotifyCrewModal(false);
      setAdminTypedMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingNotifyCrew(false);
    }
  };

 const handleLeaveRoom = async () => {
 if (!id || !firebaseUser || !group) return;
 if (window.confirm("Are you sure you want to leave this workspace? If you are the last member, this temporary room will be automatically deleted completely.")) {
 try {
 const roomRef = doc(db, 'rooms', id);
 const currentMembers = group.members || [];
 
 if (currentMembers.length <= 1) {
 console.log("[Lifecycle] Last member left, deleting temporary room:", id);
 await deleteDoc(roomRef);
 navigate('/rooms');
 } else {
 await updateDoc(roomRef, {
 members: arrayRemove(firebaseUser.uid)
 });
 navigate('/rooms');
 }
 } catch (err) {
 console.error("Error leaving room:", err);
 }
 }
 };

 React.useEffect(() => {
 if (!id || !firebaseUser) return;

 const groupRef = doc(db, 'rooms', id);
 const unsubscribeGroup = onSnapshot(groupRef, async (docSnap) => {
 if (docSnap.exists()) {
 const groupData = { id: docSnap.id, ...docSnap.data() } as any;
 
 // Check if user is a member or recipient
 const isMember = groupData.members?.includes(firebaseUser.uid);
 const isRecipient = user?.email === groupData.recipient_email;
 
 if (!isMember && !isRecipient) {
 setLoading(false);
 return;
 }

 // Fetch member names
 const membersList = groupData.members || [];
 const namesMap: {[uid: string]: string} = {};
 let celebrantUid: string | null = null;
 if (membersList.length > 0) {
 try {
 const chunks = [];
 for (let i = 0; i < membersList.length; i += 30) {
 chunks.push(membersList.slice(i, i + 30));
 }
 for (const chunk of chunks) {
 const usersSnap = await getDocs(query(collection(db, 'users'), where('id', 'in', chunk)));
 usersSnap.forEach(d => {
 const uData = d.data();
 if (uData.name) {
 namesMap[d.id] = uData.name;
 }
 if (uData.email && groupData.recipient_email && uData.email.toLowerCase() === groupData.recipient_email.toLowerCase()) {
 celebrantUid = d.id;
 }
 });
 }
 } catch (err) {
 console.error("Error fetching member names:", err);
 }
 }
 setMemberNames(namesMap);

 setGroup({ ...groupData, isMember, isRecipient });

 if (!groupData.join_code && id && firebaseUser?.uid && (groupData.created_by === firebaseUser.uid || groupData.admins?.includes(firebaseUser.uid))) {
 generateUniqueJoinCode().then((newCode) => {
 updateDoc(doc(db, 'rooms', id), { join_code: newCode, invite_code: newCode }).catch(() => {});
 }).catch(() => {});
 }

 // Action A: Birthday Locker Countdown
 if (groupData.person_birthday && !hasSentBirthdayPush.current) {
 const days = getDaysUntil(groupData.person_birthday);
 if (days <= 0) {
 hasSentBirthdayPush.current = true;
 (async () => {
 try {
 const targetMembers = groupData.members || [];
 if (targetMembers.length > 0) {
 await fetch('/.netlify/functions/send-push-ping', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 userIds: targetMembers,
 title: "The Vault is UNLOCKED! ",
 body: `Surprises for ${groupData.person_name || 'your friends'} are officially live! Tap to watch the reveal!`,
 url: `/rooms/${id}`
 })
 });
 }
 } catch (err) {
 console.error("Error sending birthday push notification:", err);
 }
 })();
 }
 }

 setLoading(false);
 } else {
 setLoading(false);
 }
 }, (err) => {
 console.warn("Handled snapshot restriction gracefully:", err.message);
 setLoading(false);
 });

 // Contributions subscription
 const contributionsRef = collection(db, 'rooms', id, 'contributions');
 const unsubscribeContributions = onSnapshot(contributionsRef, (snapshot) => {
 setContributions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled snapshot restriction gracefully:", err.message);
 });

 // Date polls subscription
 const datePollsRef = collection(db, 'rooms', id, 'date_polls');
 const unsubscribeDatePolls = onSnapshot(datePollsRef, (snapshot) => {
 setDatePolls(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled snapshot restriction gracefully:", err.message);
 });

 // Ideas subscription
 const ideasRef = collection(db, 'rooms', id, 'ideas');
 const unsubscribeIdeas = onSnapshot(ideasRef, (snapshot) => {
 setIdeas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled snapshot restriction gracefully:", err.message);
 });

 // Surprises subscription
 const surprisesRef = collection(db, 'rooms', id, 'surprises');
 const unsubscribeSurprises = onSnapshot(surprisesRef, (snapshot) => {
 setSurprises(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled snapshot restriction gracefully:", err.message);
 });

 // Tasks subscription
 const tasksRef = collection(db, 'rooms', id, 'tasks');
 const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
 setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled snapshot restriction gracefully:", err.message);
 });

 // Polls subscription (client-side sort to be safe from index issues)
 const pollsRef = collection(db, 'rooms', id, 'polls');
 const unsubscribePolls = onSnapshot(pollsRef, (snapshot) => {
 const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
 list.sort((a: any, b: any) => {
 const tA = a.created_at?.seconds || 0;
 const tB = b.created_at?.seconds || 0;
 return tB - tA;
 });
 setPolls(list);
 }, (err) => {
 console.warn("Handled snapshot restriction gracefully:", err.message);
 });

 // Photos subscription (client-side sort to be safe from index issues)
 const photosRef = collection(db, 'rooms', id, 'party_photos');
 const unsubscribePhotos = onSnapshot(photosRef, (snapshot) => {
 const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
 list.sort((a: any, b: any) => {
 const tA = a.created_at?.seconds || 0;
 const tB = b.created_at?.seconds || 0;
 return tB - tA;
 });
 setPhotos(list);
 }, (err) => {
 console.warn("Handled snapshot restriction gracefully:", err.message);
 });

 // Trivia Questions subscription
 const questionsRef = collection(db, 'rooms', id, 'birthday_questions');
 const unsubscribeQuestions = onSnapshot(questionsRef, (snapshot) => {
 const qList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
 qList.sort((a: any, b: any) => {
 const tA = a.created_at?.seconds || 0;
 const tB = b.created_at?.seconds || 0;
 return tA - tB;
 });
 setBirthdayQuestions(qList);
 }, (err) => {
 console.warn("Handled questions snapshot restriction gracefully:", err.message);
 });

 // Trivia Responses subscription
 const responsesRef = collection(db, 'rooms', id, 'birthday_responses');
 const unsubscribeResponses = onSnapshot(responsesRef, (snapshot) => {
 setBirthdayResponses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled responses snapshot restriction gracefully:", err.message);
 });

 return () => {
 unsubscribeGroup();
 unsubscribeIdeas();
 unsubscribeSurprises();
 unsubscribeTasks();
 unsubscribePolls();
 unsubscribePhotos();
 unsubscribeContributions();
 unsubscribeDatePolls();
 unsubscribeQuestions();
 unsubscribeResponses();
 };
 }, [id, firebaseUser, user?.email]);

 React.useEffect(() => {
   if (group) {
     setEditRoomName(group.name || '');
     setEditRoomNotes(group.notes || '');
     setEditPlannerNotes(group.planner_notes || '');
     setEditPartyDate(group.party_date || '');
     setResponsesLockDate(group.responses_lock_date || '');
     if (group.visibility_by_status) {
       setEditVisibility(group.visibility_by_status);
     }
     if (group.photo_access) {
       setEditPhotoAccess(group.photo_access);
     }
     if (group.question_depth) {
       setEditQuestionDepth(group.question_depth as any);
     }
   }
 }, [group?.name, group?.notes, group?.planner_notes, group?.party_date, group?.responses_lock_date, group?.visibility_by_status, group?.photo_access, group?.question_depth]);

 // Load user answers from subcollection
 React.useEffect(() => {
 if (firebaseUser && birthdayResponses.length > 0) {
 const updatedAnswers: {[qId: string]: string} = {};
 birthdayResponses.forEach(resp => {
 if (resp.user_id === firebaseUser.uid) {
 updatedAnswers[resp.question_id] = resp.answer_text || '';
 }
 });
 setUserAnswers(prev => ({ ...prev, ...updatedAnswers }));
 }
 }, [birthdayResponses, firebaseUser]);

 // Two-channel Chat subscription
 React.useEffect(() => {
 if (!id || !firebaseUser) return;

 const chatRef = collection(db, 'rooms', id, 'chat');
 // Subscribes dynamically to selectedChatChannel ('everyone' or 'admin_planner')
 const qChat = query(
 chatRef, 
 where('channel', '==', selectedChatChannel),
 orderBy('created_at', 'asc')
 );

 const unsubscribeChat = onSnapshot(qChat, (snapshot) => {
 setChatMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled snapshot restriction gracefully:", err.message);
 });

 return () => {
 unsubscribeChat();
 };
 }, [id, firebaseUser, selectedChatChannel]);

 React.useEffect(() => {
 if (!id || !firebaseUser || !isPlannerOrAdmin) return;

 const qAi = query(
 collection(db, 'rooms', id, 'planner_ai_chat'),
 orderBy('created_at', 'asc')
 );

 const unsubscribeAi = onSnapshot(qAi, (snapshot) => {
 setPlannerAiMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled planner_ai_chat snapshot restriction gracefully:", err.message);
 });

 return () => {
 unsubscribeAi();
 };
 }, [id, firebaseUser, isPlannerOrAdmin]);

 React.useEffect(() => {
 if (partyActiveTab === 'ai_assistant') {
 plannerAiEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }
 }, [plannerAiMessages, partyActiveTab, isPlannerAiThinking]);

 const handleSendPlannerAiMessage = async (customPrompt?: string) => {
 const textToSend = (customPrompt || newPlannerAiText).trim();
 if (!textToSend || !id || !firebaseUser || isPlannerAiThinking) return;

 setNewPlannerAiText('');
 setIsPlannerAiThinking(true);

 try {
 await addDoc(collection(db, 'rooms', id, 'planner_ai_chat'), {
 sender_id: firebaseUser.uid,
 sender_name: user?.name || firebaseUser?.displayName || 'Planner',
 text: textToSend,
 is_ai: false,
 created_at: serverTimestamp(),
 });

 const partyContext = `
Party Planning Context:
- Party Name: ${group?.name || 'Party'}
- Person/Celebrant Name: ${group?.person_name || 'Friend'}
- Vibe / Theme: ${group?.vibe || 'Not specified'}
- Party Date: ${group?.party_date || 'Not set'}
- Guest Count: ${group?.guest_count || (group?.members?.length || 0)}
- Planner Notes: ${group?.planner_notes || 'None'}
- Target Budget: ${group?.target_amount ? `$${group.target_amount}` : 'Not specified'}
- Location / Venue: ${group?.venue_location || 'Not set'}
`;

 const recentHistory = plannerAiMessages.slice(-8);
 const contents: any[] = [];

 if (recentHistory.length > 0) {
 for (const msg of recentHistory) {
 contents.push({
 role: msg.is_ai ? 'model' : 'user',
 parts: [{ text: msg.text }]
 });
 }
 contents.push({
 role: 'user',
 parts: [{ text: textToSend }]
 });
 } else {
 contents.push({
 role: 'user',
 parts: [{ text: `${partyContext}\n\nPlanner Question: ${textToSend}` }]
 });
 }

 const systemPrompt = `You are an expert party planning AI assistant helping party coordinators and admins organize a memorable event.
Context about the party:
${partyContext}

Provide clear, structured, practical, and enthusiastic party planning advice (e.g. timelines, icebreaker ideas, menu suggestions, guest engagement, logistics).
CRITICAL STYLING RULE: Do NOT use any emojis in your response. Keep all text purely alphanumeric and clean.`;

 const aiReply = await callCoachModel(contents, {
 systemInstruction: systemPrompt
 });

 const cleanAiReply = (aiReply || "I'm ready to help you plan! Ask me any question about timelines, icebreakers, or party details.")
 .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]/gu, '');

 await addDoc(collection(db, 'rooms', id, 'planner_ai_chat'), {
 sender_id: 'ai_assistant',
 sender_name: 'Planning Assistant',
 text: cleanAiReply,
 is_ai: true,
 created_at: serverTimestamp(),
 });
 } catch (err) {
 console.error("Error sending planner AI message:", err);
 try {
 await addDoc(collection(db, 'rooms', id, 'planner_ai_chat'), {
 sender_id: 'ai_assistant',
 sender_name: 'Planning Assistant',
 text: "I ran into a temporary issue processing your question. Please try asking again!",
 is_ai: true,
 created_at: serverTimestamp(),
 });
 } catch (e) {
 console.error(e);
 }
 } finally {
 setIsPlannerAiThinking(false);
 }
 };

 const [hasDismissedPublishTip, setHasDismissedPublishTip] = React.useState(() => {
 return localStorage.getItem('has_dismissed_publish_tip') === 'true';
 });

 const handleDismissPublishTip = () => {
 localStorage.setItem('has_dismissed_publish_tip', 'true');
 setHasDismissedPublishTip(true);
 };

 const handleToggleThemePublish = async (themeId: string, currentPublished: boolean) => {
 if (!id || !firebaseUser) return;
 try {
 const themeDocRef = doc(db, 'rooms', id, 'themes', themeId);
 await updateDoc(themeDocRef, {
 published: !currentPublished
 });
 } catch (err) {
 console.error("Error toggling theme publish:", err);
 }
 };

 const handleToggleVenuePublish = async (venueId: string, currentPublished: boolean) => {
 if (!id || !firebaseUser) return;
 try {
 const venueDocRef = doc(db, 'rooms', id, 'venues', venueId);
 await updateDoc(venueDocRef, {
 published: !currentPublished
 });
 } catch (err) {
 console.error("Error toggling venue publish:", err);
 }
 };

 const handleTogglePlaylistPublish = async (currentPublished: boolean) => {
 if (!id || !firebaseUser) return;
 try {
 const playlistDocRef = doc(db, 'rooms', id, 'playlists', 'current');
 await updateDoc(playlistDocRef, {
 published: !currentPublished
 });
 } catch (err) {
 console.error("Error toggling playlist publish:", err);
 }
 };

   const handleCreateTask = async () => {
    if (!id || !newTaskTitle.trim()) return;
    try {
      await addDoc(collection(db, 'rooms', id, 'tasks'), {
        title: newTaskTitle.trim(),
        assignee: newTaskAssignee || null,
        published: false,
        completed: false,
        created_at: serverTimestamp()
      });
      setNewTaskTitle('');
      setNewTaskAssignee('');
    } catch (err) { console.error("Error creating task:", err); }
  };

  const handleToggleTaskCompleted = async (taskId: string, currentCompleted: boolean) => {
    if (!id || !firebaseUser) return;
    try {
      await updateDoc(doc(db, 'rooms', id, 'tasks', taskId), { completed: !currentCompleted });
    } catch (err) { console.error("Error toggling task completion:", err); }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!id || !isCrewAdminOrMod) return;
    try {
      await deleteDoc(doc(db, 'rooms', id, 'tasks', taskId));
    } catch (err) { console.error("Error deleting task:", err); }
  };

  const handleToggleTaskPublish = async (taskId: string, currentPublished: boolean) => {
 if (!id || !firebaseUser) return;
 try {
 const taskDocRef = doc(db, 'rooms', id, 'tasks', taskId);
 await updateDoc(taskDocRef, {
 published: !currentPublished
 });
 } catch (err) {
 console.error("Error toggling task publish:", err);
 }
 };

 const handleToggleGameIdeaPublish = async (gameId: string, currentPublished: boolean) => {
 if (!id || !firebaseUser) return;
 try {
 const gameDocRef = doc(db, 'rooms', id, 'game_ideas', gameId);
 await updateDoc(gameDocRef, {
 published: !currentPublished
 });
 } catch (err) {
 console.error("Error toggling game idea publish:", err);
 }
 };

 React.useEffect(() => {
 if (!id || !firebaseUser || !group) return;

 const userRole = group.roles?.[firebaseUser.uid] || 'guest';
 const isGuest = userRole === 'guest';

 let themesQuery: any = collection(db, 'rooms', id, 'themes');
 let venuesQuery: any = collection(db, 'rooms', id, 'venues');
 let playlistsQuery: any = collection(db, 'rooms', id, 'playlists');
 let gameIdeasQuery: any = collection(db, 'rooms', id, 'game_ideas');

 if (isGuest) {
 themesQuery = query(collection(db, 'rooms', id, 'themes'), where('published', '==', true));
 venuesQuery = query(collection(db, 'rooms', id, 'venues'), where('published', '==', true));
 playlistsQuery = query(collection(db, 'rooms', id, 'playlists'), where('published', '==', true));
 gameIdeasQuery = query(collection(db, 'rooms', id, 'game_ideas'), where('published', '==', true));
 }

 const unsubscribeThemes = onSnapshot(themesQuery, (snapshot) => {
 setPartyThemes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled themes snapshot gracefully:", err.message);
 });

 const unsubscribeVenues = onSnapshot(venuesQuery, (snapshot) => {
 setPartyVenues(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled venues snapshot gracefully:", err.message);
 });

 const unsubscribePlaylists = onSnapshot(playlistsQuery, (snapshot) => {
 const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
 const currentPlaylist = docs.find(d => d.id === 'current');
 setPlaylistConcept(currentPlaylist || null);
 }, (err) => {
 console.warn("Handled playlists snapshot gracefully:", err.message);
 });

 const unsubscribeGameIdeas = onSnapshot(gameIdeasQuery, (snapshot) => {
 setPartyGameIdeas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
 }, (err) => {
 console.warn("Handled game_ideas snapshot gracefully:", err.message);
 });

 return () => {
 unsubscribeThemes();
 unsubscribeVenues();
 unsubscribePlaylists();
 unsubscribeGameIdeas();
 };
 }, [id, firebaseUser, group?.roles?.[firebaseUser?.uid]]);

 React.useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [chatMessages]);

 React.useEffect(() => {
 if (newSurprise.type !== 'image') {
 setSelectedImageFile(null);
 setImagePreviewUrl(null);
 }
 }, [newSurprise.type, showSurpriseForm]);

 const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 setSelectedImageFile(file);
 const reader = new FileReader();
 reader.onloadend = () => {
 setImagePreviewUrl(reader.result as string);
 };
 reader.readAsDataURL(file);
 }
 };

 const createActivityNotification = async (activityType: 'message' | 'surprise' | 'contribution') => {
 if (!id || !firebaseUser || !group) return;
 const members = group.members || [];
 const otherMembers = members.filter((uid: string) => uid !== firebaseUser.uid);
 if (otherMembers.length === 0) return;

 const notifRef = collection(db, 'notifications');
 const roomName = group.name || group.title || (group.person_name ? `${group.person_name}'s Birthday` : 'Workspace Room');
 const authorName = user?.name || 'Someone';

 let title = '';
 let message = '';

 if (activityType === 'message') {
 title = `New Room Message `;
 message = `${authorName} sent a message in ${roomName}`;
 } else if (activityType === 'surprise') {
 title = `New Surprise Idea! `;
 message = `${authorName} added a surprise/note in ${roomName}`;
 } else if (activityType === 'contribution') {
 title = `New Pool Contribution `;
 message = `${authorName} contributed to the gift pool in ${roomName}`;
 } else {
 title = `New Room Activity `;
 message = `${authorName} made an update in ${roomName}`;
 }

 try {
 console.log("[DEBUG createActivityNotification] Writing notification:", {
 room_id: id,
 currentUserUid: firebaseUser.uid,
 groupMembers: group.members || []
 });
 const promises = otherMembers.map((memberUid: string) => {
 return addDoc(notifRef, {
 user_id: memberUid,
 title,
 message,
 type: 'group',
 is_read: false,
 isRead: false,
 link: `/rooms/${id}`,
 room_id: id,
 created_at: serverTimestamp()
 });
 });
 await Promise.all(promises);
 } catch (err) {
 console.error("Error creating in-app notification:", err);
 }
 };

 const handleSendChatMessage = async () => {
 const trimmedText = newMessageText.trim();
 if (!id || !trimmedText || !firebaseUser) return;
 
 try {
 const chatRef = collection(db, 'rooms', id, 'chat');
 const userMsgData = {
 user_id: firebaseUser.uid,
 sender_id: firebaseUser.uid,
 user_name: user?.name || 'Anonymous',
 sender_name: user?.name || 'Anonymous',
 text: trimmedText,
 content: trimmedText,
 channel: selectedChatChannel,
 created_at: serverTimestamp()
 };
 await addDoc(chatRef, userMsgData);
 // Spark AI features are disabled in channels
 setNewMessageText('');
 await createActivityNotification('message');
 } catch (err) {
 console.error("Error sending message:", err);
 }
 };

 const handleAddSurprise = async () => {
 if (!id || !firebaseUser) return;

 if (newSurprise.type === 'image') {
 if (!selectedImageFile) {
 alert("Please select an image file to upload.");
 return;
 }
 
 try {
 setIsUploadingImage(true);
 const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dffkrlv1k';
 const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'relateos_uploads';
 
 const formData = new FormData();
 formData.append('file', selectedImageFile);
 formData.append('upload_preset', uploadPreset);
 
 const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
 method: 'POST',
 body: formData
 });
 
 if (!response.ok) {
 throw new Error('Failed to upload image');
 }
 
 const data = await response.json();
 const cloudinaryUrl = data.secure_url;
 
 const surprisesRef = collection(db, 'rooms', id, 'surprises');
 await addDoc(surprisesRef, {
 user_id: firebaseUser.uid,
 user_name: user?.name || 'Anonymous',
 type: 'image',
 content: cloudinaryUrl,
 created_at: serverTimestamp()
 });
 await createActivityNotification('surprise');
 
 setNewSurprise({ type: 'message', content: '' });
 setSelectedImageFile(null);
 setImagePreviewUrl(null);
 setShowSurpriseForm(false);
 } catch (err) {
 console.error("Image upload failed:", err);
 alert("Image upload failed. Please try again.");
 } finally {
 setIsUploadingImage(false);
 }
 return;
 }

 if (!newSurprise.content.trim()) return;
 try {
 const surprisesRef = collection(db, 'rooms', id, 'surprises');
 await addDoc(surprisesRef, {
 user_id: firebaseUser.uid,
 user_name: user?.name || 'Anonymous',
 type: newSurprise.type,
 content: newSurprise.content,
 created_at: serverTimestamp()
 });
 await createActivityNotification('surprise');

 // Trigger C — Card Message Added push:
 if (newSurprise.type === 'message') {
 (async () => {
 try {
 const targetUserIds = (group?.members || []).filter((uid: string) => uid !== firebaseUser.uid);
 if (targetUserIds.length > 0) {
 await fetch('/.netlify/functions/send-push-ping', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 userIds: targetUserIds,
 title: "New birthday card note ",
 body: `${user?.name || firebaseUser.email} left a secret message in the locker!`,
 url: `/rooms/${id}`
 })
 });
 }
 } catch (e) {
 console.error("Failed to send secret message push notification:", e);
 }
 })();
 }

 setNewSurprise({ type: 'message', content: '' });
 setShowSurpriseForm(false);
 } catch (err) {
 console.error(err);
 }
 };

 const handleContribute = async () => {
 if (!id || !firebaseUser) return;
 try {
 const amt = parseFloat(contributionAmountSidebar) || 0;
 const contributionsRef = collection(db, 'rooms', id, 'contributions');
 await addDoc(contributionsRef, {
 user_id: firebaseUser.uid,
 user_name: user?.name || 'Anonymous',
 amount: amt,
 created_at: serverTimestamp()
 });
 await createActivityNotification('contribution');

 // Trigger B — Target Achievement / Gift Decision Confirmed push:
 if (totalContributed + amt >= targetAmount) {
 (async () => {
 try {
 await fetch('/.netlify/functions/send-push-ping', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 userIds: group?.members || [],
 title: "Gift Finalized! ",
 body: `The crew has locked in the gift choice for ${group?.person_name || 'our friend'}! Check it out.`,
 url: `/rooms/${id}`
 })
 });
 } catch (e) {
 console.error("Failed to send gift pool complete push notification:", e);
 }
 })();
 }

 setIsContributingSidebar(false);
 } catch (err) {
 console.error(err);
 }
 };

 const handleFinalizeGift = async () => {
 if (!id || !group) return;
 try {
 const roomRef = doc(db, 'rooms', id);
 await updateDoc(roomRef, { gift_finalized: true });
 // Trigger B — Gift Decision Confirmed push:
 (async () => {
 try {
 await fetch('/.netlify/functions/send-push-ping', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 userIds: group?.members || [],
 title: "Gift Finalized! ",
 body: `The crew has locked in the gift choice for ${group?.person_name || 'our friend'}! Check it out.`,
 url: `/rooms/${id}`
 })
 });
 } catch (pushErr) {
 console.error("Failed to send gift finalized push:", pushErr);
 }
 })();
 alert('Gift choice finalized & crew notified! ');
 } catch (err) {
 console.error(err);
 }
 };

 const handleGenerateSuggestions = async () => {
 if (!group) return;
 setIsGeneratingSuggestions(true);
 
 let matchedInterests: string[] = [];
 let matchedNotes: string[] = [];
 const members = group.members || [];
 
 // 1. Try direct fetch of group.person_id if it exists (only works if current user owns it)
 if (group?.person_id && firebaseUser && (group?.host_uid === firebaseUser.uid || group?.created_by === firebaseUser.uid)) {
 try {
 const personSnap = await getDoc(doc(db, 'people', group.person_id));
 if (personSnap.exists()) {
 const pData = personSnap.data();
 if (pData.interests) matchedInterests.push(pData.interests);
 if (pData.notes) matchedNotes.push(pData.notes);
 }
 } catch (err) {
 console.log("[Suggestions] No direct access to room person_id document, falling back to owner search:", err);
 }
 }

 // 2. Query the current user's own people collection for any matching names (secure and always allowed)
 if (firebaseUser) {
 try {
 const peopleRef = collection(db, 'people');
 const peopleQuery = query(peopleRef, where('user_id', '==', firebaseUser.uid));
 const peopleSnap = await getDocs(peopleQuery);
 peopleSnap.docs.forEach(docSnap => {
 const pData = docSnap.data();
 const pName = pData.name || '';
 if (docSnap.id !== group?.person_id && pName.toLowerCase() === (group?.person_name || '').toLowerCase()) {
 if (pData.interests) matchedInterests.push(pData.interests);
 if (pData.notes) matchedNotes.push(pData.notes);
 }
 });
 } catch (err) {
 console.error("Error fetching own people documents for suggestions:", err);
 }
 }
 
 let combinedInterestsList = [];
 if (group?.planner_notes && group.planner_notes.trim()) {
   combinedInterestsList.push(`Planner's notes on the recipient: ${group.planner_notes.trim()}`);
 }
 if (group?.person_notes) combinedInterestsList.push(group.person_notes);
 if (matchedInterests.length > 0) combinedInterestsList.push(matchedInterests.join(', '));
 if (matchedNotes.length > 0) combinedInterestsList.push(matchedNotes.join(', '));

 try {
   const neutralizedRef = collection(db, 'rooms', id, 'guest_ai_notes_neutralized');
   const neutralizedSnap = await getDocs(neutralizedRef);
   const guestNotesList: string[] = [];
   neutralizedSnap.docs.forEach(docSnap => {
     const data = docSnap.data();
     if (data.neutralized_text && data.neutralized_text.trim()) {
       guestNotesList.push(data.neutralized_text.trim());
     }
   });
   if (guestNotesList.length > 0) {
     combinedInterestsList.push(`Guests' collective notes: ${guestNotesList.join(', ')}`);
   }
 } catch (err) {
   console.error("Error fetching neutralized guest notes for AI suggestions:", err);
 }

 let combinedInterests = combinedInterestsList.join(', ') || 'General interests';
 
 let imageUrls: string[] = [];
 try {
 const surprisesRef = collection(db, 'rooms', id, 'surprises');
 const surprisesQuery = query(surprisesRef, where('type', '==', 'image'));
 const surprisesSnap = await getDocs(surprisesQuery);
 surprisesSnap.docs.forEach(docSnap => {
 const sData = docSnap.data();
 if (sData.content) {
 imageUrls.push(sData.content);
 }
 });
 } catch (err) {
 console.error("Error fetching image surprises:", err);
 }
 
 if (imageUrls.length > 0) {
 combinedInterests += `\nVisual context from friends: ${imageUrls.join(', ')}`;
 }
 
 const totalContributed = contributions?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
 const suggestions = await generateGiftSuggestions({
 interests: combinedInterests,
 budget: totalContributed || 50,
 relationship: group.person_category || 'Friend'
 });
 if (suggestions) setAiSuggestions(suggestions);
 setIsGeneratingSuggestions(false);
 };

 const sendBirthdayEmail = async (docRefId: string, recipientEmail: string) => {
 if (!recipientEmail) return;
 try {
 const secretRef = doc(db, 'secrets', 'resend_api_key');
 const secretSnap = await getDoc(secretRef);
 if (!secretSnap.exists()) {
 console.warn('Resend API key not found in secrets/resend_api_key');
 return;
 }
 
 const resendKey = secretSnap.data()?.value;
 if (!resendKey) {
 console.warn('Resend API key value is empty');
 return;
 }

 fetch('/.netlify/functions/send-email', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 to: recipientEmail,
 subject: `Your friends are planning something special `,
 html: `
 <div style="font-family: sans-serif; max-width: 480px; 
 margin: 0 auto; padding: 24px;">
 <h1 style="color: #10b981;">Something special is 
 coming your way </h1>
 <p>Your friends have been working on a secret surprise 
 for your birthday.</p>
 <p>Check back on your birthday to unlock it!</p>
 <a href="${window.location.origin}/surprise/${docRefId}"
 style="display: inline-block; background: #10b981; 
 color: white; padding: 12px 24px; 
 border-radius: 12px; text-decoration: none;
 font-weight: bold; margin-top: 16px;">
 Preview My Surprise
 </a>
 <p style="color: #999; font-size: 12px; margin-top: 24px;">
 Built with RelateOS
 </p>
 </div>
 `,
 resendKey: resendKey
 })
 });
 } catch (err) {
 // log errors silently
 }
 };

 const handleCreateUnifiedRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setCreateCodeError('');

    const roomName = partyName.trim() || defaultRoomName || 'New Room';
    const rawCode = partyJoinCode.trim() || birthdayJoinCode.trim() || roomName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    if (!rawCode) {
      setCreateCodeError('Please choose a custom join code for your room');
      return;
    }

    setIsCheckingCode(true);
    const codeCheck = await checkJoinCodeAvailable(rawCode);
    setIsCheckingCode(false);

    if (!codeCheck.available) {
      setCreateCodeError(codeCheck.error || 'This code is already in use — try another');
      return;
    }

    try {
      const groupsRef = collection(db, 'rooms');
      const finalJoinCode = codeCheck.cleaned;
      const normalizedCode = codeCheck.normalized;
      
      let person_name = partyPersonName.trim() || 'Someone';
      let person_notes = '';
      let person_category = '';
      let person_birthday = '';



      if (personId) {
        const personSnap = await getDoc(doc(db, 'people', personId));
        if (personSnap.exists()) {
          const pData = personSnap.data();
          if (!partyPersonName.trim()) person_name = pData.name || 'Someone';
          person_notes = pData.notes || '';
          person_category = pData.category || '';
          person_birthday = pData.birthday || '';
        }
      }

      let roomPayload: any = {
        room_type: isPartyRoom ? 'party' : 'birthday',
        is_party: isPartyRoom,
        isPartyRoom: isPartyRoom,
        name: roomName,
        code_name: codeNameInput || '',
        person_id: personId || null,
        person_name,
        person_notes,
        person_category,
        person_birthday,
        recipient_email: recipientEmail ? recipientEmail.toLowerCase() : '',
        join_code: finalJoinCode,
        invite_code: finalJoinCode,
        normalized_join_code: normalizedCode,
        created_by: firebaseUser.uid,
        members: [firebaseUser.uid],
        admins: [firebaseUser.uid],
        mods: [],
        roles: {
          [firebaseUser.uid]: 'admin'
        },
        created_at: serverTimestamp()
      };

      if (isPartyRoom) {
        roomPayload = {
          ...roomPayload,
          party_date: partyDate || '',
          party_time: partyTime || '',
          vibe: selectedVibe || 'Fun & Hype',
          guest_count: Number(guestCount) || 0,
          notes: partyNotes || '',
          room_structure: roomStructure || 'flat',
          rsvps: {
            [firebaseUser.uid]: 'going'
          },
          attendance: {
            [firebaseUser.uid]: 'going'
          },
          requires_attendance: createRequiresAttendance,
          photo_access: 'guests_can_add',
          visibility_by_status: {
            not_going: 'none',
            undecided: 'limited',
            going: 'full'
          },
          target_amount: 0
        };
      } else {
        roomPayload = {
          ...roomPayload,
          target_amount: 500
        };
      }

      const docRef = await addDoc(groupsRef, roomPayload);

      if (recipientEmail) {
        sendBirthdayEmail(docRef.id, recipientEmail.toLowerCase());
      }

      navigate("/rooms/" + docRef.id);
    } catch (err) {
      console.error('Error creating room:', err);
      setCreateCodeError('Failed to create room. Please try again.');
    }
  };

  const handleAddIdea = async () => {
 if (!id || !newIdea.trim() || !firebaseUser) return;
 try {
 const ideasRef = collection(db, 'rooms', id, 'ideas');
 await addDoc(ideasRef, {
 title: newIdea,
 description: '',
 user_id: firebaseUser.uid,
 votes: [],
 created_at: serverTimestamp()
 });
 setNewIdea('');
 } catch (err) {
 console.error(err);
 }
 };

 const handleVote = async (ideaId: string, currentVotes: string[]) => {
 if (!id || !firebaseUser) return;
 try {
 const ideaRef = doc(db, 'rooms', id, 'ideas', ideaId);
 if (currentVotes.includes(firebaseUser.uid)) {
 await updateDoc(ideaRef, {
 votes: currentVotes.filter(uid => uid !== firebaseUser.uid)
 });
 } else {
 await updateDoc(ideaRef, {
 votes: arrayUnion(firebaseUser.uid)
 });
 }
 } catch (err) {
 console.error(err);
 }
 };

   if (!id) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-32">
        <header className="p-6 pt-[calc(1.5rem+var(--sat))] flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Create Room</h1>
          <div className="w-10" />
        </header>
        
        <div className="p-6 max-w-lg mx-auto space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <form onSubmit={handleCreateUnifiedRoom} className="space-y-6">
              <div className="p-6 bg-emerald-500 text-white rounded-3xl space-y-3 shadow-xl relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                  <Gift size={120} />
                </div>
                <Gift size={32} className="relative z-10" />
                <div className="relative z-10">
                  <h2 className="text-xl font-bold">Create a Room</h2>
                  <p className="text-sm opacity-90 leading-relaxed">
                    Set up a secret room for collecting birthday gifts and surprises, or enable Full Party Mode to manage guests, RSVPs, and event planning.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Room Name *</label>
                  <input 
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    required 
                    className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                    placeholder="e.g. Sarah's 30th Celebration" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Custom Join Code *</label>
                  <input 
                    value={partyJoinCode}
                    onChange={(e) => {
                      setPartyJoinCode(e.target.value.replace(/\s+/g, ""));
                      if (createCodeError) setCreateCodeError("");
                    }}
                    required 
                    placeholder="e.g. Sarah30" 
                    className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100 font-mono uppercase tracking-wider" 
                  />
                  <p className="text-[10px] text-zinc-500 ml-1">Friends will enter this custom code to join the room. Min 3 characters, no spaces.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Who's it for?</label>
                  <input 
                    value={partyPersonName}
                    onChange={(e) => setPartyPersonName(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                    placeholder="e.g. Sarah" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Recipient Email</label>
                  <input 
                    type="email" 
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                    placeholder="e.g. sarah@example.com" 
                  />
                  <p className="text-[10px] text-zinc-500 ml-1">Links the locker to their account for the auto-reveal on their birthday.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Secret Code Name (Optional)</label>
                  <input 
                    value={codeNameInput}
                    onChange={(e) => setCodeNameInput(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                    placeholder="e.g. Project Cupcake" 
                  />
                </div>

                {/* Full Party Checkbox */}
                <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 shadow-xs">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={isPartyRoom}
                      onChange={(e) => setIsPartyRoom(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        Make this a full party?
                      </span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                        Adds roles, guest list, RSVPs, budget, photo dumps, date polls, and Spark games.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Conditional Party Fields */}
                {isPartyRoom && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-5 pt-2 border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Party Date</label>
                        <input 
                          type="date"
                          min={new Date().toISOString().split("T")[0]}
                          value={partyDate} 
                          onChange={(e) => setPartyDate(e.target.value)}
                          className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100 text-xs" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Party Time</label>
                        <input 
                          type="time"
                          value={partyTime} 
                          onChange={(e) => setPartyTime(e.target.value)}
                          className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100 text-xs" 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Vibe</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "House Party", 
                          "Outdoor", 
                          "Gaming Night", 
                          "Casual Hangout", 
                          "Graduation", 
                          "Team Party",
                          "Birthday Bash", 
                          "Custom"
                        ].map((vibe) => (
                          <button
                            key={vibe}
                            type="button"
                            onClick={() => setSelectedVibe(vibe)}
                            className={cn(
                              "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer",
                              selectedVibe === vibe 
                                ? "bg-emerald-500 text-white border-emerald-500" 
                                : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                            )}
                          >
                            {vibe}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Estimated Guest Count</label>
                      <input 
                        type="number"
                        value={guestCount} 
                        onChange={(e) => setGuestCount(e.target.value)}
                        className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                        placeholder="How many people?" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Notes</label>
                      <textarea 
                        value={partyNotes} 
                        onChange={(e) => setPartyNotes(e.target.value)}
                        className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm text-zinc-900 dark:text-zinc-100 min-h-[80px]" 
                        placeholder="Any details, theme ideas, or special requests..." 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Room Structure</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setRoomStructure("flat")}
                          className={cn(
                            "p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer h-full",
                            roomStructure === "flat"
                              ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                              : "bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-750"
                          )}
                        >
                          <Users size={20} className={cn(roomStructure === "flat" ? "text-white" : "text-zinc-650 dark:text-zinc-400")} />
                          <div>
                            <p className="text-xs font-bold leading-tight">Everyone's Equal</p>
                            <p className={cn("text-[10px] leading-snug mt-1", roomStructure === "flat" ? "text-emerald-100" : "text-zinc-400")}>
                              Simple. Everyone can do everything.
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRoomStructure("roles")}
                          className={cn(
                            "p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer h-full",
                            roomStructure === "roles"
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-md dark:bg-zinc-800 dark:border-zinc-800"
                              : "bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-750"
                          )}
                        >
                          <Shield size={20} className={cn(roomStructure === "roles" ? "text-white" : "text-zinc-650 dark:text-zinc-400")} />
                          <div>
                            <p className="text-xs font-bold leading-tight">Roles</p>
                            <p className={cn("text-[10px] leading-snug mt-1", roomStructure === "roles" ? "text-zinc-300" : "text-zinc-400")}>
                              Admin controls who can do what.
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Guest Attendance Requirement</p>
                          <p className="text-[10px] text-zinc-400 mt-1">If enabled, guests must confirm their attendance. Content visibility will be gated by their status.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCreateRequiresAttendance(!createRequiresAttendance)}
                          className={cn(
                            "w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none flex-shrink-0 cursor-pointer",
                            createRequiresAttendance ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"
                          )}
                        >
                          <div
                            className={cn(
                              "bg-white w-4 h-4 rounded-full shadow-md transform duration-200",
                              createRequiresAttendance ? "translate-x-6" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {createCodeError && (
                <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl text-center">
                  {createCodeError}
                </p>
              )}

              <button 
                type="submit" 
                disabled={isCheckingCode}
                className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isCheckingCode ? "Checking Code..." : "Create Room"}
              </button>
            </form>
          </motion.div>
        </div>
        <Navigation />
      </div>
    );
  }



  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Loading room details...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24 flex flex-col justify-between">
        <header className="p-6 pt-[calc(1.5rem+var(--sat))] flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Room Unavailable</h1>
          <div className="w-10" />
        </header>

        <div className="p-6 max-w-md mx-auto text-center space-y-4 my-auto">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 text-zinc-400 rounded-full flex items-center justify-center mx-auto">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Access Restricted</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            You don't have access to this room or it may no longer exist.
          </p>
          <button
            onClick={() => navigate('/vaults')}
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            Back to Rooms & Vaults
          </button>
        </div>

        <Navigation />
      </div>
    );
  }

 const totalContributed = contributions?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
 const targetAmount = group?.target_amount || 500;
 const progress = Math.min((totalContributed / targetAmount) * 100, 100);

 // Check if it's the birthday
 const isBirthday = isBirthdayToday(group?.person_birthday);
 const isUnlocked = isBirthday || group?.isMember;
 const isRoomAdmin = group?.created_by === firebaseUser?.uid || group?.admins?.includes(firebaseUser?.uid) || group?.roles?.[firebaseUser?.uid] === 'admin';
  const isCrewAdminOrMod = isRoomAdmin || group?.mods?.includes(firebaseUser?.uid) || group?.roles?.[firebaseUser?.uid] === 'planner';
 const isFullParty = group?.room_type === 'party' || group?.is_party === true || group?.isPartyRoom === true;

 const userRole = group?.roles?.[firebaseUser?.uid] || (group?.created_by === firebaseUser?.uid ? 'admin' : 'guest');
 const isGuest = userRole === 'guest';
 const requiresAttendance = group?.requires_attendance || group?.attendance?.requires_attendance;
 const myRsvp = group?.rsvps?.[firebaseUser?.uid] || 'going';
 const isAttendanceGated = requiresAttendance && isGuest && myRsvp !== 'going';

  const isPhotoDumpUnlocked = React.useMemo(() => {
    if (isCrewAdminOrMod) return true;
    if (!group?.party_date) return false;
    try {
      const dateStr = group.party_date;
      let partyDateTime: Date;
      if (group.party_time) {
        partyDateTime = new Date(`${dateStr}T${group.party_time}`);
        if (isNaN(partyDateTime.getTime())) {
          partyDateTime = new Date(`${dateStr} ${group.party_time}`);
        }
      } else {
        partyDateTime = new Date(dateStr);
      }
      if (isNaN(partyDateTime.getTime())) {
        partyDateTime = new Date(dateStr);
      }
      if (isNaN(partyDateTime.getTime())) return false;
      return new Date() >= partyDateTime;
    } catch {
      return false;
    }
  }, [isCrewAdminOrMod, group?.party_date, group?.party_time]);

 // Helper action handlers
 const handleVoteTheme = async (themeId: string, currentVotes: string[] = []) => {
   if (!id || !firebaseUser) return;
   const uid = firebaseUser.uid;
   const updated = currentVotes.includes(uid)
     ? currentVotes.filter(u => u !== uid)
     : [...currentVotes, uid];
   try {
     await updateDoc(doc(db, 'rooms', id, 'themes', themeId), { votes: updated });
   } catch (e) {
     console.error("Error voting theme:", e);
   }
 };

 const handleVoteVenue = async (venueId: string, currentVotes: string[] = []) => {
   if (!id || !firebaseUser) return;
   const uid = firebaseUser.uid;
   const updated = currentVotes.includes(uid)
     ? currentVotes.filter(u => u !== uid)
     : [...currentVotes, uid];
   try {
     await updateDoc(doc(db, 'rooms', id, 'venues', venueId), { votes: updated });
   } catch (e) {
     console.error("Error voting venue:", e);
   }
 };

 const handleVoteGameIdea = async (gameId: string, currentVotes: string[] = []) => {
   if (!id || !firebaseUser) return;
   const uid = firebaseUser.uid;
   const updated = currentVotes.includes(uid)
     ? currentVotes.filter(u => u !== uid)
     : [...currentVotes, uid];
   try {
     await updateDoc(doc(db, 'rooms', id, 'game_ideas', gameId), { votes: updated });
   } catch (e) {
     console.error("Error voting game idea:", e);
   }
 };

 const handleAddCustomTheme = async () => {
   if (!id || !customThemeName.trim()) return;
   try {
     await addDoc(collection(db, 'rooms', id, 'themes'), {
       name: customThemeName.trim(),
       cost: customThemeCost.trim() || '$',
       decorations: customThemeDecorations.trim(),
       vibe: customThemeVibe.trim(),
       food: customThemeFood.trim(),
       published: false,
       created_at: serverTimestamp()
     });
     setCustomThemeName(''); setCustomThemeCost(''); setCustomThemeDecorations(''); setCustomThemeVibe(''); setCustomThemeFood('');
     setShowCustomThemeForm(false);
   } catch (err) { console.error("Error adding theme:", err); }
 };

 
  const renderGuestConsolidatedView = () => {
    const myRsvp = group?.rsvps?.[firebaseUser?.uid || ''] || 'undecided';
    const requiresAttendance = !!group?.requires_attendance;
    
    let tier: 'none' | 'limited' | 'full' = 'full';
    if (requiresAttendance) {
      const visSetting = group?.visibility_by_status || { not_going: 'none', undecided: 'limited', going: 'full' };
      if (myRsvp === 'not_going') tier = visSetting.not_going || 'none';
      else if (myRsvp === 'going') tier = visSetting.going || 'full';
      else tier = visSetting.undecided || 'limited';
    }

    const publishedThemes = partyThemes.filter((t: any) => t.published);
    const publishedVenues = partyVenues.filter((v: any) => v.published);
    const publishedGameIdeas = partyGameIdeas.filter((g: any) => g.published);
    const publishedPlaylist = playlistConcept?.published ? playlistConcept : null;
    const publishedTasks = tasks.filter((t: any) => t.published);

    const hasPublishedItems = publishedThemes.length > 0 || publishedVenues.length > 0 || publishedGameIdeas.length > 0 || !!publishedPlaylist || publishedTasks.length > 0;

    return (
      <div className="space-y-6">
        <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Calendar size={20} className="text-emerald-500" />
                {group?.name || 'Party'} Attendance RSVP
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Let the organizers know if you will be attending on {group?.date ? new Date(group.date).toLocaleDateString() : 'TBD'}.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(['going', 'maybe', 'not_going'] as const).map((status) => {
                const isActive = myRsvp === status;
                const label = status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : 'Not Going';
                return (
                  <button
                    key={status}
                    onClick={() => handleUpdateRsvp(status)}
                    className={cn(
                      "flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm",
                      isActive
                        ? status === 'going'
                          ? "bg-emerald-500 text-white"
                          : status === 'maybe'
                          ? "bg-amber-500 text-white"
                          : "bg-rose-500 text-white"
                        : "bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {tier === 'none' && (
          <div className="p-8 text-center bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-200 dark:border-zinc-700 space-y-3 shadow-sm">
            <Shield size={32} className="mx-auto text-amber-500" />
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 max-w-sm mx-auto">
              Your current RSVP status is Declined (Not Going). Update your RSVP above to access party plans and content.
            </p>
          </div>
        )}

        {(tier === 'limited' || tier === 'full') && (
          <div className="space-y-6">
            {!hasPublishedItems ? (
              <div className="p-10 text-center text-zinc-500 dark:text-zinc-400 font-extrabold text-sm bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg">
                Nothing to see yet — check back soon!
              </div>
            ) : (
              <>
                {publishedThemes.length > 0 && (
                  <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                    <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                      <Palette size={18} className="text-emerald-500" />
                      Party Theme
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {publishedThemes.map((t: any) => (
                        <div key={t.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">{t.name}</h4>
                            {t.cost && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] rounded-full border border-emerald-500/20">{t.cost}</span>}
                          </div>
                          {t.vibe && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Vibe:</strong> {t.vibe}</p>}
                          {t.decorations && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Decorations:</strong> {t.decorations}</p>}
                          {t.food && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Food & Cocktails:</strong> {t.food}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {publishedVenues.length > 0 && (
                  <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                    <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                      <MapPin size={18} className="text-emerald-500" />
                      Venue Details
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {publishedVenues.map((v: any) => (
                        <div key={v.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">{v.type}</h4>
                            {v.cost && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] rounded-full border border-emerald-500/20">{v.cost}</span>}
                          </div>
                          {v.why && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Why it fits:</strong> {v.why}</p>}
                          {v.tips && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Tips & Parking:</strong> {v.tips}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {publishedGameIdeas.length > 0 && (
                  <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                    <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                      <Sparkles size={18} className="text-emerald-500" />
                      Games & Activities
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {publishedGameIdeas.map((g: any) => (
                        <div key={g.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">{g.name}</h4>
                            {g.duration && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{g.duration}</span>}
                          </div>
                          {g.description && <p className="text-xs text-zinc-600 dark:text-zinc-300">{g.description}</p>}
                          {g.materials && <p className="text-xs text-zinc-500 dark:text-zinc-400"><strong>Materials:</strong> {g.materials}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {publishedPlaylist && (
                  <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                        <Music size={18} className="text-emerald-500" />
                        Party Playlist & Vibes
                      </h3>
                      <button
                        onClick={() => setPartyActiveTab('vibes')}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        View Full Playlist →
                      </button>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                      {publishedPlaylist.vibe && <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">✨ Vibe: {publishedPlaylist.vibe}</p>}
                      {publishedPlaylist.tracks && publishedPlaylist.tracks.length > 0 ? (
                        <div className="space-y-2 pt-1">
                          <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">Featured Songs ({publishedPlaylist.tracks.length})</p>
                          {publishedPlaylist.tracks.slice(0, 5).map((tr: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-black text-emerald-500 w-4">{idx + 1}.</span>
                                <span className="font-extrabold text-zinc-800 dark:text-zinc-200 truncate">{tr.title}</span>
                                <span className="text-zinc-400 truncate">— {tr.artist}</span>
                              </div>
                              <a
                                href={`https://open.spotify.com/search/${encodeURIComponent(tr.title + ' ' + tr.artist)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                              >
                                Spotify ↗
                              </a>
                            </div>
                          ))}
                          {publishedPlaylist.tracks.length > 5 && (
                            <p className="text-[11px] text-zinc-400 font-medium text-center pt-1">
                              + {publishedPlaylist.tracks.length - 5} more songs in full playlist
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          {publishedPlaylist.hype_tracks && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Hype Tracks:</strong> {publishedPlaylist.hype_tracks}</p>}
                          {publishedPlaylist.mid_tracks && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Mid-tempo:</strong> {publishedPlaylist.mid_tracks}</p>}
                          {publishedPlaylist.chill_tracks && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Chill:</strong> {publishedPlaylist.chill_tracks}</p>}
                        </>
                      )}
                    </div>
                  </section>
                )}

                {publishedTasks.length > 0 && (
                  <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                    <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                      <CheckSquare size={18} className="text-emerald-500" />
                      Party Checklist & Tasks
                    </h3>
                    <div className="space-y-2.5">
                      {publishedTasks.map((t: any) => {
                        const assigneeName = group?.members?.find((m: any) => m.uid === t.assignee)?.name || t.assignee;
                        return (
                          <div key={t.id} className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={!!t.completed}
                                onChange={() => handleToggleTaskCompleted(t.id, !!t.completed)}
                                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <p className={cn("text-xs font-bold transition-all", t.completed ? "line-through text-zinc-400" : "text-zinc-800 dark:text-zinc-200")}>
                                  {t.title}
                                </p>
                                {assigneeName && (
                                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                                    <User size={10} /> Assigned to: {assigneeName}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full", t.completed ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500")}>
                              {t.completed ? 'Completed' : 'To Do'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}

            {tier === 'full' && (
              <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                  <MessageSquare size={18} className="text-emerald-500" />
                  Party Chat
                </h3>
                <div className="h-64 overflow-y-auto space-y-3 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/60 dark:border-zinc-700">
                  {chatMessages.filter((m: any) => (m.channel || 'everyone') === 'everyone').length === 0 ? (
                    <p className="text-xs text-zinc-400 italic text-center p-4">No messages yet. Say hi!</p>
                  ) : (
                    chatMessages.filter((m: any) => (m.channel || 'everyone') === 'everyone').map((m: any) => (
                      <div key={m.id} className={cn("p-3 rounded-2xl text-xs max-w-[85%] space-y-1", m.user_id === firebaseUser?.uid ? "ml-auto bg-emerald-500 text-white font-medium" : "bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700")}>
                        <p className="text-[10px] opacity-75 font-bold">{m.user_name || 'Guest'}</p>
                        <p>{m.text}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Type a message to everyone..."
                    className="flex-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs outline-none focus:border-emerald-500"
                  />
                  <button onClick={() => handleSendChatMessage()} className="px-4 py-3 bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer">
                    <Send size={14} />
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleGenerateAiThemes = async () => {
   if (!id) return;
   setIsGeneratingThemes(true);
   try {
     const prompt = `Generate 3 creative, immersive party theme ideas for event "${group?.name || 'Party'}".
Party Vibe/Notes: ${group?.vibe || group?.planner_notes || 'Fun and memorable'}.
Return a JSON array of objects with keys:
- "name": String (unique theme title)
- "cost": String (e.g. "$", "$$", "$$$")
- "decorations": String (detailed multi-sentence description of lighting, props, color schemes, and setup ideas)
- "vibe": String (detailed multi-sentence description of the atmosphere, music style, and guest mood)
- "food": String (detailed multi-sentence food and cocktail menu suggestions matching the theme)

CRITICAL: Provide rich, multi-sentence descriptive content for decorations, vibe, and food. Do NOT use emojis. Output ONLY valid raw JSON array.`;
     const resText = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);
     const jsonMatch = resText.match(/\[[\s\S]*\]/);
     if (jsonMatch) {
       const items = JSON.parse(jsonMatch[0]);
       for (const item of items) {
         await addDoc(collection(db, 'rooms', id, 'themes'), {
           name: item.name || 'Party Theme',
           cost: item.cost || '$$',
           decorations: item.decorations || '',
           vibe: item.vibe || '',
           food: item.food || '',
           published: false,
           created_at: serverTimestamp()
         });
       }
     }
   } catch (err) { console.error("Error generating themes:", err); }
   finally { setIsGeneratingThemes(false); }
 };

 const handleAddCustomVenue = async () => {
   if (!id || !customVenueType.trim()) return;
   try {
     await addDoc(collection(db, 'rooms', id, 'venues'), {
       type: customVenueType.trim(),
       cost: customVenueCost.trim() || '$$',
       why: customVenueWhy.trim(),
       tips: customVenueTips.trim(),
       published: false,
       created_at: serverTimestamp()
     });
     setCustomVenueType(''); setCustomVenueCost(''); setCustomVenueWhy(''); setCustomVenueTips('');
     setShowCustomVenueForm(false);
   } catch (err) { console.error("Error adding venue:", err); }
 };

 const handleGenerateAiVenues = async () => {
   if (!id) return;
   setIsGeneratingVenues(true);
   try {
     const prompt = `Generate 3 venue ideas for event "${group?.name || 'Party'}".
Party Vibe/Notes: ${group?.vibe || group?.planner_notes || 'Fun and memorable'}.
Return a JSON array of objects with keys:
- "type": String (venue style name)
- "cost": String (e.g. "$", "$$", "$$$")
- "why": String (detailed multi-sentence explanation of why this venue fits the event, capacity, and ambiance)
- "tips": String (detailed multi-sentence practical booking tips, parking/transport notes, and setup advice)

CRITICAL: Provide rich, multi-sentence descriptive content for why and tips. Do NOT use emojis. Output ONLY valid raw JSON array.`;
     const resText = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);
     const jsonMatch = resText.match(/\[[\s\S]*\]/);
     if (jsonMatch) {
       const items = JSON.parse(jsonMatch[0]);
       for (const item of items) {
         await addDoc(collection(db, 'rooms', id, 'venues'), {
           type: item.type || 'Venue',
           cost: item.cost || '$$',
           why: item.why || '',
           tips: item.tips || '',
           published: false,
           created_at: serverTimestamp()
         });
       }
     }
   } catch (err) { console.error("Error generating venues:", err); }
   finally { setIsGeneratingVenues(false); }
 };

 const handleAddCustomGame = async () => {
   if (!id || !customGameName.trim()) return;
   try {
     await addDoc(collection(db, 'rooms', id, 'game_ideas'), {
       name: customGameName.trim(),
       description: customGameDescription.trim(),
       duration: customGameDuration.trim() || '15 mins',
       materials: customGameMaterials.trim() || 'None',
       published: false,
       created_at: serverTimestamp()
     });
     setCustomGameName(''); setCustomGameDescription(''); setCustomGameDuration(''); setCustomGameMaterials('');
     setShowCustomGameForm(false);
   } catch (err) { console.error("Error adding game idea:", err); }
 };

 const handleGenerateAiGames = async () => {
   if (!id) return;
   setIsGeneratingGameIdeas(true);
   try {
     const prompt = `Generate 3 party game or activity ideas for event "${group?.name || 'Party'}".
Party Ideas/Notes: ${group?.planner_notes || group?.vibe || 'Fun and memorable'}.
Return a JSON array of objects with keys:
- "name": String (game title)
- "description": String (brief explanation of how to play, rules, and host instructions)
- "duration": String (estimated time e.g. "15-20 mins")
- "materials": String (list of required items, props, or setup needed, or "None")

CRITICAL: Provide clear, creative game descriptions and materials needed. Do NOT use emojis. Output ONLY valid raw JSON array.`;
     const resText = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);
     const jsonMatch = resText.match(/\[[\s\S]*\]/);
     if (jsonMatch) {
       const items = JSON.parse(jsonMatch[0]);
       for (const item of items) {
         await addDoc(collection(db, 'rooms', id, 'game_ideas'), {
           name: item.name || 'Party Game',
           description: item.description || '',
           duration: item.duration || '15 mins',
           materials: item.materials || 'None',
           published: false,
           created_at: serverTimestamp()
         });
       }
     }
   } catch (err) { console.error("Error generating games:", err); }
   finally { setIsGeneratingGameIdeas(false); }
 };

 const handleSaveCustomPlaylist = async () => {
   if (!id || !customPlaylistVibe.trim()) return;
   try {
     await setDoc(doc(db, 'rooms', id, 'playlists', 'current'), {
       vibe: customPlaylistVibe.trim(),
       hype_tracks: customPlaylistHype.trim(),
       mid_tracks: customPlaylistMid.trim(),
       chill_tracks: customPlaylistChill.trim(),
       published: false,
       created_at: serverTimestamp()
     });
     setCustomPlaylistVibe(''); setCustomPlaylistHype(''); setCustomPlaylistMid(''); setCustomPlaylistChill('');
     setShowCustomPlaylistForm(false);
   } catch (err) { console.error("Error saving playlist:", err); }
 };

 const handleGenerateAiPlaylist = async () => {
    if (!id) return;
    setIsGeneratingPlaylist(true);
    try {
      const personName = group?.person_name || group?.name || 'Guest of Honor';
      const partyVibe = group?.vibe || selectedVibe || 'Upbeat Party';
      const plannerNotes = group?.planner_notes || group?.person_notes || group?.notes || '';
      
      const themesText = partyThemes?.map((t: any) => `${t.style} (${t.vibe || ''})`).join('; ') || '';
      
      const surveyText = birthdayResponses?.map((r: any) => {
        if (r.responses) {
          return Object.entries(r.responses).map(([k, v]) => `${k}: ${v}`).join(', ');
        }
        return r.answer_text || '';
      }).filter(Boolean).join(' | ') || '';

      const ideasText = ideas?.map((i: any) => i.content || i.text || i.title).filter(Boolean).join('; ') || '';

      const prompt = `You are an expert DJ and party playlist curator. Create a personalized multi-song party playlist for ${personName}'s celebration.

PARTY & PERSON DETAILS:
- Guest of Honor: ${personName}
- Party Vibe & Style: ${partyVibe}
${plannerNotes ? `- Notes & Interests: ${plannerNotes}` : ''}
${themesText ? `- Selected Party Themes: ${themesText}` : ''}
${surveyText ? `- Guest Survey Answers & Music Preferences: ${surveyText}` : ''}
${ideasText ? `- Member Ideas: ${ideasText}` : ''}

Curate 10 to 12 real, iconic songs tailored to ${personName}'s vibe across different party energy phases.
Return ONLY a valid JSON object with:
- "vibe": String (A catchy 1-sentence description of the overall playlist vibe for ${personName})
- "hype_tracks": String (1-sentence summary of high-energy openers)
- "mid_tracks": String (1-sentence summary of singalong & dance anthems)
- "chill_tracks": String (1-sentence summary of cocktail & wind-down grooves)
- "tracks": Array of 10 to 12 song objects, each containing:
    - "id": String (unique id e.g. "tr-1")
    - "title": String (exact song title)
    - "artist": String (artist name)
    - "category": String (strictly one of: "hype", "anthem", "chill", "highlight")
    - "why": String (1 concise sentence explaining why this song fits ${personName}, guest survey preferences, or the party vibe)

Output ONLY valid raw JSON object. No markdown formatting.`;

      const resText = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);
      const jsonMatch = resText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const item = JSON.parse(jsonMatch[0]);
        const formattedTracks = (item.tracks || []).map((t: any, idx: number) => ({
          id: t.id || `track-${Date.now()}-${idx}`,
          title: t.title || 'Party Song',
          artist: t.artist || 'Artist',
          category: ['hype', 'anthem', 'chill', 'highlight'].includes(t.category) ? t.category : 'anthem',
          why: t.why || `Selected for ${personName}'s party vibe`,
          added_by: 'ai',
          added_by_name: 'AI DJ Curator',
          votes: []
        }));

        await setDoc(doc(db, 'rooms', id, 'playlists', 'current'), {
          vibe: item.vibe || partyVibe || 'Party Vibes',
          hype_tracks: item.hype_tracks || '',
          mid_tracks: item.mid_tracks || '',
          chill_tracks: item.chill_tracks || '',
          tracks: formattedTracks,
          published: playlistConcept?.published ?? false,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        }, { merge: true });
      }
    } catch (err) {
      console.error("Error generating playlist:", err);
    } finally {
      setIsGeneratingPlaylist(false);
    }
  };

  const handleAddCustomTrack = async () => {
    if (!id || !newTrackTitle.trim() || !newTrackArtist.trim()) return;
    try {
      const existingTracks = playlistConcept?.tracks || [];
      const newTrack = {
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: newTrackTitle.trim(),
        artist: newTrackArtist.trim(),
        category: newTrackCategory || 'anthem',
        why: newTrackWhy.trim() || `Added by ${user?.name || 'Crew Member'}`,
        added_by: firebaseUser?.uid || 'guest',
        added_by_name: user?.name || 'Crew Member',
        votes: [firebaseUser?.uid].filter(Boolean)
      };
      const updatedTracks = [...existingTracks, newTrack];
      await setDoc(doc(db, 'rooms', id, 'playlists', 'current'), {
        vibe: playlistConcept?.vibe || group?.vibe || 'Party Vibes',
        tracks: updatedTracks,
        published: playlistConcept?.published ?? false,
        updated_at: serverTimestamp()
      }, { merge: true });

      setNewTrackTitle('');
      setNewTrackArtist('');
      setNewTrackWhy('');
      setShowAddTrackForm(false);
    } catch (err) {
      console.error("Error adding custom track:", err);
    }
  };

  const handleToggleTrackVote = async (trackId: string) => {
    if (!id || !firebaseUser || !playlistConcept?.tracks) return;
    try {
      const userId = firebaseUser.uid;
      const updatedTracks = playlistConcept.tracks.map((t: any) => {
        if (t.id === trackId || (t.title === trackId && t.artist === t.artist)) {
          const votes = Array.isArray(t.votes) ? t.votes : [];
          const hasVoted = votes.includes(userId);
          const newVotes = hasVoted ? votes.filter((v: string) => v !== userId) : [...votes, userId];
          return { ...t, votes: newVotes };
        }
        return t;
      });
      await updateDoc(doc(db, 'rooms', id, 'playlists', 'current'), {
        tracks: updatedTracks
      });
    } catch (err) {
      console.error("Error toggling track vote:", err);
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!id || !playlistConcept?.tracks) return;
    try {
      const updatedTracks = playlistConcept.tracks.filter((t: any) => t.id !== trackId && t.title !== trackId);
      await updateDoc(doc(db, 'rooms', id, 'playlists', 'current'), {
        tracks: updatedTracks
      });
    } catch (err) {
      console.error("Error removing track:", err);
    }
  };

  const handleCopyTracklist = () => {
    if (!playlistConcept?.tracks || playlistConcept.tracks.length === 0) return;
    const text = playlistConcept.tracks.map((t: any, i: number) => 
      `${i + 1}. ${t.title} - ${t.artist} [${(t.category || 'song').toUpperCase()}]${t.why ? ` - ${t.why}` : ''}`
    ).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedTracklist(true);
    setTimeout(() => setCopiedTracklist(false), 2500);
  };

 const handleProposeQuestion = async () => {
   if (!id || !newQuestionText.trim() || !firebaseUser) return;
   setIsProposingQuestion(true);
   try {
     await addDoc(collection(db, 'rooms', id, 'birthday_questions'), {
       question_text: newQuestionText.trim(),
       created_by: firebaseUser.uid,
       created_by_name: user?.name || 'Member',
       created_at: serverTimestamp()
     });
     setNewQuestionText('');
   } catch (err) { console.error("Error proposing question:", err); }
   finally { setIsProposingQuestion(false); }
 };

 const handleGenerateAiQuestions = async () => {
   if (!id) return;
   setIsGeneratingAIQuestions(true);
   try {
     const currentDepth = group?.question_depth || editQuestionDepth || 'light';
     let depthInstruction = '';
     if (currentDepth === 'light') {
       depthInstruction = `Tone/Depth: LIGHT - explicitly fun, silly, lighthearted, surface-level questions (e.g. "What's their most-used emoji?", "What's their go-to late night snack?", "What's a funny quirk they have?"). Keep it light and fun so it's not awkward for the birthday person.`;
     } else if (currentDepth === 'medium') {
       depthInstruction = `Tone/Depth: MEDIUM - a balance of fun, playful questions and slightly more personal or reflective questions (e.g. "What's their favorite memory with this group?", "What superpower best describes them?").`;
     } else if (currentDepth === 'deep') {
       depthInstruction = `Tone/Depth: DEEP - meaningful, warm, and sentimental questions (e.g. "What's a moment this person made you feel truly supported?", "What's something you deeply admire about them?"). Still tasteful, appropriate, and non-invasive.`;
     }

     const prompt = `Generate 3 Spark Game trivia questions about guest of honor "${group?.person_name || 'Friend'}".
Context & Ideas for AI: ${group?.planner_notes || group?.vibe || 'Friendly party'}.
${depthInstruction}
Return ONLY a valid JSON array of 3 string questions. Output raw JSON array only.`;

     const resText = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);
     const jsonMatch = resText.match(/\[[\s\S]*\]/);
     if (jsonMatch) {
       const questions = JSON.parse(jsonMatch[0]);
       for (const qText of questions) {
         await addDoc(collection(db, 'rooms', id, 'birthday_questions'), {
           question_text: typeof qText === 'string' ? qText : qText.question,
           created_by: firebaseUser?.uid || 'ai',
           created_by_name: 'AI Spark Assistant',
           published: false,
           created_at: serverTimestamp()
         });
       }
     }
   } catch (err) { console.error("Error generating AI questions:", err); }
   finally { setIsGeneratingAIQuestions(false); }
 };

 const handleSaveAnswer = async (questionId: string) => {
   if (!id || !firebaseUser) return;
   const answer = userAnswers[questionId];
   if (!answer?.trim()) return;
   setIsSavingAnswers(prev => ({ ...prev, [questionId]: true }));
   try {
     const respRef = doc(db, 'rooms', id, 'birthday_responses', `${questionId}_${firebaseUser.uid}`);
     await setDoc(respRef, {
       question_id: questionId,
       user_id: firebaseUser.uid,
       user_name: user?.name || 'Member',
       answer_text: answer.trim(),
       updated_at: serverTimestamp()
     });
   } catch (err) { console.error("Error saving answer:", err); }
   finally { setIsSavingAnswers(prev => ({ ...prev, [questionId]: false })); }
 };

  const handleSendTriviaToVault = async () => {
    if (!id || !firebaseUser) return;
    setIsSendingToVaults(true);
    try {
      if (sendToLockerEnabled) {
        const compiledText = birthdayQuestions.map(q => {
          const qResps = birthdayResponses.filter(r => r.question_id === q.id);
          const respStr = qResps.map(r => `${r.user_name || 'Guest'}: "${r.answer_text}"`).join(', ');
          return "Q: " + q.question_text + "\nAnswers: " + (respStr || 'No answers yet');
        }).join('\n\n');

        await addDoc(collection(db, 'rooms', id, 'surprises'), {
          type: 'spark',
          content: compiledText,
          questions: birthdayQuestions.map(q => ({ id: q.id, text: q.question_text })),
          responses: birthdayResponses.map(r => ({
            id: r.id,
            question_id: r.question_id,
            user_id: r.user_id,
            user_name: r.user_name || 'Guest',
            answer_text: r.answer_text
          })),
          guess_who: guessWhoEnabled,
          user_id: firebaseUser.uid,
          user_name: 'Spark Game Results',
          created_at: serverTimestamp()
        });
        alert("Spark Game results compiled & sent to recipient's Locker!");
      } else if (customLockerNote.trim()) {
        await addDoc(collection(db, 'rooms', id, 'surprises'), {
          type: 'note',
          content: customLockerNote.trim(),
          user_id: firebaseUser.uid,
          user_name: 'Planner Note',
          created_at: serverTimestamp()
        });
        alert("Custom note saved to recipient's Locker!");
      } else {
        alert("Spark Game settings saved!");
      }
    } catch (err) { console.error("Error compiling trivia to vault:", err); }
    finally { setIsSendingToVaults(false); }
  };

 const handleAddDatePoll = async () => {
   if (!id || !newPollDate.trim()) return;
   try {
     await addDoc(collection(db, 'rooms', id, 'date_polls'), {
       date: newPollDate.trim(),
       time: newPollTime.trim() || 'TBD',
       votes: [],
       created_at: serverTimestamp()
     });
     setNewPollDate(''); setNewPollTime(''); setShowAddDatePoll(false);
   } catch (err) { console.error("Error adding date poll:", err); }
 };

 const handleVoteDatePoll = async (datePollId: string, currentVotes: string[]) => {
   if (!id || !firebaseUser) return;
   const userUid = firebaseUser.uid;
   const hasVoted = currentVotes?.includes(userUid);
   const updatedVotes = hasVoted ? currentVotes.filter(u => u !== userUid) : [...(currentVotes || []), userUid];
   try {
     await updateDoc(doc(db, 'rooms', id, 'date_polls', datePollId), { votes: updatedVotes });
   } catch (err) { console.error("Error voting on date poll:", err); }
 };

 const handleAddCustomPoll = async () => {
   if (!id || !newPollQuestion.trim()) return;
   try {
     const validOpts = newPollOptions.filter(o => o.trim());
     await addDoc(collection(db, 'rooms', id, 'polls'), {
       question: newPollQuestion.trim(),
       options: validOpts.map(o => ({ text: o.trim(), votes: [] })),
       created_at: serverTimestamp()
     });
     setNewPollQuestion(''); setNewPollOptions(['', '']); setShowPollForm(false);
   } catch (err) { console.error("Error adding custom poll:", err); }
 };

 const handleVotePollOption = async (pollId: string, optionIndex: number, currentPoll: any) => {
   if (!id || !firebaseUser) return;
   const userUid = firebaseUser.uid;
   const newOpts = (currentPoll.options || []).map((opt: any, idx: number) => {
     let votes = opt.votes || [];
     if (idx === optionIndex) {
       votes = votes.includes(userUid) ? votes.filter((u: string) => u !== userUid) : [...votes, userUid];
     } else {
       votes = votes.filter((u: string) => u !== userUid);
     }
     return { ...opt, votes };
   });
   try {
     await updateDoc(doc(db, 'rooms', id, 'polls', pollId), { options: newOpts });
   } catch (err) { console.error("Error voting on poll option:", err); }
 };

 const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
   const file = e.target.files?.[0];
   if (!file || !id || !firebaseUser) return;
   setIsUploadingPhoto(true);
   try {
     const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dffkrlv1k';
     const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'relateos_uploads';
     const formData = new FormData();
     formData.append('file', file);
     formData.append('upload_preset', uploadPreset);
     const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
     if (!res.ok) throw new Error("Upload failed");
     const data = await res.json();
     await addDoc(collection(db, 'rooms', id, 'party_photos'), {
       photo_url: data.secure_url,
       user_id: firebaseUser.uid,
       user_name: user?.name || 'Guest',
       caption: '',
       created_at: serverTimestamp()
     });
   } catch (err) { console.error("Photo upload error:", err); }
   finally { setIsUploadingPhoto(false); }
 };

 const handleGenerateAiMemory = async () => {
   if (!id) return;
   setIsGeneratingMemory(true);
   try {
     const prompt = `Write a nostalgic, fun 2-paragraph memory recap for a party named "${group?.name || 'Party'}". Highlight how amazing the atmosphere and guest connections were. Keep it clean without emojis.`;
     const resText = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);
     const cleanText = (resText || '').replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
     setPartyMemory(cleanText);
     await updateDoc(doc(db, 'rooms', id), { memory_recap: cleanText });
   } catch (err) { console.error("Memory generation error:", err); }
   finally { setIsGeneratingMemory(false); }
 };

 const handleSaveRoomDetails = async () => {
   if (!id) return;
   setIsSavingRoomDetails(true);
   try {
     await updateDoc(doc(db, 'rooms', id), {
       name: editRoomName.trim() || group?.name,
       notes: editRoomNotes.trim()
     });
     alert("Room details saved!");
   } catch (err) { console.error("Save details error:", err); }
   finally { setIsSavingRoomDetails(false); }
 };

 const handleSavePlannerNotes = async () => {
   if (!id) return;
   setIsSavingPlannerNotes(true);
   try {
     await updateDoc(doc(db, 'rooms', id), { planner_notes: editPlannerNotes.trim() });
     alert("Planner notes saved!");
   } catch (err) { console.error("Save planner notes error:", err); }
   finally { setIsSavingPlannerNotes(false); }
 };

 const handleSavePartyDate = async () => {
   if (!id) return;
   setIsSavingPartyDate(true);
   try {
     await updateDoc(doc(db, 'rooms', id), { party_date: editPartyDate });
     alert("Party date saved!");
   } catch (err) { console.error("Save date error:", err); }
   finally { setIsSavingPartyDate(false); }
 };

 const handleSaveVisibility = async (newVis: {not_going: string, undecided: string, going: string}) => {
   if (!id) return;
   try {
     await updateDoc(doc(db, 'rooms', id), {
       visibility_by_status: newVis
     });
     setEditVisibility(newVis);
   } catch (err) { console.error("Save visibility error:", err); }
 };

 const handleSavePhotoAccess = async (newAccess: string) => {
   if (!id) return;
   try {
     await updateDoc(doc(db, 'rooms', id), {
       photo_access: newAccess
     });
     setEditPhotoAccess(newAccess);
   } catch (err) { console.error("Save photo access error:", err); }
 };

 const handleSaveQuestionDepth = async (newDepth: 'light' | 'medium' | 'deep') => {
   if (!id) return;
   try {
     await updateDoc(doc(db, 'rooms', id), {
       question_depth: newDepth
     });
     setEditQuestionDepth(newDepth);
   } catch (err) { console.error("Save question depth error:", err); }
 };

 const handleSaveLockDate = async () => {
   if (!id) return;
   setIsSavingLockDate(true);
   try {
     await updateDoc(doc(db, 'rooms', id), {
       responses_lock_date: responsesLockDate
     });
     alert("Lock date updated!");
   } catch (err) { console.error("Save lock date error:", err); }
   finally { setIsSavingLockDate(false); }
 };

 const handleSaveJoinCode = async () => {
   if (!id || !editJoinCode.trim()) return;
   const cleanCode = editJoinCode.trim().toUpperCase();
   if (cleanCode.length < 3) {
     setEditJoinCodeError("Join code must be at least 3 characters.");
     return;
   }
   setIsSavingJoinCode(true);
   setEditJoinCodeError('');
   try {
     await updateDoc(doc(db, 'rooms', id), {
       join_code: cleanCode,
       invite_code: cleanCode,
       normalized_join_code: cleanCode.toLowerCase()
     });
     setEditJoinCodeSuccess(true);
     setIsEditingJoinCode(false);
   } catch (err) {
     console.error("Save join code error:", err);
     setEditJoinCodeError("Failed to save join code.");
   } finally {
     setIsSavingJoinCode(false);
   }
 };

 const handleUpdateRsvp = async (newRsvp: 'going' | 'maybe' | 'not_going') => {
   if (!id || !firebaseUser) return;
   try {
     const roomRef = doc(db, 'rooms', id);
     await updateDoc(roomRef, {
       [`rsvps.${firebaseUser.uid}`]: newRsvp,
       [`attendance.${firebaseUser.uid}`]: newRsvp
     });
   } catch (err) {
     console.error("Error updating RSVP:", err);
   }
 };

 const handleUpdateMemberRole = async (targetUid: string, newRole: 'admin' | 'planner' | 'guest') => {
   if (!id || !firebaseUser || !isRoomAdmin) return;
   try {
     const roomRef = doc(db, 'rooms', id);
     await updateDoc(roomRef, {
       [`roles.${targetUid}`]: newRole
     });
   } catch (err) {
     console.error("Error updating member role:", err);
   }
 };

 return (
 <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
 <header className="p-4 sm:p-6 pt-[calc(1.25rem+var(--sat))] bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 relative">
  <div className="h-1.5 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-2 bg-gradient-to-r from-rose-500 via-amber-400 via-emerald-400 via-sky-400 via-indigo-500 to-purple-500 rounded-t-xl opacity-90 overflow-hidden" />
  <div className="flex items-center justify-between">
  <button onClick={() => navigate(-1)} className="p-2 -ml-2 cursor-pointer text-zinc-700 dark:text-zinc-200"><ArrowLeft size={24} /></button>
  <div className="text-center">
  <div className="flex items-center justify-center gap-1.5">
  <h1 className="font-bold text-base sm:text-lg">{group?.code_name || group?.name}</h1>
  {isFullParty && (
  <span className="px-2.5 py-0.5 bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-indigo-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded-full border border-emerald-500/30 shadow-sm">
  🎉 Full Party
  </span>
  )}
  </div>
  <p className="text-[10px] text-zinc-400 uppercase font-bold">For {group?.person_name}</p>
  </div>
  <button 
  onClick={handleLeaveRoom}
  className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/30 dark:border-rose-900/30 rounded-xl text-[10px] font-extrabold cursor-pointer transition-all shadow-sm"
  >
  <span>Leave</span>
  </button>
  </div>
  </header>

  {/* Sticky Dropdown & Tab Navigation Bar */}
  {!isGuest && (
    <div className="sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 sm:px-6 py-2.5 shadow-sm transition-all">

 {isFullParty ? (
   (() => {
     const getTabColorConfig = (tabId: string) => {
       switch (tabId) {
         case 'party_setup':
           return { active: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20', icon: 'text-purple-500 dark:text-purple-400' };
         case 'setup':
           return { active: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20', icon: 'text-emerald-500 dark:text-emerald-400' };
         case 'plan':
           return { active: 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-md shadow-amber-500/20', icon: 'text-amber-500 dark:text-amber-400' };
         case 'polls':
           return { active: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20', icon: 'text-sky-500 dark:text-sky-400' };
         case 'guests':
           return { active: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20', icon: 'text-indigo-500 dark:text-indigo-400' };
         case 'vibes':
           return { active: 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/20', icon: 'text-rose-500 dark:text-rose-400' };
         case 'photos':
           return { active: 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-md shadow-fuchsia-500/20', icon: 'text-fuchsia-500 dark:text-fuchsia-400' };
         case 'chat':
           return { active: 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20', icon: 'text-teal-500 dark:text-teal-400' };
         case 'trivia':
           return { active: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-amber-500/20', icon: 'text-amber-500 dark:text-amber-400' };
         case 'ai_assistant':
           return { active: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20', icon: 'text-cyan-500 dark:text-cyan-400' };
         case 'guest_room':
           return { active: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20', icon: 'text-emerald-500 dark:text-emerald-400' };
         case 'settings':
           return { active: 'bg-gradient-to-r from-zinc-700 to-zinc-900 text-white shadow-md shadow-zinc-500/20', icon: 'text-zinc-500 dark:text-zinc-400' };
         default:
           return { active: 'bg-emerald-500 text-white', icon: 'text-emerald-500' };
       }
     };

     const partyTabsList = isCrewAdminOrMod ? [
        { id: 'setup', label: 'Overview', icon: LayoutDashboard },
        { id: 'plan', label: 'Themes & Ideas', icon: Palette },
        { id: 'polls', label: 'Polls & Dates', icon: Vote },
        { id: 'guests', label: 'Guest List', icon: Users },
        { id: 'vibes', label: 'Playlist & Vibes', icon: Music },
        { id: 'photos', label: 'Photo Dump', icon: ImageIcon },
        { id: 'chat', label: 'Party Chat', icon: MessageSquare },
        { id: 'trivia', label: 'Spark Game', icon: Sparkles },
        { id: 'ai_assistant', label: 'Ask AI', icon: Bot },
        { id: 'settings', label: 'Party Settings', icon: Settings },
      ] : [
        { id: 'guest_room', label: 'Party Room', icon: LayoutDashboard },
        { id: 'photos', label: 'Photo Dump', icon: ImageIcon },
      ];

     const activeTabObj = partyTabsList.find(t => t.id === partyActiveTab) || partyTabsList[0];
     const activeColorCfg = getTabColorConfig(activeTabObj.id);
     const ActiveIcon = activeTabObj.icon;

     return (
       <div className="space-y-2">
         {/* Mobile dropdown selector */}
         <div className="relative">
           <button
             onClick={() => setIsTabMenuOpen(!isTabMenuOpen)}
             className="w-full flex items-center justify-between p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-extrabold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
           >
             <div className="flex items-center gap-2">
               <ActiveIcon size={16} className={activeColorCfg.icon} />
               <span>{activeTabObj.label}</span>
             </div>
             <ChevronDown size={16} className={cn("text-zinc-400 transition-transform duration-200", isTabMenuOpen && "rotate-180")} />
           </button>

           <AnimatePresence>
             {isTabMenuOpen && (
               <>
                 <div className="fixed inset-0 z-20" onClick={() => setIsTabMenuOpen(false)} />
                 <motion.div
                   initial={{ opacity: 0, y: -8, scale: 0.98 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   exit={{ opacity: 0, y: -8, scale: 0.98 }}
                   className="absolute left-0 right-0 top-full mt-2 z-30 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 dark:border-t-white/5 rounded-2xl shadow-xl overflow-hidden p-1.5 space-y-1"
                 >
                   {partyTabsList.map(tabItem => {
                     const tabCfg = getTabColorConfig(tabItem.id);
                     const isTabSel = partyActiveTab === tabItem.id;
                     return (
                       <button
                         key={tabItem.id}
                         onClick={() => {
                           setPartyActiveTab(tabItem.id as any);
                           setIsTabMenuOpen(false);
                         }}
                         className={cn(
                           "w-full flex items-center justify-between p-2.5 px-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer",
                           isTabSel
                             ? `${tabCfg.active} font-extrabold`
                             : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                         )}
                       >
                         <div className="flex items-center gap-2.5">
                           <tabItem.icon size={15} className={isTabSel ? "text-white" : tabCfg.icon} />
                           <span>{tabItem.label}</span>
                         </div>
                         {isTabSel && <Check size={14} className="text-white" />}
                       </button>
                     );
                   })}
                 </motion.div>
               </>
             )}
           </AnimatePresence>
         </div>

         
       </div>
     );
   })()
 ) : (
 <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
 {(['planning', 'vault', 'chat'] as const).map((tab) => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 className={cn(
 "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
 activeTab === tab 
 ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
 : "text-zinc-400"
 )}
 >
 {tab === 'vault' ? 'Locker' : tab === 'chat' ? 'Chat' : 'Plan'}
 </button>
 ))}
 </div>
 )}
 </div>
 )}

 <div className="p-6 space-y-8 max-w-2xl mx-auto">
 {isFullParty ? (
   <div className="space-y-8">
     {isAttendanceGated && partyActiveTab !== 'setup' && partyActiveTab !== 'settings' && partyActiveTab !== 'guests' && partyActiveTab !== 'guest_room' ? (
       <div className="p-8 bg-amber-500/10 border border-amber-500/20 rounded-3xl text-center space-y-4">
         <Shield size={40} className="mx-auto text-amber-500" />
         <h3 className="text-lg font-black text-amber-900 dark:text-amber-200">Attendance RSVP Required</h3>
         <p className="text-xs text-zinc-500 max-w-md mx-auto">
           This party has attendance gating enabled. Please RSVP "Going" under Overview & Setup to access themes, venues, polls, and party plans!
         </p>
         <div className="flex justify-center gap-2 pt-2">
           <button
             onClick={() => handleUpdateRsvp('going')}
             className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
           >
             I'm Going!
           </button>
         </div>
       </div>
     ) : (
       <>
          {partyActiveTab === 'guest_room' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              {/* 1. RSVP Hero Section */}
              <div className="p-6 bg-gradient-to-br from-emerald-600 via-teal-600 via-indigo-600 to-purple-700 text-white rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/25 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-rose-500/25 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 shadow-sm flex items-center gap-1">
                    <span>🎉</span> Full Party Mode
                  </span>
                  {group?.vibe && (
                    <span className="text-xs font-bold bg-amber-400/20 backdrop-blur-md px-3 py-1 rounded-full border border-amber-300/30 text-amber-100 flex items-center gap-1">
                      ✨ Vibe: {group.vibe}
                    </span>
                  )}
                </div>

                <div className="relative z-10">
                  <h2 className="text-2xl font-black tracking-tight drop-shadow-sm">{group?.name}</h2>
                  {group?.notes && <p className="text-xs opacity-90 mt-1 leading-relaxed">{group.notes}</p>}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-white/20 relative z-10">
                  {group?.party_date && (
                    <div>
                      <p className="text-[9px] uppercase font-bold text-emerald-200">Date & Time</p>
                      <p className="text-xs font-extrabold">{group.party_date} {group?.party_time && `@ ${group.party_time}`}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[9px] uppercase font-bold text-emerald-200">Guest Count</p>
                    <p className="text-xs font-extrabold">{group?.guest_count || (group?.members?.length || 1)} Guests</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-emerald-200">My RSVP</p>
                    <p className="text-xs font-extrabold capitalize">{group?.rsvps?.[firebaseUser?.uid] || 'Going'}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-2 relative z-10">
                  <span className="text-xs font-bold">Update My RSVP:</span>
                  <div className="flex gap-1.5">
                    {(['going', 'maybe', 'not_going'] as const).map((status) => {
                      const currentRsvp = group?.rsvps?.[firebaseUser?.uid] || 'going';
                      const isSel = currentRsvp === status;
                      const activeRsvpStyle = status === 'going' 
                        ? 'bg-emerald-400 text-emerald-950 ring-2 ring-emerald-300 shadow-lg font-black' 
                        : status === 'maybe' 
                        ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300 shadow-lg font-black' 
                        : 'bg-rose-400 text-rose-950 ring-2 ring-rose-300 shadow-lg font-black';
                      return (
                        <button
                          key={status}
                          onClick={() => handleUpdateRsvp(status)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer",
                            isSel
                              ? activeRsvpStyle
                              : "bg-white/10 hover:bg-white/20 text-white"
                          )}
                        >
                          {status === 'not_going' ? 'Not Going' : status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Birthday Countdown Block */}
              {group?.person_birthday && (
                (() => {
                  const days = getDaysUntil(group.person_birthday);
                  let text = "";
                  if (days === 0) {
                    text = `It's ${group?.person_name || 'Friend'}'s birthday TODAY!`;
                  } else if (days === 1) {
                    text = `Tomorrow is ${group?.person_name || 'Friend'}'s birthday!`;
                  } else {
                    text = `${days} days until ${group?.person_name || 'Friend'}'s birthday!`;
                  }
                  return (
                    <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 dark:from-amber-500/20 dark:via-rose-500/20 dark:to-purple-500/20 text-zinc-900 dark:text-white rounded-3xl p-6 border border-amber-500/30 shadow-sm flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles size={16} className="text-amber-500 animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Birthday Countdown</span>
                        </div>
                        <p className="text-lg font-extrabold tracking-tight">{text}</p>
                      </div>
                      <div className="p-3 bg-amber-500/20 text-amber-600 dark:text-amber-300 rounded-2xl shrink-0">
                        <PartyPopper size={26} />
                      </div>
                    </div>
                  );
                })()
              )}

              {/* 3. Party Join Code Display */}
              <div className="space-y-3">
                <div className="p-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl border border-zinc-100 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg flex justify-between items-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Party Join Code</p>
                    <p className="text-xl font-mono font-bold tracking-widest">{group?.join_code || group?.invite_code}</p>
                  </div>
                  <button className="px-4 py-2 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-100 rounded-xl text-xs font-bold cursor-pointer transition-all" onClick={() => {
                    navigator.clipboard.writeText(group?.join_code || group?.invite_code || '');
                    alert('Join Code copied!');
                  }}>Copy Code</button>
                </div>

                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/surprise/${id}`);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }} 
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 text-sm cursor-pointer"
                >
                  <Share2 size={16} />
                  {linkCopied ? "Link copied!" : "Share Party Link"}
                </button>
              </div>

              {/* 4. Gift Pool Section */}
              <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                <div>
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">
                      <DollarSign size={18} className="text-emerald-500" />
                      Gift Pool
                    </h3>
                    <span className="text-sm font-bold">${totalContributed} / ${targetAmount}</span>
                  </div>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium font-sans mt-1">
                    Track who's chipping in — this doesn't process real payments (pledge tracker only).
                  </p>
                </div>
                <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-emerald-500" 
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wide">Chip-in Logs</p>
                  {contributions && contributions.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {contributions.map((c: any, idx: number) => (
                        <span key={idx} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1.5 rounded-full flex items-center gap-1">
                          {c.user_name} contributed ${c.amount}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">No pool contributions added yet.</p>
                  )}
                </div>

                <AnimatePresence>
                  {isContributingSidebar ? (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 pt-2">
                      <div className="flex gap-2">
                        {['10', '25', '50', '100'].map(amt => (
                          <button 
                            key={amt}
                            onClick={() => setContributionAmountSidebar(amt)}
                            className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                              contributionAmountSidebar === amt ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'
                            }`}
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setIsContributingSidebar(false)} className="flex-1 py-3 text-sm font-bold text-zinc-500">Cancel</button>
                        <button onClick={handleContribute} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm">Confirm</button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      <button onClick={() => setIsContributingSidebar(true)} className="w-full py-3 bg-emerald-500/10 text-emerald-600 rounded-xl font-bold text-sm cursor-pointer">
                        Contribute to Pool
                      </button>
                      {isCrewAdminOrMod && !group?.gift_finalized && (
                        <button onClick={handleFinalizeGift} className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm shadow-amber-500/10">
                          Finalize Gift Choice 
                        </button>
                      )}
                      {group?.gift_finalized && (
                        <div className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl font-bold text-sm text-center">
                          Gift Choice Finalized 
                        </div>
                      )}
                    </div>
                  )}
                </AnimatePresence>
              </section>

              {/* 5. AI Gift Suggestions Section */}
              <section className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Sparkles size={20} className="text-amber-500" />
                    AI Gift Suggestions
                  </h2>
                  <button onClick={handleGenerateSuggestions} disabled={isGeneratingSuggestions} className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-1 cursor-pointer">
                    {isGeneratingSuggestions ? 'Analyzing...' : 'Refresh Suggestions'}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {aiSuggestions.length > 0 ? aiSuggestions.map((suggestion, i) => (
                    <motion.a key={i} href={suggestion.searchUrl} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center group hover:border-emerald-500 transition-all">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold">{suggestion.title}</h4>
                          <span className="text-xs font-bold text-emerald-500">{suggestion.price}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{suggestion.reason}</p>
                      </div>
                      <div className="p-2 text-zinc-300 group-hover:text-emerald-500 transition-colors">
                        <ExternalLink size={18} />
                      </div>
                    </motion.a>
                  )) : (
                    <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-700">
                      <p className="text-zinc-500 text-sm">Tap refresh to see AI gift ideas based on the current pool and interests.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* 6. Published Ideas/Themes/Venue/Playlist Content */}
              {hasPublishedItems && (
                <div className="space-y-6">
                  {publishedThemes.length > 0 && (
                    <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                      <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                        <Palette size={18} className="text-emerald-500" />
                        Party Theme
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {publishedThemes.map((t: any) => (
                          <div key={t.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">{t.name}</h4>
                              {t.cost && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] rounded-full border border-emerald-500/20">{t.cost}</span>}
                            </div>
                            {t.vibe && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Vibe:</strong> {t.vibe}</p>}
                            {t.decorations && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Decorations:</strong> {t.decorations}</p>}
                            {t.food && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Food & Cocktails:</strong> {t.food}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {publishedVenues.length > 0 && (
                    <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                      <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                        <MapPin size={18} className="text-emerald-500" />
                        Venue Details
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {publishedVenues.map((v: any) => (
                          <div key={v.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">{v.type}</h4>
                              {v.cost && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] rounded-full border border-emerald-500/20">{v.cost}</span>}
                            </div>
                            {v.why && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Why it fits:</strong> {v.why}</p>}
                            {v.tips && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Tips & Parking:</strong> {v.tips}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {publishedGameIdeas.length > 0 && (
                    <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                      <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                        <Sparkles size={18} className="text-emerald-500" />
                        Games & Activities
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {publishedGameIdeas.map((g: any) => (
                          <div key={g.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">{g.name}</h4>
                              {g.duration && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{g.duration}</span>}
                            </div>
                            {g.description && <p className="text-xs text-zinc-600 dark:text-zinc-300">{g.description}</p>}
                            {g.materials && <p className="text-xs text-zinc-500 dark:text-zinc-400"><strong>Materials:</strong> {g.materials}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {publishedPlaylist && (
                    <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                      <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                        <Music size={18} className="text-emerald-500" />
                        Party Playlist & Vibes
                      </h3>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                        {publishedPlaylist.vibe && <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">✨ Vibe: {publishedPlaylist.vibe}</p>}
                        {publishedPlaylist.tracks && publishedPlaylist.tracks.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            <p className="text-[11px] font-black uppercase text-zinc-400 tracking-wider">Featured Songs ({publishedPlaylist.tracks.length})</p>
                            {publishedPlaylist.tracks.map((tr: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[10px] font-black text-emerald-500 w-4">{idx + 1}.</span>
                                  <span className="font-extrabold text-zinc-800 dark:text-zinc-200 truncate">{tr.title}</span>
                                  <span className="text-zinc-400 truncate">— {tr.artist}</span>
                                </div>
                                <a
                                  href={`https://open.spotify.com/search/${encodeURIComponent(tr.title + ' ' + tr.artist)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                                >
                                  Spotify ↗
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {publishedPlaylist.hype_tracks && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Hype Tracks:</strong> {publishedPlaylist.hype_tracks}</p>}
                            {publishedPlaylist.mid_tracks && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Mid-tempo:</strong> {publishedPlaylist.mid_tracks}</p>}
                            {publishedPlaylist.chill_tracks && <p className="text-xs text-zinc-600 dark:text-zinc-300"><strong>Chill:</strong> {publishedPlaylist.chill_tracks}</p>}
                          </>
                        )}
                      </div>
                    </section>
                  )}

                  {publishedTasks.length > 0 && (
                    <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                      <h3 className="font-black text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                        <CheckSquare size={18} className="text-emerald-500" />
                        Party Checklist
                      </h3>
                      <div className="space-y-2.5">
                        {publishedTasks.map((t: any) => (
                          <div key={t.id} className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3">
                            <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">{t.title}</p>
                            {t.completed && <span className="text-[10px] font-bold text-emerald-500">Completed</span>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* 7. Polls */}
              <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Vote size={20} className="text-emerald-500" />
                  Party Polls & Date Options
                </h3>
                <div className="space-y-4">
                  {polls.map((poll: any) => (
                    <div key={poll.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl space-y-3">
                      <p className="font-extrabold text-sm">{poll.question}</p>
                      <div className="space-y-2">
                        {(poll.options || []).map((opt: any, idx: number) => {
                          const hasVoted = (opt.votes || []).includes(firebaseUser?.uid);
                          return (
                            <button
                              key={idx}
                              onClick={() => handleVotePollOption(poll.id, idx, poll)}
                              className={cn(
                                "w-full p-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer border",
                                hasVoted
                                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-300"
                                  : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200"
                              )}
                            >
                              <span>{opt.text}</span>
                              <span className="text-[10px] font-black uppercase">{(opt.votes || []).length} Votes</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-extrabold uppercase text-zinc-400">Create New Poll</p>
                  <input value={newPollQuestion} onChange={(e) => setNewPollQuestion(e.target.value)} placeholder="Poll Question..." className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none" />
                  <div className="space-y-2">
                    {newPollOptions.map((opt, i) => (
                      <input key={i} value={opt} onChange={(e) => {
                        const updated = [...newPollOptions];
                        updated[i] = e.target.value;
                        setNewPollOptions(updated);
                      }} placeholder={`Option ${i + 1}...`} className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none" />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setNewPollOptions(prev => [...prev, ''])} className="flex-1 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold">+ Option</button>
                    <button onClick={handleCreatePoll} disabled={isCreatingPoll || !newPollQuestion.trim()} className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">{isCreatingPoll ? 'Creating...' : 'Post Poll'}</button>
                  </div>
                </div>
              </section>

              {/* 8. Party Chat */}
              <section className="space-y-4">
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <MessageSquare size={20} className="text-emerald-500" />
                  Party Chat
                </h3>
                <div className="flex flex-col h-[500px] bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-xl">
                  {isPlannerOrAdmin && (
                    <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/20 p-2.5 gap-2 shrink-0">
                      <button onClick={() => setSelectedChatChannel('everyone')} className={cn("flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer font-sans", selectedChatChannel === 'everyone' ? "bg-emerald-500 text-white shadow-sm" : "bg-transparent text-zinc-400")}>
                        Everyone Chat
                      </button>
                      <button onClick={() => setSelectedChatChannel('admin_planner')} className={cn("flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer font-sans", selectedChatChannel === 'admin_planner' ? "bg-emerald-500 text-white shadow-sm" : "bg-transparent text-zinc-400")}>
                        Coordinator Chat (Admins & Planners)
                      </button>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
                    {chatMessages.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-sm py-12 text-center">
                        <MessageSquare size={32} className="mb-2 text-zinc-300" />
                        <p>{selectedChatChannel === 'admin_planner' ? "No coordinator messages yet." : "No messages here yet. Say hello to the crew!"}</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, i) => {
                        const isOwn = msg.user_id === firebaseUser?.uid;
                        return (
                          <div key={msg.id || i} className={cn("flex flex-col max-w-[80%]", isOwn ? "self-end items-end" : "self-start items-start")}>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">{msg.user_name}</span>
                            <div className={cn("p-3.5 text-sm leading-relaxed", isOwn ? "bg-zinc-800 text-white rounded-[20px] rounded-tr-sm" : "bg-zinc-100 dark:bg-zinc-800/60 dark:text-zinc-100 text-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] rounded-tl-sm")}>
                              {msg.text}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex gap-2 items-center">
                    <input value={newMessageText} onChange={(e) => setNewMessageText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendChatMessage(); } }} className="flex-1 p-3 px-4 rounded-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm outline-none" placeholder="Send message..." />
                    <button onClick={handleSendChatMessage} className="p-3 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0 w-11 h-11">
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </section>

              {/* 9. Spark Game */}
              <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <HelpCircle size={18} className="text-emerald-500" />
                      Live Spark Game Questions
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Answer questions about {group?.person_name || 'the birthday person'}. When Guess Who is enabled, {group?.person_name || 'they'} will guess who submitted each answer in their Locker!
                    </p>
                  </div>
                  {isLockDatePassed && (
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-full text-[10px] font-bold">
                      Answers Locked
                    </span>
                  )}
                </div>

                {birthdayQuestions.filter((q: any) => q.published !== false).length === 0 ? (
                  <p className="text-xs text-zinc-400 italic py-4 text-center">
                    No questions live yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {birthdayQuestions.filter((q: any) => q.published !== false).map((q: any) => {
                      const currentAnswer = userAnswers[q.id] || '';
                      const existingResp = birthdayResponses.find(r => r.question_id === q.id && r.user_id === firebaseUser?.uid);
                      return (
                        <div key={q.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100">{q.question_text}</p>
                            <span className="text-[10px] text-zinc-400 shrink-0">
                              By {q.created_by_name || 'Member'}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <input
                              value={currentAnswer}
                              disabled={isLockDatePassed}
                              onChange={(e) => setUserAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder={isLockDatePassed ? "Submissions locked" : "Write your answer here..."}
                              className="flex-1 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                            />
                            {!isLockDatePassed && (
                              <button
                                onClick={() => handleSaveAnswer(q.id)}
                                disabled={isSavingAnswers[q.id] || !currentAnswer.trim()}
                                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer disabled:opacity-50"
                              >
                                {existingResp ? 'Update' : 'Submit'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </motion.div>
          )}


         {partyActiveTab === 'setup' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
             <div className="p-6 bg-gradient-to-br from-emerald-600 via-teal-600 via-indigo-600 to-purple-700 text-white rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
               <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/25 rounded-full blur-2xl pointer-events-none" />
               <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-rose-500/25 rounded-full blur-2xl pointer-events-none" />
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" />

               <div className="flex items-center justify-between relative z-10">
                 <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 shadow-sm flex items-center gap-1">
                   <span>🎉</span> Full Party Mode
                 </span>
                 {group?.vibe && (
                   <span className="text-xs font-bold bg-amber-400/20 backdrop-blur-md px-3 py-1 rounded-full border border-amber-300/30 text-amber-100 flex items-center gap-1">
                     ✨ Vibe: {group.vibe}
                   </span>
                 )}
               </div>

               <div className="relative z-10">
                 <h2 className="text-2xl font-black tracking-tight drop-shadow-sm">{group?.name}</h2>
                 {group?.notes && <p className="text-xs opacity-90 mt-1 leading-relaxed">{group.notes}</p>}
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-white/20 relative z-10">
                 {group?.party_date && (
                   <div>
                     <p className="text-[9px] uppercase font-bold text-emerald-200">Date & Time</p>
                     <p className="text-xs font-extrabold">{group.party_date} {group?.party_time && `@ ${group.party_time}`}</p>
                   </div>
                 )}
                 <div>
                   <p className="text-[9px] uppercase font-bold text-emerald-200">Guest Count</p>
                   <p className="text-xs font-extrabold">{group?.guest_count || (group?.members?.length || 1)} Guests</p>
                 </div>
                 <div>
                   <p className="text-[9px] uppercase font-bold text-emerald-200">My RSVP</p>
                   <p className="text-xs font-extrabold capitalize">{group?.rsvps?.[firebaseUser?.uid] || 'Going'}</p>
                 </div>
               </div>

               <div className="pt-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-2 relative z-10">
                 <span className="text-xs font-bold">Update My RSVP:</span>
                 <div className="flex gap-1.5">
                   {(['going', 'maybe', 'not_going'] as const).map((status) => {
                     const currentRsvp = group?.rsvps?.[firebaseUser?.uid] || 'going';
                     const isSel = currentRsvp === status;
                     const activeRsvpStyle = status === 'going' 
                       ? 'bg-emerald-400 text-emerald-950 ring-2 ring-emerald-300 shadow-lg font-black' 
                       : status === 'maybe' 
                       ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300 shadow-lg font-black' 
                       : 'bg-rose-400 text-rose-950 ring-2 ring-rose-300 shadow-lg font-black';
                     return (
                       <button
                         key={status}
                         onClick={() => handleUpdateRsvp(status)}
                         className={cn(
                           "px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer",
                           isSel
                             ? activeRsvpStyle
                             : "bg-white/10 hover:bg-white/20 text-white"
                         )}
                       >
                         {status === 'not_going' ? 'Not Going' : status}
                       </button>
                     );
                   })}
                 </div>
               </div>
             </div>

             {group?.person_birthday && (
               (() => {
                 const days = getDaysUntil(group.person_birthday);
                 let text = "";
                 if (days === 0) {
                   text = `It's ${group?.person_name || 'Friend'}'s birthday TODAY!`;
                 } else if (days === 1) {
                   text = `Tomorrow is ${group?.person_name || 'Friend'}'s birthday!`;
                 } else {
                   text = `${days} days until ${group?.person_name || 'Friend'}'s birthday!`;
                 }
                 return (
                   <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 dark:from-amber-500/20 dark:via-rose-500/20 dark:to-purple-500/20 text-zinc-900 dark:text-white rounded-3xl p-6 border border-amber-500/30 shadow-sm flex items-center justify-between gap-4">
                     <div>
                       <div className="flex items-center gap-2 mb-1">
                         <Sparkles size={16} className="text-amber-500 animate-pulse" />
                         <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Birthday Countdown</span>
                       </div>
                       <p className="text-lg font-extrabold tracking-tight">{text}</p>
                     </div>
                     <div className="p-3 bg-amber-500/20 text-amber-600 dark:text-amber-300 rounded-2xl shrink-0">
                       <PartyPopper size={26} />
                     </div>
                   </div>
                 );
               })()
             )}

             {isCrewAdminOrMod && (
               <section className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-[32px] flex items-center justify-between gap-4 animate-fade-in">
                 <div className="space-y-1">
                   <h3 className="font-extrabold text-sm tracking-tight text-amber-850 dark:text-amber-300">Host Controls</h3>
                   <p className="text-xs text-zinc-500 dark:text-zinc-400">Send an urgent home screen ping to everyone in the party planning room.</p>
                 </div>
                 <button
                   onClick={() => {
                     setAdminTypedMessage('');
                     setShowNotifyCrewModal(true);
                   }}
                   className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 flex-shrink-0 cursor-pointer"
                 >
                   Notify Crew
                 </button>
               </section>
             )}

             <div className="space-y-3">
               <div className="p-4 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl border border-zinc-100 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg flex justify-between items-center">
                 <div>
                   <p className="text-[10px] uppercase font-bold text-zinc-400">Party Join Code</p>
                   <p className="text-xl font-mono font-bold tracking-widest">{group?.join_code || group?.invite_code}</p>
                 </div>
                 <button className="px-4 py-2 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-100 rounded-xl text-xs font-bold cursor-pointer transition-all" onClick={() => {
                   navigator.clipboard.writeText(group?.join_code || group?.invite_code || '');
                   alert('Join Code copied!');
                 }}>Copy Code</button>
               </div>

               <button 
                 onClick={() => {
                   navigator.clipboard.writeText(`${window.location.origin}/surprise/${id}`);
                   setLinkCopied(true);
                   setTimeout(() => setLinkCopied(false), 2000);
                 }} 
                 className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 text-sm cursor-pointer"
               >
                 <Share2 size={16} />
                 {linkCopied ? "Link copied!" : "Share Party Link"}
               </button>
             </div>

             <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
               <div>
                 <div className="flex justify-between items-center">
                   <h3 className="font-bold flex items-center gap-2">
                     <DollarSign size={18} className="text-emerald-500" />
                     Gift Pool
                   </h3>
                   <span className="text-sm font-bold">${totalContributed} / ${targetAmount}</span>
                 </div>
                 <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium font-sans mt-1">
                   Track who's chipping in — this doesn't process real payments (pledge tracker only).
                 </p>
               </div>
               <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${progress}%` }}
                   className="h-full bg-emerald-500" 
                 />
               </div>

               <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                 <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wide">Chip-in Logs</p>
                 {contributions && contributions.length > 0 ? (
                   <div className="flex flex-wrap gap-2 pt-1">
                     {contributions.map((c: any, idx: number) => (
                       <span key={idx} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1.5 rounded-full flex items-center gap-1">
                         {c.user_name} contributed ${c.amount}
                       </span>
                     ))}
                   </div>
                 ) : (
                   <p className="text-xs text-zinc-400 italic">No pool contributions added yet.</p>
                 )}
               </div>

               <AnimatePresence>
                 {isContributingSidebar ? (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 pt-2">
                     <div className="flex gap-2">
                       {['10', '25', '50', '100'].map(amt => (
                         <button 
                           key={amt}
                           onClick={() => setContributionAmountSidebar(amt)}
                           className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                             contributionAmountSidebar === amt ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'
                           }`}
                         >
                           ${amt}
                         </button>
                       ))}
                     </div>
                     <div className="flex gap-2">
                       <button onClick={() => setIsContributingSidebar(false)} className="flex-1 py-3 text-sm font-bold text-zinc-500">Cancel</button>
                       <button onClick={handleContribute} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm">Confirm</button>
                     </div>
                   </motion.div>
                 ) : (
                   <div className="space-y-2">
                     <button onClick={() => setIsContributingSidebar(true)} className="w-full py-3 bg-emerald-500/10 text-emerald-600 rounded-xl font-bold text-sm cursor-pointer">
                       Contribute to Pool
                     </button>
                     {isCrewAdminOrMod && !group?.gift_finalized && (
                       <button onClick={handleFinalizeGift} className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm shadow-amber-500/10">
                         Finalize Gift Choice 
                       </button>
                     )}
                     {group?.gift_finalized && (
                       <div className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl font-bold text-sm text-center">
                         Gift Choice Finalized 
                       </div>
                     )}
                   </div>
                 )}
               </AnimatePresence>
             </section>

             {/* Guest Private Ideas for the AI section */}
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-3">
               <div className="flex items-center justify-between">
                 <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                   <Sparkles size={16} className="text-amber-500" />
                   Ideas for the AI
                 </h3>
               </div>
               <p className="text-xs text-zinc-500 leading-relaxed">
                 Tell the AI something about the birthday person — only you can see what you write here.
               </p>
               <textarea
                 value={guestNoteText}
                 onChange={(e) => setGuestNoteText(e.target.value)}
                 rows={3}
                 placeholder="Write a note, interest, or trait for the AI..."
                 className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none text-zinc-900 dark:text-zinc-100"
               />
               <div className="flex items-center gap-3">
                 <button
                   onClick={handleSaveGuestAiNote}
                   disabled={isSavingGuestNote}
                   className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all disabled:opacity-50"
                 >
                   {isSavingGuestNote ? 'Saving...' : 'Save Notes'}
                 </button>
                 {guestNoteSavedSuccess && (
                   <span className="text-xs font-bold text-emerald-500">Saved!</span>
                 )}
               </div>
             </section>

             <section className="space-y-4">
               <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold flex items-center gap-2">
                   <Sparkles size={20} className="text-amber-500" />
                   AI Gift Suggestions
                 </h2>
                 <button onClick={handleGenerateSuggestions} disabled={isGeneratingSuggestions} className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-1 cursor-pointer">
                   {isGeneratingSuggestions ? 'Analyzing...' : 'Refresh Suggestions'}
                 </button>
               </div>
               <div className="grid grid-cols-1 gap-4">
                 {aiSuggestions.length > 0 ? aiSuggestions.map((suggestion, i) => (
                   <motion.a key={i} href={suggestion.searchUrl} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center group hover:border-emerald-500 transition-all">
                     <div className="flex-1">
                       <div className="flex items-center gap-2">
                         <h4 className="font-bold">{suggestion.title}</h4>
                         <span className="text-xs font-bold text-emerald-500">{suggestion.price}</span>
                       </div>
                       <p className="text-xs text-zinc-500 mt-1">{suggestion.reason}</p>
                     </div>
                     <div className="p-2 text-zinc-300 group-hover:text-emerald-500 transition-colors">
                       <ExternalLink size={18} />
                     </div>
                   </motion.a>
                 )) : (
                   <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-700">
                     <p className="text-zinc-500 text-sm">Tap refresh to see AI gift ideas based on the current pool and interests.</p>
                   </div>
                 )}
               </div>
             </section>

             <section className="space-y-4">
               <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold flex items-center gap-2">
                   <Vote size={20} className="text-zinc-400" />
                   Idea Board
                 </h2>
               </div>
               <div className="space-y-4">
                 {ideas?.map((idea: any) => (
                   <motion.div key={idea.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-start">
                     <div>
                       <h4 className="font-bold">{idea.title}</h4>
                       <p className="text-sm text-zinc-500">{idea.description}</p>
                     </div>
                     <button onClick={() => handleVote(idea.id, idea.votes || [])} className="flex flex-col items-center p-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl min-w-[44px] cursor-pointer">
                       <ChevronUp size={20} className={cn((idea.votes || []).includes(firebaseUser?.uid) && "text-emerald-500")} />
                       <span className="text-xs font-bold">{(idea.votes || []).length}</span>
                     </button>
                   </motion.div>
                 ))}
               </div>
               <div className="flex gap-2">
                 <input value={newIdea || ''} onChange={(e) => setNewIdea(e.target.value)} className="flex-1 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm" placeholder="Suggest something..." />
                 <button onClick={handleAddIdea} className="p-4 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-2xl cursor-pointer">
                   <Plus size={24} />
                 </button>
               </div>
             </section>
           </motion.div>
         )}

         {partyActiveTab === 'plan' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
             <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
               <div className="flex items-center justify-between">
                 <h3 className="font-extrabold text-base flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
                   <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 rounded-xl border border-amber-500/20 shadow-sm">
                     <Palette size={18} />
                   </div>
                   Party Themes & Aesthetics
                 </h3>
                 <button onClick={handleGenerateAiThemes} disabled={isGeneratingThemes} className="text-xs font-bold text-amber-500 uppercase flex items-center gap-1 cursor-pointer hover:text-amber-400 transition-colors bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                   {isGeneratingThemes ? 'Generating...' : '✨ AI Generate'}
                 </button>
               </div>
               <div className="grid grid-cols-1 gap-3">
                 {partyThemes.map((t: any) => (
                   <div key={t.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/60 dark:border-zinc-700 space-y-2">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">{t.name}</h4>
                         {t.cost && <span className="text-xs font-bold text-emerald-500">{t.cost}</span>}
                       </div>
                       <button onClick={() => handleVoteTheme(t.id, t.votes || [])} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/20 transition-all cursor-pointer">
                         {(t.votes || []).includes(firebaseUser?.uid) ? 'Voted' : 'Vote'} ({(t.votes || []).length})
                       </button>
                     </div>
                     {t.vibe && <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed"><strong className="text-zinc-700 dark:text-zinc-200">Vibe:</strong> {t.vibe}</p>}
                     {t.decorations && <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed"><strong className="text-zinc-700 dark:text-zinc-200">Decor:</strong> {t.decorations}</p>}
                     {t.food && <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed"><strong className="text-zinc-700 dark:text-zinc-200">Menu & Drinks:</strong> {t.food}</p>}
                   </div>
                 ))}
                 {partyThemes.length === 0 && (
                   <p className="text-xs text-zinc-400 italic text-center py-4">No party themes proposed yet. Tap AI Generate or add your custom theme below!</p>
                 )}
               </div>

               {showCustomThemeForm ? (
                 <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-700">
                   <input value={customThemeName} onChange={(e) => setCustomThemeName(e.target.value)} placeholder="Theme Name..." className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none" />
                   <input value={customThemeVibe} onChange={(e) => setCustomThemeVibe(e.target.value)} placeholder="Atmosphere & Vibe..." className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none" />
                   <input value={customThemeDecorations} onChange={(e) => setCustomThemeDecorations(e.target.value)} placeholder="Decorations & Props..." className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none" />
                   <div className="flex gap-2">
                     <button onClick={() => setShowCustomThemeForm(false)} className="px-4 py-2.5 text-xs font-bold text-zinc-500 cursor-pointer">Cancel</button>
                     <button onClick={handleAddCustomTheme} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all">Add Theme</button>
                   </div>
                 </div>
               ) : (
                 <button onClick={() => setShowCustomThemeForm(true)} className="w-full py-2.5 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer">
                   + Add Custom Theme
                 </button>
               )}
             </section>

             <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
               <div className="flex items-center justify-between">
                 <h3 className="font-extrabold text-base flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
                   <div className="p-2 bg-sky-500/10 dark:bg-sky-500/20 text-sky-500 rounded-xl border border-sky-500/20 shadow-sm">
                     <Eye size={18} />
                   </div>
                   Venues & Locations
                 </h3>
                 <button onClick={handleGenerateAiVenues} disabled={isGeneratingVenues} className="text-xs font-bold text-sky-500 uppercase flex items-center gap-1 cursor-pointer hover:text-sky-400 transition-colors bg-sky-500/10 px-3 py-1.5 rounded-xl border border-sky-500/20">
                   {isGeneratingVenues ? 'Analyzing...' : '✨ AI Generate'}
                 </button>
               </div>
               <div className="grid grid-cols-1 gap-3">
                 {partyVenues.map((v: any) => (
                   <div key={v.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/60 dark:border-zinc-700 space-y-2">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">{v.type || v.name}</h4>
                         {v.cost && <span className="text-xs font-bold text-emerald-500">{v.cost}</span>}
                       </div>
                       <button onClick={() => handleVoteVenue(v.id, v.votes || [])} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/20 transition-all cursor-pointer">
                         {(v.votes || []).includes(firebaseUser?.uid) ? 'Voted' : 'Vote'} ({(v.votes || []).length})
                       </button>
                     </div>
                     {v.why && <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed"><strong className="text-zinc-700 dark:text-zinc-200">Why it fits:</strong> {v.why}</p>}
                     {v.tips && <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed"><strong className="text-zinc-700 dark:text-zinc-200">Tips:</strong> {v.tips}</p>}
                   </div>
                 ))}
                 {partyVenues.length === 0 && (
                   <p className="text-xs text-zinc-400 italic text-center py-4">No venues proposed yet. Tap AI Generate or add your venue idea below!</p>
                 )}
               </div>

               {showCustomVenueForm ? (
                 <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-700">
                   <input value={customVenueType} onChange={(e) => setCustomVenueType(e.target.value)} placeholder="Venue Style / Name..." className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none" />
                   <input value={customVenueWhy} onChange={(e) => setCustomVenueWhy(e.target.value)} placeholder="Why it fits this event..." className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none" />
                   <input value={customVenueTips} onChange={(e) => setCustomVenueTips(e.target.value)} placeholder="Booking tips / logistics..." className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none" />
                   <div className="flex gap-2">
                     <button onClick={() => setShowCustomVenueForm(false)} className="px-4 py-2.5 text-xs font-bold text-zinc-500 cursor-pointer">Cancel</button>
                     <button onClick={handleAddCustomVenue} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all">Add Venue</button>
                   </div>
                 </div>
               ) : (
                 <button onClick={() => setShowCustomVenueForm(true)} className="w-full py-2.5 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer">
                   + Add Custom Venue
                 </button>
               )}
             </section>

             <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
               <div className="flex items-center justify-between">
                 <h3 className="font-extrabold text-base flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
                   <div className="p-2 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 rounded-xl border border-indigo-500/20 shadow-sm">
                     <Gamepad2 size={18} />
                   </div>
                   Game Ideas & Proposals
                 </h3>
                 <button onClick={handleGenerateAiGames} disabled={isGeneratingGameIdeas} className="text-xs font-bold text-indigo-500 uppercase flex items-center gap-1 cursor-pointer hover:text-indigo-400 transition-colors bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20">
                   {isGeneratingGameIdeas ? 'Generating...' : '✨ AI Generate'}
                 </button>
               </div>
               <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-2">
                 Propose party games or generate AI suggestions using your AI Ideas context.
               </p>
               <div className="grid grid-cols-1 gap-3">
                 {partyGameIdeas.map((g: any) => (
                   <div key={g.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/60 dark:border-zinc-700 space-y-2">
                     <div className="flex items-center justify-between gap-2">
                       <div className="flex items-center gap-2 min-w-0">
                         <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 truncate">{g.name || g.title}</h4>
                         {g.duration && <span className="text-xs font-bold text-emerald-500 shrink-0">{g.duration}</span>}
                       </div>
                       <div className="flex items-center gap-2 shrink-0">
                         {isCrewAdminOrMod && (
                           <button
                             onClick={() => handleToggleGameIdeaPublish(g.id, !!g.published)}
                             className={cn(
                               "px-2.5 py-1 rounded-xl text-[10px] font-extrabold border transition-all cursor-pointer",
                               g.published
                                 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                 : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                             )}
                           >
                             {g.published ? 'Published' : 'Publish'}
                           </button>
                         )}
                         <button onClick={() => handleVoteGameIdea(g.id, g.votes || [])} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/20 transition-all cursor-pointer">
                           {(g.votes || []).includes(firebaseUser?.uid) ? 'Voted' : 'Vote'} ({(g.votes || []).length})
                         </button>
                       </div>
                     </div>
                     {g.description && <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed"><strong className="text-zinc-700 dark:text-zinc-200">Rules & Setup:</strong> {g.description}</p>}
                     {g.materials && <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed"><strong className="text-zinc-700 dark:text-zinc-200">Materials:</strong> {g.materials}</p>}
                   </div>
                 ))}
                 {partyGameIdeas.length === 0 && (
                   <p className="text-xs text-zinc-400 italic text-center py-4">No game proposals added yet. Tap AI Generate or propose a game below!</p>
                 )}
               </div>

               {showCustomGameForm ? (
                 <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-700">
                   <input value={customGameName} onChange={(e) => setCustomGameName(e.target.value)} placeholder="Game Title..." className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none" />
                   <input value={customGameDuration} onChange={(e) => setCustomGameDuration(e.target.value)} placeholder="Estimated Time / Duration (e.g. 15-20 mins)..." className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none" />
                   <textarea value={customGameDescription} onChange={(e) => setCustomGameDescription(e.target.value)} rows={2} placeholder="Rules and instructions..." className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none" />
                   <input value={customGameMaterials} onChange={(e) => setCustomGameMaterials(e.target.value)} placeholder="Required materials / props..." className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 outline-none" />
                   <div className="flex gap-2">
                     <button onClick={() => setShowCustomGameForm(false)} className="px-4 py-2.5 text-xs font-bold text-zinc-500 cursor-pointer">Cancel</button>
                     <button onClick={handleAddCustomGame} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all">Add Game</button>
                   </div>
                 </div>
               ) : (
                 <button onClick={() => setShowCustomGameForm(true)} className="w-full py-2.5 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer">
                   + Propose Party Game
                 </button>
               )}
             </section>
           </motion.div>
         )}

         {partyActiveTab === 'polls' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <h3 className="font-extrabold text-base flex items-center gap-2">
                 <Vote size={20} className="text-emerald-500" />
                 Party Polls & Date Options
               </h3>
               <div className="space-y-4">
                 {polls.map((poll: any) => (
                   <div key={poll.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl space-y-3">
                     <p className="font-extrabold text-sm">{poll.question}</p>
                     <div className="space-y-2">
                       {(poll.options || []).map((opt: any, idx: number) => {
                         const hasVoted = (opt.votes || []).includes(firebaseUser?.uid);
                         return (
                           <button
                             key={idx}
                             onClick={() => handleVotePollOption(poll.id, idx, poll)}
                             className={cn(
                               "w-full p-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer border",
                               hasVoted
                                 ? "bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-300"
                                 : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200"
                             )}
                           >
                             <span>{opt.text}</span>
                             <span className="text-[10px] font-black uppercase">{(opt.votes || []).length} Votes</span>
                           </button>
                         );
                       })}
                     </div>
                   </div>
                 ))}
               </div>

               <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                 <p className="text-xs font-extrabold uppercase text-zinc-400">Create New Poll</p>
                 <input value={newPollQuestion} onChange={(e) => setNewPollQuestion(e.target.value)} placeholder="Poll Question..." className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none" />
                 <div className="space-y-2">
                   {newPollOptions.map((opt, i) => (
                     <input key={i} value={opt} onChange={(e) => {
                       const updated = [...newPollOptions];
                       updated[i] = e.target.value;
                       setNewPollOptions(updated);
                     }} placeholder={`Option ${i + 1}...`} className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none" />
                   ))}
                 </div>
                 <div className="flex gap-2">
                   <button onClick={() => setNewPollOptions([...newPollOptions, ''])} className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 text-xs font-bold rounded-xl cursor-pointer">Add Option</button>
                   <button onClick={handleAddCustomPoll} className="flex-1 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer">Create Poll</button>
                 </div>
               </div>
             </section>
           </motion.div>
         )}

         {partyActiveTab === 'guests' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
             <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <div className="flex justify-between items-center">
                 <div>
                   <h3 className="font-extrabold text-base flex items-center gap-2">
                     <Users size={20} className="text-emerald-500" />
                     Guest List & Roles
                   </h3>
                   <p className="text-xs text-zinc-500 mt-0.5">
                     Total Members: {group?.members?.length || 0}
                   </p>
                 </div>
                 <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black rounded-full">
                   {Object.values(group?.rsvps || {}).filter(v => v === 'going').length} Going
                 </span>
               </div>

               <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                 <span> 10 Core Planners (Admins/Planners)</span>
                 <span> 30 General Guests</span>
               </div>

               <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                 {(group?.members || []).map((memberUid: string) => {
                   const memberName = memberNames[memberUid] || (memberUid === firebaseUser?.uid ? (user?.name || 'You') : 'Member');
                   const role = group?.roles?.[memberUid] || (group?.created_by === memberUid ? 'admin' : 'guest');
                   const rsvp = group?.rsvps?.[memberUid] || 'going';

                   return (
                     <div key={memberUid} className="py-3.5 flex items-center justify-between gap-3">
                       <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm">
                           {memberName.charAt(0).toUpperCase()}
                         </div>
                         <div>
                           <p className="text-sm font-bold flex items-center gap-2">
                             {memberName}
                             {memberUid === firebaseUser?.uid && <span className="text-[10px] text-zinc-400 font-normal">(You)</span>}
                           </p>
                           <p className="text-[10px] text-zinc-400 uppercase font-semibold">
                             RSVP: <span className="text-emerald-600 dark:text-emerald-400 font-bold capitalize">{rsvp}</span>
                           </p>
                         </div>
                       </div>

                       <div className="flex items-center gap-2">
                         {isRoomAdmin ? (
                           <select
                             value={role}
                             onChange={(e) => handleUpdateMemberRole(memberUid, e.target.value as any)}
                             className="p-1.5 px-2 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 outline-none text-zinc-900 dark:text-zinc-100"
                           >
                             <option value="admin">Admin</option>
                             <option value="planner">Planner</option>
                             <option value="guest">Guest</option>
                           </select>
                         ) : (
                           <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold rounded-lg uppercase">
                             {role}
                           </span>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           </motion.div>
         )}

         {partyActiveTab === 'vibes' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              {/* Header Banner */}
              <section className="bg-gradient-to-br from-emerald-600 via-teal-600 to-indigo-700 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-5 relative overflow-hidden">
                <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                  <Disc size={220} className="animate-spin-slow" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-emerald-100 text-xs font-bold uppercase tracking-wider">
                      <Music size={14} />
                      AI Music & Playlist Generator
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                      Party Playlist & Vibes
                    </h3>
                    <p className="text-xs text-emerald-100 max-w-xl leading-relaxed">
                      Powered by guest survey responses, themes, and {group?.person_name || 'the birthday person'}'s unique taste to curate the ultimate party soundtrack!
                    </p>
                  </div>

                  {isCrewAdminOrMod && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={handleGenerateAiPlaylist}
                        disabled={isGeneratingPlaylist}
                        className="px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 font-black text-xs rounded-2xl flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
                      >
                        <Sparkles size={16} className="text-amber-500 animate-pulse" />
                        {isGeneratingPlaylist ? 'Curating Jams...' : '✨ Build AI Playlist'}
                      </button>
                      <button
                        onClick={() => setShowAddTrackForm(!showAddTrackForm)}
                        className="px-3.5 py-2.5 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 backdrop-blur-md cursor-pointer transition-all"
                      >
                        <Plus size={16} />
                        Add Song
                      </button>
                      {playlistConcept && (
                        <button
                          onClick={() => handleTogglePlaylistPublish(playlistConcept?.published || false)}
                          className={cn(
                            "px-3.5 py-2.5 font-black text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer transition-all shadow-sm",
                            playlistConcept?.published 
                              ? "bg-amber-400 text-zinc-950 hover:bg-amber-300" 
                              : "bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                          )}
                        >
                          {playlistConcept?.published ? 'Unpublish Draft' : 'Publish to Guests'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Published / Draft Status Pill */}
                {playlistConcept && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100 pt-2 border-t border-white/10">
                    <span className={cn("w-2 h-2 rounded-full", playlistConcept.published ? "bg-emerald-300 animate-ping" : "bg-amber-300")} />
                    <span>{playlistConcept.published ? "LIVE: Published to all party guests" : "DRAFT: Visible to planners (tap 'Publish to Guests' when ready)"}</span>
                  </div>
                )}
              </section>

              {/* Add Custom Track Form Modal/Inline */}
              {showAddTrackForm && (
                <motion.section initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-emerald-500/30 shadow-lg space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <h4 className="font-extrabold text-sm flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                      <Plus size={18} className="text-emerald-500" />
                      Add Custom Track to Party Playlist
                    </h4>
                    <button onClick={() => setShowAddTrackForm(false)} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-zinc-500 uppercase">Song Title</label>
                      <input value={newTrackTitle} onChange={(e) => setNewTrackTitle(e.target.value)} placeholder="e.g. September" className="w-full mt-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none focus:ring-2 ring-emerald-500" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-zinc-500 uppercase">Artist Name</label>
                      <input value={newTrackArtist} onChange={(e) => setNewTrackArtist(e.target.value)} placeholder="e.g. Earth, Wind & Fire" className="w-full mt-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none focus:ring-2 ring-emerald-500" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-zinc-500 uppercase">Energy Category</label>
                      <select value={newTrackCategory} onChange={(e) => setNewTrackCategory(e.target.value as any)} className="w-full mt-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none focus:ring-2 ring-emerald-500">
                        <option value="hype">⚡ Hype & Openers</option>
                        <option value="anthem">🎶 Dance Anthems & Singalongs</option>
                        <option value="chill">🍸 Chill & Cocktail Grooves</option>
                        <option value="highlight">🎂 Birthday Spotlight Special</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-zinc-500 uppercase">Why this track fits?</label>
                      <input value={newTrackWhy} onChange={(e) => setNewTrackWhy(e.target.value)} placeholder={`e.g. ${group?.person_name || 'Friend'}'s favorite song!`} className="w-full mt-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none focus:ring-2 ring-emerald-500" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setShowAddTrackForm(false)} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-xs rounded-xl cursor-pointer">Cancel</button>
                    <button onClick={handleAddCustomTrack} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm">Save Song</button>
                  </div>
                </motion.section>
              )}

              {/* Playlist Concept Info & Categories */}
              {playlistConcept && (
                <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-6">
                  {/* Overall Vibe Box */}
                  <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 rounded-2xl border border-emerald-500/20 space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Curated Party Vibe</span>
                        <h4 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 mt-0.5">{playlistConcept.vibe || "Party Jams"}</h4>
                      </div>
                      <button
                        onClick={handleCopyTracklist}
                        className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
                      >
                        {copiedTracklist ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        {copiedTracklist ? "Copied Tracklist!" : "Copy Tracklist"}
                      </button>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  {playlistConcept.tracks && playlistConcept.tracks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                      {[
                        { id: 'all', label: 'All Songs', count: playlistConcept.tracks.length },
                        { id: 'hype', label: '⚡ Hype & Openers', count: playlistConcept.tracks.filter((t) => t.category === 'hype').length },
                        { id: 'anthem', label: '🎶 Anthems', count: playlistConcept.tracks.filter((t) => t.category === 'anthem').length },
                        { id: 'chill', label: '🍸 Chill', count: playlistConcept.tracks.filter((t) => t.category === 'chill').length },
                        { id: 'highlight', label: '🎂 Spotlight', count: playlistConcept.tracks.filter((t) => t.category === 'highlight').length }
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setPlaylistCategoryFilter(cat.id as any)}
                          className={cn(
                            "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                            playlistCategoryFilter === cat.id
                              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                          )}
                        >
                          <span>{cat.label}</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/20">{cat.count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tracks Grid / List */}
                  {playlistConcept.tracks && playlistConcept.tracks.length > 0 ? (
                    <div className="space-y-3">
                      {playlistConcept.tracks
                        .filter((t) => playlistCategoryFilter === 'all' || t.category === playlistCategoryFilter)
                        .map((track, index) => {
                          const votes = Array.isArray(track.votes) ? track.votes : [];
                          const hasVoted = firebaseUser ? votes.includes(firebaseUser.uid) : false;
                          
                          let categoryBadgeClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                          let categoryLabel = "Anthem";
                          if (track.category === 'hype') {
                            categoryBadgeClass = "bg-amber-500/10 text-amber-600 border-amber-500/20";
                            categoryLabel = "⚡ Hype";
                          } else if (track.category === 'chill') {
                            categoryBadgeClass = "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
                            categoryLabel = "🍸 Chill";
                          } else if (track.category === 'highlight') {
                            categoryBadgeClass = "bg-rose-500/10 text-rose-600 border-rose-500/20";
                            categoryLabel = "🎂 Spotlight";
                          }

                          const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(track.title + ' ' + track.artist)}`;
                          const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(track.title + ' ' + track.artist)}`;

                          return (
                            <div
                              key={track.id || index}
                              className="p-4 bg-zinc-50/80 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/40 transition-all group"
                            >
                              <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-zinc-900 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 shadow-sm border border-zinc-800">
                                  {index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 truncate">{track.title}</h5>
                                    <span className={cn("px-2 py-0.5 text-[10px] font-black rounded-full border uppercase tracking-wider", categoryBadgeClass)}>
                                      {categoryLabel}
                                    </span>
                                  </div>
                                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate">{track.artist}</p>
                                  {track.why && (
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium italic mt-1 line-clamp-2">
                                      ✨ {track.why}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                {/* Upvote */}
                                <button
                                  onClick={() => handleToggleTrackVote(track.id || track.title)}
                                  className={cn(
                                    "px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer",
                                    hasVoted
                                      ? "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
                                      : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400"
                                  )}
                                  title="Upvote song"
                                >
                                  <Heart size={14} className={cn(hasVoted && "fill-rose-500 text-rose-500")} />
                                  <span>{votes.length}</span>
                                </button>

                                {/* Spotify link */}
                                <a
                                  href={spotifySearchUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                                  title="Listen on Spotify"
                                >
                                  <Music size={14} />
                                  <span className="hidden md:inline">Spotify</span>
                                </a>

                                {/* YouTube link */}
                                <a
                                  href={youtubeSearchUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                                  title="Search YouTube"
                                >
                                  <ExternalLink size={14} />
                                  <span className="hidden md:inline">YouTube</span>
                                </a>

                                {/* Remove Track (Admin/Planner) */}
                                {isCrewAdminOrMod && (
                                  <button
                                    onClick={() => handleRemoveTrack(track.id || track.title)}
                                    className="p-2 text-zinc-400 hover:text-rose-500 rounded-xl transition-all cursor-pointer"
                                    title="Remove track"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 space-y-3">
                      <Music size={32} className="mx-auto text-zinc-400" />
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                        No songs on this playlist yet. Click <strong className="text-emerald-600">✨ Build AI Playlist</strong> to auto-generate songs based on guest responses or add custom songs!
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* External Playlist URL Link Sync Card */}
              <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
                <h4 className="font-extrabold text-sm flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                  <ExternalLink size={18} className="text-emerald-500" />
                  Synced Spotify / Apple Music Playlist Link
                </h4>
                <p className="text-xs text-zinc-500">Attach an official Spotify or Apple Music playlist link so guests can open and save it directly in their music apps.</p>
                <div className="flex gap-2">
                  <input value={partyPlaylistUrl} onChange={(e) => setPartyPlaylistUrl(e.target.value)} placeholder="https://open.spotify.com/playlist/..." className="flex-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none focus:ring-2 ring-emerald-500" />
                  <button onClick={handleSavePlaylistUrl} className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm">Save Link</button>
                </div>
                {group?.playlist_url && (
                  <a href={group.playlist_url} target="_blank" rel="noopener noreferrer" className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all">
                    <span>Open Spotify Party Playlist</span>
                    <ExternalLink size={16} />
                  </a>
                )}
              </section>
            </motion.div>
          )}

          {partyActiveTab === 'photos' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <div className="flex justify-between items-center">
                 <h3 className="font-extrabold text-base flex items-center gap-2">
                   <Camera size={20} className="text-emerald-500" />
                   Party Photo Dump
                 </h3>
                 {isPhotoDumpUnlocked && (
                   <label className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-emerald-600 transition-all">
                     {isUploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                     <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={isUploadingPhoto} className="hidden" />
                   </label>
                 )}
               </div>

               {!isPhotoDumpUnlocked ? (
                 <div className="p-12 text-center bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 flex flex-col items-center justify-center space-y-3">
                   <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                     <Lock size={20} />
                   </div>
                   <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                     Photos unlock after the party starts
                   </p>
                 </div>
               ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                   {photoDumpImages.map((photo: any) => {
                     const imgUrl = photo.photo_url || photo.image_url;
                     return (
                       <img
                         key={photo.id}
                         src={imgUrl}
                         alt="Party dump"
                         className="w-full h-36 object-cover rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800"
                       />
                     );
                   })}
                   {photoDumpImages.length === 0 && (
                     <div className="col-span-full p-8 text-center bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 text-xs text-zinc-400">
                       No photo dump images yet! Upload the first party snap.
                     </div>
                   )}
                 </div>
               )}
             </section>
           </motion.div>
         )}

         {partyActiveTab === 'chat' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[600px] bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-xl">
             {isPlannerOrAdmin && (
               <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/20 p-2.5 gap-2 shrink-0">
                 <button onClick={() => setSelectedChatChannel('everyone')} className={cn("flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer font-sans", selectedChatChannel === 'everyone' ? "bg-emerald-500 text-white shadow-sm" : "bg-transparent text-zinc-400")}>
                   Everyone Chat
                 </button>
                 <button onClick={() => setSelectedChatChannel('admin_planner')} className={cn("flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer font-sans", selectedChatChannel === 'admin_planner' ? "bg-emerald-500 text-white shadow-sm" : "bg-transparent text-zinc-400")}>
                   Coordinator Chat (Admins & Planners)
                 </button>
               </div>
             )}
             <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
               {chatMessages.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-sm py-12 text-center">
                   <MessageSquare size={32} className="mb-2 text-zinc-300" />
                   <p>{selectedChatChannel === 'admin_planner' ? "No coordinator messages yet." : "No messages here yet. Say hello to the crew!"}</p>
                 </div>
               ) : (
                 chatMessages.map((msg, i) => {
                   const isOwn = msg.user_id === firebaseUser?.uid;
                   return (
                     <div key={msg.id || i} className={cn("flex flex-col max-w-[80%]", isOwn ? "self-end items-end" : "self-start items-start")}>
                       <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">{msg.user_name}</span>
                       <div className={cn("p-3.5 text-sm leading-relaxed", isOwn ? "bg-zinc-800 text-white rounded-[20px] rounded-tr-sm" : "bg-zinc-100 dark:bg-zinc-800/60 dark:text-zinc-100 text-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] rounded-tl-sm")}>
                         {msg.text}
                       </div>
                     </div>
                   );
                 })
               )}
               <div ref={messagesEndRef} />
             </div>
             <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex gap-2 items-center">
               <input value={newMessageText} onChange={(e) => setNewMessageText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendChatMessage(); } }} className="flex-1 p-3 px-4 rounded-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm outline-none" placeholder="Send message..." />
               <button onClick={handleSendChatMessage} className="p-3 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0 w-11 h-11">
                 <Send size={18} />
               </button>
             </div>
           </motion.div>
         )}

         {partyActiveTab === 'trivia' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {isCrewAdminOrMod && (
                <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Sparkles size={20} className="text-emerald-500" />
                        Spark Game Question Creator
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Create custom questions or generate AI ideas about {group?.person_name || 'the birthday person'}.
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        Suggestions use what you wrote in Party Setup → Ideas for the AI
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateAiQuestions}
                      disabled={isGeneratingAIQuestions}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      <Sparkles size={14} />
                      {isGeneratingAIQuestions ? 'Generating...' : 'AI Suggest Questions'}
                    </button>
                  </div>

                  {birthdayQuestions.filter((q: any) => q.published === false).length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-700">
                      <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        AI Suggested Draft Questions (Double-tap or click Publish to add to live list)
                      </h4>
                      <div className="space-y-2">
                        {birthdayQuestions.filter((q: any) => q.published === false).map((q: any) => (
                          <div
                            key={q.id}
                            onDoubleClick={() => handlePublishQuestion(q.id)}
                            className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-500 transition-all"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{q.question_text}</p>
                              <span className="text-[10px] text-zinc-400">Suggested by AI</span>
                            </div>
                            <button
                              onClick={() => handlePublishQuestion(q.id)}
                              className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-emerald-600 shrink-0"
                            >
                              Publish Question
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <input
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleProposeQuestion()}
                      placeholder="Ask a custom question..."
                      className="flex-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                    />
                    <button
                      onClick={handleProposeQuestion}
                      disabled={isProposingQuestion || !newQuestionText.trim()}
                      className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      {isProposingQuestion ? 'Adding...' : 'Add Question'}
                    </button>
                  </div>
                </section>
              )}

              <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <HelpCircle size={18} className="text-emerald-500" />
                      Live Spark Game Questions
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Answer questions about {group?.person_name || 'the birthday person'}. When Guess Who is enabled, {group?.person_name || 'they'} will guess who submitted each answer in their Locker!
                    </p>
                  </div>
                  {isLockDatePassed && (
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-full text-[10px] font-bold">
                      Answers Locked
                    </span>
                  )}
                </div>

                {birthdayQuestions.filter((q: any) => q.published !== false).length === 0 ? (
                  <p className="text-xs text-zinc-400 italic py-4 text-center">
                    No questions live yet. Click 'AI Suggest Questions' or add a custom question above!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {birthdayQuestions.filter((q: any) => q.published !== false).map((q: any) => {
                      const currentAnswer = userAnswers[q.id] || '';
                      const existingResp = birthdayResponses.find(r => r.question_id === q.id && r.user_id === firebaseUser?.uid);
                      return (
                        <div key={q.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100">{q.question_text}</p>
                            <span className="text-[10px] text-zinc-400 shrink-0">
                              By {q.created_by_name || 'Member'}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <input
                              value={currentAnswer}
                              disabled={isLockDatePassed}
                              onChange={(e) => setUserAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder={isLockDatePassed ? "Submissions locked" : "Write your answer here..."}
                              className="flex-1 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                            />
                            {!isLockDatePassed && (
                              <button
                                onClick={() => handleSaveAnswer(q.id)}
                                disabled={isSavingAnswers[q.id] || !currentAnswer.trim()}
                                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer disabled:opacity-50"
                              >
                                {existingResp ? 'Update' : 'Submit'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {isPlannerOrAdmin && (
                <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-6">
                  <div className="border-b border-zinc-100 dark:border-zinc-700 pb-4">
                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Lock size={18} className="text-emerald-500" />
                      Spark Results & Locker Settings (Admin / Planner)
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Review all submitted answers and configure options for {group?.person_name || 'the birthday person'}.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                      Compiled Guest Answers
                    </h4>
                    {birthdayQuestions.filter((q: any) => q.published !== false).map((q: any) => {
                      const qResponses = birthdayResponses.filter(r => r.question_id === q.id);
                      return (
                        <div key={q.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                          <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{q.question_text}</p>
                          {qResponses.length === 0 ? (
                            <p className="text-[11px] text-zinc-400 italic">No answers submitted yet.</p>
                          ) : (
                            <div className="space-y-1.5 pt-1">
                              {qResponses.map(r => (
                                <div key={r.id} className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs flex justify-between gap-2">
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">{r.user_name}:</span>
                                  <span className="text-zinc-700 dark:text-zinc-300 text-right">"{r.answer_text}"</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-700">
                    <h4 className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                      Locker & In-Person Party Options
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between cursor-pointer">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Send responses to their Locker</span>
                        <input
                          type="checkbox"
                          checked={sendToLockerEnabled}
                          onChange={(e) => setSendToLockerEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                        />
                      </label>

                      <label className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between cursor-pointer">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Keep for in-person party use</span>
                        <input
                          type="checkbox"
                          checked={keepInPersonEnabled}
                          onChange={(e) => setKeepInPersonEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                        />
                      </label>

                      <label className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between cursor-pointer sm:col-span-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Let them guess who said what (guessing game in Locker)</span>
                        <input
                          type="checkbox"
                          checked={guessWhoEnabled}
                          onChange={(e) => setGuessWhoEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                        />
                      </label>
                    </div>

                    {!sendToLockerEnabled && (
                      <div className="space-y-1.5 pt-2">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          Custom Locker Placeholder Note (optional)
                        </label>
                        <input
                          value={customLockerNote}
                          onChange={(e) => setCustomLockerNote(e.target.value)}
                          placeholder="e.g. There's a surprise waiting for you at the party!"
                          className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs outline-none text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    )}

                    <button
                      onClick={handleSendTriviaToVault}
                      disabled={isSendingToVaults}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      {isSendingToVaults ? 'Saving Spark Settings...' : 'Save Spark Settings & Save to Locker'}
                    </button>
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {partyActiveTab === 'ai_assistant' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
             <section className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-700 dark:border-t-white/5 dark:shadow-lg space-y-4">
               <div className="flex items-center justify-between">
                 <div>
                   <h3 className="font-extrabold text-base flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                     <Bot size={20} className="text-emerald-500" />
                     Ask AI Assistant
                   </h3>
                   <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Real-time party planning strategist powered by Gemini.</p>
                 </div>
               </div>

               {/* Quick Suggestion Chips */}
               <div className="flex flex-wrap gap-2 pt-1">
                 {[
                   "Suggest 3 budget-friendly themes",
                   "Draft a timeline for party day",
                   "Write a fun invite message for guests",
                   "Recommend icebreaker games"
                 ].map((prompt, idx) => (
                   <button
                     key={idx}
                     onClick={() => handleSendPlannerAiMessage(prompt)}
                     disabled={isPlannerAiThinking}
                     className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-950 hover:bg-zinc-200 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer text-left"
                   >
                     + {prompt}
                   </button>
                 ))}
               </div>

               {/* Chat History Box */}
               <div className="h-80 overflow-y-auto space-y-3 p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/60 dark:border-zinc-700">
                 {plannerAiMessages.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                     <Sparkles size={28} className="text-emerald-500 animate-pulse" />
                     <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">How can I help plan {group?.person_name || 'the party'}?</p>
                     <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs">Ask me for theme ideas, budget breakdowns, schedules, or guest list tips.</p>
                   </div>
                 )}
                 {plannerAiMessages.map((m: any) => (
                   <div
                     key={m.id || m.created_at}
                     className={cn(
                       "p-3.5 rounded-2xl text-xs max-w-[85%] space-y-1 leading-relaxed",
                       m.is_ai
                         ? "bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 shadow-sm"
                         : "ml-auto bg-emerald-500 text-white font-medium"
                     )}
                   >
                     <div className="flex items-center justify-between text-[10px] opacity-75 font-semibold">
                       <span>{m.is_ai ? 'AI Assistant' : (m.sender_name || 'You')}</span>
                     </div>
                     <p className="whitespace-pre-wrap">{m.text}</p>
                   </div>
                 ))}
                 {isPlannerAiThinking && (
                   <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-3.5 rounded-2xl text-xs max-w-[85%] space-y-1 text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                     <Sparkles size={14} className="text-emerald-500 animate-spin" />
                     <span>AI is thinking & drafting response...</span>
                   </div>
                 )}
                 <div ref={plannerAiEndRef} />
               </div>

               {/* Chat Input */}
               <div className="flex gap-2 pt-1">
                 <input
                   value={newPlannerAiText}
                   onChange={(e) => setNewPlannerAiText(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendPlannerAiMessage())}
                   placeholder="Ask AI for advice or party ideas..."
                   disabled={isPlannerAiThinking}
                   className="flex-1 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-all"
                 />
                 <button
                   onClick={() => handleSendPlannerAiMessage()}
                   disabled={isPlannerAiThinking || !newPlannerAiText.trim()}
                   className="px-5 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                 >
                   <Send size={14} />
                   Send
                 </button>
               </div>
             </section>
           </motion.div>
         )}

         {partyActiveTab === 'settings' && isCrewAdminOrMod && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
             <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
               <div>
                 <h2 className="text-base font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                   <Settings size={18} className="text-emerald-500" />
                   Party Settings
                 </h2>
                 <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                   Manage room details, AI prompts, guest permissions, and Spark Game rules in one place.
                 </p>
               </div>
             </div>

             {/* 1. Room Name & Notes */}
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                 <LayoutDashboard size={16} className="text-emerald-500" />
                 Room Name & Notes
               </h3>
               <div className="space-y-3">
                 <div>
                   <label className="text-xs font-bold text-zinc-500 block mb-1">Party Room Name</label>
                   <input
                     value={editRoomName}
                     onChange={(e) => setEditRoomName(e.target.value)}
                     placeholder="e.g., Alex's 25th Birthday Bash"
                     className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none"
                   />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-zinc-500 block mb-1">General Description / Notes for Guests</label>
                   <textarea
                     value={editRoomNotes}
                     onChange={(e) => setEditRoomNotes(e.target.value)}
                     rows={2}
                     placeholder="Welcome notes or general information for guests..."
                     className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none"
                   />
                 </div>
                 <button
                   onClick={handleSaveRoomDetails}
                   disabled={isSavingRoomDetails}
                   className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
                 >
                   {isSavingRoomDetails ? 'Saving...' : 'Save Room Details'}
                 </button>
               </div>
             </section>

             {/* 2. Ideas for the AI (planner_notes) */}
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <div className="flex items-center justify-between">
                 <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                   <Sparkles size={16} className="text-amber-500" />
                   Ideas for the AI (AI Spark Context)
                 </h3>
                 <span className="text-[10px] uppercase tracking-wider font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full">
                   Editable by Admin & Planners
                 </span>
               </div>
               <p className="text-xs text-zinc-500 leading-relaxed">
                 Describe the vibe, theme ideas, recipient's interests, favorite movies, music genres, or language preferences. This directly feeds into AI generation for themes, venues, soundtracks, game ideas, and Spark questions.
               </p>

               <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit text-xs font-bold">
                 <button
                   onClick={() => setPlannerNotesTab('my_notes')}
                   className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                     plannerNotesTab === 'my_notes'
                       ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                       : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                   }`}
                 >
                   My Notes
                 </button>
                 <button
                   onClick={() => {
                     setPlannerNotesTab('group_wide');
                     fetchGroupNeutralizedNotes();
                   }}
                   className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                     plannerNotesTab === 'group_wide'
                       ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                       : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                   }`}
                 >
                   Group-Wide
                 </button>
               </div>

               {plannerNotesTab === 'my_notes' ? (
                 <div className="space-y-3">
                   <textarea
                     value={editPlannerNotes}
                     onChange={(e) => setEditPlannerNotes(e.target.value)}
                     rows={3}
                     placeholder="e.g. 'Tamil movie themed, likes K-pop and board games, budget-friendly retro vibe, late night snacks'"
                     className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none text-zinc-900 dark:text-zinc-100"
                   />
                   <button
                     onClick={handleSavePlannerNotes}
                     disabled={isSavingPlannerNotes}
                     className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
                   >
                     {isSavingPlannerNotes ? 'Saving...' : 'Save AI Ideas'}
                   </button>
                 </div>
               ) : (
                 <div className="space-y-3">
                   {isLoadingGroupNotes ? (
                     <p className="text-xs text-zinc-500 italic">Loading guest notes...</p>
                   ) : groupNeutralizedNotes.length > 0 ? (
                     <ul className="space-y-2 pt-1">
                       {groupNeutralizedNotes.map((note, idx) => (
                         <li key={idx} className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-700/50 flex items-start gap-2">
                           <span className="text-amber-500 font-bold">•</span>
                           <span>{note}</span>
                         </li>
                       ))}
                     </ul>
                   ) : (
                     <p className="text-xs text-zinc-400 italic">No guest notes submitted yet.</p>
                   )}
                 </div>
               )}
             </section>

             {/* 3. Party Date & Time */}
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                 <Vote size={16} className="text-emerald-500" />
                 Party Date & Time
               </h3>
               <div className="flex items-center gap-3">
                 <input
                   type="date"
                   value={editPartyDate}
                   onChange={(e) => setEditPartyDate(e.target.value)}
                   className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none text-zinc-900 dark:text-zinc-100"
                 />
                 <button
                   onClick={handleSavePartyDate}
                   disabled={isSavingPartyDate}
                   className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
                 >
                   {isSavingPartyDate ? 'Saving...' : 'Save Date'}
                 </button>
               </div>
             </section>

             {/* 4. Custom Join Code */}
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                 <Sliders size={16} className="text-emerald-500" />
                 Custom Join Code
               </h3>
               <div className="space-y-3">
                 <div>
                   <label className="text-xs font-bold uppercase text-zinc-400 block mb-1">Party Join Code</label>
                   <div className="flex gap-2">
                     <input value={editableJoinCode} onChange={(e) => setEditableJoinCode(e.target.value.toUpperCase())} className="flex-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono font-bold outline-none text-zinc-900 dark:text-zinc-100" />
                     <button onClick={handleSaveJoinCode} disabled={isSavingJoinCode} className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all">Save Code</button>
                   </div>
                 </div>
               </div>
             </section>

             {/* 5. Attendance Requirement Gating */}
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <div className="flex items-center justify-between">
                 <div>
                   <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                     <Shield size={16} className="text-emerald-500" />
                     Attendance Requirement Gating
                   </h3>
                   <p className="text-xs text-zinc-500 mt-1">
                     Require guests to RSVP "Going" before unlocking party plans and chat.
                   </p>
                 </div>
                 <button
                   onClick={handleToggleRequiresAttendance}
                   className={cn(
                     "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                     group?.requires_attendance
                       ? "bg-emerald-500 text-white"
                       : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                   )}
                 >
                   {group?.requires_attendance ? 'Gating Enabled' : 'Gating Disabled'}
                 </button>
               </div>
             </section>

             {/* 6. Per-Status Guest Visibility Options */}
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                 <Eye size={16} className="text-emerald-500" />
                 Per-Status Guest Visibility Options
               </h3>
               <p className="text-xs text-zinc-500">
                 Control what guests can see depending on their RSVP status.
               </p>

               <div className="space-y-4 pt-2">
                 {[
                   { key: 'not_going', label: 'Declined (Not Going)' },
                   { key: 'undecided', label: 'Undecided / Maybe' },
                   { key: 'going', label: 'Confirmed (Going)' },
                 ].map((statusObj) => {
                   const currentVal = (editVisibility as any)[statusObj.key] || 'limited';

                   return (
                     <div key={statusObj.key} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 space-y-2">
                       <div className="flex items-center justify-between">
                         <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">{statusObj.label}</span>
                         <select
                           value={currentVal}
                           onChange={(e) => {
                             const updated = { ...editVisibility, [statusObj.key]: e.target.value };
                             handleSaveVisibility(updated);
                           }}
                           className="p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none cursor-pointer"
                         >
                           <option value="none">None</option>
                           <option value="limited">Limited</option>
                           <option value="full">Full</option>
                         </select>
                       </div>

                       <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                         {currentVal === 'none' && "None — they'll only see the option to update their RSVP, nothing else."}
                         {currentVal === 'limited' && "Limited — they'll see published themes, venues, and soundtracks, but not chat or photos."}
                         {currentVal === 'full' && "Full — they'll see everything: plans, chat, and photos, just like a confirmed guest."}
                       </p>
                     </div>
                   );
                 })}
               </div>
             </section>

             {/* 7. Photo Dump Access */}
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                 <ImageIcon size={16} className="text-emerald-500" />
                 Photo Dump Access
               </h3>
               <div className="space-y-2">
                 {[
                   { id: 'guests_can_add', label: 'View & Upload', desc: 'Guests can view and upload photos to the dump.' },
                   { id: 'guests_view_only', label: 'View Only', desc: 'Guests can view photos, but only Admins/Planners can upload.' },
                   { id: 'guests_hidden', label: 'Hidden', desc: 'Photo Dump is hidden from guests completely.' },
                 ].map(option => (
                   <label
                     key={option.id}
                     onClick={() => handleSavePhotoAccess(option.id)}
                     className={cn(
                       "flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer",
                       editPhotoAccess === option.id
                         ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                         : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                     )}
                   >
                     <input
                       type="radio"
                       name="photo_access"
                       checked={editPhotoAccess === option.id}
                       onChange={() => {}}
                       className="mt-0.5 accent-emerald-500"
                     />
                     <div>
                       <p className="text-xs font-bold">{option.label}</p>
                       <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{option.desc}</p>
                     </div>
                   </label>
                 ))}
               </div>
             </section>

             {/* 8. Spark Game Locker & In-Person Mode */}
             <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
               <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                 <Sparkles size={16} className="text-emerald-500" />
                 Spark Game Locker & In-Person Mode
               </h3>
               <p className="text-xs text-zinc-500 leading-relaxed">
                 Configure lock dates, send answers directly to the recipient's Locker, or keep answers for in-person party reveals.
               </p>

               <div className="space-y-3 pt-2">
                 <div>
                   <label className="text-xs font-bold text-zinc-500 block mb-1">Lock Answers On Date</label>
                   <div className="flex gap-2">
                     <input
                       type="date"
                       value={responsesLockDate}
                       onChange={(e) => setResponsesLockDate(e.target.value)}
                       className="flex-1 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs outline-none text-zinc-900 dark:text-zinc-100"
                     />
                     <button
                       onClick={handleSaveLockDate}
                       disabled={isSavingLockDate}
                       className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer transition-all"
                     >
                       {isSavingLockDate ? 'Saving...' : 'Set Lock Date'}
                     </button>
                   </div>
                 </div>

                 <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 space-y-2">
                   <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">Guess Who Mechanic</p>
                   <p className="text-[11px] text-zinc-500 leading-relaxed">
                     When enabled, the birthday person gets to guess which guest submitted each answer when reviewing their Locker.
                   </p>
                 </div>

                 {/* Spark Question Depth Setting */}
                 <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 space-y-3">
                   <div>
                     <h4 className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                       <Sliders size={14} className="text-emerald-500" />
                       Spark Question Depth Level
                     </h4>
                     <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                       Controls the tone and depth of AI-generated Spark questions. Does not affect custom questions written manually by members.
                     </p>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                     {[
                       {
                         id: 'light',
                         label: 'Light',
                         desc: 'Fun, silly & surface-level (e.g. most-used emoji, favorite snack)'
                       },
                       {
                         id: 'medium',
                         label: 'Medium',
                         desc: 'Mix of playful & slightly reflective group memories'
                       },
                       {
                         id: 'deep',
                         label: 'Deep',
                         desc: 'Meaningful & sentimental (e.g. moments of support & admiration)'
                       },
                     ].map((depthObj) => {
                       const isSelected = editQuestionDepth === depthObj.id;
                       return (
                         <button
                           key={depthObj.id}
                           type="button"
                           onClick={() => handleSaveQuestionDepth(depthObj.id as any)}
                           className={cn(
                             "p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer",
                             isSelected
                               ? "bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm"
                               : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300"
                           )}
                         >
                           <div>
                             <div className="flex items-center justify-between mb-1">
                               <span className="text-xs font-black">{depthObj.label}</span>
                               {isSelected && <Check size={14} className="text-emerald-500" />}
                             </div>
                             <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                               {depthObj.desc}
                             </p>
                           </div>
                         </button>
                       );
                     })}
                   </div>
                 </div>
               </div>
             </section>
           </motion.div>
         )}
       </>
     )}
   </div>
 ) : (
 <>
 {activeTab === 'planning' && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
 {/* Full Party Overview Banner */}
 {isFullParty && (
 <div className="p-6 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
 <div className="flex items-center justify-between">
 <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest">
 Full Party Mode
 </span>
 {group?.vibe && (
 <span className="text-xs font-bold bg-black/20 px-3 py-1 rounded-full">
 Vibe: {group.vibe}
 </span>
 )}
 </div>

 <div>
 <h2 className="text-2xl font-black tracking-tight">{group?.name}</h2>
 {group?.notes && <p className="text-xs opacity-90 mt-1">{group.notes}</p>}
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/20">
 {group?.party_date && (
 <div>
 <p className="text-[9px] uppercase font-bold text-emerald-200">Date & Time</p>
 <p className="text-xs font-extrabold">{group.party_date} {group?.party_time && `@ ${group.party_time}`}</p>
 </div>
 )}
 <div>
 <p className="text-[9px] uppercase font-bold text-emerald-200">Guest Count</p>
 <p className="text-xs font-extrabold">{group?.guest_count || (group?.members?.length || 1)} Guests</p>
 </div>
 <div>
 <p className="text-[9px] uppercase font-bold text-emerald-200">My RSVP</p>
 <p className="text-xs font-extrabold capitalize">{group?.rsvps?.[firebaseUser?.uid] || 'Going'}</p>
 </div>
 </div>

 <div className="pt-2 border-t border-white/20 flex flex-wrap items-center justify-between gap-2">
 <span className="text-xs font-bold">Update My RSVP:</span>
 <div className="flex gap-1.5">
 {(['going', 'maybe', 'not_going'] as const).map((status) => {
 const currentRsvp = group?.rsvps?.[firebaseUser?.uid] || 'going';
 const isSel = currentRsvp === status;
 return (
 <button
 key={status}
 onClick={() => handleUpdateRsvp(status)}
 className={cn(
 "px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer",
 isSel
 ? "bg-white text-emerald-800 shadow-md"
 : "bg-white/10 hover:bg-white/20 text-white"
 )}
 >
 {status === 'not_going' ? 'Not Going' : status}
 </button>
 );
 })}
 </div>
 </div>
 </div>
 )}
 {/* Birthday Countdown */}
 {group?.person_birthday && (
 (() => {
 const days = getDaysUntil(group.person_birthday);
 let text = "";
 if (days === 0) {
 text = ` It's ${group?.person_name || 'Friend'}'s birthday TODAY!`;
 } else if (days === 1) {
 text = `Tomorrow is ${group?.person_name || 'Friend'}'s birthday! `;
 } else {
 text = `${days} days until ${group?.person_name || 'Friend'}'s birthday `;
 }
 return (
 <div className="bg-zinc-900 text-white rounded-3xl p-6 border border-zinc-800">
 <p className="text-lg font-extrabold tracking-tight">{text}</p>
 </div>
 );
 })()
 )}

 {/* Administrative Broadcast banner */}
 {isCrewAdminOrMod && (
 <section className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-[32px] flex items-center justify-between gap-4 animate-fade-in">
 <div className="space-y-1">
 <h3 className="font-extrabold text-sm tracking-tight text-amber-850 dark:text-amber-300"> Host Controls</h3>
 <p className="text-xs text-zinc-500">Send an urgent home screen ping to everyone in the birthday planning room.</p>
 </div>
 <button
 onClick={() => {
 setAdminTypedMessage('');
 setShowNotifyCrewModal(true);
 }}
 className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 flex-shrink-0 cursor-pointer"
 >
 Notify Crew
 </button>
 </section>
 )}

 {/* Invite Code */}
 <div className="space-y-3">
 <div className="p-4 bg-zinc-900 text-white rounded-2xl flex justify-between items-center">
 <div>
 <p className="text-[10px] uppercase font-bold text-zinc-400">Party Join Code</p>
 <p className="text-xl font-mono font-bold tracking-widest">{group?.join_code || group?.invite_code}</p>
 </div>
 <button className="px-4 py-2 bg-white/10 rounded-xl text-xs font-bold" onClick={() => {
 navigator.clipboard.writeText(group?.join_code || group?.invite_code || '');
 alert('Join Code copied!');
 }}>Copy Code</button>
 </div>

 {/* Share Surprise Link */}
 <button 
 onClick={() => {
 navigator.clipboard.writeText(`${window.location.origin}/surprise/${id}`);
 setLinkCopied(true);
 setTimeout(() => setLinkCopied(false), 2000);
 }} 
 className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 text-sm"
 >
 <Share2 size={16} />
 {linkCopied ? "Link copied!" : "Share Surprise Link"}
 </button>
 </div>

 {/* Contribution Pool */}
 <section className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
 <div>
 <div className="flex justify-between items-center">
 <h3 className="font-bold flex items-center gap-2">
 <DollarSign size={18} className="text-emerald-500" />
 Gift Pool
 </h3>
 <span className="text-sm font-bold">${totalContributed} / ${targetAmount}</span>
 </div>
 <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium font-sans mt-1">
 Track who's chipping in — this doesn't process real payments (pledge tracker only).
 </p>
 </div>
 <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
 <motion.div 
 initial={{ width: 0 }}
 animate={{ width: `${progress}%` }}
 className="h-full bg-emerald-500" 
 />
 </div>

 {/* Log list */}
 <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
 <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wide">Chip-in Logs</p>
 {contributions && contributions.length > 0 ? (
 <div className="flex flex-wrap gap-2 pt-1">
 {contributions.map((c: any, idx: number) => (
 <span key={idx} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1.5 rounded-full flex items-center gap-1">
 {c.user_name} contributed ${c.amount}
 </span>
 ))}
 </div>
 ) : (
 <p className="text-xs text-zinc-400 italic">No pool contributions added yet.</p>
 )}
 </div>
 
 <AnimatePresence>
 {isContributingSidebar ? (
 <motion.div 
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 className="space-y-3 pt-2"
 >
 <div className="flex gap-2">
 {['10', '25', '50', '100'].map(amt => (
 <button 
 key={amt}
 onClick={() => setContributionAmountSidebar(amt)}
 className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
 contributionAmountSidebar === amt ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'
 }`}
 >
 ${amt}
 </button>
 ))}
 </div>
 <div className="flex gap-2">
 <button onClick={() => setIsContributingSidebar(false)} className="flex-1 py-3 text-sm font-bold text-zinc-500">Cancel</button>
 <button onClick={handleContribute} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm">Confirm</button>
 </div>
 </motion.div>
 ) : (
 <div className="space-y-2">
 <button 
 onClick={() => setIsContributingSidebar(true)}
 className="w-full py-3 bg-emerald-500/10 text-emerald-600 rounded-xl font-bold text-sm cursor-pointer"
 >
 Contribute to Pool
 </button>
 {isCrewAdminOrMod && !group?.gift_finalized && (
 <button 
 onClick={handleFinalizeGift}
 className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm shadow-amber-500/10"
 >
 Finalize Gift Choice 
 </button>
 )}
 {group?.gift_finalized && (
 <div className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl font-bold text-sm text-center">
 Gift Choice Finalized 
 </div>
 )}
 </div>
 )}
 </AnimatePresence>
 </section>

 {/* AI Gift Suggestions */}
 <section className="space-y-4">
 <div className="flex justify-between items-center">
 <h2 className="text-lg font-bold flex items-center gap-2">
 <Sparkles size={20} className="text-amber-500" />
 AI Gift Suggestions
 </h2>
 <button 
 onClick={handleGenerateSuggestions}
 disabled={isGeneratingSuggestions}
 className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-1"
 >
 {isGeneratingSuggestions ? 'Analyzing...' : 'Refresh Suggestions'}
 </button>
 </div>

 <div className="grid grid-cols-1 gap-4">
 {aiSuggestions.length > 0 ? aiSuggestions.map((suggestion, i) => (
 <motion.a
 key={i}
 href={suggestion.searchUrl}
 target="_blank"
 rel="noopener noreferrer"
 initial={{ opacity: 0, x: 10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: i * 0.1 }}
 className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center group hover:border-emerald-500 transition-all"
 >
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <h4 className="font-bold">{suggestion.title}</h4>
 <span className="text-xs font-bold text-emerald-500">{suggestion.price}</span>
 </div>
 <p className="text-xs text-zinc-500 mt-1">{suggestion.reason}</p>
 </div>
 <div className="p-2 text-zinc-300 group-hover:text-emerald-500 transition-colors">
 <ExternalLink size={18} />
 </div>
 </motion.a>
 )) : (
 <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-700">
 <p className="text-zinc-500 text-sm">Tap refresh to see AI gift ideas based on the current pool and interests.</p>
 </div>
 )}
 </div>
 </section>

 {/* Idea Board */}
 <section className="space-y-4">
 <div className="flex justify-between items-center">
 <h2 className="text-lg font-bold flex items-center gap-2">
 <Vote size={20} className="text-zinc-400" />
 Idea Board
 </h2>
 </div>
 
 <div className="space-y-4">
 {ideas?.map((idea: any) => (
 <motion.div 
 key={idea.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-start"
 >
 <div>
 <h4 className="font-bold">{idea.title}</h4>
 <p className="text-sm text-zinc-500">{idea.description}</p>
 </div>
 <button 
 onClick={() => handleVote(idea.id, idea.votes || [])}
 className="flex flex-col items-center p-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl min-w-[44px]"
 >
 <ChevronUp size={20} className={cn((idea.votes || []).includes(firebaseUser?.uid) && "text-emerald-500")} />
 <span className="text-xs font-bold">{(idea.votes || []).length}</span>
 </button>
 </motion.div>
 ))}
 </div>

 <div className="flex gap-2">
 <input 
 value={newIdea || ''}
 onChange={(e) => setNewIdea(e.target.value)}
 className="flex-1 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800"
 placeholder="Suggest something..."
 />
 <button 
 onClick={handleAddIdea}
 className="p-4 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-2xl"
 >
 <Plus size={24} />
 </button>
 </div>
 </section>
 </motion.div>
 )}

 {activeTab === 'guests' && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
 <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4">
 <div className="flex justify-between items-center">
 <div>
 <h3 className="font-extrabold text-base flex items-center gap-2">
 <Users size={20} className="text-emerald-500" />
 Guest List & Roles
 </h3>
 <p className="text-xs text-zinc-500 mt-0.5">
 Total Members: {group?.members?.length || 0}
 </p>
 </div>
 <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black rounded-full">
 {Object.values(group?.rsvps || {}).filter(v => v === 'going').length} Going
 </span>
 </div>

 <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
 {(group?.members || []).map((memberUid: string) => {
 const memberName = memberNames[memberUid] || (memberUid === firebaseUser?.uid ? (user?.name || 'You') : 'Member');
 const role = group?.roles?.[memberUid] || (group?.created_by === memberUid ? 'admin' : 'guest');
 const rsvp = group?.rsvps?.[memberUid] || 'going';

 return (
 <div key={memberUid} className="py-3.5 flex items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm">
 {memberName.charAt(0).toUpperCase()}
 </div>
 <div>
 <p className="text-sm font-bold flex items-center gap-2">
 {memberName}
 {memberUid === firebaseUser?.uid && (
 <span className="text-[10px] text-zinc-400 font-normal">(You)</span>
 )}
 </p>
 <p className="text-[10px] text-zinc-400 uppercase font-semibold">
 RSVP: <span className="text-emerald-600 dark:text-emerald-400 font-bold capitalize">{rsvp}</span>
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 {isRoomAdmin ? (
                           <select
                             value={role}
 onChange={(e) => handleUpdateMemberRole(memberUid, e.target.value as any)}
 className="p-1.5 px-2 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 outline-none text-zinc-900 dark:text-zinc-100"
 >
 <option value="admin">Admin</option>
 <option value="planner">Planner</option>
 <option value="guest">Guest</option>
 </select>
 ) : (
 <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold rounded-lg uppercase">
 {role}
 </span>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </motion.div>
 )}

 {activeTab === 'vault' && (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
 <div className="p-6 bg-zinc-900 text-white rounded-[40px] space-y-4 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-8 opacity-10">
 {isUnlocked ? <Unlock size={120} /> : <Lock size={120} />}
 </div>
 <div className="relative z-10">
 <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
 {isUnlocked ? <Unlock className="text-emerald-500" /> : <Lock className="text-amber-500" />}
 Secret Locker
 </h2>
 <p className="text-sm text-zinc-400 mt-2">
 {isUnlocked 
 ? "The locker is open! Enjoy all the surprises your friends left for you."
 : `Locked until ${group?.person_name || 'Friend'}'s birthday. Add surprises below!`}
 </p>
 </div>
 </div>

 {group?.isMember && (
 <button 
 onClick={() => setShowSurpriseForm(true)}
 className="w-full p-4 bg-emerald-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
 >
 <Plus size={20} />
 Add a Surprise
 </button>
 )}

 <AnimatePresence>
 {showSurpriseForm && (
 <motion.div 
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 20 }}
 className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-4"
 >
 <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
 {(['message', 'image', 'gift'] as const).map(type => (
 <button
 key={type}
 onClick={() => setNewSurprise({ ...newSurprise, type })}
 className={cn(
 "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
 newSurprise.type === type ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-zinc-400"
 )}
 >
 {type}
 </button>
 ))}
 </div>
 {newSurprise.type === 'image' ? (
 <div className="space-y-3">
 <label className="block w-full border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/40 transition-all">
 <input 
 type="file" 
 accept="image/*" 
 onChange={handleImageChange} 
 className="hidden" 
 />
 <ImageIcon className="mx-auto text-zinc-400 mb-2" size={24} />
 <span className="text-sm font-medium text-zinc-500">
 {selectedImageFile ? selectedImageFile.name : "Select an image file"}
 </span>
 </label>
 {imagePreviewUrl && (
 <div className="relative rounded-2xl overflow-hidden max-h-48 shadow-inner border border-zinc-200 dark:border-zinc-800">
 <img src={imagePreviewUrl} className="w-full h-full object-cover" alt="Selected Preview" />
 </div>
 )}
 {isUploadingImage && (
 <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase">
 <span className="animate-spin"></span>
 <span>Uploading ...</span>
 </div>
 )}
 </div>
 ) : (
 <textarea 
 value={newSurprise.content}
 onChange={(e) => setNewSurprise({ ...newSurprise, content: e.target.value })}
 className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none text-sm min-h-[100px]"
 placeholder={newSurprise.type === 'message' ? "Write a secret message..." : "Paste a URL or description..."}
 />
 )}
 <div className="flex gap-2">
 <button onClick={() => setShowSurpriseForm(false)} className="flex-1 py-3 text-sm font-bold text-zinc-500">Cancel</button>
 <button 
 onClick={handleAddSurprise} 
 disabled={isUploadingImage || (newSurprise.type === 'image' && !selectedImageFile) || (newSurprise.type !== 'image' && !newSurprise.content.trim())}
 className="flex-1 py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl font-bold text-sm disabled:opacity-50"
 >
 {isUploadingImage ? 'Uploading...' : 'Add to Locker'}
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 <div className="grid grid-cols-1 gap-4">
 {isUnlocked ? (
 surprises.length > 0 ? surprises.map((surprise, i) => (
 <motion.div
 key={surprise.id}
 initial={{ opacity: 0, scale: 0.9 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: i * 0.1 }}
 className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-3"
 >
 <div className="flex items-center gap-2">
 {surprise.type === 'message' && <MessageSquare size={16} className="text-blue-500" />}
 {surprise.type === 'image' && <ImageIcon size={16} className="text-emerald-500" />}
 {surprise.type === 'gift' && <Gift size={16} className="text-amber-500" />}
 {surprise.type === 'spark' && <Sparkles size={16} className="text-indigo-500" />}
 <span className="text-[10px] font-bold uppercase text-zinc-400">
 {surprise.type === 'spark' ? 'Spark Game' : `From ${surprise.user_name}`}
 </span>
 </div>
 {surprise.type === 'spark' ? (
 <SparkSurpriseCard surprise={surprise} />
 ) : surprise.type === 'image' ? (
 <img 
 src={surprise.content} 
 alt={`Surprise from ${surprise.user_name}`} 
 className="w-full rounded-2xl object-cover max-h-64" 
 />
 ) : (
 <p className="text-sm leading-relaxed whitespace-pre-wrap">{surprise.content}</p>
 )}
 </motion.div>
 )) : (
 <div className="p-12 text-center space-y-4">
 <Heart className="mx-auto text-zinc-200" size={48} />
 <p className="text-zinc-500">No surprises yet. Be the first!</p>
 </div>
 )
 ) : (
 <div className="p-12 text-center space-y-4 bg-zinc-100 dark:bg-zinc-900/50 rounded-[40px] border border-dashed border-zinc-200 dark:border-zinc-800">
 <Lock className="mx-auto text-zinc-300" size={48} />
 <div className="space-y-1">
 <p className="font-bold text-zinc-400 uppercase tracking-widest text-xs">Locker Locked</p>
 <p className="text-sm text-zinc-500">Only members can see what's inside until the big reveal.</p>
 </div>
 </div>
 )}
 </div>
 </motion.div>
 )}

 {activeTab === 'chat' && (
 <motion.div 
 initial={{ opacity: 0 }} 
 animate={{ opacity: 1 }} 
 className="flex flex-col h-[600px] md:h-[650px] bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-xl"
 >
 {/* Channel Tabs */}
 {isPlannerOrAdmin && (
 <div className="flex border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/20 p-2.5 gap-2 shrink-0">
 <button
 onClick={() => setSelectedChatChannel('everyone')}
 className={cn(
 "flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer font-sans",
 selectedChatChannel === 'everyone'
 ? "bg-emerald-500 text-white shadow-sm"
 : "bg-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
 )}
 >
 Everyone Chat
 </button>
 <button
 onClick={() => setSelectedChatChannel('admin_planner')}
 className={cn(
 "flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer font-sans",
 selectedChatChannel === 'admin_planner'
 ? "bg-emerald-500 text-white shadow-sm"
 : "bg-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
 )}
 >
 Coordinator Chat (Admins & Planners)
 </button>
 </div>
 )}

 {/* Messages Area: scrollable, flex-1 */}
 <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
 {chatMessages.length === 0 ? (
 <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-sm py-12 text-center">
 <MessageSquare size={32} className="mb-2 text-zinc-300" />
 <p>
 {selectedChatChannel === 'admin_planner'
 ? "No coordinator messages yet. Align on budget, schedules, and plans privately!"
 : "No messages here yet. Say hello to the crew!"}
 </p>
 </div>
 ) : (
 chatMessages.map((msg, i) => {
 const isOwn = msg.user_id === firebaseUser?.uid;
 const isSpark = msg.user_id === 'spark' || msg.is_spark;
 return (
 <div 
 key={msg.id || i} 
 className={cn(
 "flex flex-col max-w-[80%]",
 isOwn ? "self-end items-end" : "self-start items-start"
 )}
 >
 <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">
 {msg.user_name}
 </span>
 <div 
 className={cn(
 "p-3.5 text-sm leading-relaxed",
 isSpark 
 ? "bg-emerald-950 border border-emerald-800 text-emerald-100 rounded-[20px] rounded-tl-sm"
 : isOwn
 ? "bg-zinc-800 text-white rounded-[20px] rounded-tr-sm"
 : "bg-zinc-100 dark:bg-zinc-800/60 dark:text-zinc-100 text-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] rounded-tl-sm"
 )}
 >
 {msg.text}
 </div>
 </div>
 );
 })
 )}
 <div ref={messagesEndRef} />
 </div>

 {/* Fixed input bar at bottom of the tab content area */}
 <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex gap-2 items-center">
 <input 
 value={newMessageText}
 onChange={(e) => setNewMessageText(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 handleSendChatMessage();
 }
 }}
 className="flex-1 p-3 px-4 rounded-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
 placeholder={selectedChatChannel === 'admin_planner' ? "Send message to co-planners and admins..." : "Send message to everyone in the room..."}
 />
 <button 
 onClick={handleSendChatMessage}
 className="p-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors flex items-center justify-center shrink-0 w-11 h-11 shadow-md shadow-emerald-500/10"
 >
 <Send size={18} />
 </button>
 </div>
 </motion.div>
 )}
 </>
 )}
 </div>

 {/* Notify Crew Modal overlay */}
 <AnimatePresence>
 {showNotifyCrewModal && (
 <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
 <motion.div 
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => setShowNotifyCrewModal(false)}
 className="absolute inset-0 bg-black/60 backdrop-blur-sm"
 />
 <motion.div 
 initial={{ y: '100%', scale: 0.95 }}
 animate={{ y: 0, scale: 1 }}
 exit={{ y: '100%', scale: 0.95 }}
 className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-5"
 >
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-black tracking-tight"> Host Controls</h2>
 <button 
 onClick={() => setShowNotifyCrewModal(false)} 
 className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
 >
 <X size={18} />
 </button>
 </div>

 <div className="space-y-4">
 <p className="text-xs text-zinc-500 leading-relaxed">
 Send an urgent home screen ping to everyone in the party planning room...
 </p>

 <div className="space-y-1">
 <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block ml-1">Message Text</label>
 <textarea
 required
 rows={4}
 className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-amber-500 text-xs placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 outline-none"
 placeholder="e.g., Hey crew, please vote on the final venue tonight! "
 value={adminTypedMessage}
 onChange={(e) => setAdminTypedMessage(e.target.value)}
 />
 </div>

 <div className="flex gap-3">
 <button 
 onClick={() => setShowNotifyCrewModal(false)}
 className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 font-bold text-xs rounded-xl text-zinc-600 dark:text-zinc-300"
 >
 Cancel
 </button>
 <button 
 onClick={() => handleSendNotifyCrew(adminTypedMessage)}
 disabled={isSendingNotifyCrew || !adminTypedMessage.trim()}
 className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-500/10 disabled:opacity-50"
 >
 {isSendingNotifyCrew ? 'Sending...' : 'Send Alert'}
 </button>
 </div>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>

 </div>
 );
}
