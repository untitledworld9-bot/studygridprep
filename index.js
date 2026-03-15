console.log("INDEX JS RUNNING");

import { db, auth } from "./firebase.js"; 

import { 
getFirestore,
collection,
onSnapshot
} from 
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


if(Notification.permission !== "granted"){
 Notification.requestPermission();
}

// Service worker
if ("serviceWorker" in navigator) {
 navigator.serviceWorker.register("/firebase-messaging-sw.js")
 .then(reg => console.log("SW registered"))
 .catch(err => console.log("SW error", err));
}


// Current user
const currentUser = localStorage.getItem("userName");


// -------------------------------
// DUPLICATE PROTECTION SYSTEM
// -------------------------------

let seenNotifications = new Set();
let seenPromotions = new Set();
let seenAnnouncements = new Set();


// -------------------------------
// PUSH NOTIFICATION SYSTEM
// -------------------------------

onSnapshot(collection(db,"notifications"), snap=>{

snap.docChanges().forEach(change=>{

if(change.type !== "added") return;

const id = change.doc.id;

if(seenNotifications.has(id)) return;

seenNotifications.add(id);

const n = change.doc.data();

if(n.user === currentUser || n.user === "all"){

navigator.serviceWorker.ready.then(reg=>{

reg.showNotification(n.title,{
body:n.body,
icon:"/icon-192.png",
badge:"/icon-192.png"
});

});

}

});

});


// -------------------------------
// PROMOTION POPUP
// -------------------------------

onSnapshot(collection(db,"promotions"), snap=>{

snap.docChanges().forEach(change=>{

if(change.type !== "added") return;

const id = change.doc.id;

if(seenPromotions.has(id)) return;

seenPromotions.add(id);

const p = change.doc.data();

if(!p.active) return;

const box = document.createElement("div");

box.style.position="fixed";
box.style.bottom="20px";
box.style.left="20px";
box.style.background="#111";
box.style.color="white";
box.style.padding="14px 18px";
box.style.borderRadius="12px";
box.style.zIndex="9999";
box.style.maxWidth="280px";
box.style.boxShadow="0 0 12px rgba(0,0,0,0.4)";

box.innerHTML=`
<b>${p.title}</b><br>
${p.message}
`;

document.body.appendChild(box);

setTimeout(()=>{
box.remove();
},6000);

});

});


// -------------------------------
// ANNOUNCEMENT SYSTEM
// -------------------------------

onSnapshot(collection(db,"announcements"), snap=>{

snap.docChanges().forEach(change=>{

if(change.type !== "added") return;

const id = change.doc.id;

if(seenAnnouncements.has(id)) return;

seenAnnouncements.add(id);

const a = change.doc.data();

if(!a.active) return;

const box=document.createElement("div");

box.className="admin-msg";

box.innerText="📢 "+a.text;

document.body.appendChild(box);

setTimeout(()=>{
box.remove();
},5000);

});

});