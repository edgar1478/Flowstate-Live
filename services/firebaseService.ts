// Use modular SDK for initialization
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyANxmMqulJDkRKPK2h74O8HhoemCYS-4g8",
    authDomain: "fir-fb-8d369.firebaseapp.com",
    projectId: "fir-fb-8d369",
    storageBucket: "fir-fb-8d369.firebasestorage.app",
    messagingSenderId: "338584338817",
    appId: "1:338584338817:web:957afbe8d2c29b1c5ba880",
    measurementId: "G-8RW2N07RXK"
};

// Initialize Firebase using the compat SDK
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
const db = firebase.firestore(app);

// Export auth instance
export const auth = firebase.auth(app);

export interface UserData {
    projectsXml?: string;
}


/**
 * Saves or updates user data in Firestore, merging with existing data.
 * @param userId The user's unique ID from Firebase Auth.
 * @param data The partial or full user data to save.
 */
export const updateUserData = async (userId: string, data: UserData): Promise<void> => {
    const userDocRef = db.collection("users").doc(userId);
    await userDocRef.set(data, { merge: true });
};

/**
 * Retrieves the user's project data from Firestore.
 * @param userId The user's unique ID.
 * @returns The user data object, or null if no data exists.
 */
export const getUserData = async (userId: string): Promise<UserData | null> => {
    const userDocRef = db.collection("users").doc(userId);
    const docSnap = await userDocRef.get();
    if (docSnap.exists) {
        return docSnap.data() as UserData;
    }
    return null;
};

/**
 * Subscribes to real-time updates for a user's data.
 * @param userId The user's unique ID.
 * @param callback A function to call with the new user data when it changes.
 * @returns An unsubscribe function to detach the listener.
 */
export type Unsubscribe = () => void;
export const subscribeToUserData = (userId: string, callback: (data: UserData | null) => void): Unsubscribe => {
    const userDocRef = db.collection("users").doc(userId);
    const unsubscribe = userDocRef.onSnapshot((docSnap) => {
        if (docSnap.exists) {
            callback(docSnap.data() as UserData);
        } else {
            callback(null); // Document doesn't exist
        }
    });
    return unsubscribe;
};


// Export types to be used in components
export type User = firebase.User;
