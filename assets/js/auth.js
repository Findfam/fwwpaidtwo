
window.addEventListener("DOMContentLoaded", () => {
  // Ensure Firebase is initialized
  if (!firebase.apps.length) {
    console.error("Firebase app not initialized!");
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  // Utility to display messages on screen
  function showMessage(msg, type = "info") {
    console.log(msg);
    let box = document.querySelector("#auth-message-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "auth-message-box";
      box.style.position = "fixed";
      box.style.bottom = "10px";
      box.style.left = "50%";
      box.style.transform = "translateX(-50%)";
      box.style.padding = "10px 20px";
      box.style.borderRadius = "6px";
      box.style.zIndex = "9999";
      box.style.fontFamily = "sans-serif";
      box.style.fontSize = "14px";
      box.style.color = "#fff";
      document.body.appendChild(box);
    }
    box.style.background = type === "error" ? "red" : (type === "success" ? "green" : "blue");
    box.textContent = msg;
    setTimeout(() => { box.remove(); }, 5000);
  }

  // Helper to create user document in Firestore
  function createUserProfile(user, extraData = {}) {
    if (!user) return;
    const userRef = db.collection("users").doc(user.uid);
    userRef.set({
      email: user.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      ...extraData
    }, { merge: true });
  }

  // Auto-detect signup forms/buttons
  const signupForm = document.querySelector("form#signup-form") || document.querySelector("form[data-auth='signup']");
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = signupForm.querySelector("input[type='email']")?.value;
      const password = signupForm.querySelector("input[type='password']")?.value;
      const firstName = signupForm.querySelector("input[name='firstName']")?.value || "";
      const lastName = signupForm.querySelector("input[name='lastName']")?.value || "";
      if (!email || !password) { showMessage("Missing email or password", "error"); return; }
      showMessage("Creating account...", "info");
      auth.createUserWithEmailAndPassword(email, password)
        .then((cred) => {
          return cred.user.sendEmailVerification().then(() => {
            createUserProfile(cred.user, { firstName, lastName });
            showMessage("Account created. Please verify your email.", "success");
          });
        })
        .catch(err => { showMessage(err.message, "error"); });
    });
  }

  // Auto-detect login forms/buttons
  const loginForm = document.querySelector("form#login-form") || document.querySelector("form[data-auth='login']");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = loginForm.querySelector("input[type='email']")?.value;
      const password = loginForm.querySelector("input[type='password']")?.value;
      if (!email || !password) { showMessage("Missing email or password", "error"); return; }
      showMessage("Logging in...", "info");
      auth.signInWithEmailAndPassword(email, password)
        .then((cred) => {
          if (!cred.user.emailVerified) {
            showMessage("Please verify your email before logging in.", "error");
            auth.signOut();
            return;
          }
          showMessage("Login successful! Redirecting...", "success");
          window.location.href = "dashboard.html";
        })
        .catch(err => { showMessage(err.message, "error"); });
    });
  }

  
  // Auto-detect forgot password form
  const forgotForm = document.querySelector("form#forgot-form");
  if(forgotForm){
    forgotForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const email = forgotForm.querySelector("input[type='email']")?.value;
      if(!email){ showMessage("Enter your email.", "error"); return; }
      auth.sendPasswordResetEmail(email).then(()=>{
        showMessage("Reset link sent. Check your inbox.", "success");
      }).catch(err=> showMessage(err.message, "error"));
    });
  }

  console.log("Auth.js with debug initialized successfully.");
});
