
/* global firebase, auth, db */
(async function(){
  const $ = (s)=>document.querySelector(s);
  function note(t){ const el = $("#saveMsg"); if(el) el.textContent = t || ""; }

  async function ensureInited(){
    if (!firebase.apps.length) {
      if (window.__initFirebase) window.__initFirebase();
    }
  }
  await ensureInited();

  const gate = $("#gate");
  const app = $("#memberApp");

  firebase.auth().onAuthStateChanged(async (u)=>{
    if (!u){
      gate.innerHTML = "<p>Please sign in first.</p>";
      setTimeout(()=>location.href="register-premium.html", 1200);
      return;
    }
    // Refresh token to get latest claims
    await u.getIdToken(true);
    const token = await u.getIdTokenResult();
    const isVerified = u.emailVerified || token.claims.email_verified === true;
    const profile = await firebase.firestore().collection('users').doc(u.uid).get();
    const isMember = (token.claims && token.claims.member === true) || (profile.exists && profile.data().plan === 'premium');

    if(!isVerified){
      gate.innerHTML = "<p>Your email is not verified. Please verify then return.</p>";
      return;
    }
    if(!isMember){
      gate.innerHTML = "<p>You have not completed payment yet. Please finish on the <a href='register-premium.html'>Register Premium</a> page.</p>";
      return;
    }
    // Authorized
    gate.classList.add("hidden");
    app.classList.remove("hidden");

    // Prefill current profile
    const doc = await firebase.firestore().collection("members").doc(u.uid).get();
    const data = doc.exists ? doc.data() : {};
    $("#fullName").value = data.fullName || (u.displayName || "");
    $("#bio").value = data.bio || "";
    $("#lostNames").value = (data.lostNames||[]).join(", ");
    if (data.photoURL){ $("#preview").src = data.photoURL; }

    // Save handler
    document.getElementById("profileForm").addEventListener("submit", async (e)=>{
      e.preventDefault();
      try{
        const fullName = $("#fullName").value.trim();
        const bio = $("#bio").value.trim();
        const lostNames = $("#lostNames").value.split(/[,\\n]+/).map(s=>s.trim()).filter(Boolean);

        // Upload one photo if selected
        let photoURL = data.photoURL || null;
        const f = document.getElementById("photo").files[0];
        if (f){
          const ref = firebase.storage().ref().child(`members/${u.uid}/profile.jpg`);
          const snap = await ref.put(f);
          photoURL = await snap.ref.getDownloadURL();
        }

        await firebase.firestore().collection("members").doc(u.uid).set({
          uid: u.uid, fullName, bio, lostNames, photoURL,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, {merge:true});

        note("Saved.");
        renderMembers();
      }catch(err){
        note(err.message||String(err));
      }
    });

    // Logout btn
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn){
      logoutBtn.addEventListener("click", ()=> firebase.auth().signOut().then(()=>location.href="index.html"));
    }

    // Initial list
    renderMembers();
  });

  async function renderMembers(){
    const list = document.getElementById("membersList");
    if (!list) return;
    const snap = await firebase.firestore().collection("members").orderBy("createdAt","desc").limit(200).get();
    list.innerHTML = "";
    snap.forEach(doc=>{
      const m = doc.data();
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `
        <img class="avatar" src="${m.photoURL || 'images/placeholder.png'}" alt="photo">
        <h4 style="margin:8px 0 4px 0">${(m.fullName||'Member')}</h4>
        ${(m.lostNames && m.lostNames.length) ? `<div class="note">Looking for: ${m.lostNames.join(', ')}</div>` : ''}
        ${(m.bio) ? `<p class="note">${m.bio.substring(0,160)}</p>` : ''}
      `;
      list.appendChild(el);
    });
  }
})();
