import React, { useState, useRef, useEffect } from 'react';
import { rephraseText, findSynonyms, getWritingCritique, CritiqueTip } from '../services/geminiService';
import { parseDocument, htmlToPlainText, createSanitizedMarkup } from '../services/documentParser';
import { WandIcon, UploadIcon, SaveIcon, CritiqueIcon, CopyIcon, CheckIcon, CameraIcon, CloseIcon, PasteIcon } from './icons';

export interface Selection {
    text: string;
}

export interface ActiveSelection extends Selection {}

interface RephrasePanelProps {
    textToEdit: string;
    activeSelection: ActiveSelection | null;
    onReplaceSelection: (replacementText: string) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
);

const CameraCapture: React.FC<{
    onCapture: (imageDataUrl: string) => void;
    onClose: () => void;
}> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const startCamera = async () => {
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } else {
                    setError("Your browser does not support camera access.");
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                setError("Could not access camera. Please ensure permissions are granted.");
            }
        };

        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                onCapture(dataUrl);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-bg-secondary)] rounded-lg shadow-xl w-full max-w-2xl flex flex-col">
                <div className="p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center">
                    <h3 className="text-lg font-bold">Take Photo</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--color-element-primary)]"><CloseIcon className="w-5 h-5"/></button>
                </div>
                <div className="p-4 bg-gray-900 relative">
                    {error ? (
                        <div className="text-red-400 text-center py-20">{error}</div>
                    ) : (
                        <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-md" />
                    )}
                </div>
                <div className="p-4 bg-[var(--color-bg-tertiary)] flex justify-center">
                    <button onClick={handleCapture} disabled={!!error} className="flex items-center justify-center bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] font-semibold px-6 py-3 rounded-full shadow-lg hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50">
                        <CameraIcon className="w-6 h-6 mr-2" />
                        Capture
                    </button>
                    <canvas ref={canvasRef} className="hidden" />
                </div>
            </div>
        </div>
    );
};

const PasteStyleModal: React.FC<{
    onClose: () => void;
    onSave: (text: string) => void;
}> = ({ onClose, onSave }) => {
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setTimeout(() => textareaRef.current?.focus(), 100);
    }, []);

    const handleSave = () => {
        if (text.trim()) {
            onSave(text.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-bg-secondary)] rounded-lg shadow-xl w-full max-w-lg flex flex-col" style={{ height: '70vh' }}>
                <div className="p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center">
                    <h3 className="text-lg font-bold">Paste Style Text</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--color-element-primary)]"><CloseIcon className="w-5 h-5"/></button>
                </div>
                <div className="p-4 flex-grow flex flex-col min-h-0">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Paste the text you want the AI to mimic..."
                        className="w-full flex-grow text-sm p-4 resize-none focus:outline-none leading-relaxed text-[var(--color-text-primary)] rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-secondary)] focus:ring-2 focus:ring-[var(--color-ring)]"
                    />
                </div>
                <div className="p-4 bg-[var(--color-bg-tertiary)] flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)]">Cancel</button>
                    <button onClick={handleSave} disabled={!text.trim()} className="flex items-center justify-center bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] font-semibold px-4 py-2 rounded-lg hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50">
                        <SaveIcon className="w-4 h-4 mr-2" />
                        Save Style
                    </button>
                </div>
            </div>
        </div>
    );
};

const STYLE_CATEGORIES: { [key: string]: { id: string, label: string }[] } = {
    "General": [
        { id: 'simplify', label: 'Simplify' },
        { id: 'shorten', label: 'Shorten' },
        { id: 'expand', label: 'Expand' },
        { id: 'formal', label: 'Formal' },
        { id: 'casual', label: 'Casual' },
        { id: 'confident', label: 'Confident' },
    ],
    "Creative": [
        { id: 'descriptive', label: 'Descriptive' },
        { id: 'tense', label: 'Tense' },
        { id: 'poetic', label: 'Poetic' },
    ],
    "Professional": [
        { id: 'professional', label: 'Professional' },
        { id: 'persuasive', label: 'Persuasive' },
        { id: 'diplomatic', label: 'Diplomatic' },
    ],
    "Social Media": [
        { id: 'linkedin', label: 'LinkedIn Post' },
        { id: 'twitter', label: 'Tweet / X' },
    ]
};

const RephrasePanel: React.FC<RephrasePanelProps> = ({ textToEdit, activeSelection, onReplaceSelection }) => {
    const [instructions, setInstructions] = useState('');
    const [styleFile, setStyleFile] = useState<{ content: string; type: string, name: string } | null>(null);
    const [alternatives, setAlternatives] = useState<string[]>([]);
    const [isRephrasing, setIsRephrasing] = useState(false);
    const [numRephraseAlternatives, setNumRephraseAlternatives] = useState<number>(3);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
    
    const [synonymTerm, setSynonymTerm] = useState('');
    const [synonyms, setSynonyms] = useState<string[]>([]);
    const [isFindingSyns, setIsFindingSyns] = useState(false);

    const [critique, setCritique] = useState<CritiqueTip[] | null>(null);
    const [isCritiquing, setIsCritiquing] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isMimicPopoverOpen, setIsMimicPopoverOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isPasteStyleModalOpen, setIsPasteStyleModalOpen] = useState(false);
    const mimicButtonRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        setAlternatives([]);
        setSynonyms([]);
        setError(null);
        
        if (activeSelection && activeSelection.text.trim() !== '') {
            setSynonymTerm(activeSelection.text);
        } else {
            setSynonymTerm('');
        }
    }, [activeSelection]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (mimicButtonRef.current && !mimicButtonRef.current.contains(event.target as Node)) {
                setIsMimicPopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setError(null);
        setIsMimicPopoverOpen(false);

        try {
            const extension = file.name.split('.').pop()?.toLowerCase() || '';

            if (['txt', 'docx', 'pdf'].includes(extension)) {
                const textContent = await parseDocument(file);
                setStyleFile({ content: textContent, type: 'text/plain', name: file.name });
            } else if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    setStyleFile({ content: base64String, type: file.type, name: file.name });
                };
                reader.onerror = () => { throw new Error("Failed to read the image file."); };
                reader.readAsDataURL(file);
            } else {
                throw new Error('Unsupported file type. Please upload .txt, .docx, .pdf, or an image file.');
            }
        } catch (err) {
            setError((err as Error).message);
            setStyleFile(null);
        } finally {
            if (event.target) event.target.value = '';
        }
    };
    
    const handlePhotoCapture = (imageDataUrl: string) => {
        const base64String = imageDataUrl.split(',')[1];
        setStyleFile({ content: base64String, type: 'image/jpeg', name: `capture-${Date.now()}.jpg` });
        setIsCameraOpen(false);
    };

    const handlePasteStyle = (text: string) => {
        setStyleFile({ content: text, type: 'text/plain', name: 'Pasted Style' });
        setIsPasteStyleModalOpen(false);
    };

    const handleGenerateAlternatives = async () => {
        const textToRephrase = activeSelection?.text.trim() || htmlToPlainText(textToEdit).trim();
        if (!textToRephrase) {
            setError('Please select text or write in the editor to rephrase.');
            return;
        }
        setAlternatives([]);
        setIsRephrasing(true);
        setError(null);
        try {
            const result = await rephraseText(textToRephrase, instructions, selectedStyle, styleFile, numRephraseAlternatives);
            setAlternatives(result);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsRephrasing(false);
        }
    };
    
    const handleAlternativeClick = (alt: string) => {
        onReplaceSelection(alt);
        setAlternatives([]);
    };

    const handleFindSynonyms = async () => {
        if (!synonymTerm.trim()) {
            setError('Please enter a word or phrase to find synonyms for.');
            return;
        }
        setIsFindingSyns(true);
        setError(null);
        setSynonyms([]);
        try {
            const result = await findSynonyms(synonymTerm);
            setSynonyms(result);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsFindingSyns(false);
        }
    };

    const handleSynonymClick = (synonym: string) => {
        onReplaceSelection(synonym);
        setSynonymTerm('');
        setSynonyms([]);
    };

    const handleGetCritique = async () => {
        const plainText = htmlToPlainText(textToEdit);
        if (!plainText.trim()) {
            setError('Editor is empty. Please provide text to get feedback on.');
            return;
        }
        setIsCritiquing(true);
        setError(null);
        setCritique(null);
        try {
            const result = await getWritingCritique(plainText);
            setCritique(result);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsCritiquing(false);
        }
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            setError('Failed to copy text to clipboard.');
        });
    };
    
    const hasSelection = activeSelection && activeSelection.text.trim() !== '';
    const hasComposition = textToEdit && htmlToPlainText(textToEdit).trim() !== '';

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6">
            {error && <div className="bg-red-100 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
            
            {isPasteStyleModalOpen && <PasteStyleModal onClose={() => setIsPasteStyleModalOpen(false)} onSave={handlePasteStyle} />}
            {isCameraOpen && <CameraCapture onCapture={handlePhotoCapture} onClose={() => setIsCameraOpen(false)} />}
            
            <div className="space-y-3">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Transform Text</h3>
                <p className="text-xs text-[var(--color-text-secondary)] -mt-2">Rewrite selected text with a new style or goal.</p>

                <div>
                    <label className="text-sm font-medium text-[var(--color-text-secondary)]">Choose a Transformation Style</label>
                    <div className="mt-2 space-y-3">
                        {Object.entries(STYLE_CATEGORIES).map(([category, styles]) => (
                            <div key={category}>
                                <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">{category}</p>
                                <div className="flex flex-wrap gap-2">
                                    {styles.map(style => (
                                        <button
                                            key={style.id}
                                            onClick={() => setSelectedStyle(prev => prev === style.id ? null : style.id)}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-ring)] focus:ring-offset-[var(--color-bg-primary)] ${
                                                selectedStyle === style.id
                                                    ? 'bg-[var(--color-accent-primary)] text-[var(--color-accent-text)]'
                                                    : 'bg-[var(--color-element-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary-hover)]'
                                            }`}
                                        >
                                            {style.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Optional: Add custom instructions..."
                    className="w-full bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.docx,.pdf,image/*" className="hidden"/>
                <div className="relative" ref={mimicButtonRef}>
                    <button onClick={() => setIsMimicPopoverOpen(prev => !prev)} className="w-full flex items-center justify-center text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-element-primary)] px-3 py-2.5 rounded-lg transition-colors truncate">
                        <UploadIcon className="mr-2 w-4 h-4 flex-shrink-0"/> 
                        <span className="truncate">{styleFile ? `Style: ${styleFile.name}` : 'Add Mimic Style...'}</span>
                    </button>
                    {isMimicPopoverOpen && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg shadow-xl z-20">
                            <button onClick={() => {fileInputRef.current?.click(); setIsMimicPopoverOpen(false);}} className="w-full flex items-center text-left px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-t-lg transition-colors">
                                <UploadIcon className="mr-2 w-4 h-4"/> Upload File
                            </button>
                            <button onClick={() => { setIsPasteStyleModalOpen(true); setIsMimicPopoverOpen(false); }} className="w-full flex items-center text-left px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] transition-colors">
                                <PasteIcon className="mr-2 w-4 h-4"/> Paste Text
                            </button>
                            <button onClick={() => { setIsCameraOpen(true); setIsMimicPopoverOpen(false); }} className="w-full flex items-center text-left px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] transition-colors">
                                <CameraIcon className="mr-2 w-4 h-4"/> Take Photo
                            </button>
                            {styleFile && (
                                 <button onClick={() => { setStyleFile(null); setIsMimicPopoverOpen(false); }} className="w-full flex items-center text-left px-4 py-2.5 text-sm text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] rounded-b-lg border-t border-[var(--color-border-primary)] transition-colors">
                                    <CloseIcon className="mr-2 w-4 h-4"/> Clear Style
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Alternatives:</span>
                        <div className="flex items-center space-x-1 bg-[var(--color-element-primary)] p-0.5 rounded-lg">
                            {[1, 2, 3].map(num => (
                                <button 
                                    key={num} 
                                    onClick={() => setNumRephraseAlternatives(num)} 
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${numRephraseAlternatives === num ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleGenerateAlternatives} disabled={isRephrasing || !(hasSelection || hasComposition)} className="flex items-center justify-center bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] hover:from-[var(--color-accent-primary-hover)] hover:to-[var(--color-accent-secondary-hover)] text-[var(--color-accent-text)] font-semibold px-4 py-2.5 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 transition-all">
                        {isRephrasing ? <LoadingSpinner /> : <><WandIcon className="mr-2 w-5 h-5"/> Generate</>}
                    </button>
                </div>
                {alternatives.length > 0 && (
                    <div className="space-y-2 pt-2">
                        {alternatives.map((alt, index) => (
                             <div 
                                key={index} 
                                onClick={() => handleAlternativeClick(alt)}
                                className="bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--color-border-primary)] shadow-sm hover:bg-[var(--color-accent-subtle-bg)] cursor-pointer group transition-colors"
                            >
                                <div className="flex items-start justify-between space-x-3">
                                    <div className="text-sm text-[var(--color-text-primary)] flex-1 break-words prose-card" dangerouslySetInnerHTML={createSanitizedMarkup(alt)} />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleCopy(alt, index); }}
                                        aria-label={copiedIndex === index ? 'Copied' : 'Copy to clipboard'}
                                        className="p-1.5 -m-1.5 rounded-full text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)] hover:!text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] flex-shrink-0 transition-colors"
                                    >
                                        {copiedIndex === index ? <CheckIcon className="w-4 h-4 text-green-600" /> : <CopyIcon className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-3 border-t border-[var(--color-border-primary)] pt-6">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Find Synonyms</h3>
                <input
                    type="text"
                    value={synonymTerm}
                    onChange={(e) => setSynonymTerm(e.target.value)}
                    placeholder="Highlight text or type here"
                    className="w-full bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
                <button onClick={handleFindSynonyms} disabled={isFindingSyns || !synonymTerm.trim()} className="w-full flex items-center justify-center bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] hover:from-[var(--color-accent-primary-hover)] hover:to-[var(--color-accent-secondary-hover)] text-[var(--color-accent-text)] font-semibold px-4 py-2.5 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 transition-all">
                    {isFindingSyns ? <LoadingSpinner /> : <><WandIcon className="mr-2 w-5 h-5"/> Find Synonyms</>}
                </button>
                {synonyms.length > 0 && (
                    <div className="space-y-2 pt-2">
                        <div className="bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--color-border-primary)] shadow-sm">
                            <ul className="flex flex-wrap gap-2">
                                {synonyms.map((syn, index) => (
                                   <li key={index}>
                                      <button 
                                        onClick={() => handleSynonymClick(syn)}
                                        className="text-sm bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] hover:opacity-80 font-medium px-3 py-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                                      >
                                        {syn}
                                      </button>
                                   </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-3 border-t border-[var(--color-border-primary)] pt-6">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Writing Tips & Critique</h3>
                <p className="text-xs text-[var(--color-text-secondary)] -mt-2">Get AI feedback on the text in the editor.</p>
                <button onClick={handleGetCritique} disabled={isCritiquing || !hasComposition} className="w-full flex items-center justify-center bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] hover:from-[var(--color-accent-primary-hover)] hover:to-[var(--color-accent-secondary-hover)] text-[var(--color-accent-text)] font-semibold px-4 py-2.5 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 transition-all">
                    {isCritiquing ? <LoadingSpinner /> : <><CritiqueIcon className="mr-2 w-5 h-5"/> Get Feedback</>}
                </button>
                {critique && critique.length > 0 && (
                    <div className="space-y-3 pt-2">
                        {critique.map((item, index) => (
                            <div key={index} className="bg-[var(--color-bg-secondary)] p-4 rounded-lg border border-[var(--color-border-primary)] shadow-sm">
                                <h4 className="font-semibold text-md text-[var(--color-text-primary)] mb-1">{item.title}</h4>
                                <div className="text-sm text-[var(--color-text-secondary)] prose-card" dangerouslySetInnerHTML={createSanitizedMarkup(item.tip)} />
                                {item.example && (
                                    <div className="mt-3 pt-3 border-t border-[var(--color-border-primary)]">
                                        <p className="text-xs text-[var(--color-text-secondary)] font-medium">EXAMPLE</p>
                                        <div className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] p-2 rounded mt-1 font-mono prose-card" dangerouslySetInnerHTML={createSanitizedMarkup(`"${item.example}"`)} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RephrasePanel;