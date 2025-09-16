
/* global firebase, paypal, auth, db, functions */
(function(){
  const $ = (sel)=>document.querySelector(sel);
  const msgBox = document.getElementById("auth-message-box");
  function msg(t, cls=""){ 
    if(!msgBox) return console.log(t);
    msgBox.innerHTML = `<div class="card ${cls}">${t}</div>`;
  }

  let currentUser = null;

  function showVerifyStep(email){
    $("#v-email").textContent = email || "";
    $("#verify-step").classList.remove("hidden");
  }
  function showPaypalStep(){
    $("#paypal-step").classList.remove("hidden");
  }

  async function ensureInited(){
    if (!firebase.apps.length) {
      if (window.__initFirebase) window.__initFirebase();
    }
  }

  window.addEventListener("DOMContentLoaded", async()=>{
    await ensureInited();
    const signupForm = document.getElementById("signup-form");
    const refreshBtn = document.getElementById("refresh-btn");

    firebase.auth().onAuthStateChanged(async(u)=>{
      currentUser = u || null;
    });

    // Sign up handler
    if (signupForm){
      signupForm.addEventListener("submit", async (e)=>{
        e.preventDefault();
        await ensureInited();
        const email = document.getElementById("signup-email").value.trim();
        const password = document.getElementById("signup-password").value;
        const firstName = document.getElementById("signup-firstName").value.trim();
        const lastName = document.getElementById("signup-lastName").value.trim();
        const whatsapp = document.getElementById("signup-whatsapp").value.trim();
        const country = document.getElementById("signup-country").value.trim();

        if (!email || !password){ return msg("Email and password are required","err"); }
        try{
          const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
          await cred.user.updateProfile({displayName: `${firstName} ${lastName}`.trim()});
          await firebase.firestore().collection("users").doc(cred.user.uid).set({
            firstName, lastName, whatsapp, country, plan: "premium", subscribed: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, {merge:true});
          await cred.user.sendEmailVerification();
          msg("Account created. Verification email sent.");
          showVerifyStep(email);
        }catch(err){
          msg(err.message||String(err), "err");
        }
      });
    }

    // Refresh (check verification) button
    if (refreshBtn){
      refreshBtn.addEventListener("click", async ()=>{
        if (!firebase.auth().currentUser) return msg("Please sign in again.","err");
        await firebase.auth().currentUser.reload();
        const verified = firebase.auth().currentUser.emailVerified;
        if (!verified){
          $("#verify-error").textContent = "Email still not verified yet. Please click the link in your inbox.";
          return;
        }
        $("#verify-error").textContent = "";
        msg("Email verified. You can now pay securely.");
        showPaypalStep();
        renderPayPal();
      });
    }

    function renderPayPal(){
      if (!paypal || !paypal.Buttons){ 
        document.getElementById("paypal-error").textContent = "PayPal SDK failed to load."; 
        return;
      }
      paypal.Buttons({
        createOrder: function(data, actions){
          return actions.order.create({
            purchase_units: [{
              amount: { value: "10.00", currency_code: "USD" },
              description: "Premium membership (one-time)"
            }]
          });
        },
        onApprove: async function(data, actions){
          try{
            const details = await actions.order.capture();
            // Call secure Firebase Function to verify order and set custom claim
            const callable = firebase.functions().httpsCallable("verifyPayPalOrder");
            const res = await callable({ orderId: data.orderID });
            // Force refresh ID token to receive custom claim
            await firebase.auth().currentUser.getIdToken(true);
            window.location.href = "registered-members.html";
          }catch(err){
            document.getElementById("paypal-error").textContent = (err.message||String(err));
          }
        },
        onError: function(err){
          document.getElementById("paypal-error").textContent = (err.message||String(err));
        }
      }).render("#paypal-button-container");
    }
  });
})();
