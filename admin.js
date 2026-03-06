import {
auth,
onAuthStateChanged,
db,
collection,
onSnapshot,
addDoc,
getDoc,
doc
} from "./firebase.js";

/* ADMIN PROTECTION */

onAuthStateChanged(auth,user=>{

if(!user){
return
}

if(user.email!=="ayushgupt640@gmail.com"){
location.href="/"
}

});

/* ELEMENTS */

const totalUsers=document.getElementById("totalUsers");
const onlineUsers=document.getElementById("onlineUsers");
const focusTime=document.getElementById("focusTime");
const rooms=document.getElementById("rooms");
const messagesCount=document.getElementById("messagesCount");

const userTable=document.getElementById("userTable");
const chatLogs=document.getElementById("chatLogs");

/* SECTION SWITCH */

window.showSection=(id)=>{

document.querySelectorAll(".section")
.forEach(s=>s.classList.remove("active"))

document.getElementById(id)
.classList.add("active")

}

/* USERS DATA */

onSnapshot(collection(db,"users"),snap=>{

let total=0
let online=0
let focus=0
let html=""

snap.forEach(docSnap=>{

const u=docSnap.data()

total++

if(u.status==="Online" || u.status==="Focusing 👋"){
online++
}

focus+=u.focusTime||0

html+=`

<tr>
<td>${u.name}</td>
<td>${u.status}</td>
<td>${u.focusTime||0}</td>
</tr>

`

})

totalUsers.innerText=total
onlineUsers.innerText=online
focusTime.innerText=Math.floor(focus/60)+"h"

userTable.innerHTML=html

})

/* ROOMS */

onSnapshot(collection(db,"rooms"),snap=>{
rooms.innerText=snap.size
})

/* MESSAGES */

onSnapshot(collection(db,"messages"),snap=>{

messagesCount.innerText=snap.size

let html=""

snap.forEach(docSnap=>{

const m=docSnap.data()

html+=`
<div>
<b>${m.from}</b> → ${m.text}
</div>
`

})

chatLogs.innerHTML=html

})

/* ANNOUNCEMENT */

window.sendAnnouncement=async()=>{

const text=document.getElementById("announceText").value

if(!text)return

await addDoc(collection(db,"announcements"),{
text:text,
active:true,
time:Date.now()
})

alert("Announcement Sent")

}

/* PUSH NOTIFICATION (Firestore Method) */

window.sendUserNotification = async ()=>{

const name = document.getElementById("notifyUser").value
const text = document.getElementById("notifyText").value

if(!name || !text){
alert("Enter username & message")
return
}

/* SAVE NOTIFICATION REQUEST */

await addDoc(collection(db,"notifications"),{

user: name,
title: "Untitled World",
body: text,
time: Date.now()

})

alert("Notification Sent")

}