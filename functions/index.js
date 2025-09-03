const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

// Helper to get PayPal access token
async function getPayPalAccessToken(){
  const clientId = functions.config().paypal.client_id;
  const secret = functions.config().paypal.secret;
  if(!clientId || !secret){
    throw new functions.https.HttpsError('failed-precondition', 'PayPal API keys are not configured. Run: firebase functions:config:set paypal.client_id="..." paypal.secret="..."');
  }
  const auth = Buffer.from(clientId + ":" + secret).toString('base64');
  const resp = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if(!resp.ok){
    const t = await resp.text();
    throw new functions.https.HttpsError('internal', 'PayPal token error: '+t);
  }
  const data = await resp.json();
  return data.access_token;
}

exports.verifyPayPalOrder = functions.https.onCall( async (data, context) => {
  const uid = context.auth && context.auth.uid;
  if(!uid){
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  if(!data || !data.orderId){
    throw new functions.https.HttpsError('invalid-argument', 'orderId is required');
  }

  const token = await getPayPalAccessToken();

  // Verify order details
  const ordResp = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${data.orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if(!ordResp.ok){
    const t = await ordResp.text();
    throw new functions.https.HttpsError('invalid-argument', 'Order lookup failed: '+t);
  }
  const order = await ordResp.json();

  if (order.status !== 'COMPLETED'){
    throw new functions.https.HttpsError('failed-precondition', 'Order not completed');
  }
  const unit = (order.purchase_units && order.purchase_units[0]) || {};
  const amount = unit.amount && unit.amount.value;
  const currency = unit.amount && unit.amount.currency_code;
  if (amount !== '10.00' || currency !== 'USD'){
    throw new functions.https.HttpsError('failed-precondition', 'Incorrect amount/currency');
  }

  // Mark membership (custom claim)
  const claims = { member: true };
  await admin.auth().setCustomUserClaims(uid, claims);

  // Persist membership doc
  const db = admin.firestore();
  await db.collection('members').doc(uid).set({
    paid: true,
    paidAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true };
});


exports.setAdmin = functions.https.onCall(async (data, context) => {
  // Only existing admins may call this
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }
  const callerUid = context.auth.uid;
  // Allow if caller has custom claim admin OR has /admins/{uid} doc
  const db = admin.firestore();
  const callerDoc = await db.collection('admins').doc(callerUid).get();
  const isCallerAdmin = context.auth.token.admin === true || (callerDoc.exists && callerDoc.data().isAdmin !== false);
  if (!isCallerAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Admins only.');
  }

  const targetUid = data && data.uid;
  const to = data && data.to; // true/false/undefined to toggle
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'Missing uid');

  // Read current custom claims
  const user = await admin.auth().getUser(targetUid);
  const current = user.customClaims || {};
  let nextVal;
  if (typeof to === 'boolean') {
    nextVal = to;
  } else {
    nextVal = !(current.admin === true);
  }
  const next = Object.assign({}, current, { admin: nextVal });
  await admin.auth().setCustomUserClaims(targetUid, next);
  await db.collection('users').doc(targetUid).set({ admin: nextVal }, { merge: true });
  if (nextVal) {
    await db.collection('admins').doc(targetUid).set({ isAdmin: true }, { merge: true });
  } else {
    await db.collection('admins').doc(targetUid).delete().catch(()=>{});
  }
  return { ok: true, admin: nextVal };
});
