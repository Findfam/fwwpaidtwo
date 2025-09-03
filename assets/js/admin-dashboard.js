
/* global firebase, auth, db, functions, uploadFileToStorage, qs, qsa, show, hide, toast */
(function(){
  // Tab logic
  const dash = qs("#adminDashboard");
  const tabUsers = qs("#tabUsers");
  const tabPosts = qs("#tabPosts");
  const tabActivity = qs("#tabActivity");
  const tabDating = qs("#tabDating");
  const tabs = { users: tabUsers, posts: tabPosts, activity: tabActivity, dating: tabDating };

  function setTab(name){
    Object.values(tabs).forEach(hide);
    show(tabs[name]);
  }

  document.addEventListener("click", (e)=>{
    const t = e.target.closest("[data-tab]");
    if(t){
      e.preventDefault();
      setTab(t.getAttribute("data-tab"));
    }
  });

  // Admin gate
  auth.onAuthStateChanged(async (u)=>{
    if(!u){
      hide("#postForm");
      hide(dash);
      return;
    }
    try {
      const token = await u.getIdTokenResult(true);
      const isAdmin = token.claims && token.claims.admin === true;
      if(isAdmin){
        show("#postForm");
        show(dash);
        setTab("users");
        initAllAdmin();
      } else {
        hide("#postForm");
        hide(dash);
      }
    } catch(err){
      console.error(err);
      hide("#postForm"); hide(dash);
    }
  });

  // Users (real-time)
  let stopUsers = null;
  function renderUserCard(id, u){
    const plan = u.plan || "free";
    const admin = u.admin === true; // mirror claim if you store it; otherwise token-based only
    const subscribed = !!u.subscribed;
    return `<div class="card">
      <div class="grid">
        <div class="grid">
          <img class="avatar" src="${u.photoURL || ''}" alt="avatar"/>
          <div><strong>${u.name || u.email || id}</strong><div class="small">Plan: ${plan}${u.paid ? " (paid)" : ""}</div></div>
        </div>
        <div class="nav">
          <button class="btn" data-action="toggle-subscribed" data-uid="${id}" data-val="${(!subscribed)}">${subscribed ? "Unsubscribe" : "Subscribe"}</button>
          <button class="btn" data-action="make-admin" data-uid="${id}">Toggle Admin</button>
        </div>
      </div>
      <div class="small">UID: ${id}</div>
    </div>`;
  }
  function initUsers(){
    const container = qs("#usersTable");
    if(stopUsers) stopUsers();
    stopUsers = db.collection("users").orderBy("plan").onSnapshot(async snap=>{
      container.innerHTML = snap.docs.map(d=>renderUserCard(d.id, d.data())).join("");
    });
  }

  // Handle user actions
  document.addEventListener("click", async (e)=>{
    const btn = e.target.closest("[data-action]");
    if(!btn) return;
    const uid = btn.getAttribute("data-uid");
    const action = btn.getAttribute("data-action");
    if(action === "toggle-subscribed"){
      const to = btn.getAttribute("data-val") === "true";
      try{
        await db.collection("users").doc(uid).set({ subscribed: to }, { merge: true });
        toast("Subscription status updated.","success");
      }catch(err){ toast(err.message || String(err), "error"); }
    }
    
    if(action === "set-plan"){
      const plan = btn.getAttribute("data-val");
      try{
        await db.collection("users").doc(uid).set({ plan: plan, paid: (plan === 'premium') }, { merge: true });
        toast("Plan updated to " + plan + ".", "success");
      }catch(err){ toast(err.message || String(err), "error"); }
    }
if(action === "make-admin"){
      try{
        const callable = firebase.functions().httpsCallable("setAdmin");
        await callable({ uid });
        toast("Admin claim toggled (if permitted). Re-login may be required.","success");
      }catch(err){ toast(err.message || String(err), "error"); }
    }
  });

  // Posts (real-time for admin list)
  let stopAdminPosts = null;
  function renderAdminPost(id, p){
    return `<div class="card">
      <img style="max-width:100%;border-radius:12px" src="${p.imageURL || ''}" alt="post"/>
      <textarea class="input" data-field="text" data-id="${id}">${p.text || ""}</textarea>
      <div class="nav">
        <label class="btn">
          Replace Image
          <input type="file" accept="image/*" data-action="replace-image" data-id="${id}" style="display:none"/>
        </label>
        <button class="btn" data-action="save-post" data-id="${id}">Save</button>
        <button class="btn" data-action="delete-post" data-id="${id}">Delete</button>
      </div>
      <div class="small">Post ID: ${id}</div>
    </div>`;
  }
  function initAdminPosts(){
    const cont = qs("#adminPostsList");
    if(stopAdminPosts) stopAdminPosts();
    stopAdminPosts = db.collection("posts").orderBy("createdAt","desc").onSnapshot(snap=>{
      cont.innerHTML = snap.docs.map(d=>renderAdminPost(d.id, d.data())).join("");
    });
  }

  // Handle post actions
  document.addEventListener("change", async (e)=>{
    const input = e.target;
    if(input && input.getAttribute("data-action") === "replace-image"){
      const id = input.getAttribute("data-id");
      const file = input.files[0];
      if(!file) return;
      try{
        const url = await uploadFileToStorage(file, `posts/${Date.now()}_${file.name}`);
        await db.collection("posts").doc(id).set({ imageURL: url }, { merge: true });
        toast("Image replaced.","success");
      }catch(err){ toast(err.message || String(err),"error"); }
    }
  });
  document.addEventListener("click", async (e)=>{
    const btn = e.target.closest("[data-action]");
    if(!btn) return;
    const id = btn.getAttribute("data-id");
    if(btn.getAttribute("data-action") === "save-post"){
      const textEl = qs(`textarea[data-field="text"][data-id="${id}"]`);
      try{
        await db.collection("posts").doc(id).set({ text: textEl.value }, { merge: true });
        toast("Post saved.","success");
      }catch(err){ toast(err.message || String(err), "error"); }
    }
    if(btn.getAttribute("data-action") === "delete-post"){
      if(!confirm("Delete this post?")) return;
      try{
        await db.collection("posts").doc(id).delete();
        toast("Post deleted.","success");
      }catch(err){ toast(err.message || String(err), "error"); }
    }
  });

  // Activity (simple live feed from users & notifications)
  let stopActivityUsers = null, stopActivityNotifs = null;
  function initActivity(){
    const cont = qs("#activityList");
    if(stopActivityUsers) stopActivityUsers();
    if(stopActivityNotifs) stopActivityNotifs();

    stopActivityUsers = db.collection("users").orderBy("plan").onSnapshot(snap=>{
      const items = snap.docs.map(d=>{
        const u = d.data();
        return `<div class="card"><strong>${u.name || d.id}</strong>
          <div class="small">Plan: ${u.plan || 'free'} ${u.paid ? '(paid)' : ''}</div></div>`;
      });
      cont.innerHTML = items.join("");
    });

    stopActivityNotifs = db.collection("notifications").orderBy("createdAt","desc").limit(20).onSnapshot(snap=>{
      const items = snap.docs.map(d=>{
        const n = d.data();
        return `<div class="card"><div>${n.title || 'Notification'}</div>
          <div class="small">post: ${n.postId || ''}</div></div>`;
      });
      // Append below users snapshot (simple merge)
      cont.innerHTML += items.join("");
    });
  }
})();


  // Dating profiles (admin view + delete)
  let stopDating = null;
  function renderDatingAdminCard(id, p){
    const img = p.imageURL ? `<img class="avatar" src="${p.imageURL}" alt="profile"/>` : "";
    return `<div class="card">
      <div class="grid">
        ${img}
        <div>
          <div><strong>${p.name || id}</strong></div>
          <div class="small">${p.country || ''}</div>
          <div class="small">WhatsApp: ${p.whatsapp || ''}</div>
        </div>
      </div>
      <div class="nav">
        <button class="btn" data-action="delete-dating" data-id="${id}" data-path="${p.imagePath || ''}">Delete</button>
      </div>
    </div>`;
  }
  function initDating(){
    const cont = qs("#datingAdminList");
    if(stopDating) stopDating();
    stopDating = db.collection("dating_profiles").orderBy("updatedAt","desc").onSnapshot(snap=>{
      cont.innerHTML = snap.docs.map(d=>renderDatingAdminCard(d.id, d.data())).join("");
    });
  }

  // Hook into admin initialization
  const _oldInitAfterAdmin = initActivity; // reuse as marker
  function initAllAdmin(){
    initUsers(); initAdminPosts(); initActivity(); initDating();
  }

  // Replace previous call sequence
  document.addEventListener("DOMContentLoaded", ()=>{}); // no-op

  document.addEventListener("click", async (e)=>{
    const btn = e.target.closest("[data-action='delete-dating']");
    if(!btn) return;
    const id = btn.getAttribute("data-id");
    const path = btn.getAttribute("data-path");
    if(!confirm("Delete this dating profile?")) return;
    try{
      // Delete Firestore doc
      await db.collection("dating_profiles").doc(id).delete();
      // Attempt to delete Storage object if path exists (requires rules to allow admin)
      if(path){
        try{
          const ref = firebase.storage().ref().child(path);
          await ref.delete();
        }catch(err){ console.warn('Storage delete failed:', err.message); }
      }
      toast("Profile deleted.","success");
    }catch(err){
      toast(err.message || String(err), "error");
    }
  });
