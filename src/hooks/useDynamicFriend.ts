import { useState, useEffect } from "react";
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { db } from "../lib/firebase";

export function useDynamicFriend(initialPerson: any, currentUserId?: string) {
  const [person, setPerson] = useState(initialPerson);
  const [streakCount, setStreakCount] = useState(0);
  const [lastInteractionDate, setLastInteractionDate] = useState<string | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [friendRequestDocId, setFriendRequestDocId] = useState<string | null>(null);

  useEffect(() => {
    if (initialPerson) {
      setPerson((prev: any) => {
        // Only merge if base ID matches or has same name
        if (prev && prev.id === initialPerson.id) {
          return { ...initialPerson, ...prev };
        }
        return initialPerson;
      });
    }
  }, [initialPerson]);

  useEffect(() => {
    if (!currentUserId || !initialPerson || !initialPerson.host_uid) {
      setFriendshipStatus(null);
      setFriendRequestDocId(null);
      setStreakCount(0);
      setLastInteractionDate(null);
      return;
    }

    const frRef = collection(db, "friend_requests");
    const q1 = query(frRef, where("sender_uid", "==", currentUserId), where("receiver_uid", "==", initialPerson.host_uid));
    const q2 = query(frRef, where("sender_uid", "==", initialPerson.host_uid), where("receiver_uid", "==", currentUserId));

    const handleSnaps = (snap1: any, snap2: any) => {
      let found: any = null;
      if (!snap1.empty) found = snap1.docs[0];
      else if (!snap2.empty) found = snap2.docs[0];

      if (found) {
        const d = found.data();
        setFriendshipStatus(d.status);
        setFriendRequestDocId(found.id);
        setStreakCount(d.streak_count || 0);
        setLastInteractionDate(d.last_interaction_date || null);
      } else {
        setFriendshipStatus(null);
        setFriendRequestDocId(null);
        setStreakCount(0);
        setLastInteractionDate(null);
      }
    };

    const unsub1 = onSnapshot(q1, (snap1) => {
      getDocs(q2).then((snap2) => handleSnaps(snap1, snap2)).catch(() => {});
    });

    const unsub2 = onSnapshot(q2, (snap2) => {
      getDocs(q1).then((snap1) => handleSnaps(snap1, snap2)).catch(() => {});
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [initialPerson?.host_uid, currentUserId]);

  useEffect(() => {
    if (!initialPerson || !initialPerson.host_uid || friendshipStatus !== "accepted") {
      // Fallback: reset back to static values from initialPerson
      if (initialPerson) {
        setPerson(initialPerson);
      }
      return;
    }

    const userRef = doc(db, "users", initialPerson.host_uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const u = snap.data();
        setPerson((prev: any) => ({
          ...prev,
          name: u.name || prev.name,
          photo_url: u.profile_picture_url || prev.photo_url,
          fav_sports_teams: u.fav_sports_teams,
          fav_artists: u.fav_artists,
          anything_extra: u.anything_extra,
        }));
      }
    });

    return () => {
      unsub();
    };
  }, [initialPerson?.host_uid, friendshipStatus]);

  return { 
    person, 
    friendshipStatus, 
    friendRequestDocId, 
    streakCount, 
    lastInteractionDate 
  };
}
