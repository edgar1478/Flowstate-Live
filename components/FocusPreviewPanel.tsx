import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon } from './icons';
import ImmersiveToolbar from './ImmersiveToolbar';

// Same themes as CompositionPanel
const COMPOSITION_THEMES: Record<string, { bg: string; text: string; hover: string; placeholder: string; }> = {
    default: { bg: 'bg-[var(--color-bg-primary)]', text: 'text-[var(--color-text-primary)]', hover: 'hover:bg-[var(--color-element-primary)]', placeholder: 'placeholder-[var(--color-text-tertiary)]' },
    paper: { bg: 'bg-[#fdf6e3]', text: 'text-[#657b83]', hover: 'hover:bg-[#eee8d5]', placeholder: 'placeholder-[#93a1a1]' },
    charcoal: { bg: 'bg-[#2d2d2d]', text: 'text-[#dcdcdc]', hover: 'hover:bg-[#3f3f3f]', placeholder: 'placeholder-[#7f7f7f]' },
    'contrast': { bg: 'bg-[#ffffff]', text: 'text-[#000000]', hover: 'hover:bg-[#f0f0f0]', placeholder: 'placeholder-[#a0a0a0]' },
};

interface FocusPreviewPanelProps {
    projectName: string;
    onClose: () => void;
    htmlContent: { __html: string };
    onDoubleClick: (e: React.MouseEvent) => void;
    compositionTheme: string;
    indentStyle: 'block' | 'first-line';
}


const FocusPreviewPanel: React.FC<FocusPreviewPanelProps> = ({
    projectName,
    onClose,
    htmlContent,
    onDoubleClick,
    compositionTheme,
    indentStyle
}) => {
    const [width, setWidth] = useState(window.innerWidth < 768 ? 90 : 40);
    const [isToolbarVisible, setIsToolbarVisible] = useState(true);
    const toolbarTimeoutRef = useRef<number | null>(null);
    const themeClasses = COMPOSITION_THEMES[compositionTheme] || COMPOSITION_THEMES['default'];

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
        toolbarTimeoutRef.current = window.setTimeout(() => setIsToolbarVisible(false), 500);
    };

    return (
        <div className={`fixed inset-0 z-50 flex flex-col animate-fade-in ${themeClasses.bg} ${themeClasses.text}`}>
            <header className="flex-shrink-0 p-4 flex justify-between items-center w-full max-w-4xl mx-auto">
                 <div className="text-sm font-semibold text-current opacity-70">
                    {projectName} - Focus View
                </div>
                <button onClick={onClose} className={`p-2 rounded-full transition-colors ${themeClasses.hover}`}>
                    <CloseIcon className="w-5 h-5 text-current opacity-80" />
                </button>
            </header>
            
            <main 
                className="flex-grow flex justify-center overflow-y-auto px-4"
                onDoubleClick={onDoubleClick}
            >
                <div
                    className="w-full h-full py-6 transition-all duration-300 prose-preview text-lg"
                    style={{ maxWidth: `${width}%` }}
                >
                    <div
                        className={
                            indentStyle === 'first-line'
                                ? '[&_.card-source-wrapper_p]:indent-[2em] [&_.card-source-wrapper_p]:my-0'
                                : ''
                        }
                        dangerouslySetInnerHTML={htmlContent}
                    />
                </div>
            </main>

             <footer className="flex-shrink-0 p-4 flex justify-end items-center w-full max-w-4xl mx-auto">
                <div className="text-xs font-mono text-current opacity-60">
                    Double-click text to locate its card.
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

export default FocusPreviewPanel;