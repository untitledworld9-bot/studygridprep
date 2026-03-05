import {
db,
collection,
onSnapshot
} from "./firebase.js";

const totalUsers=document.getElementById("totalUsers");
const onlineUsers=document.getElementById("onlineUsers");
const focusTime=document.getElementById("focusTime");
const rooms=document.getElementById("rooms");
const messages=document.getElementById("messages");
const visitors=document.getElementById("visitors");

/* USERS DATA */

onSnapshot(collection(db,"users"), snap=>{

let total=0;
let online=0;
let focus=0;

snap.forEach(doc=>{
const u=doc.data();

total++;

if(u.status==="Online" || u.status==="Focusing 👋"){
online++;
}

focus += u.focusTime || 0;

});

totalUsers.innerText=total;
onlineUsers.innerText=online;
focusTime.innerText=Math.floor(focus/60)+"h";

});

/* ROOMS */

onSnapshot(collection(db,"rooms"), snap=>{
rooms.innerText=snap.size;
});

/* MESSAGES */

onSnapshot(collection(db,"messages"), snap=>{
messages.innerText=snap.size;
});

/* LIVE VISITORS */

onSnapshot(collection(db,"users"), snap=>{
visitors.innerText=snap.size;
});