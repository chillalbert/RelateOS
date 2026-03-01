/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDeCQvcjI6HhXe6tnqS5VtF6mAAB6mHmOs",
  authDomain: "random-988ba.firebaseapp.com",
  databaseURL: "https://random-988ba-default-rtdb.firebaseio.com",
  projectId: "random-988ba",
  storageBucket: "random-988ba.appspot.com",
  messagingSenderId: "777157828577",
  appId: "1:777157828577:web:06f23ab9cdb57b42e23ca0",
  measurementId: "G-XYX2DHXGJY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
