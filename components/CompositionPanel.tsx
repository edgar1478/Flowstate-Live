import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CloseIcon, SaveIcon } from './icons';
import ImmersiveToolbar from './ImmersiveToolbar';

interface CompositionPanelProps {
    initialContent: string;
    onUpdate: (newContent: string) => void;
    onClose: () => void;
    onSaveAndClose: (newContent: string) => void;
    compositionTheme: string;
    saveButtonText?: string;
}

const COMPOSITION_THEMES: Record<string, { bg: string; text: string; hover: string; placeholder: string; }> = {
    default: { bg: 'bg-[var(--color-bg-primary)]', text: 'text-[var(--color-text-primary)]', hover: 'hover:bg-[var(--color-element-primary)]', placeholder: 'placeholder-[var(--color-text-tertiary)]' },
    paper: { bg: 'bg-[#fdf6e3]', text: 'text-[#657b83]', hover: 'hover:bg-[#eee8d5]', placeholder: 'placeholder-[#93a1a1]' },
    charcoal: { bg: 'bg-[#2d2d2d]', text: 'text-[#dcdcdc]', hover: 'hover:bg-[#3f3f3f]', placeholder: 'placeholder-[#7f7f7f]' },
    'contrast': { bg: 'bg-[#ffffff]', text: 'text-[#000000]', hover: 'hover:bg-[#f0f0f0]', placeholder: 'placeholder-[#a0a0a0]' },
};

const CompositionPanel: React.FC<CompositionPanelProps> = ({ initialContent, onUpdate, onClose, onSaveAndClose, compositionTheme, saveButtonText = 'Save & Exit' }) => {
    const [content, setContent] = useState(initialContent);
    const [width, setWidth] = useState(window.innerWidth < 768 ? 90 : 40);
    const [isToolbarVisible, setIsToolbarVisible] = useState(true);
    const editorRef = useRef<HTMLDivElement>(null);
    const toolbarTimeoutRef = useRef<number | null>(null);
    const themeClasses = COMPOSITION_THEMES[compositionTheme] || COMPOSITION_THEMES['default'];

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== initialContent) {
            editorRef.current.innerHTML = initialContent;
        }
    }, [initialContent]);

    // Update the parent component's state as the user types
    useEffect(() => {
        onUpdate(content);
    }, [content, onUpdate]);

    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Toolbar visibility logic
    useEffect(() => {
        const showToolbar = () => {
            setIsToolbarVisible(true);
            if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
            toolbarTimeoutRef.current = window.setTimeout(() => setIsToolbarVisible(false), 3000);
        };

        window.addEventListener('mousemove', showToolbar);
        showToolbar(); // Initial show

        return () => {
            window.removeEventListener('mousemove', showToolbar);
            if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
        };
    }, []);

    const handleToolbarMouseEnter = () => {
        if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
        setIsToolbarVisible(true);
    };

    const handleToolbarMouseLeave = () => {
        if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
        // A shorter timeout when leaving the toolbar itself
        toolbarTimeoutRef.current = window.setTimeout(() => setIsToolbarVisible(false), 500);
    };
    
    // Auto-focus the editor
    useEffect(() => {
        editorRef.current?.focus();
    }, []);

    const wordCount = useMemo(() => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const text = tempDiv.textContent || tempDiv.innerText || '';
        const trimmed = text.trim();
        if (trimmed === '') return 0;
        return trimmed.split(/\s+/).length;
    }, [content]);

    return (
        <div className={`fixed inset-0 z-50 flex flex-col animate-fade-in ${themeClasses.bg} ${themeClasses.text}`}>
            <header className="flex-shrink-0 p-4 flex justify-between items-center w-full max-w-4xl mx-auto">
                <div className="text-sm font-semibold text-current opacity-70">
                    Composition Mode
                </div>
                <div className="flex items-center space-x-3">
                    <button onClick={() => onSaveAndClose(content)} className="px-4 py-2 text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] rounded-lg hover:bg-[var(--color-accent-primary-hover)] flex items-center">
                        <SaveIcon className="w-4 h-4 mr-2" />
                        {saveButtonText}
                    </button>
                    <button onClick={onClose} className={`p-2 rounded-full transition-colors ${themeClasses.hover}`}>
                        <CloseIcon className="w-5 h-5 text-current opacity-80" />
                    </button>
                </div>
            </header>

            <main className="flex-grow flex justify-center overflow-y-auto px-4">
                <div
                    ref={editorRef}
                    contentEditable={true}
                    onInput={(e) => setContent(e.currentTarget.innerHTML)}
                    data-placeholder="Let the words flow..."
                    className={`w-full p-6 resize-none focus:outline-none leading-loose bg-transparent text-current whitespace-pre-wrap transition-all duration-300 prose-card text-xl ${themeClasses.placeholder}`}
                    style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', maxWidth: `${width}%` }}
                />
            </main>
            
            <footer className="flex-shrink-0 p-4 flex justify-end items-center w-full max-w-4xl mx-auto">
                <div className="text-sm font-mono text-current opacity-60">
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </div>
            </footer>
            <ImmersiveToolbar
                width={width}
                onSetWidth={setWidth}
                isVisible={isToolbarVisible}
                onMouseEnter={handleToolbarMouseEnter}
                onMouseLeave={handleToolbarMouseLeave}
            />
        </div>
    );
};

export default CompositionPanel;