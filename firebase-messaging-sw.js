importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
 apiKey: "AIzaSyB_13GJOiLQwxsirfJ7T_4WinaxVmSp7fs",
 authDomain: "untitled-world-2e645.firebaseapp.com",
 projectId: "untitled-world-2e645",
 messagingSenderId: "990115586087",
 appId: "1:990115586087:web:963f68bd59dec5ef0c6e02"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {

 console.log("Background message:", payload);

 if(payload.notification){

  self.registration.showNotification(
   payload.notification.title,
   {
    body: payload.notification.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png"
   }
  );

 }

});

self.addEventListener("notificationclick", function(event){

 event.notification.close();

 event.waitUntil(
  clients.openWindow("https://untitledworld.us.cc")
 );

});