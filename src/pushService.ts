/**
 * Boilerplate Background/Push Notifications Infrastructure
 * Designed to handle native push notification messages outside the app shell lifecycle,
 * dispatching alerts on the operating system lockscreen even when the application state
 * is completely closed or the screen is turned off.
 */

// Your public VAPID key from your push notification provider (e.g. Firebase Cloud Messaging / WebPush)
const VAPID_PUBLIC_KEY = 'BCFXI0MEi3CVogRK6TZVK7B0zuqcuwU_K8mBNr7sD1yXkdXHTr-Z_vwDZaYiF4VdhstF4V-I1ncoFdoR4E2IIFA';

/**
 * Service Worker Registration and Push Subscription Bootstrapper
 */
export async function registerPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('System push notifications are not supported in this browser environment.');
    return;
  }

  try {
    // 1. Request Browser Notifications Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Push notification permission was denied by the user.');
      return;
    }

    // 2. Register Background Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('Service Worker registered successfully for push notifications scope:', registration.scope);

    // 3. Subscribe user to push service (APNs / FCM Gateway)
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // In production, convert VAPID public key to standard Uint8Array
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
      console.log('Newly established Native Push Subscription object:', subscription);
    } else {
      console.log('Pre-existing active Mobile Push Subscription confirmed:', subscription);
    }

    // 4. Send this device token & subscription endpoint payload to Firebase/Server
    await sendSubscriptionToServer(subscription);

  } catch (err) {
    console.error('Failed to configure native device system Push alerts:', err);
  }
}

/**
 * Proxies the push subscription package to the backend storage
 */
async function sendSubscriptionToServer(subscription: PushSubscription) {
  // HOOK: Replace this url endpoints or firestore update commands with real database write:
  const token = JSON.stringify(subscription);
  console.log('Hook: Syncing push token descriptor to user profile in Firestore:', token);
}

/**
 * Utility: Converts VAPID Base64 string to Uint8Array for PushManager subscriptions
 */
function urlBase64ToUint8Array(base64String: string | null | undefined) {
  if (!base64String) {
    console.error('VAPID key string is null, empty, or undefined.');
    return new Uint8Array(0);
  }

  // 1) strip any accidental literal single or double quotes
  let cleaned = base64String.trim().replace(/^['"]|['"]$/g, '');
  if (!cleaned) {
    console.error('VAPID key string is empty after trimming and stripping quotes.');
    return new Uint8Array(0);
  }

  // 3) replace URL-safe '-' with '+' and '_' with '/'
  cleaned = cleaned.replace(/\-/g, '+').replace(/_/g, '/');

  // 2) dynamically recalculate and append missing '=' padding characters based on string length remainder
  const padding = '='.repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = cleaned + padding;

  try {
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (error) {
    console.error('Failed to execute atob during VAPID conversion. Cleaned string: ' + base64String, error);
    return new Uint8Array(0);
  }
}
