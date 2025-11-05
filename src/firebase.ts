// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBeQYaFl-AgGaiYQCrS1iFUaMV8xBbTGgU",
  authDomain: "evaluaciones360-eb048.firebaseapp.com",
  projectId: "evaluaciones360-eb048",
  storageBucket: "evaluaciones360-eb048.firebasestorage.app",
  messagingSenderId: "499373653965",
  appId: "1:499373653965:web:f3c016983a73238223ce84",
  measurementId: "G-C133JMWEM2"
};

// Solo una inicialización
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
