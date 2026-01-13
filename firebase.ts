import * as firebaseApp from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBbW8gOmYL-60eBtc3V5K0DKOcql1GJ-4Y",
  authDomain: "gestion-detablissement.firebaseapp.com",
  projectId: "gestion-detablissement",
  storageBucket: "gestion-detablissement.firebasestorage.app",
  messagingSenderId: "145695550964",
  appId: "1:145695550964:web:7bb7522df991fe6e5adda1"
};

const app = firebaseApp.initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const APP_ID = 'gestion-etablissement-prod'; // Collection prefix