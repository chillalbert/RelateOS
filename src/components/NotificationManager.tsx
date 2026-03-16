import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDaysUntil } from '../lib/utils';

export default function NotificationManager() {
  const { firebaseUser } = useAuth();

  useEffect(() => {
    if (!firebaseUser) return;

    const checkBirthdays = async () => {
      try {
        const peopleRef = collection(db, 'people');
        const q = query(peopleRef, where('user_id', '==', firebaseUser.uid));
        const querySnapshot = await getDocs(q);
        const people = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        const notifRef = collection(db, 'notifications');
        const existingNotifsSnap = await getDocs(query(notifRef, where('user_id', '==', firebaseUser.uid)));
        const existingNotifs = existingNotifsSnap.docs.map(doc => doc.data());

        for (const person of people) {
          const daysUntil = getDaysUntil(person.birthday);
          
          // 1. Birthday Today
          if (daysUntil === 0) {
            const title = `It's ${person.name}'s Birthday! 🎂`;
            if (!existingNotifs.some(n => n.title === title && n.person_id === person.id && isToday(n.created_at))) {
              await addDoc(notifRef, {
                user_id: firebaseUser.uid,
                person_id: person.id,
                title,
                message: `Don't forget to send a message to ${person.name} today!`,
                type: 'birthday',
                is_read: false,
                link: `/person/${person.id}`,
                created_at: serverTimestamp()
              });
            }
          }

          // 2. Gift Deadline (14 days before)
          if (daysUntil === 14) {
            const title = `Gift Deadline: ${person.name}`;
            if (!existingNotifs.some(n => n.title === title && n.person_id === person.id && isToday(n.created_at))) {
              await addDoc(notifRef, {
                user_id: firebaseUser.uid,
                person_id: person.id,
                title,
                message: `You have 2 weeks to decide on a gift for ${person.name}.`,
                type: 'task',
                is_read: false,
                link: `/person/${person.id}`,
                created_at: serverTimestamp()
              });
            }
          }

          // 3. Card Deadline (3 days before)
          if (daysUntil === 3) {
            const title = `Card Reminder: ${person.name}`;
            if (!existingNotifs.some(n => n.title === title && n.person_id === person.id && isToday(n.created_at))) {
              await addDoc(notifRef, {
                user_id: firebaseUser.uid,
                person_id: person.id,
                title,
                message: `Time to write a card for ${person.name}. Use AI to help!`,
                type: 'task',
                is_read: false,
                link: `/person/${person.id}`,
                created_at: serverTimestamp()
              });
            }
          }
        }
      } catch (err) {
        console.error("Notification check error:", err);
      }
    };

    checkBirthdays();
    // Run every hour
    const interval = setInterval(checkBirthdays, 3600000);
    return () => clearInterval(interval);
  }, [firebaseUser]);

  return null;
}

function isToday(timestamp: any) {
  if (!timestamp) return false;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}
