import React, { useState, useEffect } from 'react';
import { Card } from '../types';
import { CloseIcon, WandIcon } from './icons';
import { generateContextualText } from '../services/geminiService';
import { formatNewCardContent, htmlToPlainText, createSanitizedMarkup } from '../services/documentParser';

interface GenerateInContextModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddCard: (cardData: Partial<Omit<Card, 'id'>>, index: number) => void;
    precedingCard: Card | null;
    followingCard: Card | null;
    insertIndex: number;
    defaultImportFont: { family: string; size: string };
}

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

const GenerateInContextModal: React.FC<GenerateInContextModalProps> = ({
    isOpen,
    onClose,
    onAddCard,
    precedingCard,
    followingCard,
    insertIndex,
    defaultImportFont
}) => {
    const [intent, setIntent] = useState('');
    const [plan, setPlan] = useState('');
    const [draft, setDraft] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [alternatives, setAlternatives] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        // Reset state when modal opens/closes or context changes
        setIntent('');
        setPlan('');
        setDraft('');
        setAlternatives(null);
        setError(null);
        setIsGenerating(false);
    }, [isOpen, precedingCard, followingCard]);

    const handleGenerate = async () => {
        setError(null);
        setIsGenerating(true);
        setAlternatives(null);

        const prompt = `
            Based on the following, generate a new passage:
            [INTENT]: ${intent}
            [PLAN]: ${plan}
            [DRAFT]: ${draft}
        `.trim();
        
        const contextBefore = precedingCard ? htmlToPlainText(precedingCard.content) : '';
        const contextAfter = followingCard ? htmlToPlainText(followingCard.content) : '';

        try {
            const result = await generateContextualText(prompt, contextBefore, contextAfter, 3);
            if (result.length === 0) {
                setError("The AI couldn't generate any alternatives. Try providing more specific instructions.");
            } else {
                setAlternatives(result);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSelectAlternative = (content: string) => {
        const formattedContent = formatNewCardContent(content, defaultImportFont.family, defaultImportFont.size);
        onAddCard({ content: formattedContent }, insertIndex);
        onClose();
    };

    if (!isOpen) return null;

    const isGenerateDisabled = (!intent && !plan && !draft) || isGenerating;
    
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="flex items-start justify-center gap-8 w-full h-full max-h-[90vh] max-w-[95vw]">
                {/* BEFORE Card */}
                {precedingCard ? (
                    <div className="w-[36rem] p-4 bg-[var(--color-bg-secondary)] rounded-lg shadow-lg flex flex-col flex-shrink-0">
                        <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex-shrink-0">Preceding Text</h4>
                        <div className="prose-card text-sm text-[var(--color-text-secondary)] overflow-y-auto h-72" dangerouslySetInnerHTML={createSanitizedMarkup(precedingCard.content)} />
                    </div>
                ) : <div className="w-[36rem] flex-shrink-0 hidden lg:block"></div> }

                {/* MAIN MODAL */}
                <div
                    className="bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-full flex-shrink"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center flex-shrink-0">
                        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Generate in Context</h2>
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--color-element-primary)]">
                            <CloseIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
                        </button>
                    </div>
                    
                    <div className="flex-grow p-6 space-y-4 overflow-y-auto">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Provide a direction for the AI. You only need to fill out one field. The AI will use the surrounding cards for context.
                        </p>
                        
                        <div>
                            <label className="text-sm font-medium text-[var(--color-text-primary)]">Intent</label>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">What is the high-level goal of this new section?</p>
                            <input
                                type="text"
                                value={intent}
                                onChange={e => setIntent(e.target.value)}
                                placeholder="e.g., Introduce the main conflict"
                                className="w-full bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                            />
                        </div>
                        
                         <div>
                            <label className="text-sm font-medium text-[var(--color-text-primary)]">Plan</label>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">List a few key points or beats to include.</p>
                            <textarea
                                value={plan}
                                onChange={e => setPlan(e.target.value)}
                                placeholder="e.g., - The character receives a mysterious letter.&#10;- They are hesitant at first.&#10;- They decide to investigate."
                                rows={3}
                                className="w-full bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] resize-none"
                            />
                        </div>
                        
                         <div>
                            <label className="text-sm font-medium text-[var(--color-text-primary)]">Draft</label>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Write a rough version for the AI to improve and expand upon.</p>
                            <textarea
                                value={draft}
                                onChange={e => setDraft(e.target.value)}
                                placeholder="e.g., Walter was scared. A letter came. What should he do?"
                                rows={6}
                                className="w-full bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] resize-none"
                            />
                        </div>
                        
                        {error && <div className="bg-red-100 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
                        
                        {alternatives && (
                            <div className="space-y-3 pt-4 border-t border-[var(--color-border-primary)]">
                                 <h3 className="text-md font-semibold text-[var(--color-text-primary)]">Choose a version:</h3>
                                 {alternatives.map((alt, index) => (
                                     <div 
                                        key={index}
                                        onClick={() => handleSelectAlternative(alt)}
                                        className="bg-[var(--color-accent-subtle-bg)] p-3 rounded-lg border border-[var(--color-accent-subtle-border)] hover:ring-2 hover:ring-[var(--color-ring)] cursor-pointer"
                                    >
                                        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{alt}</p>
                                     </div>
                                 ))}
                            </div>
                        )}

                    </div>
                    
                    <div className="flex-shrink-0 p-4 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border-primary)] flex justify-end">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerateDisabled}
                            className="flex items-center justify-center bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] hover:from-[var(--color-accent-primary-hover)] hover:to-[var(--color-accent-secondary-hover)] text-[var(--color-accent-text)] font-semibold px-5 py-2.5 rounded-lg shadow disabled:opacity-50"
                        >
                            {isGenerating ? <LoadingSpinner /> : <><WandIcon className="w-5 h-5 mr-2"/> Generate</>}
                        </button>
                    </div>
                </div>

                {/* AFTER Card */}
                {followingCard ? (
                    <div className="w-[36rem] p-4 bg-[var(--color-bg-secondary)] rounded-lg shadow-lg flex flex-col flex-shrink-0">
                        <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 flex-shrink-0">Following Text</h4>
                        <div className="prose-card text-sm text-[var(--color-text-secondary)] overflow-y-auto h-72" dangerouslySetInnerHTML={createSanitizedMarkup(followingCard.content)} />
                    </div>
                ) : <div className="w-[36rem] flex-shrink-0 hidden lg:block"></div> }
            </div>
        </div>
    );
};

export default GenerateInContextModal;