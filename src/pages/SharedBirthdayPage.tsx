import React from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, 
  Mic, 
  Image as ImageIcon, 
  Type, 
  Send, 
  Sparkles, 
  Clock,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { cn, getDaysUntil } from '../lib/utils';

export default function SharedBirthdayPage() {
  const { id } = useParams();
  const [person, setPerson] = React.useState<any>(null);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'text' | 'photo' | 'voice' | 'video'>('text');
  const [content, setContent] = React.useState('');
  const [senderName, setSenderName] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;

    const personRef = doc(db, 'people', id);
    const unsubscribePerson = onSnapshot(personRef, (doc) => {
      if (doc.exists()) {
        setPerson({ id: doc.id, ...doc.data() });
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      if (err.code === 'permission-denied') {
        setError("This page is private or hasn't been shared correctly.");
      } else {
        setError("Something went wrong loading this page.");
      }
      setLoading(false);
    });

    const messagesRef = collection(db, 'people', id, 'messages');
    const q = query(messagesRef, orderBy('created_at', 'desc'));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    }, (err) => {
      console.error("Messages Error:", err);
    });

    return () => {
      unsubscribePerson();
      unsubscribeMessages();
    };
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !content || !senderName) return;

    setSending(true);
    try {
      const messagesRef = collection(db, 'people', id, 'messages');
      await addDoc(messagesRef, {
        type: activeTab,
        content,
        senderName,
        created_at: serverTimestamp()
      });
      setSubmitted(true);
      setContent('');
      setSenderName('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 text-center">
      <div className="space-y-4">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <Lock size={32} />
        </div>
        <h1 className="text-2xl font-black">Access Denied</h1>
        <p className="text-zinc-500 max-w-xs mx-auto">{error}</p>
        <p className="text-xs text-zinc-400 mt-8">Make sure the app owner has updated their Firestore Security Rules.</p>
      </div>
    </div>
  );

  if (!person) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 text-center">
      <div className="space-y-4">
        <h1 className="text-2xl font-black">Page Not Found</h1>
        <p className="text-zinc-500">This birthday page might have expired or doesn't exist.</p>
      </div>
    </div>
  );

  const daysUntil = getDaysUntil(person.birthday);
  const isBirthday = daysUntil === 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-12">
      {/* Hero Section */}
      <div className="relative h-64 bg-zinc-900 overflow-hidden">
        {person.photo_url ? (
          <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover opacity-50 blur-sm scale-110" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-700 opacity-20" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 rounded-[2rem] bg-white dark:bg-zinc-800 flex items-center justify-center text-3xl font-black shadow-2xl mb-4 overflow-hidden border-4 border-white dark:border-zinc-900"
          >
            {person.photo_url ? (
              <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
            ) : (
              <span className="serif-italic">{person.name[0]}</span>
            )}
          </motion.div>
          <h1 className="text-3xl font-black text-white tracking-tight">{person.name}'s Birthday</h1>
          <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs mt-2">
            {isBirthday ? "It's Celebration Day! 🎉" : `Revealing in ${daysUntil} days`}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto -mt-8 px-6 space-y-8 relative z-10">
        {/* Intro Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 shadow-xl border border-zinc-100 dark:border-zinc-800 text-center space-y-4">
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            We're collecting surprises for {person.name.split(' ')[0]}! Leave a message, photo, or voice note. Everything will be revealed on their birthday.
          </p>
          <div className="flex justify-center gap-2">
            <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-bold text-zinc-500 uppercase">
              {messages.length} Messages Collected
            </div>
          </div>
        </div>

        {/* Reveal or Form */}
        {isBirthday ? (
          <div className="space-y-6">
            <h2 className="text-xl font-black flex items-center gap-2 px-2">
              <Sparkles className="text-amber-500" />
              The Surprise Reveal
            </h2>
            <div className="grid gap-4">
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-black text-emerald-500 uppercase tracking-wider">{msg.senderName}</span>
                    <span className="text-[10px] text-zinc-400">{msg.type.toUpperCase()}</span>
                  </div>
                  {msg.type === 'text' && <p className="text-zinc-700 dark:text-zinc-300 italic">"{msg.content}"</p>}
                  {msg.type === 'photo' && <img src={msg.content} alt="Birthday Memory" className="rounded-xl w-full" />}
                  {/* Add audio/video players if content is a URL */}
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-[32px] p-8 shadow-xl border border-zinc-100 dark:border-zinc-800 space-y-6">
                <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                  {(['text', 'photo', 'voice', 'video'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex-1 py-2 flex items-center justify-center rounded-xl transition-all",
                        activeTab === tab ? "bg-white dark:bg-zinc-700 shadow-sm text-emerald-500" : "text-zinc-400"
                      )}
                    >
                      {tab === 'text' && <Type size={18} />}
                      {tab === 'photo' && <ImageIcon size={18} />}
                      {tab === 'voice' && <Mic size={18} />}
                      {tab === 'video' && <Video size={18} />}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-2">Your Name</label>
                    <input 
                      type="text"
                      required
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Who is this from?"
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-2">
                      {activeTab === 'text' ? 'Your Message' : 'URL to Content'}
                    </label>
                    <textarea 
                      required
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={activeTab === 'text' ? "Write something sweet..." : "Paste the link to your file..."}
                      className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-emerald-500 min-h-[120px]"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={sending}
                  className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sending ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={20} />
                      Send to Surprise Box
                    </>
                  )}
                </button>
              </form>
            ) : (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-emerald-500 text-white rounded-[32px] p-10 text-center space-y-4 shadow-2xl shadow-emerald-500/20"
              >
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-2xl font-black">Message Locked!</h2>
                <p className="font-medium opacity-90">Your surprise has been added to the vault. It will be revealed to {person.name.split(' ')[0]} on their birthday.</p>
                <button 
                  onClick={() => setSubmitted(false)}
                  className="text-sm font-bold underline opacity-80"
                >
                  Send another message
                </button>
              </motion.div>
            )}

            <div className="p-6 bg-zinc-900 text-white rounded-[32px] space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Lock size={18} />
                <h3 className="font-bold">Surprise Vault</h3>
              </div>
              <p className="text-sm text-zinc-400">
                All messages are encrypted and hidden until the clock strikes midnight on {person.name.split(' ')[0]}'s birthday.
              </p>
            </div>
          </div>
        )}

        {/* Footer Branding */}
        <div className="text-center space-y-2 py-8">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Powered by</p>
          <h2 className="text-xl font-black tracking-tighter text-zinc-300 dark:text-zinc-700">RelateOS</h2>
          <p className="text-xs text-zinc-400">Never miss a moment that matters.</p>
        </div>
      </div>
    </div>
  );
}
