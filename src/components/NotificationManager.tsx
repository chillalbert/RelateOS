import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDaysUntil } from '../lib/utils';

interface ReminderEntry {
  id: string;
  personId: string;
  personName: string;
  label: string;
  date: string;
  type: 'birthday' | 'anniversary' | 'custom';
  year_unknown: boolean;
}

export default function NotificationManager() {
  const { firebaseUser } = useAuth();

  useEffect(() => {
    if (!firebaseUser) return;

    const checkReminders = async () => {
      try {
        const peopleRef = collection(db, 'people');
        const q = query(peopleRef, where('user_id', '==', firebaseUser.uid));
        const querySnapshot = await getDocs(q);
        const peopleDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        // 1. Fetch events subcollection for each person in parallel
        const people = await Promise.all(
          peopleDocs.map(async (person: any) => {
            try {
              const eventsRef = collection(db, 'people', person.id, 'events');
              const eventsSnap = await getDocs(eventsRef);
              const events = eventsSnap.docs.map(eDoc => ({ id: eDoc.id, ...eDoc.data() }));
              return { ...person, events };
            } catch (err) {
              console.error(`Failed to fetch events for person ${person.id}:`, err);
              return { ...person, events: [] };
            }
          })
        );

        // 2. Build flattened array of date entries per person
        const entries: ReminderEntry[] = [];
        for (const person of people) {
          if (person.birthday) {
            entries.push({
              id: `birthday_${person.id}`,
              personId: person.id,
              personName: person.name,
              label: 'Birthday',
              date: person.birthday,
              type: 'birthday',
              year_unknown: !!person.birthYearUnknown
            });
          }

          if (Array.isArray(person.events)) {
            for (const evt of person.events) {
              if (!evt.date) continue;
              entries.push({
                id: evt.id || `event_${person.id}_${evt.date}`,
                personId: person.id,
                personName: person.name,
                label: evt.label || (evt.type === 'anniversary' ? 'Anniversary' : 'Event'),
                date: evt.date,
                type: evt.type || 'custom',
                year_unknown: !!evt.year_unknown
              });
            }
          }
        }

        const notifRef = collection(db, 'notifications');
        const existingNotifsSnap = await getDocs(query(notifRef, where('user_id', '==', firebaseUser.uid)));
        const existingNotifs = existingNotifsSnap.docs.map(doc => doc.data() as any);

        for (const entry of entries) {
          const daysUntil = getDaysUntil(entry.date);

          // Helper to check deduplication scoped per entry on the same day
          const isAlreadyNotified = (thresholdTitle: string) => {
            return existingNotifs.some(n => {
              if (n.user_id !== firebaseUser.uid || n.person_id !== entry.personId || !isToday(n.created_at)) {
                return false;
              }
              if (n.title !== thresholdTitle) {
                return false;
              }
              if (n.event_id) {
                return n.event_id === entry.id;
              }
              if (n.entry_label) {
                return n.entry_label === entry.label;
              }
              // For legacy notifications without event_id/entry_label, only match if current entry is birthday
              return entry.type === 'birthday';
            });
          };

          // 1. Day of Event (daysUntil === 0)
          if (daysUntil === 0) {
            const title = entry.type === 'birthday'
              ? `It's ${entry.personName}'s Birthday!`
              : `It's ${entry.personName}'s ${entry.label} today!`;
            
            if (!isAlreadyNotified(title)) {
              const message = entry.type === 'birthday'
                ? `Don't forget to send a message to ${entry.personName} today!`
                : `Don't forget to celebrate ${entry.personName}'s ${entry.label} today!`;

              await addDoc(notifRef, {
                user_id: firebaseUser.uid,
                person_id: entry.personId,
                title,
                message,
                type: entry.type === 'birthday' ? 'birthday' : 'task',
                entry_type: entry.type,
                entry_label: entry.label,
                event_id: entry.id,
                is_read: false,
                link: `/person/${entry.personId}`,
                created_at: serverTimestamp()
              });

              existingNotifs.push({
                user_id: firebaseUser.uid,
                person_id: entry.personId,
                title,
                message,
                entry_type: entry.type,
                entry_label: entry.label,
                event_id: entry.id,
                created_at: new Date()
              });
            }
          }

          // 2. Gift Deadline (14 days before)
          if (daysUntil === 14) {
            const title = `Gift Deadline: ${entry.personName}`;
            if (!isAlreadyNotified(title)) {
              const message = entry.type === 'birthday'
                ? `You have 2 weeks to decide on a gift for ${entry.personName}.`
                : `You have 2 weeks to decide on a gift for ${entry.personName}'s ${entry.label}.`;

              await addDoc(notifRef, {
                user_id: firebaseUser.uid,
                person_id: entry.personId,
                title,
                message,
                type: 'task',
                entry_type: entry.type,
                entry_label: entry.label,
                event_id: entry.id,
                is_read: false,
                link: `/person/${entry.personId}`,
                created_at: serverTimestamp()
              });

              existingNotifs.push({
                user_id: firebaseUser.uid,
                person_id: entry.personId,
                title,
                message,
                entry_type: entry.type,
                entry_label: entry.label,
                event_id: entry.id,
                created_at: new Date()
              });
            }
          }

          // 3. Card Deadline (3 days before)
          if (daysUntil === 3) {
            const title = `Card Reminder: ${entry.personName}`;
            if (!isAlreadyNotified(title)) {
              const message = entry.type === 'birthday'
                ? `Time to write a card for ${entry.personName}. Use AI to help!`
                : `Time to write a card for ${entry.personName}'s ${entry.label}. Use AI to help!`;

              await addDoc(notifRef, {
                user_id: firebaseUser.uid,
                person_id: entry.personId,
                title,
                message,
                type: 'task',
                entry_type: entry.type,
                entry_label: entry.label,
                event_id: entry.id,
                is_read: false,
                link: `/person/${entry.personId}`,
                created_at: serverTimestamp()
              });

              existingNotifs.push({
                user_id: firebaseUser.uid,
                person_id: entry.personId,
                title,
                message,
                entry_type: entry.type,
                entry_label: entry.label,
                event_id: entry.id,
                created_at: new Date()
              });
            }
          }
        }
      } catch (err) {
        console.error("Notification check error:", err);
      }
    };

    checkReminders();
    // Run every hour
    const interval = setInterval(checkReminders, 3600000);
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
