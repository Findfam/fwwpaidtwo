/* Seed admin helper: fill your UID in SEED_ADMIN_UIDS */
(function(){
  const SEED_ADMIN_UIDS = [
    isR4ZdOhuydUOIwj26qNmOx8U5Y2,
    pef9pQro8ZZT7f76ksbkhuCdbtL2
  ];

  function log(t){ const el = document.getElementById('out'); if(el) el.textContent = (t||''); console.log(t); }

  document.getElementById('seed').addEventListener('click', async ()=>{
    if(!firebase.apps.length && window.__initFirebase) window.__initFirebase();
    const u = firebase.auth().currentUser;
    if(!u){ log('Please sign in first.'); return; }
    if(SEED_ADMIN_UIDS.indexOf(u.uid) === -1){ log('Your UID is not allowed here. Edit seed-admin.js first. UID: '+u.uid); return; }
    await firebase.firestore().collection('admins').doc(u.uid).set({ isAdmin:true, seededAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    log('Admin seeded for UID: '+u.uid);
  });
})();
