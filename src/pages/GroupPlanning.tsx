import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  Users, 
  Plus, 
  Vote, 
  DollarSign, 
  Shield, 
  ChevronUp, 
  Sparkles, 
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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Navigation from '../components/Navigation';
import { generateGiftSuggestions, callCoachModel } from '../services/geminiService';
import { triggerSystemNotification } from '../lib/pushManager';
import { db } from '../lib/firebase';
import { 
  doc, 
  getDoc, 
  updateDoc, 
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
import { cn, getDaysUntil, isBirthdayToday, formatTime as utilsFormatTime } from '../lib/utils';

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
  const [activeTab, setActiveTab] = React.useState<'planning' | 'vault' | 'chat'>('planning');

  // Room Type Selection State
  const [roomType, setRoomType] = React.useState<'select' | 'birthday' | 'party'>('select');

  // Party creation form states
  const [partyName, setPartyName] = React.useState('');
  const [partyPersonName, setPartyPersonName] = React.useState('');
  const [partyDate, setPartyDate] = React.useState('');
  const [partyTime, setPartyTime] = React.useState('');
  const [selectedVibe, setSelectedVibe] = React.useState('🏠 House Party');
  const [guestCount, setGuestCount] = React.useState('');
  const [partyNotes, setPartyNotes] = React.useState('');
  const [roomStructure, setRoomStructure] = React.useState<'flat' | 'roles'>('flat');

  // Party active tab state
  const [partyActiveTab, setPartyActiveTab] = React.useState<'plan' | 'polls' | 'guests' | 'vibes' | 'photos' | 'chat'>('plan');

  // Member names cache
  const [memberNames, setMemberNames] = React.useState<{[uid: string]: string}>({});

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

  // Polls tab states
  const [newPollQuestion, setNewPollQuestion] = React.useState('');
  const [newPollOptions, setNewPollOptions] = React.useState<string[]>(['', '']);
  const [showPollForm, setShowPollForm] = React.useState(false);

  // Vibes tab states
  const [playlistConcept, setPlaylistConcept] = React.useState<any>(null);
  const [isGeneratingPlaylist, setIsGeneratingPlaylist] = React.useState(false);

  // Photos tab states
  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
  const [partyMemory, setPartyMemory] = React.useState('');
  const [isGeneratingMemory, setIsGeneratingMemory] = React.useState(false);
  
  // Form states
  const [newIdea, setNewIdea] = React.useState('');
  const [isContributing, setIsContributing] = React.useState(false);
  const [contributionAmount, setContributionAmount] = React.useState('25');
  const [aiSuggestions, setAiSuggestions] = React.useState<any[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = React.useState(false);
  const [isJoining, setIsJoining] = React.useState(false);
  const [inviteCode, setInviteCode] = React.useState('');
  const [joinError, setJoinError] = React.useState('');
  const [isJoiningLoading, setIsJoiningLoading] = React.useState(false);
  
  // Vault states
  const [showSurpriseForm, setShowSurpriseForm] = React.useState(false);
  const [newSurprise, setNewSurprise] = React.useState({ type: 'message', content: '' });
  const [surprises, setSurprises] = React.useState<any[]>([]);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [ideas, setIdeas] = React.useState<any[]>([]);

  // Chat states
  const [chatMessages, setChatMessages] = React.useState<any[]>([]);
  const [newMessageText, setNewMessageText] = React.useState('');
  const [isSparkTyping, setIsSparkTyping] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Image Upload states
  const [selectedImageFile, setSelectedImageFile] = React.useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const hasSentBirthdayPush = React.useRef(false);

  // Notify crew states
  const [showNotifyCrewModal, setShowNotifyCrewModal] = React.useState(false);
  const [adminTypedMessage, setAdminTypedMessage] = React.useState('');
  const [isSendingNotifyCrew, setIsSendingNotifyCrew] = React.useState(false);

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
          setJoinError("You are not a member of this room.");
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
                      title: "The Vault is UNLOCKED! 🔓",
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

    // Chat subscription
    const chatRef = collection(db, 'rooms', id, 'chat');
    const qChat = query(chatRef, orderBy('created_at', 'asc'));
    const unsubscribeChat = onSnapshot(qChat, (snapshot) => {
      setChatMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
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
    const photosRef = collection(db, 'rooms', id, 'photos');
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

    return () => {
      unsubscribeGroup();
      unsubscribeIdeas();
      unsubscribeSurprises();
      unsubscribeChat();
      unsubscribeTasks();
      unsubscribePolls();
      unsubscribePhotos();
      unsubscribeContributions();
      unsubscribeDatePolls();
    };
  }, [id, firebaseUser, user?.email]);

  React.useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, isSparkTyping]);

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
      title = `New Room Message 💬`;
      message = `${authorName} sent a message in ${roomName}`;
    } else if (activityType === 'surprise') {
      title = `New Surprise Idea! 🎁`;
      message = `${authorName} added a surprise/note in ${roomName}`;
    } else if (activityType === 'contribution') {
      title = `New Pool Contribution 💰`;
      message = `${authorName} contributed to the gift pool in ${roomName}`;
    } else {
      title = `New Room Activity ✨`;
      message = `${authorName} made an update in ${roomName}`;
    }

    try {
      const promises = otherMembers.map((memberUid: string) => {
        return addDoc(notifRef, {
          user_id: memberUid,
          title,
          message,
          type: 'group',
          is_read: false,
          isRead: false,
          link: `/rooms/${id}`,
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
        user_name: user?.name || 'Anonymous',
        text: trimmedText,
        created_at: serverTimestamp()
      };
      await addDoc(chatRef, userMsgData);
      setNewMessageText('');
      await createActivityNotification('message');

      // Check if includes '@Spark' (case insensitive)
      if (trimmedText.toLowerCase().includes('@spark')) {
        setIsSparkTyping(true);
        try {
          // Extract prompt by removing '@spark' (case-insensitive) from text
          const cleanPrompt = trimmedText.replace(/@spark/gi, '').trim();
          
          // Calculate total contributed for context
          const totalContributed = contributions?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;

          // Build context:
          let systemContext = '';
          if (group.room_type === 'party') {
            systemContext = `You are Spark, a fun AI party planning assistant. You know about this ${group.vibe || 'party'} party for ${group.person_name || 'Someone'} on ${group.party_date || 'date'} with approximately ${group.guest_count || 15} guests. Help with party ideas, logistics, and hype. Keep responses short, fun, and emoji-forward. Max 3 sentences.`;
          } else {
            systemContext = `You are Spark, a fun, casual AI assistant living inside a group birthday planning chat. You know the following about the person being celebrated:
Name: ${group?.person_name || 'Someone'}
Birthday: ${group?.person_birthday || 'Unknown'}
Notes: ${group?.person_notes || 'None'}
Category: ${group?.person_category || 'Friend'}
The group has contributed $${totalContributed} to a gift pool.
Keep responses short, friendly, and use emojis. Max 3 sentences.`;
          }

          const prompt = `${systemContext}\n\nUser Question: ${cleanPrompt}`;
          const response = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);

          await addDoc(chatRef, {
            user_id: 'spark',
            user_name: 'Spark ✨',
            text: response || '',
            created_at: serverTimestamp(),
            is_spark: true
          });
        } catch (err) {
          console.error("Error calling Spark:", err);
        } finally {
          setIsSparkTyping(false);
        }
      }
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
                  title: "New birthday card note 📝",
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
      const amt = parseFloat(contributionAmount) || 0;
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
                title: "Gift Finalized! 🎁",
                body: `The crew has locked in the gift choice for ${group?.person_name || 'our friend'}! Check it out.`,
                url: `/rooms/${id}`
              })
            });
          } catch (e) {
            console.error("Failed to send gift pool complete push notification:", e);
          }
        })();
      }

      setIsContributing(false);
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
              userIds: group.members || [],
              title: "Gift Finalized! 🎁",
              body: `The crew has locked in the gift choice for ${group.person_name || 'our friend'}! Check it out.`,
              url: `/rooms/${id}`
            })
          });
        } catch (pushErr) {
          console.error("Failed to send gift finalized push:", pushErr);
        }
      })();
      alert('Gift choice finalized & crew notified! 🎁');
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
    
    if (members.length > 0) {
      const peopleRef = collection(db, 'people');
      try {
        const peopleQuery = query(peopleRef, where('user_id', 'in', members.slice(0, 30)));
        const peopleSnap = await getDocs(peopleQuery);
        peopleSnap.docs.forEach(docSnap => {
          const pData = docSnap.data();
          const pName = pData.name || '';
          if (pName.toLowerCase() === (group.person_name || '').toLowerCase()) {
            if (pData.interests) matchedInterests.push(pData.interests);
            if (pData.notes) matchedNotes.push(pData.notes);
          }
        });
      } catch (err) {
        console.error("Error fetching matched people documents:", err);
      }
    }
    
    let combinedInterestsList = [];
    if (group.person_notes) combinedInterestsList.push(group.person_notes);
    if (matchedInterests.length > 0) combinedInterestsList.push(matchedInterests.join(', '));
    if (matchedNotes.length > 0) combinedInterestsList.push(matchedNotes.join(', '));
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

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !inviteCode.trim()) return;
    
    setIsJoiningLoading(true);
    setJoinError('');
    
    try {
      const groupsRef = collection(db, 'rooms');
      const q = query(groupsRef, where('invite_code', '==', inviteCode.trim().toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setJoinError('Invalid invite code. Please check and try again.');
        setIsJoiningLoading(false);
        return;
      }
      
      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();
      
      if (!groupData.members?.includes(firebaseUser.uid)) {
        await updateDoc(doc(db, 'rooms', groupDoc.id), {
          members: arrayUnion(firebaseUser.uid)
        });
      }

      // Trigger automatic high-priority background system alert
      await triggerSystemNotification(
        `Joined ${groupData.name || 'Friend Circle'}! 🤝`,
        `You have been successfully added to the network Circle: '${groupData.name}'. Tap to start planning!`,
        `/rooms/${groupDoc.id}`
      );
      
      navigate(`/rooms/${groupDoc.id}`);
    } catch (err) {
      console.error(err);
      setJoinError('An error occurred while joining the group.');
    } finally {
      setIsJoiningLoading(false);
    }
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
          subject: `Your friends are planning something special 🎁`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; 
                        margin: 0 auto; padding: 24px;">
              <h1 style="color: #10b981;">Something special is 
                coming your way 🎉</h1>
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

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const code_name = formData.get('code_name') as string;
    const recipient_email = formData.get('recipient_email') as string;

    try {
      const groupsRef = collection(db, 'rooms');
      const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      let person_name = 'Someone';
      let person_notes = '';
      let person_category = '';
      let person_birthday = '';

      if (personId) {
        const personSnap = await getDoc(doc(db, 'people', personId));
        if (personSnap.exists()) {
          const pData = personSnap.data();
          person_name = pData.name;
          person_notes = pData.notes;
          person_category = pData.category;
          person_birthday = pData.birthday;
        }
      }

      const docRef = await addDoc(groupsRef, {
        room_type: 'birthday',
        name,
        code_name,
        person_id: personId,
        person_name,
        person_notes,
        person_category,
        person_birthday,
        recipient_email: recipient_email.toLowerCase(),
        invite_code,
        created_by: firebaseUser.uid,
        members: [firebaseUser.uid],
        admins: [firebaseUser.uid],
        mods: [],
        target_amount: 500,
        created_at: serverTimestamp()
      });

      // Fire and forget email notification
      sendBirthdayEmail(docRef.id, recipient_email.toLowerCase());

      navigate(`/rooms/${docRef.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePartyGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (!partyName.trim() || !partyPersonName.trim()) {
      alert("Please fill in all required fields!");
      return;
    }

    try {
      const groupsRef = collection(db, 'rooms');
      const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const docRef = await addDoc(groupsRef, {
        room_type: 'party',
        name: partyName,
        person_name: partyPersonName,
        party_date: partyDate,
        party_time: partyTime,
        vibe: selectedVibe,
        guest_count: Number(guestCount) || 0,
        notes: partyNotes,
        room_structure: roomStructure,
        created_by: firebaseUser.uid,
        members: [firebaseUser.uid],
        admins: [firebaseUser.uid],
        mods: [],
        invite_code,
        created_at: serverTimestamp(),
        rsvps: {},
        target_amount: 0
      });

      navigate(`/rooms/${docRef.id}`);
    } catch (err) {
      console.error("Error creating party group:", err);
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
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">
            {isJoining ? 'Join Room' : roomType === 'select' ? 'Choose Room Type' : roomType === 'birthday' ? 'Create Birthday Locker' : 'Create Party Planning'}
          </h1>
          <div className="w-10" />
        </header>
        
        <div className="p-6 max-w-lg mx-auto space-y-8">
          <div className="flex p-1 bg-zinc-200 dark:bg-zinc-800 rounded-2xl shadow-inner">
            <button 
              onClick={() => { setIsJoining(false); setRoomType('select'); }}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200",
                !isJoining ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500"
              )}
            >
              Create New
            </button>
            <button 
              onClick={() => { setIsJoining(true); }}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200",
                isJoining ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500"
              )}
            >
              Join with Code
            </button>
          </div>

          {isJoining ? (
            <motion.form 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleJoinGroup} 
              className="space-y-6"
            >
              <div className="p-6 bg-zinc-900 text-white rounded-3xl space-y-3 shadow-xl relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                  <Users size={120} />
                </div>
                <Users size={32} className="text-emerald-500 relative z-10" />
                <div className="relative z-10">
                  <h2 className="text-xl font-bold">Join the Crew</h2>
                  <p className="text-sm opacity-90 text-zinc-400 leading-relaxed">Enter the 6-character invite code shared by your friends to join the planning group.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Invite Code</label>
                  <input 
                    value={inviteCode || ''}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    required 
                    maxLength={6}
                    className="w-full p-6 text-center text-3xl font-mono font-bold tracking-[0.5em] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 uppercase focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                    placeholder="XXXXXX" 
                  />
                </div>
                {joinError && (
                  <p className="text-sm text-red-500 font-medium text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{joinError}</p>
                )}
              </div>
              
              <button 
                type="submit" 
                disabled={isJoiningLoading || inviteCode.length < 6}
                className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-emerald-500/20 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {isJoiningLoading ? 'Joining...' : 'Join Room'}
              </button>
            </motion.form>
          ) : roomType === 'select' ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="space-y-6"
            >
              {/* Card A: Birthday Locker */}
              <motion.div 
                onClick={() => setRoomType('birthday')}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer bg-zinc-900 text-white rounded-[40px] p-8 shadow-2xl transition-transform border border-zinc-800 flex flex-col items-start gap-4 hover:scale-[1.02]"
              >
                <div className="text-5xl">🎁</div>
                <div>
                  <h3 className="font-black text-2xl text-white">Birthday Locker</h3>
                  <p className="text-zinc-400 text-sm mt-1">Plan the perfect gift in secret. Reveal it on their birthday.</p>
                </div>
                <span className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
                  Secret • Gift Planning • Surprise Reveal
                </span>
              </motion.div>

              {/* Card B: Party Planning */}
              <motion.div 
                onClick={() => setRoomType('party')}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer bg-emerald-500 text-white rounded-[40px] p-8 shadow-2xl transition-transform border border-emerald-400 flex flex-col items-start gap-4 hover:scale-[1.02]"
              >
                <div className="text-5xl">🎉</div>
                <div>
                  <h3 className="font-black text-2xl text-white">Party Planning</h3>
                  <p className="text-emerald-100 text-sm mt-1">Organize the whole event. Venue, vibes, guests — all in one place.</p>
                </div>
                <span className="text-xs bg-emerald-600 text-emerald-100 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
                  RSVP • Playlist • Polls • Photo Dump
                </span>
              </motion.div>
            </motion.div>
          ) : roomType === 'birthday' ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <button 
                onClick={() => setRoomType('select')} 
                className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft size={14} /> Back to selection
              </button>

              <form onSubmit={handleCreateGroup} className="space-y-6">
                <div className="p-6 bg-emerald-500 text-white rounded-3xl space-y-3 shadow-xl shadow-emerald-500/20 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                    <Shield size={120} />
                  </div>
                  <Shield size={32} className="relative z-10" />
                  <div className="relative z-10">
                    <h2 className="text-xl font-bold">Social Surprise Mode</h2>
                    <p className="text-sm opacity-90 leading-relaxed">Collaborate with friends in secret. The birthday person will never know until their big day.</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Room Name</label>
                    <input 
                      name="name" 
                      required 
                      defaultValue={defaultRoomName}
                      key={`name-${defaultRoomName}`}
                      className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                      placeholder="e.g. Sarah's 30th Crew" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Secret Code Name</label>
                    <input 
                      name="code_name" 
                      className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                      placeholder="e.g. Project Cupcake" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Recipient Email</label>
                    <input 
                      name="recipient_email" 
                      type="email" 
                      required 
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                      placeholder="The person we are surprising" 
                    />
                    <p className="text-[10px] text-zinc-500 ml-1">This links the locker to their account for the auto-reveal.</p>
                  </div>
                </div>

                <button type="submit" className="w-full py-5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-2xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
                  Start Planning
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <button 
                onClick={() => setRoomType('select')} 
                className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft size={14} /> Back to selection
              </button>

              <form onSubmit={handleCreatePartyGroup} className="space-y-6">
                <div className="p-6 bg-emerald-500 text-white rounded-3xl space-y-3 shadow-xl relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                    <Users size={120} />
                  </div>
                  <Users size={32} className="relative z-10" />
                  <div className="relative z-10">
                    <h2 className="text-xl font-bold">Party Planning Mode</h2>
                    <p className="text-sm opacity-90 leading-relaxed">Design the ultimate event coordinates, manage guests, craft playlists, and chat live with your group.</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Party Name *</label>
                    <input 
                      value={partyName} 
                      onChange={(e) => setPartyName(e.target.value)}
                      required 
                      className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                      placeholder="e.g. Jake's Graduation Bash 🎓" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Who's it for? *</label>
                    <input 
                      value={partyPersonName} 
                      onChange={(e) => setPartyPersonName(e.target.value)}
                      required 
                      className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                      placeholder="e.g. Jake" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Party Date</label>
                      <input 
                        type="date"
                        min="2026-01-01"
                        value={partyDate} 
                        onChange={(e) => setPartyDate(e.target.value)}
                        className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                      />
                      <p className="text-[9px] text-zinc-400 mt-1 ml-1 leading-relaxed">
                        Not sure yet? Leave blank and use Date Polling below
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Party Time</label>
                      <input 
                        type="time"
                        value={partyTime} 
                        onChange={(e) => setPartyTime(e.target.value)}
                        className="w-full p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-zinc-900 dark:text-zinc-100" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Vibe *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        '🏠 House Party', 
                        '🏖️ Outdoor', 
                        '🎮 Gaming Night', 
                        '🍕 Casual Hangout', 
                        '🎓 Graduation', 
                        '🏆 Team Party',
                        '🎂 Birthday Bash', 
                        '✨ Custom'
                      ].map((vibe) => (
                        <button
                          key={vibe}
                          type="button"
                          onClick={() => setSelectedVibe(vibe)}
                          className={cn(
                            "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between",
                            selectedVibe === vibe 
                              ? "bg-emerald-500 text-white border-emerald-500" 
                              : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                          )}
                        >
                          {vibe}
                          {selectedVibe === vibe && <span>✓</span>}
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
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Room Structure *</label>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Option A: Everyone's Equal */}
                      <button
                        type="button"
                        onClick={() => setRoomStructure('flat')}
                        className={cn(
                          "p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer h-full",
                          roomStructure === 'flat'
                            ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                            : "bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-750"
                        )}
                      >
                        <Users size={20} className={cn(roomStructure === 'flat' ? 'text-white' : 'text-zinc-650 dark:text-zinc-400')} />
                        <div>
                          <p className="text-xs font-bold leading-tight">Everyone's Equal</p>
                          <p className={cn("text-[10px] leading-snug mt-1", roomStructure === 'flat' ? "text-emerald-100" : "text-zinc-400")}>
                            Simple. Everyone can do everything.
                          </p>
                        </div>
                      </button>

                      {/* Option B: Roles */}
                      <button
                        type="button"
                        onClick={() => setRoomStructure('roles')}
                        className={cn(
                          "p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all cursor-pointer h-full",
                          roomStructure === 'roles'
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-md dark:bg-zinc-800 dark:border-zinc-800"
                            : "bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-750"
                        )}
                      >
                        <Shield size={20} className={cn(roomStructure === 'roles' ? 'text-white' : 'text-zinc-650 dark:text-zinc-400')} />
                        <div>
                          <p className="text-xs font-bold leading-tight">Roles</p>
                          <p className={cn("text-[10px] leading-snug mt-1", roomStructure === 'roles' ? "text-zinc-300" : "text-zinc-400")}>
                            Admin controls who can do what.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
                  Start Planning Party 🎉
                </button>
              </form>
            </motion.div>
          )}
        </div>
        <Navigation />
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!group) return <div className="p-8 text-center">Room not found or access denied.</div>;

  // --- PARTY ROOM HELPERS ---
  const handleGenerateThemes = async () => {
    setIsGeneratingThemes(true);
    try {
      const prompt = `You are Spark, a fun party planning AI for teenagers.
Suggest 3 creative party themes for a ${group.vibe || 'party'} party for ${group.person_name || 'Someone'}. For each theme provide:
- Theme name with emoji
- 3 decoration ideas
- Playlist vibe (2-3 genres)
- 3 food/drink ideas
- Estimated cost per person
Keep it fun, affordable, and teen-friendly.
Return strictly as a JSON array (no markdown code fence blocks, just the array itself) with fields: themeName, decorations[], playlistVibe, foodIdeas[], costPerPerson`;
      const responseText = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);
      
      let cleaned = responseText || '';
      if (cleaned.includes('```')) {
        cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      const jsonStart = cleaned.indexOf('[');
      const jsonEnd = cleaned.lastIndexOf(']');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
      }
      
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        setPartyThemes(parsed);
      }
    } catch (err) {
      console.error("Error generating themes:", err);
    } finally {
      setIsGeneratingThemes(false);
    }
  };

  const handleUpdateBudget = async () => {
    if (!id || !firebaseUser) return;
    try {
      const groupRef = doc(db, 'rooms', id);
      await updateDoc(groupRef, {
        target_amount: Number(customBudget) || 0
      });
      setIsEditingBudget(false);
    } catch (err) {
      console.error("Error updating budget:", err);
    }
  };

  const handleGenerateVenues = async () => {
    setIsGeneratingVenues(true);
    try {
      const prompt = `You are Spark, an expert teenage party planner AI.
Suggest 3 affordable venue ideas for a ${group.vibe || 'party'} party with approximately ${group.guest_count || 15} guests.
Keep suggestions realistic for teenagers with limited budget. For each venue suggest: venue type, why it works for this vibe, estimated cost, and tips for booking.
Return strictly as a JSON array (no markdown code fence blocks, just the array itself) with fields: venueType, why, estimatedCost, tips`;
      
      const responseText = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);
      let cleaned = responseText || '';
      if (cleaned.includes('```')) {
        cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      const jsonStart = cleaned.indexOf('[');
      const jsonEnd = cleaned.lastIndexOf(']');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
      }
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        setPartyVenues(parsed);
      }
    } catch (err) {
      console.error("Error generating venues:", err);
    } finally {
      setIsGeneratingVenues(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !id || !firebaseUser) return;
    try {
      const tasksRef = collection(db, 'rooms', id, 'tasks');
      const assignedName = newTaskAssignee ? (memberNames[newTaskAssignee] || 'Someone') : 'Unassigned';
      await addDoc(tasksRef, {
        title: newTaskTitle.trim(),
        assigned_to: newTaskAssignee || '',
        assigned_name: assignedName,
        completed: false,
        created_by: firebaseUser.uid,
        created_at: serverTimestamp()
      });
      setNewTaskTitle('');
      setNewTaskAssignee('');
    } catch (err) {
      console.error("Error adding task:", err);
    }
  };

  const handleToggleTask = async (taskId: string, currentCompleted: boolean, assignedTo: string) => {
    if (!id || !firebaseUser) return;
    const isFlat = group?.room_structure === 'flat';
    const isCrewAdmin = isFlat || group?.admins?.includes(firebaseUser.uid) || group?.created_by === firebaseUser.uid;
    const isCrewMod = isFlat || group?.mods?.includes(firebaseUser.uid);
    const isCrewAdminOrMod = isFlat || isCrewAdmin || isCrewMod;
    
    if (assignedTo !== firebaseUser.uid && !isCrewAdminOrMod) {
      alert("Only the assignee or a Coordinator (Admin/Mod) can toggle this task's status!");
      return;
    }
    
    try {
      const taskRef = doc(db, 'rooms', id, 'tasks', taskId);
      await updateDoc(taskRef, {
        completed: !currentCompleted
      });
    } catch (err) {
      console.error("Error toggling task:", err);
    }
  };

  const handlePartyContribution = async () => {
    if (!id || !firebaseUser) return;
    try {
      const contributionsRef = collection(db, 'rooms', id, 'contributions');
      await addDoc(contributionsRef, {
        user_id: firebaseUser.uid,
        user_name: user?.name || 'Someone',
        amount: Number(contributionAmount),
        created_at: serverTimestamp()
      });
      await createActivityNotification('contribution');
      setIsContributing(false);
    } catch (err) {
      console.error("Error posting party contribution:", err);
    }
  };

  const handleVotePoll = async (pollId: string, optionIdx: number) => {
    if (!id || !firebaseUser) return;
    try {
      const pollRef = doc(db, 'rooms', id, 'polls', pollId);
      await updateDoc(pollRef, {
        [`votes.${firebaseUser.uid}`]: optionIdx
      });
    } catch (err) {
      console.error("Error voting on poll:", err);
    }
  };

  const handleCreatePoll = async () => {
    if (!newPollQuestion.trim() || !id || !firebaseUser) return;
    const filteredOptions = newPollOptions.filter(o => o.trim() !== '');
    if (filteredOptions.length < 2) {
      alert("Please provide at least 2 non-empty options!");
      return;
    }

    try {
      const pollsRef = collection(db, 'rooms', id, 'polls');
      await addDoc(pollsRef, {
        question: newPollQuestion.trim(),
        options: filteredOptions,
        votes: {},
        created_by: firebaseUser.uid,
        created_at: serverTimestamp(),
        is_active: true
      });

      // Trigger A — New Poll Released push:
      (async () => {
        try {
          const targetUserIds = (group?.members || []).filter((uid: string) => uid !== firebaseUser.uid);
          if (targetUserIds.length > 0) {
            await fetch('/.netlify/functions/send-push-ping', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userIds: targetUserIds,
                title: "New Poll dropped! 🗳️",
                body: `${user?.name || firebaseUser.email} just posted a question in ${group?.name || 'the group'}. Go vote!`,
                url: `/rooms/${id}`
              })
            });
          }
        } catch (pushErr) {
          console.error("Failed to send new poll push notification:", pushErr);
        }
      })();

      setNewPollQuestion('');
      setNewPollOptions(['', '']);
      setShowPollForm(false);
    } catch (err) {
      console.error("Error creating poll:", err);
    }
  };

  const handleUpdateRSVP = async (status: 'going' | 'maybe' | 'not_going') => {
    if (!id || !firebaseUser) return;
    try {
      const roomRef = doc(db, 'rooms', id);
      await updateDoc(roomRef, {
        [`rsvps.${firebaseUser.uid}`]: status
      });
    } catch (err) {
      console.error("Error updating RSVP:", err);
    }
  };

  const handlePromoteToMod = async (targetUserId: string) => {
    if (!id || !firebaseUser) return;
    try {
      const roomRef = doc(db, 'rooms', id);
      await updateDoc(roomRef, {
        mods: arrayUnion(targetUserId)
      });
    } catch (err) {
      console.error("Error promoting member to Mod:", err);
    }
  };

  const handleGeneratePlaylist = async () => {
    setIsGeneratingPlaylist(true);
    try {
      const prompt = `Create a party playlist concept for a ${group.vibe || 'party'} party.
Suggest:
- 5 hype/opener songs (real popular songs teens know)
- 5 mid-energy songs  
- 5 chill/wind-down songs
- Overall playlist vibe description
For each song: song name, artist, why it fits this vibe.
Return strictly as a JSON object (no markdown code fence blocks, just the object itself) with fields: hype[] (array of items with name, artist, reason), mid[] (array of items with name, artist, reason), chill[] (array of items with name, artist, reason), vibeDescription`;
      
      const responseText = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);
      let cleaned = responseText || '';
      if (cleaned.includes('```')) {
        cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
      }
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object') {
        setPlaylistConcept(parsed);
      }
    } catch (err) {
      console.error("Error generating playlist:", err);
    } finally {
      setIsGeneratingPlaylist(false);
    }
  };

  const handleCopyPlaylist = () => {
    if (!playlistConcept) return;
    const formatList = (title: string, songs: any[]) => {
      return `${title}:\n` + (songs || []).map(s => `- "${s.name}" by ${s.artist} (Fits: ${s.reason})`).join('\n');
    };
    const fullText = [
      `Aesthetic Playlist concept for: ${group.name} (${group.vibe})\n`,
      playlistConcept.vibeDescription,
      formatList('🔥 HYPE / OPENERS', playlistConcept.hype),
      formatList('⚡ MID-ENERGY', playlistConcept.mid),
      formatList('🍃 CHILL / WIND-DOWN', playlistConcept.chill)
    ].join('\n\n');
    navigator.clipboard.writeText(fullText);
    alert("Playlist formatted coordinates copied to clipboard!");
  };

  const handleUploadPartyPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !firebaseUser) return;
    setIsUploadingPhoto(true);
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dffkrlv1k';
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'relateos_uploads';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (!data.secure_url) {
        throw new Error("No URL returned from Cloudinary");
      }

      const photosRef = collection(db, 'rooms', id, 'photos');
      await addDoc(photosRef, {
        url: data.secure_url,
        user_id: firebaseUser.uid,
        user_name: user?.name || 'Someone',
        created_at: serverTimestamp()
      });

      // Action B: Photo Dump Drops
      (async () => {
        try {
          const targetMembers = (group?.members || []).filter((mId: string) => mId !== firebaseUser.uid);
          if (targetMembers.length > 0) {
            await fetch('/.netlify/functions/send-push-ping', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userIds: targetMembers,
                title: "New photo drop! 📸",
                body: `${user?.name || 'Someone'} added a photo to the memory wall for ${group?.name || 'the group'}.`,
                url: `/rooms/${id}`
              })
            });
          }
        } catch (err) {
          console.error("Error sending photo push notification:", err);
        }
      })();
    } catch (err) {
      console.error("Error uploading photo:", err);
      alert("Failed to upload photo. Please try again!");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleGeneratePartyMemory = async () => {
    if (!id || photos.length < 3) return;
    setIsGeneratingMemory(true);
    try {
      const prompt = `You are Spark, a fun and warm party memory collector AI.
Look at this party info: Theme/Vibe is ${group.vibe}, Party for ${group.person_name} on ${group.party_date}.
The photos were uploaded by group members: ${photos.map(p => p.user_name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}.
Write a warm, nostalgic, and fun 3-4 sentence memory summary of this party that the group can keep forever. Sound like a friend writing in a diary. Use emojis!`;
      
      const response = await callCoachModel([{ role: 'user', parts: [{ text: prompt }] }]);
      setPartyMemory(response || 'No memory recorded yet.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMemory(false);
    }
  };

  const handleSendNotifyCrew = async (msgText: string) => {
    if (!msgText.trim() || !firebaseUser || !group) return;
    setIsSendingNotifyCrew(true);
    try {
      const targetUserIds = (group.members || []).filter((uid: string) => uid !== firebaseUser.uid);
      if (targetUserIds.length > 0) {
        await fetch('/.netlify/functions/send-push-ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userIds: targetUserIds,
            title: `Alert from ${group.name} 🚨`,
            body: msgText,
            url: `/rooms/${id}`
          })
        });
        alert('Alert sent successfully to everyone in the party planning room!');
        setAdminTypedMessage('');
        setShowNotifyCrewModal(false);
      } else {
        alert('No other members in this group to notify.');
      }
    } catch (err) {
      console.error('Error sending notify crew:', err);
      alert('Failed to send push notifications.');
    } finally {
      setIsSendingNotifyCrew(false);
    }
  };

  // --- RENDER PARTY ROOM VIEW ---
  const renderPartyRoom = () => {
    const isFlat = group?.room_structure === 'flat';
    const isCrewAdmin = isFlat || group.admins?.includes(firebaseUser?.uid) || group.created_by === firebaseUser?.uid;
    const isCrewMod = isFlat || group.mods?.includes(firebaseUser?.uid);
    const isCrewAdminOrMod = isFlat || isCrewAdmin || isCrewMod;
    const isAdminOrMod = group?.admins?.includes(firebaseUser?.uid) || group?.mods?.includes(firebaseUser?.uid) || group?.created_by === firebaseUser?.uid;

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      } catch (e) {
        return dateStr;
      }
    };

    const formatTime = (timeStr: string) => {
      return utilsFormatTime(timeStr, user?.timeFormatPreference || '12h');
    };

    const handleAddDatePoll = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id || !firebaseUser) return;
      if (!newPollDate) {
        alert("Please select a date!");
        return;
      }
      if (datePolls.length >= 5) {
        alert("You can only propose up to 5 date options!");
        return;
      }

      try {
        await addDoc(collection(db, 'rooms', id, 'date_polls'), {
          date: newPollDate,
          time: newPollTime || '',
          votes: {},
          created_by: firebaseUser.uid,
          created_at: serverTimestamp()
        });
        setNewPollDate('');
        setNewPollTime('');
        setShowAddDatePoll(false);
      } catch (err) {
        console.error("Error proposing date option:", err);
      }
    };

    const handleDeleteDatePoll = async (pollId: string) => {
      if (!id) return;
      if (!window.confirm("Are you sure you want to delete this option?")) return;
      try {
        await deleteDoc(doc(db, 'rooms', id, 'date_polls', pollId));
      } catch (err) {
        console.error("Error deleting date option:", err);
      }
    };

    const handleSelectDate = async (pollDate: string, pollTime: string) => {
      if (!id) return;
      try {
        await updateDoc(doc(db, 'rooms', id), {
          party_date: pollDate,
          party_time: pollTime || ''
        });
      } catch (err) {
        console.error("Error selecting date:", err);
      }
    };

    const handleClearSelectedDate = async () => {
      if (!id) return;
      try {
        await updateDoc(doc(db, 'rooms', id), {
          party_date: deleteField(),
          party_time: deleteField()
        });
      } catch (err) {
        console.error("Error clearing selected date:", err);
      }
    };

    const rsvps = group.rsvps || {};
    const rsvpCounts = { going: 0, maybe: 0, not_going: 0 };
    const blockedUids = user?.blocked_uids || [];
    const memberList = (group.members || []).filter((uid: string) => !blockedUids.includes(uid));
    memberList.forEach((uid: string) => {
      const status = rsvps[uid] || 'maybe';
      if (status === 'going') rsvpCounts.going++;
      else if (status === 'not_going') rsvpCounts.not_going++;
      else rsvpCounts.maybe++;
    });

    const totalPartyContributed = contributions?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
    const partyTargetAmount = group.target_amount || 0;
    const partyProgress = partyTargetAmount > 0 ? Math.min((totalPartyContributed / partyTargetAmount) * 105, 100) : 0;
    const splitAmount = group.guest_count > 0 ? (partyTargetAmount / group.guest_count) : 0;

    const isPartyDayOrLater = (() => {
      if (!group.party_date) return false;
      const todayStr = new Date().toISOString().split('T')[0];
      return todayStr >= group.party_date;
    })();

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
        <header className="p-6 pt-[calc(1.5rem+var(--sat))] flex flex-col gap-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-top z-10">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><ArrowLeft size={24} /></button>
            <div className="text-center">
              <h1 className="font-extrabold text-lg text-zinc-900 dark:text-zinc-50">{group.name} 🎉</h1>
              <p className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest mt-0.5">For {group.person_name} • {group.vibe}</p>
            </div>
            <button 
              onClick={handleLeaveRoom}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-450 border border-rose-250/30 rounded-xl text-[10px] font-extrabold cursor-pointer transition-all shadow-sm"
            >
              <span>Leave 🚪</span>
            </button>
          </div>

          <div className="grid grid-cols-6 w-full gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50">
            {([
              { id: 'plan', label: 'Plan', icon: Sparkles },
              { id: 'polls', label: 'Polls', icon: BarChart2 },
              { id: 'guests', label: 'Guests', icon: Users },
              { id: 'vibes', label: 'Vibes', icon: Music },
              { id: 'photos', label: 'Photos', icon: Camera },
              { id: 'chat', label: 'Chat', icon: MessageSquare }
            ] as const).map((tab) => {
              const Icon = tab.icon;
              const isSelected = partyActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setPartyActiveTab(tab.id)}
                  className={cn(
                    "w-full flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 sm:py-2 rounded-xl text-center transition-all duration-200 cursor-pointer",
                    isSelected 
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm font-semibold" 
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium"
                  )}
                >
                  <Icon size={14} className="flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="p-6 space-y-8 max-w-2xl mx-auto">
          {partyActiveTab === 'plan' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

              {/* Administrative Broadcast banner */}
              {group?.room_type === 'party' && isAdminOrMod && (
                <section className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-[32px] flex items-center justify-between gap-4 animate-fade-in">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm tracking-tight text-amber-850 dark:text-amber-300">📣 Host Controls</h3>
                    <p className="text-xs text-zinc-500">Send an urgent home screen ping to everyone in the party planning room.</p>
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
              
              {/* Theme suggestions */}
              <section className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-805 p-6 rounded-[32px] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">AI Theme Suggestions</h3>
                    <p className="text-xs text-zinc-400">Spawn three styling concepts for the crew bash.</p>
                  </div>
                  <button 
                    disabled={isGeneratingThemes}
                    onClick={handleGenerateThemes}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 font-bold text-xs text-white rounded-full transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                  >
                    <Sparkles size={14} />
                    {isGeneratingThemes ? 'Generating...' : 'Inspire Me'}
                  </button>
                </div>

                {partyThemes.length > 0 && (
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x pt-2">
                    {partyThemes.map((theme, i) => (
                      <div key={i} className="min-w-[280px] w-[300px] bg-zinc-900 text-white rounded-[32px] p-6 snap-center flex-shrink-0 flex flex-col gap-4 border border-zinc-900">
                        <h4 className="text-lg font-extrabold text-emerald-400">{theme.themeName}</h4>
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Decorations</p>
                          <ul className="text-xs space-y-1 list-disc ml-4 text-zinc-300 mt-1">
                            {theme.decorations?.map((d: string, idx: number) => <li key={idx}>{d}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Music Vibe</p>
                          <p className="text-xs text-zinc-300 mt-1">{theme.playlistVibe}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Food & Drinks</p>
                          <ul className="text-xs space-y-1 list-disc ml-4 text-zinc-300 mt-1">
                            {theme.foodIdeas?.map((f: string, idx: number) => <li key={idx}>{f}</li>)}
                          </ul>
                        </div>
                        <div className="mt-auto pt-3 border-t border-zinc-800 flex justify-between items-center text-xs">
                          <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Cost / Person</span>
                          <span className="font-extrabold text-emerald-400 text-sm">{theme.costPerPerson}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Task Board */}
              <section className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-6 rounded-[32px] space-y-4">
                <div>
                  <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">Coordination Task Board</h3>
                  <p className="text-xs text-zinc-400 text-left">Keep tasks organized & assign tasks to members.</p>
                </div>

                {isCrewAdminOrMod && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-2">
                    <input 
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Add coordination task to do..."
                      className="flex-1 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 focus:ring-1 focus:ring-emerald-500 outline-none text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <select 
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 outline-none text-xs text-zinc-500 dark:text-zinc-450"
                    >
                      <option value="">Assignee</option>
                      {(group.members || []).filter((uid: string) => !(user?.blocked_uids || []).includes(uid)).map((uid: string) => (
                        <option key={uid} value={uid}>{memberNames[uid] || 'Crew Member'}</option>
                      ))}
                    </select>
                    <button 
                      onClick={handleAddTask}
                      className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs min-w-[70px]"
                    >
                      Add Task
                    </button>
                  </div>
                )}

                <div className="space-y-2.5 pt-2">
                  {tasks.length > 0 ? (
                    tasks.map((task) => (
                      <div key={task.id} className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => handleToggleTask(task.id, task.completed, task.assigned_to)}
                            className="w-5 h-5 rounded-md border-zinc-250 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                          />
                          <div>
                            <p className={cn("text-xs font-bold text-zinc-800 dark:text-zinc-200", task.completed && "line-through text-zinc-400 dark:text-zinc-550")}>
                              {task.title}
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">Assigned: <span className="font-bold text-zinc-500">{task.assigned_name}</span></p>
                          </div>
                        </div>

                        {isCrewAdminOrMod && (
                          <button 
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'rooms', id!, 'tasks', task.id));
                              } catch(e) {}
                            }}
                            className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-400 italic text-center py-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-dotted border-zinc-200 dark:border-zinc-850">No tasks on planning board yet.</p>
                  )}
                </div>
              </section>

              {/* Budget Splitter */}
              <section className="bg-white dark:bg-zinc-900 border border-zinc-105 dark:border-zinc-805 p-6 rounded-[32px] space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">Budget Splitter & Contribution Pool</h3>
                    <p className="text-xs text-zinc-400">Set targeted finances and track real-time chip ins.</p>
                  </div>
                  {isCrewAdmin && (
                    <button 
                      onClick={() => {
                        setCustomBudget(String(partyTargetAmount));
                        setIsEditingBudget(!isEditingBudget);
                      }}
                      className="text-xs font-bold text-emerald-500 flex items-center"
                    >
                      {isEditingBudget ? "Cancel" : "Set Target Budget ✏️"}
                    </button>
                  )}
                </div>

                {isEditingBudget && (
                  <div className="flex gap-2 pt-1">
                    <input 
                      type="number"
                      value={customBudget}
                      onChange={(e) => setCustomBudget(e.target.value)}
                      placeholder="Target total pool..."
                      className="flex-1 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 focus:ring-1 focus:ring-emerald-500 outline-none text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <button 
                      onClick={handleUpdateBudget}
                      className="px-4 py-3 bg-emerald-500 text-white text-xs font-bold rounded-2xl"
                    >
                      Save Target
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-900 text-center">
                  <div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Target Budget Pool</p>
                    <p className="text-xl font-extrabold text-zinc-900 dark:text-zinc-550 mt-1">${partyTargetAmount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Split Cost / Head</p>
                    <p className="text-xl font-extrabold text-emerald-500 mt-1">${splitAmount.toFixed(2)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-zinc-400 px-0.5">
                    <span className="font-bold">Total Chipped In: ${totalPartyContributed}</span>
                    <span>Progress: {Math.round(partyProgress)}%</span>
                  </div>
                  <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${partyProgress}%` }} />
                  </div>
                </div>

                {/* Log list */}
                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-[10px] text-zinc-400 uppercase font-black tracking-wide">Chip-in Logs</p>
                  {contributions && contributions.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {contributions.map((c: any, idx: number) => (
                        <span key={idx} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1.5 rounded-full flex items-center gap-1">
                          💸 {c.user_name} contributed ${c.amount}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">No pool contributions added yet.</p>
                  )}
                </div>

                <div className="pt-2">
                  {!isContributing ? (
                    <button 
                      onClick={() => setIsContributing(true)}
                      className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 font-bold text-xs text-white rounded-2xl transition-colors shadow-md shadow-emerald-500/10"
                    >
                      Contribute to Party Pool 💸
                    </button>
                  ) : (
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl space-y-3 border border-zinc-100 dark:border-zinc-850">
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Select chip-in level:</p>
                      <div className="flex gap-2">
                        {['10', '25', '50', '100'].map(levelAmt => (
                          <button 
                            key={levelAmt}
                            onClick={() => setContributionAmount(levelAmt)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                              contributionAmount === levelAmt ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-zinc-900 border-zinc-150 dark:border-zinc-800 text-zinc-650'
                            }`}
                          >
                            ${levelAmt}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button 
                          onClick={() => setIsContributing(false)}
                          className="flex-1 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handlePartyContribution}
                          className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold"
                        >
                          Confirm Chip-In 💸
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Venue Finder */}
              <section className="bg-white dark:bg-zinc-900 border border-zinc-105 dark:border-zinc-805 p-6 rounded-[32px] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">AI Venue Matching</h3>
                    <p className="text-xs text-zinc-400">Spawn venue concepts fitting the guest coordinates & metrics list.</p>
                  </div>
                  <button 
                    disabled={isGeneratingVenues}
                    onClick={handleGenerateVenues}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 font-bold text-xs text-white rounded-full transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                  >
                    <Sparkles size={14} />
                    {isGeneratingVenues ? 'Analyzing...' : 'Match Venues'}
                  </button>
                </div>

                {partyVenues.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {partyVenues.map((v, keyIdx) => (
                      <div key={keyIdx} className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-2xl flex flex-col gap-2">
                        <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest">{v.venueType}</h4>
                        <p className="text-xs text-zinc-655 dark:text-zinc-400 leading-relaxed font-sans">{v.why}</p>
                        <div className="mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-900 space-y-1">
                          <p className="text-[9px] text-zinc-400 leading-normal"><span className="font-extrabold text-zinc-500">Booking Tips:</span> {v.tips}</p>
                          <div className="flex justify-between items-center text-[10px] pt-1">
                            <span className="text-zinc-400 font-bold uppercase">Estimated Cost</span>
                            <span className="font-extrabold text-emerald-500">{v.estimatedCost}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Invite coordinates */}
              <div className="p-6 bg-zinc-900 text-white rounded-[32px] flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Locker Invite Code</p>
                  <p className="text-2xl font-mono font-bold tracking-[0.25em]">{group.invite_code}</p>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(group.invite_code);
                    alert("Invite Code copied to clipboard!");
                  }}
                  className="px-5 py-3 bg-white/10 hover:bg-white/15 transition-all text-xs font-bold rounded-xl"
                >
                  Copy Crew Invite Code
                </button>
              </div>

            </motion.div>
          )}

          {/* TAB: POLLS */}
          {partyActiveTab === 'polls' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              
              {isCrewAdminOrMod && (
                <div className="pt-2">
                  {!showPollForm ? (
                    <button 
                      onClick={() => setShowPollForm(true)}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 font-bold text-xs text-white rounded-2xl text-center flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Create Crew Poll
                    </button>
                  ) : (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-black text-sm tracking-tight text-zinc-905 dark:text-zinc-100">Create Crew Poll</h4>
                        <button onClick={() => setShowPollForm(false)} className="text-xs font-bold text-zinc-400">Cancel</button>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-zinc-400 ml-1">Question Vibe</label>
                          <input 
                            value={newPollQuestion}
                            onChange={(e) => setNewPollQuestion(e.target.value)}
                            placeholder="E.g. What pizza toppings should coordinates order? 🍕"
                            className="w-full p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl text-xs border border-zinc-100 dark:border-zinc-855 outline-none text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[9px] uppercase font-bold text-zinc-400 ml-1">Options</label>
                          {newPollOptions.map((opt, idx) => (
                            <input 
                              key={idx}
                              value={opt}
                              onChange={(e) => {
                                const clone = [...newPollOptions];
                                clone[idx] = e.target.value;
                                setNewPollOptions(clone);
                              }}
                              placeholder={`Option ${idx + 1}`}
                              className="w-full p-2.5 bg-zinc-55 dark:bg-zinc-950 rounded-xl text-xs border border-zinc-100 dark:border-zinc-800 outline-none text-zinc-900 dark:text-zinc-100"
                            />
                          ))}
                        </div>

                        <div className="flex justify-between items-center pt-1 px-1">
                          <button 
                            onClick={() => setNewPollOptions([...newPollOptions, ''])}
                            className="text-[10px] font-black text-emerald-500 uppercase tracking-wider"
                          >
                            + Add Option
                          </button>
                          {newPollOptions.length > 2 && (
                            <button 
                              onClick={() => setNewPollOptions(newPollOptions.slice(0, -1))}
                              className="text-[10px] font-bold text-zinc-400"
                            >
                              Remove Last
                            </button>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={handleCreatePoll}
                        className="w-full py-3.5 bg-zinc-990 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white rounded-2xl text-xs font-bold mt-2"
                      >
                        Publish Crew Poll 🗳️
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Poll List */}
              <div className="space-y-4">
                {polls.length > 0 ? (
                  polls.map((poll) => {
                    const votesMap = poll.votes || {};
                    const totalVotes = Object.keys(votesMap).length;
                    const optionVotes = poll.options.map((opt: string, idx: number) => {
                      const voters = Object.entries(votesMap)
                        .filter(([uid, votedIdx]) => votedIdx === idx)
                        .map(([uid]) => memberNames[uid] || 'Someone');
                      const pct = totalVotes > 0 ? Math.round((voters.length / totalVotes) * 100) : 0;
                      return { opt, pct, voters };
                    });

                    return (
                      <div key={poll.id} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-6 rounded-[32px] space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 leading-snug">{poll.question}</h4>
                            <p className="text-[9px] text-zinc-400 mt-0.5 uppercase font-bold tracking-widest">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} total</p>
                          </div>
                          {isCrewAdmin && (
                            <button 
                              onClick={async () => {
                                try {
                                  await deleteDoc(doc(db, 'rooms', id!, 'polls', poll.id));
                                } catch(e) {}
                              }} 
                              className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="space-y-3 pt-1">
                          {optionVotes.map((optOption, oIdx) => {
                            const isVoted = votesMap[firebaseUser?.uid || ''] === oIdx;
                            return (
                              <button
                                key={oIdx}
                                onClick={() => handleVotePoll(poll.id, oIdx)}
                                className="w-full text-left relative overflow-hidden p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 hover:scale-[1.01] active:scale-[0.99] transition-all"
                              >
                                <div 
                                  className="absolute left-0 top-0 bottom-0 bg-emerald-500/10 transition-all duration-500 ease-out" 
                                  style={{ width: `${optOption.pct}%` }} 
                                />
                                <div className="relative z-10 flex justify-between items-center text-xs">
                                  <span className={cn("font-bold text-zinc-800 dark:text-zinc-200", isVoted && "text-emerald-500 font-extrabold")}>
                                    {optOption.opt} {isVoted && '✓'}
                                  </span>
                                  <span className="font-extrabold text-zinc-500">{optOption.pct}%</span>
                                </div>
                                {optOption.voters.length > 0 && (
                                  <p className="text-[9px] text-zinc-400 mt-1 relative z-10 font-sans">
                                    Voters: {optOption.voters.join(', ')}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-zinc-400 italic text-center py-8 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-805 rounded-[32px]">No active crew polls. All coordinates are settled.</p>
                )}
              </div>

            </motion.div>
          )}

          {/* TAB: GUESTS */}
          {partyActiveTab === 'guests' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

              {/* Administrative Broadcast banner */}
              {group?.room_type === 'party' && isAdminOrMod && (
                <section className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-[32px] flex items-center justify-between gap-4 animate-fade-in">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm tracking-tight text-amber-850 dark:text-amber-300">📣 Host Controls</h3>
                    <p className="text-xs text-zinc-500">Send an urgent home screen ping to everyone in the party planning room.</p>
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
              
              {/* Date Polling Section */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">Date Polling 📅</h3>
                    <p className="text-xs text-zinc-400">Propose and vote on the optimized coordinates for our bash.</p>
                  </div>
                  {isCrewAdminOrMod && datePolls.length < 5 && !showAddDatePoll && (
                    <button 
                      onClick={() => setShowAddDatePoll(true)}
                      className="py-1.5 px-3 bg-zinc-900 hover:bg-zinc-805 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-black uppercase rounded-full tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Propose Date
                    </button>
                  )}
                </div>

                {/* Form to Propose a Date option */}
                {showAddDatePoll && (
                  <form onSubmit={handleAddDatePoll} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-850 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-450">New Proposed Option</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-zinc-405 uppercase tracking-widest block mb-1 ml-1 font-sans">Date *</label>
                        <input 
                          type="date"
                          min="2026-01-01"
                          value={newPollDate}
                          onChange={(e) => setNewPollDate(e.target.value)}
                          required
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-805 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-zinc-405 uppercase tracking-widest block mb-1 ml-1 font-sans">Time (Optional)</label>
                        <input 
                          type="time"
                          value={newPollTime}
                          onChange={(e) => setNewPollTime(e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button 
                        type="button" 
                        onClick={() => setShowAddDatePoll(false)}
                        className="py-1.5 px-3 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-[10px] font-bold text-zinc-600 dark:text-zinc-350 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Submit Option
                      </button>
                    </div>
                  </form>
                )}

                {/* List of Proposed Date options */}
                <div className="space-y-3">
                  {datePolls.length > 0 ? (
                    datePolls.map((poll) => {
                      const voteCount = Object.values(poll.votes || {}).filter(v => v === true).length;
                      const hasVoted = poll.votes?.[firebaseUser?.uid || ''] === true;
                      const isOptionSelected = group.party_date === poll.date && (poll.time ? group.party_time === poll.time : !group.party_time);

                      return (
                        <div 
                          key={poll.id} 
                          className={cn(
                            "p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all",
                            isOptionSelected 
                              ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40" 
                              : "bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-850"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isOptionSelected && (
                                <span className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                                  🎯 Finalized Date
                                </span>
                              )}
                              <p className="text-sm font-extrabold text-zinc-900 dark:text-zinc-50 font-sans">
                                {formatDate(poll.date)}
                              </p>
                              {poll.time && (
                                <span className="text-[10px] text-zinc-500 font-mono bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                  {formatTime(poll.time)}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 font-medium">
                              Vote count: <span className="font-extrabold text-zinc-700 dark:text-zinc-200">{voteCount}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                            {/* Vote Buttons */}
                            <button
                              onClick={async () => {
                                if (!id || !firebaseUser) return;
                                try {
                                  await updateDoc(doc(db, 'rooms', id, 'date_polls', poll.id), {
                                    [`votes.${firebaseUser.uid}`]: true
                                  });
                                } catch (err) {
                                  console.error("Error voting:", err);
                                }
                              }}
                              className={cn(
                                "py-1.5 px-3 rounded-xl text-[10px] font-extrabold flex items-center gap-1 border transition-all cursor-pointer",
                                hasVoted
                                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              )}
                            >
                              I can make it ✅
                            </button>

                            <button
                              onClick={async () => {
                                if (!id || !firebaseUser) return;
                                try {
                                  await updateDoc(doc(db, 'rooms', id, 'date_polls', poll.id), {
                                    [`votes.${firebaseUser.uid}`]: deleteField()
                                  });
                                } catch (err) {
                                  console.error("Error removing vote:", err);
                                }
                              }}
                              className={cn(
                                "py-1.5 px-3 rounded-xl text-[10px] font-extrabold flex items-center gap-1 border transition-all cursor-pointer",
                                !hasVoted
                                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 border-zinc-900 dark:border-zinc-100"
                                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-805"
                              )}
                            >
                              Can't make it ❌
                            </button>

                            {/* Guard: Admins can mark as Selected */}
                            {isCrewAdmin && !isOptionSelected && (
                              <button
                                onClick={() => handleSelectDate(poll.date, poll.time)}
                                className="py-1.5 px-3 rounded-xl text-[10px] font-bold bg-zinc-900 hover:bg-zinc-850 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                Select this Date 🎯
                              </button>
                            )}

                            {isCrewAdmin && isOptionSelected && (
                              <button
                                onClick={() => handleClearSelectedDate()}
                                className="py-1.5 px-3 rounded-xl text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                Clear Selection ✕
                              </button>
                            )}

                            {/* Proposer delete button */}
                            {isCrewAdminOrMod && (
                              <button
                                onClick={() => handleDeleteDatePoll(poll.id)}
                                className="p-1.5 rounded-xl border border-transparent hover:border-red-500/20 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                                title="Delete Option"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-2xl">
                      <p className="text-xs text-zinc-400 italic font-medium">No date proposals actively polled yet.</p>
                      {isCrewAdminOrMod && (
                        <p className="text-[10px] text-zinc-500 mt-1">Click "Propose Date" above to launch the first option.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* RSVP update */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 space-y-4">
                <div>
                  <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">My Attendance Coordinator</h3>
                  <p className="text-xs text-zinc-400">Lock in your status coordinates so coordinators can plan food splits.</p>
                </div>

                <div className="flex gap-2">
                  {(['going', 'maybe', 'not_going'] as const).map(userSt => {
                    const currentStatus = rsvps[firebaseUser?.uid || ''] || 'maybe';
                    const active = currentStatus === userSt;
                    return (
                      <button
                        key={userSt}
                        onClick={() => handleUpdateRSVP(userSt)}
                        className={cn(
                          "flex-1 py-3 px-2 rounded-2xl text-xs font-black transition-all border",
                          active 
                            ? userSt === 'going' 
                              ? "bg-emerald-500 text-white border-emerald-500 shadow-md" 
                              : userSt === 'not_going'
                                ? "bg-red-500 text-white border-red-500 shadow-md"
                                : "bg-amber-500 text-white border-amber-500 shadow-md"
                            : "bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 text-zinc-655"
                        )}
                      >
                        {userSt === 'going' ? 'Going ✅' : userSt === 'not_going' ? 'Not Going ❌' : 'Maybe ❓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stats counts */}
              <div className="grid grid-cols-3 gap-2 text-center bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 rounded-[32px]">
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Going</p>
                  <p className="text-lg font-black text-emerald-500 mt-0.5">{rsvpCounts.going}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Maybe</p>
                  <p className="text-lg font-black text-amber-500 mt-0.5">{rsvpCounts.maybe}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Declined</p>
                  <p className="text-lg font-black text-red-500 mt-0.5">{rsvpCounts.not_going}</p>
                </div>
              </div>

              {/* Members attendance list */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 space-y-4">
                <h4 className="font-black text-xs text-zinc-400 uppercase tracking-wide">Crew Register ({memberList.length} members)</h4>
                
                <div className="space-y-3">
                  {memberList.map((uid: string) => {
                    const status = rsvps[uid] || 'maybe';
                    const name = memberNames[uid] || 'Crew Member';
                    
                    const isUserAdmin = group.admins?.includes(uid) || group.created_by === uid;
                    const isUserMod = group.mods?.includes(uid);

                    return (
                      <div key={uid} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-850 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2.5">
                          <div>
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                              {name}
                              {isUserAdmin ? (
                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">👑 Admin</span>
                              ) : isUserMod ? (
                                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">🛡️ Mod</span>
                              ) : null}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full",
                            status === 'going' 
                              ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" 
                              : status === 'not_going' 
                                ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400" 
                                : "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                          )}>
                            {status === 'going' ? 'Going' : status === 'not_going' ? 'Declined' : 'Maybe'}
                          </span>

                          {isCrewAdmin && !isUserAdmin && !isUserMod && (
                            <button 
                              onClick={() => handlePromoteToMod(uid)}
                              className="px-2.5 py-1 bg-zinc-900 text-white rounded-lg text-[9px] font-extrabold uppercase tracking-wider hover:bg-zinc-800 transition-colors"
                            >
                              + Mod
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB: VIBES */}
          {partyActiveTab === 'vibes' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">AI Playlist Builder</h3>
                    <p className="text-xs text-zinc-400 font-sans">Curate tracks and design overall aesthetic concept matches.</p>
                  </div>
                  <button 
                    disabled={isGeneratingPlaylist}
                    onClick={handleGeneratePlaylist}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 font-bold text-xs text-white rounded-full transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                  >
                    <Sparkles size={14} />
                    {isGeneratingPlaylist ? "Curation..." : "Build Concept"}
                  </button>
                </div>

                {playlistConcept && (
                  <div className="space-y-6 pt-2">
                    <p className="text-xs text-zinc-650 dark:text-zinc-300 leading-relaxed font-sans italic bg-zinc-50 dark:bg-zinc-950 p-4 border rounded-2xl">{playlistConcept.vibeDescription}</p>

                    <div className="space-y-4">
                      {/* Section: Hype */}
                      <div className="space-y-2">
                        <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest flex items-center gap-1">🔥 Hype & Openers (Fast Tempo)</p>
                        {playlistConcept.hype?.map((s: any, idx: number) => (
                          <div key={idx} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-2xl flex items-center justify-between font-sans">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-8 bg-red-500 rounded-full" />
                              <div>
                                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{s.name}</p>
                                <p className="text-[10px] text-zinc-400 mt-0.5">{s.artist} • <span className="italic text-zinc-555">{s.reason}</span></p>
                              </div>
                            </div>
                            <a 
                              href={`https://open.spotify.com/search/${encodeURIComponent(s.name + ' ' + s.artist)}`}
                              target="_blank" 
                              rel="referrer" 
                              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-500 rounded-xl text-xs font-bold flex items-center"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        ))}
                      </div>

                      {/* Section: Mid */}
                      <div className="space-y-2">
                        <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest flex items-center gap-1">⚡ Mid-Energy Grooves</p>
                        {playlistConcept.mid?.map((s: any, idx: number) => (
                          <div key={idx} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-2xl flex items-center justify-between font-sans">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-8 bg-emerald-500 rounded-full" />
                              <div>
                                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{s.name}</p>
                                <p className="text-[10px] text-zinc-400 mt-0.5">{s.artist} • <span className="italic text-zinc-555">{s.reason}</span></p>
                              </div>
                            </div>
                            <a 
                              href={`https://open.spotify.com/search/${encodeURIComponent(s.name + ' ' + s.artist)}`}
                              target="_blank" 
                              rel="referrer" 
                              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-500 rounded-xl text-xs font-bold flex items-center"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        ))}
                      </div>

                      {/* Section: Chill */}
                      <div className="space-y-2">
                        <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest flex items-center gap-1">🍃 Wind-Down & Chill Vibes</p>
                        {playlistConcept.chill?.map((s: any, idx: number) => (
                          <div key={idx} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-2xl flex items-center justify-between font-sans">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-8 bg-blue-500 rounded-full" />
                              <div>
                                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{s.name}</p>
                                <p className="text-[10px] text-zinc-400 mt-0.5">{s.artist} • <span className="italic text-zinc-555">{s.reason}</span></p>
                              </div>
                            </div>
                            <a 
                              href={`https://open.spotify.com/search/${encodeURIComponent(s.name + ' ' + s.artist)}`}
                              target="_blank" 
                              rel="referrer" 
                              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-500 rounded-xl text-xs font-bold flex items-center"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button 
                        onClick={handleCopyPlaylist}
                        className="w-full py-3.5 bg-zinc-900 border border-zinc-800 text-white rounded-2xl text-xs font-bold tracking-wide shadow-md shadow-zinc-900/15"
                      >
                        Copy Formatted Playlist Coordinates 📋
                      </button>
                    </div>

                  </div>
                )}
              </div>

            </motion.div>
          )}

          {/* TAB: PHOTOS */}
          {partyActiveTab === 'photos' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              
              {!isPartyDayOrLater ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-105 dark:border-zinc-800 rounded-[32px] p-8 text-center space-y-3">
                  <div className="text-5xl animate-bounce">⏳</div>
                  <h3 className="font-extrabold text-lg text-zinc-900 dark:text-zinc-100">Coordinate Photo Dump is Locked</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto font-sans">Photo uploads open up on the party day: <span className="font-extrabold text-emerald-500">{group.party_date}</span>. Track coordinates until then!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">Crew Photo Dump</h3>
                        <p className="text-xs text-zinc-400">Capture the snaps from the coordinates of the night.</p>
                      </div>
                      
                      <label className={cn(
                        "px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/10",
                        isUploadingPhoto && "opacity-50 pointer-events-none"
                      )}>
                        <Camera size={14} />
                        {isUploadingPhoto ? "Uploading..." : "Upload Photo 📸"}
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleUploadPartyPhoto} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    {photos.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                        {photos.map((photo) => (
                          <div key={photo.id} className="relative rounded-2xl overflow-hidden group aspect-square bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850">
                            <img 
                              src={photo.url} 
                              alt="Party dump" 
                              className="object-cover w-full h-full"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                              <p className="text-[10px] font-bold text-white uppercase tracking-wider">{photo.user_name}</p>
                              <p className="text-[9px] text-zinc-300">Dump coordinates shared</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 italic text-center py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">The photo pool is empty! Take snaps and start dumping snaps.</p>
                    )}
                  </div>

                  {/* AI Memory */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[32px] p-6 space-y-4">
                    <div>
                      <h3 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-100">Spark AI Custom Memory</h3>
                      <p className="text-xs text-zinc-400 font-sans">Unlock a personalized nostalgia journal. Requires at least 3 uploaded snaps to analyze.</p>
                    </div>

                    {photos.length >= 3 ? (
                      <div className="space-y-3">
                        <button 
                          onClick={handleGeneratePartyMemory}
                          disabled={isGeneratingMemory}
                          className="w-full py-3 bg-emerald-500 font-bold text-xs text-white rounded-2xl shadow-md shadow-emerald-500/10 disabled:opacity-50"
                        >
                          {isGeneratingMemory ? "Assembling Memories..." : "Spark Party Memory ⚡"}
                        </button>

                        {partyMemory && (
                          <div className="p-5 bg-emerald-950/20 border border-emerald-500/20 text-emerald-805 dark:text-emerald-300 rounded-3xl mt-2 leading-relaxed text-xs">
                            {partyMemory}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border rounded-2xl text-center text-xs text-zinc-450 font-sans">
                        Dump {3 - photos.length} more {3 - photos.length === 1 ? 'photo' : 'photos'} to unlock Spark memory curation coordinates!
                      </div>
                    )}
                  </div>

                </div>
              )}

            </motion.div>
          )}

          {/* TAB: CHAT */}
          {partyActiveTab === 'chat' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-804 rounded-[32px] overflow-hidden flex flex-col h-[550px]">
                
                {/* Chat Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
                  {chatMessages.length > 0 ? (
                    chatMessages.map((msg, idx) => {
                      const isOwner = msg.user_id === firebaseUser?.uid;
                      const isSpark = msg.is_spark;

                      return (
                        <div key={msg.id || idx} className={cn("flex flex-col max-w-[80%] font-sans", isOwner ? "ml-auto items-end" : "mr-auto items-start")}>
                          <span className="text-[9px] text-zinc-400 font-bold tracking-wide uppercase px-1 mb-0.5">
                            {msg.user_name}
                          </span>
                          <div className={cn(
                            "p-3.5 rounded-2xl text-xs leading-relaxed",
                            isOwner 
                              ? "bg-emerald-500 text-white rounded-tr-none font-sans" 
                              : isSpark
                                ? "bg-purple-500 text-white rounded-tl-none font-sans font-medium"
                                : "bg-zinc-105 dark:bg-zinc-800 text-zinc-850 dark:text-zinc-205 rounded-tl-none font-sans"
                          )}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2">
                      <p className="text-xs font-bold text-zinc-450">No messages in room yet.</p>
                      <p className="text-[10px] text-zinc-500 leading-relaxed max-w-xs font-sans">Ask questions, sync coordinates, or tag <span className="font-bold text-emerald-500">@Spark</span> to get quick party insights!</p>
                    </div>
                  )}

                  {isSparkTyping && (
                    <div className="flex flex-col items-start max-w-[80%] font-sans">
                      <span className="text-[9px] text-zinc-400 font-bold uppercase px-1 mb-0.5">Spark ✨</span>
                      <div className="p-3.5 bg-purple-500/20 text-purple-600 dark:text-purple-300 rounded-2xl rounded-tl-none text-xs flex items-center gap-1 font-sans">
                        <span className="animate-pulse">●</span>
                        <span className="animate-pulse delay-100">●</span>
                        <span className="animate-pulse delay-200">●</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Inputs */}
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 flex gap-2">
                  <input
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendChatMessage();
                    }}
                    placeholder="Type message... (e.g. @Spark query coordinates of night)"
                    className="flex-1 p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 outline-none text-xs text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-emerald-500"
                  />
                  <button 
                    onClick={handleSendChatMessage}
                    className="p-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl flex items-center justify-center transition-colors shadow-md shadow-emerald-500/10"
                  >
                    <Send size={14} />
                  </button>
                </div>

              </div>
            </motion.div>
          )}

        </div>
        <Navigation />
      </div>
    );
  };

  if (group.room_type === 'party') {
    return renderPartyRoom();
  }

  const totalContributed = contributions?.reduce((sum: number, c: any) => sum + c.amount, 0) || 0;
  const targetAmount = group.target_amount || 500;
  const progress = Math.min((totalContributed / targetAmount) * 100, 100);

  // Check if it's the birthday
  const isBirthday = isBirthdayToday(group.person_birthday);
  const isUnlocked = isBirthday || group.isMember;
  const isCrewAdminOrMod = group.admins?.includes(firebaseUser?.uid) || group.mods?.includes(firebaseUser?.uid) || group.created_by === firebaseUser?.uid;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
      <header className="p-6 pt-[calc(1.5rem+var(--sat))] flex flex-col gap-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft size={24} /></button>
          <div className="text-center">
            <h1 className="font-bold">{group.code_name || group.name}</h1>
            <p className="text-[10px] text-zinc-400 uppercase font-bold">For {group.person_name}</p>
          </div>
          <button 
            onClick={handleLeaveRoom}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-450 border border-rose-250/30 rounded-xl text-[10px] font-extrabold cursor-pointer transition-all shadow-sm"
          >
            <span>Leave 🚪</span>
          </button>
        </div>

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
              {tab === 'vault' ? 'Locker' : tab === 'chat' ? 'Chat' : tab}
            </button>
          ))}
        </div>
      </header>

      <div className="p-6 space-y-8 max-w-2xl mx-auto">
        {activeTab === 'planning' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Birthday Countdown */}
            {group.person_birthday && (
              (() => {
                const days = getDaysUntil(group.person_birthday);
                let text = "";
                if (days === 0) {
                  text = `🎂 It's ${group.person_name}'s birthday TODAY!`;
                } else if (days === 1) {
                  text = `Tomorrow is ${group.person_name}'s birthday! 🎉`;
                } else {
                  text = `${days} days until ${group.person_name}'s birthday 🎂`;
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
                  <h3 className="font-extrabold text-sm tracking-tight text-amber-850 dark:text-amber-300">📣 Host Controls</h3>
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
                  <p className="text-[10px] uppercase font-bold text-zinc-400">Invite Code</p>
                  <p className="text-xl font-mono font-bold tracking-widest">{group.invite_code}</p>
                </div>
                <button className="px-4 py-2 bg-white/10 rounded-xl text-xs font-bold" onClick={() => {
                  navigator.clipboard.writeText(group.invite_code);
                  alert('Code copied!');
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
              <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-500" />
                  Gift Pool
                </h3>
                <span className="text-sm font-bold">${totalContributed} / ${targetAmount}</span>
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
                        💸 {c.user_name} contributed ${c.amount}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No pool contributions added yet.</p>
                )}
              </div>
              
              <AnimatePresence>
                {isContributing ? (
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
                          onClick={() => setContributionAmount(amt)}
                          className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                            contributionAmount === amt ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'
                          }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setIsContributing(false)} className="flex-1 py-3 text-sm font-bold text-zinc-500">Cancel</button>
                      <button onClick={handleContribute} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm">Confirm</button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    <button 
                      onClick={() => setIsContributing(true)}
                      className="w-full py-3 bg-emerald-500/10 text-emerald-600 rounded-xl font-bold text-sm cursor-pointer"
                    >
                      Contribute to Pool
                    </button>
                    {isCrewAdminOrMod && !group?.gift_finalized && (
                      <button 
                        onClick={handleFinalizeGift}
                        className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold text-sm cursor-pointer shadow-sm shadow-amber-500/10"
                      >
                        Finalize Gift Choice 🎁
                      </button>
                    )}
                    {group?.gift_finalized && (
                      <div className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl font-bold text-sm text-center">
                        Gift Choice Finalized ✓ 🎁
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
                    : `Locked until ${group.person_name}'s birthday. Add surprises below!`}
                </p>
              </div>
            </div>

            {group.isMember && (
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
                          <span className="animate-spin">🔄</span>
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
                      <span className="text-[10px] font-bold uppercase text-zinc-400">From {surprise.user_name}</span>
                    </div>
                    {surprise.type === 'image' ? (
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
            {/* Messages Area: scrollable, flex-1 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
              {chatMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-sm py-12">
                  <MessageSquare size={32} className="mb-2 text-zinc-300" />
                  <p>No messages yet. Ask @Spark for ideas!</p>
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
              {isSparkTyping && (
                <div className="self-start flex flex-col items-start max-w-[80%]">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Spark ✨</span>
                  <div className="p-3.5 bg-emerald-950 border border-emerald-800 text-emerald-100 rounded-[20px] rounded-tl-sm text-sm">
                    <span className="animate-pulse">Spark is casting a spell... 🪄</span>
                  </div>
                </div>
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
                placeholder="Ask Sarah advice with @Spark..."
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
                <h2 className="text-lg font-black tracking-tight">📣 Host Controls</h2>
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
                    placeholder="e.g., Hey crew, please vote on the final venue tonight! 🍕"
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

      <Navigation />
    </div>
  );
}
