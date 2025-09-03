
/* Upload a File to Firebase Storage and return downloadURL */
async function uploadFileToStorage(file, path){
  const ref = firebase.storage().ref().child(path);
  const snap = await ref.put(file);
  const url = await snap.ref.getDownloadURL();
  return url;
}
