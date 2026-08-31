import React from 'react';

const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 bg-[var(--splash-bg)] flex items-center justify-center z-50">
            <div className="animate-fade-in w-64 h-64 text-[var(--splash-text-primary)]">
                <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&family=Playfair+Display:wght@400&display=swap');
                        </style>
                    </defs>
                    <path d="M 60,110 Q 200,50 340,115" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" />
                    <path d="M 330,105 L 350,135 L 325,125 Z" fill="currentColor" />
                    
                    <text x="50%" y="190" textAnchor="middle" style={{ fontFamily: "'Playfair Display', serif", fontSize: "64px", fill: "currentColor" }}>
                        Flowstate
                    </text>
                    <text x="50%" y="240" textAnchor="middle" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 500, fontSize: "32px", fill: "var(--splash-text-secondary)" }}>
                        Dream it, draft it
                    </text>
                </svg>
            </div>
        </div>
    );
};

export default SplashScreen;