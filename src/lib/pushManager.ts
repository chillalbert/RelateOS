import { getMessaging, getToken } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, auth } from "./firebase";

export const enableNativeNotifications = async () => {
  if (typeof window === 'undefined') return;

  // Safe browser capability check for PWA/environments without standard support
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Native or standard web push notifications are not supported in this frame/browser environment.');
    return;
  }

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

/**
 * Dispatches an immediate, high-priority background payload to trigger a system lock screen notification.
 */
export const triggerSystemNotification = async (title: string, body: string, url: string = "/") => {
  console.log("Structuring background lockscreen notification:", { title, body, url });
  
  // Try using the Service Worker background registration object if available
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, {
          body: body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [300, 100, 300, 100, 400],
          requireInteraction: true, // Crucial for lock screen high-priority staying
          tag: 'system-lockscreen-alert',
          data: {
            url: url
          }
        } as any);
        console.log("Background system notification payload successfully structured and delivered.");
        return;
      }
    } catch (e) {
      console.warn("Service worker showNotification was bypassed, falling back:", e);
    }
  }

  // Fallback to standard Window Notification if permissions are already granted
  if (typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        requireInteraction: true
      });
    } catch (e) {
      console.error("Secondary notification fallback failed:", e);
    }
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

