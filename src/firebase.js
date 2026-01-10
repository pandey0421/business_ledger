import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA_Mzkp11J0wixptA896OY6JykHyVn20OE",
  authDomain: "father-business.firebaseapp.com",
  projectId: "father-business",
  storageBucket: "father-business.firebasestorage.app",
  messagingSenderId: "169138412744",
  appId: "1:169138412744:web:1a3ad329a7d5098fc899fd"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Initialize Firestore with persistent cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
