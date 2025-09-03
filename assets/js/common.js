
// ---------- Common App Helpers (Auth, Firestore, Guards) ----------

// IMPORTANT: You must fill firebase-config.js with your project keys.
// See README for instructions.
/* global firebase */
let auth, db, functions, messaging;
// Robust Firebase initializer that works regardless of script load order
window.__initFirebase = function(){
  try {
    if (!window.firebase || !window.firebaseConfig) return false;
    if (!firebase.apps.length) {
      firebase.initializeApp(window.firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    try { functions = firebase.app().functions(); } catch(e) {}
    try { messaging = firebase.messaging(); } catch(e) {}
    return true;
  } catch (e) {
    console.error("Firebase init failed:", e);
    return false;
  }
};

// Try immediately; if SDK isn't ready yet, try again on window load
if (!window.__initFirebase()) {
  window.addEventListener('load', function(){
    // Give the browser a tick to ensure all scripts are parsed
    setTimeout(window.__initFirebase, 0);
  });
}

// Email verification gate
async function requireVerifiedUser() {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async (u) => {
      if (!u) return reject({code:"auth/not-signed-in"});
      await u.reload();
      if (!u.emailVerified) {
        reject({code:"auth/email-not-verified"});
      } else {
        resolve(u);
      }
    });
  });
}

// Signed-in but not necessarily verified (for login pages)
async function waitForAuth() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(resolve);
  });
}

// UI helpers
function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function show(el){ if(typeof el==='string') el=qs(el); el?.classList.remove('hidden'); }
function hide(el){ if(typeof el==='string') el=qs(el); el?.classList.add('hidden'); }
function toast(msg, cls="notice"){ const n=document.createElement('div'); n.className=cls; n.textContent=msg; document.body.prepend(n); setTimeout(()=>n.remove(), 4000); }

// Role helpers (admin via "admins" collection; premium via user doc {plan:'premium'})
async function getUserProfile(uid) {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}
async function isAdmin(uid){
  const u = auth.currentUser;
  if(!u) return false;
  const token = await u.getIdTokenResult(true);
  return token.claims && token.claims.admin === true;
}
async function requireAdmin(){
  const u = await requireVerifiedUser();
  const ok = await isAdmin(u.uid);
  if(!ok) throw {code:"auth/not-admin"};
  return u;
}
async function requirePlan(plan){ // 'premium' or 'free'
  const u = await requireVerifiedUser();
  const profile = await getUserProfile(u.uid);
  if(!profile || profile.plan !== plan) throw {code:"auth/wrong-plan"};
  return {user:u, profile};
}

// In-app real-time notifications: listen to 'notifications' collection scoped to user subscriptions
async function listenNotifications(uid, cb){
  return db.collection("notifications")
    .where("targets","array-contains", uid)
    .orderBy("createdAt","desc")
    .limit(20)
    .onSnapshot(snap=>{
      const list = snap.docs.map(d=>({id:d.id, ...d.data()}));
      cb(list);
    });
}

// Subscribe to posts (user opt-in)
async function setSubscribed(uid, val){
  await db.collection("users").doc(uid).set({subscribed:Boolean(val)}, {merge:true});
}

// ---------- Nav wireups (optional) ----------
document.addEventListener("click", (e)=>{
  const a = e.target.closest("[data-logout]");
  if(a){
    e.preventDefault();
    auth.signOut().then(()=>{
      window.location.href = "logout.html";
    });
  }
});
