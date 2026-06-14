importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBtiEUVLfJlvCpPvm8J_mLKlXUmwrQ6cs4",
  authDomain: "random-988ba.firebaseapp.com",
  projectId: "random-988ba",
  storageBucket: "random-988ba.appspot.com",
  messagingSenderId: "777157828577",
  appId: "1:777157828577:web:df739eebd66e814ae23ca0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message payload:', payload);
  const notificationTitle = payload.notification?.title || 'RelateOS Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update.',
    icon: '/icon-192.png',
    tag: payload.data?.tag,
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
