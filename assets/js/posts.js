
/* global db, auth, uploadFileToStorage, firebase, qs, show, hide, toast */
(function(){
  const form = qs("#postForm");
  const publicList = qs("#publicPosts");

  // Public feed for everyone
  db.collection("posts").orderBy("createdAt","desc").onSnapshot(snap=>{
    publicList.innerHTML = snap.docs.map(d=>{
      const p = d.data();
      return `<div class="card">
        <img style="max-width:100%;border-radius:12px" src="${p.imageURL || ''}" alt="post image" />
        <p>${(p.text||'').replace(/</g,'&lt;')}</p>
      </div>`;
    }).join("");
  });

  // Admin gate for creation
  auth.onAuthStateChanged(async (u)=>{
    if(!u){ hide(form); return; }
    try{
      const token = await u.getIdTokenResult(true);
      const isAdmin = token.claims && token.claims.admin === true;
      if(isAdmin){
        show(form);
        form.addEventListener("submit", async (e)=>{
          e.preventDefault();
          const file = qs("#postImage").files[0];
          const text = qs("#postText").value.trim();
          if(!file || !text){ toast("Image and text required.","error"); return; }
          try{
            const imageURL = await uploadFileToStorage(file, `posts/${Date.now()}_${file.name}`);
            const docRef = await db.collection("posts").add({
              createdBy: u.uid, text, imageURL,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Notify subscribers (simple client-side fan-out, fine for small scale)
            const subs = await db.collection("users").where("subscribed","==", true).get();
            const batch = db.batch();
            subs.docs.forEach(d=>{
              const nref = db.collection("notifications").doc();
              batch.set(nref, {
                postId: docRef.id,
                targets: [d.id],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                title: "New post published"
              });
            });
            await batch.commit();
            toast("Post published.","success");
            form.reset();
          }catch(err){ toast(err.message || String(err), "error"); }
        }, { once: true });
      } else {
        hide(form);
      }
    }catch(err){ hide(form); }
  });
})();
