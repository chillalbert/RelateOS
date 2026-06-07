import { Handler } from "@netlify/functions";
import webpush from "web-push";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };

// Initialize Firebase App directly using the imported JSON
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

const publicKey = "BCFXI0MEi3CVogRK6TZVK7B0zuqcuwU_K8mBNr7sD1yXkdXHTr-Z_vwDZaYiF4VdhstF4V-I1ncoFdoR4E2IIFA";
const privateKey = process.env.VAPID_PRIVATE_KEY || "YOUR_PRIVATE_VAPID_KEY_HERE_AS_PLACEHOLDER";

// Set VAPID details
webpush.setVapidDetails("mailto:smayansri@gmail.com", publicKey, privateKey);

export const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { userIds, title, body, url } = JSON.parse(event.body || "{}");

    if (!userIds || !Array.isArray(userIds) || !title || !body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields: userIds (array), title, body" }),
      };
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/"
    });

    let sentCount = 0;
    let failedCount = 0;

    // Send notification to each user's subscriptions
    for (const uid of userIds) {
      try {
        const userDocRef = doc(db, "users", uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          continue;
        }

        const userData = userSnap.data();
        const subscriptions = userData?.push_subscriptions || [];

        for (const sub of subscriptions) {
          if (sub && sub.endpoint) {
            try {
              await webpush.sendNotification(sub, payload);
              sentCount++;
            } catch (err: any) {
              // Expired or invalid endpoint status code/error
              console.error(`Failed to send push to sub of user ${uid}:`, err.message);
              failedCount++;
            }
          }
        }
      } catch (err: any) {
        // Log silently without breaking the delivery sequence to remaining users
        console.error(`Error querying user ${uid}:`, err.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sentCount, failedCount }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
