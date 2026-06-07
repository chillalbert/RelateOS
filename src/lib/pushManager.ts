import { getMessaging, getToken } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, auth } from "./firebase";

export const enableNativeNotifications = async () => {
  if (typeof window === 'undefined') return;

  try {
    // Request permission from the Android Operating System / Browser
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Android notification permission denied.');
      return;
    }

    const messaging = getMessaging();
    // Fetch the native FCM device token using your Firebase Web/App VAPID pair
    const currentToken = await getToken(messaging, {
      vapidKey: 'BCFXI0MEi3CVogRK6TZVK7B0zuqcuwU_K8mBNr7sD1yXkdXHTr-Z_vwDZaYiF4VdhstF4V-I1ncoFdoR4E2IIFA'
    });

    if (currentToken) {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, "users", user.uid);
        // Save the raw string token directly into your push_subscriptions array
        await updateDoc(userRef, {
          push_subscriptions: arrayUnion(currentToken)
        });
        console.log("Native Android FCM Token saved successfully!");
      }
    } else {
      console.log('No native registration token available.');
    }
  } catch (error) {
    console.error('Error setting up native FCM:', error);
  }
};

export async function subscribeUserToPush(firebaseUserId: string): Promise<boolean> {
  try {
    await enableNativeNotifications();
    return true;
  } catch (err) {
    console.error('Error subscription helper:', err);
    return false;
  }
}

