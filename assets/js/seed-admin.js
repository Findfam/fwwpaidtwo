(function(){
  const SEED_ADMIN_UIDS = [
    isR4ZdOhuydUOIwj26qNmOx8U5Y2,
    pef9pQro8ZZT7f76ksbkhuCdbtL2
  ];

  function log(msg){
    const el = document.getElementById('out');
    if(el) el.textContent = msg;
    console.log(msg);
  }

  // Ensure Firebase is initialized
  if (!firebase.apps.length && window.__initFirebase) window.__initFirebase();

  document.getElementById('seed').addEventListener('click', async ()=>{
    const u = firebase.auth().currentUser;

    if (!u) {
      log("Please sign in first, then click again.");
      return;
    }

    if (SEED_ADMIN_UIDS.indexOf(u.uid) === -1) {
      log("Your UID is not in SEED_ADMIN_UIDS. Edit seed-admin.js and add:\n" + u.uid);
      return;
    }

    try {
      await firebase.firestore()
        .collection('admins')
        .doc(u.uid)
        .set({
          isAdmin: true,
          seededAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      log("Admin seeded successfully for UID: " + u.uid);
    } catch (err) {
      log("Error: " + (err.message || String(err)));
    }
  });
})();
