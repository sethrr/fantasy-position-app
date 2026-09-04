// Firebase project config for live game sync.
// Get these values from: Firebase Console > Project Settings > General > Your apps > SDK setup and configuration
const firebaseConfig = {

  apiKey: "AIzaSyCmpfUtolskFbultcItCj1kTnFBHwHv18Q",

  authDomain: "fantasy-pickles.firebaseapp.com",

  projectId: "fantasy-pickles",

  storageBucket: "fantasy-pickles.firebasestorage.app",

  messagingSenderId: "975713472287",

  appId: "1:975713472287:web:c7541b27a7cc5d44202a2a"

};


let gameDocRef = null;
try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        gameDocRef = firebase.firestore().collection('games').doc('current');
    } else {
        console.warn('Firebase is not configured yet — live sync is disabled. Fill in firebase-config.js.');
    }
} catch (e) {
    console.error('Firebase init failed:', e);
}
