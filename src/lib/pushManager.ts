import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

export async function subscribeUserToPush(firebaseUserId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Verify if 'serviceWorker' and 'PushManager' exist inside the current navigator window context.
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported in this browser.');
    return false;
  }

  try {
    // Execute a browser permission query
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted.');
      return false;
    }

    // Ensure service worker is registered
    await navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });

    // Await the ready state sequence
    const registration = await navigator.serviceWorker.ready;

    // Read for an active subscription pointer on the machine
    let subscription = await registration.pushManager.getSubscription();

    // If no active token is linked, generate a new connection string
    if (!subscription) {
      const applicationServerKey = 'BCFXI0MEi3CVogRK6TZVK7B0zuqcuwU_K8mBNr7sD1yXkdXHTr-Z_vwDZaYiF4VdhstF4V-I1ncoFdoR4E2IIFA';
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
    }

    if (subscription) {
      // Convert the resulting subscription target map into a JSON object
      const subscriptionJSON = subscription.toJSON();

      // Write it cleanly to the target user profile inside Firestore
      const userRef = doc(db, 'users', firebaseUserId);
      await updateDoc(userRef, {
        push_subscriptions: arrayUnion(subscriptionJSON)
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error in subscribeUserToPush:', error);
    return false;
  }
}
