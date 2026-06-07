import { Handler } from "@netlify/functions";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };

// Initialize Firebase App directly using the imported JSON
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

const publicKey = "BCFXI0MEi3CVogRK6TZVK7B0zuqcuwU_K8mBNr7sD1yXkdXHTr-Z_vwDZaYiF4VdhstF4V-I1ncoFdoR4E2IIFA";

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

    let sentCount = 0;
    let failedCount = 0;
    const tokens: string[] = [];

    // Retrieve active tokens for each specified user
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
          if (typeof sub === "string") {
            tokens.push(sub);
          }
        }
      } catch (err: any) {
        console.error(`Error querying user ${uid}:`, err.message);
      }
    }

    if (tokens.length > 0) {
      const serverKey = process.env.FCM_SERVER_KEY || process.env.VAPID_PRIVATE_KEY || "YOUR_PRIVATE_VAPID_KEY_HERE_AS_PLACEHOLDER";
      
      try {
        const response = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `key=${serverKey}`
          },
          body: JSON.stringify({
            registration_ids: tokens,
            notification: {
              title,
              body,
              sound: "default"
            },
            data: {
              title,
              body,
              url: url || "/"
            },
            priority: "high"
          })
        });

        const result: any = await response.json();
        
        if (!response.ok) {
          console.error(`[FCM ERROR] Non-200 Response: ${response.status}`, result);
          failedCount += tokens.length;
        } else {
          console.log("[FCM SUCCESS] API Response:", result);
          sentCount += result.success || 0;
          failedCount += result.failure || 0;
        }
      } catch (err: any) {
        console.error(`[PUSH ERROR] Failed to send via FCM legacy gateway: ${err.message}`);
        failedCount += tokens.length;
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

