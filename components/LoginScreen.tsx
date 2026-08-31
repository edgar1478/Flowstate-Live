import React, { useState } from 'react';
import { auth } from '../services/firebaseService';

interface LoginScreenProps {
    // onLoginSuccess is no longer needed, App.tsx will listen to auth state changes
}

const LoginScreen: React.FC<LoginScreenProps> = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const getFirebaseErrorMessage = (errorCode: string): string => {
        switch (errorCode) {
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                return 'Invalid email or password.';
            case 'auth/email-already-in-use':
                return 'This email address is already in use.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters.';
            default:
                return 'An unexpected error occurred. Please try again.';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isLogin) {
                await auth.signInWithEmailAndPassword(email, password);
            } else {
                await auth.createUserWithEmailAndPassword(email, password);
            }
            // onLoginSuccess is no longer needed. onAuthStateChanged in App.tsx handles this.
        } catch (err) {
            // Check for error code without instanceof, which is more robust
            // and avoids the import issue with FirebaseError.
            if (err && typeof err === 'object' && 'code' in err) {
                setError(getFirebaseErrorMessage((err as { code: string }).code));
            } else {
                setError('An unknown error occurred.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                     <svg className="w-48 h-auto mx-auto text-[var(--splash-text-primary)]" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <style>
                                {`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&family=Playfair+Display:wght@400&display=swap');`}
                            </style>
                        </defs>
                        <path d="M 60,110 Q 200,50 340,115" stroke="var(--color-accent-primary)" strokeWidth="6" fill="none" strokeLinecap="round" />
                        <path d="M 330,105 L 350,135 L 325,125 Z" fill="var(--color-accent-primary)" />
                        
                        <text x="50%" y="190" textAnchor="middle" style={{ fontFamily: "'Playfair Display', serif", fontSize: "64px", fill: "var(--color-text-primary)" }}>
                            Flowstate
                        </text>
                        <text x="50%" y="240" textAnchor="middle" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500, fontSize: "32px", fill: "var(--color-text-secondary)" }}>
                            Dream it, draft it
                        </text>
                    </svg>
                </div>
                <div className="bg-[var(--color-bg-secondary)] p-8 rounded-xl shadow-lg border border-[var(--color-border-primary)]">
                     <h2 className="text-center text-2xl font-bold text-[var(--color-text-primary)] mb-6">{isLogin ? 'Sign In' : 'Create Account'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-secondary)]">Email Address</label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[var(--color-bg-tertiary)] p-3 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                                />
                            </div>
                        </div>
                        <div>
                             <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-secondary)]">Password</label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[var(--color-bg-tertiary)] p-3 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                                />
                            </div>
                        </div>
                        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                        <div>
                            <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-[var(--color-accent-text)] bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-ring)] disabled:opacity-75">
                                {isLoading ? 'Processing...' : (isLogin ? 'Sign in' : 'Sign up')}
                            </button>
                        </div>
                    </form>
                </div>
                 <p className="mt-6 text-center text-sm text-[var(--color-text-tertiary)]">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="font-medium text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primary-hover)] ml-2">
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default LoginScreen;
