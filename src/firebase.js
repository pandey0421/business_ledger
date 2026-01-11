import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCtdxrY390NK-JVbfe_y9yeS-OXSZyaRWo",
  authDomain: "karobaar-khata-prod.firebaseapp.com",
  projectId: "karobaar-khata-prod",
  storageBucket: "karobaar-khata-prod.firebasestorage.app",
  messagingSenderId: "755986166350",
  appId: "1:755986166350:web:2bd358ee704b23b1fb491f",
  measurementId: "G-PMSYXXQ9BX"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Initialize Firestore with persistent cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
