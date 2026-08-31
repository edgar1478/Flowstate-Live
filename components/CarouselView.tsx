import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, TaskStatus, TaskPriority } from '../types';
import { CloseIcon, PaletteIcon, EditIcon, TrashIcon, CopyIcon, ShareIcon, EyeOffIcon, LockIcon, UnlockIcon, FolderIcon, ChevronUpIcon, ChevronDownIcon, TypewriterIcon, PlusIcon } from './icons';
import { htmlToPlainText, createSanitizedMarkup } from '../services/documentParser';
import ImmersiveToolbar from './ImmersiveToolbar';

// Type for cards passed to this component
export interface CarouselCardData extends Card {
    projectId: string;
    projectName: string;
    projectCategory?: string;
}

interface CarouselViewProps {
    cards: CarouselCardData[];
    initialIndex?: number;
    onClose: (lastActiveCardId: string) => void;
    onUpdateCard: (projectId: string, cardId: string, updates: Partial<Card>) => void;
    onDeleteCard: (projectId: string, cardId: string) => void;
    onDuplicateCard: (projectId: string, cardId: string) => void;
    onShareCard: (card: Card) => void;
    onCompositionEdit: (card: CarouselCardData) => void;
    onNavigateBackToCard: (projectId: string, cardId: string) => void;
    onAddCard: (projectId: string, insertIndex: number) => void;
}

const CARD_COLORS: { [key: string]: { bg: string; border: string; } } = {
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
    green: { bg: 'bg-green-50', border: 'border-green-200' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200' },
    pink: { bg: 'bg-pink-50', border: 'border-pink-200' },
    gray: { bg: 'bg-gray-100', border: 'border-gray-200' },
};

const CarouselCardItem: React.FC<{
    card: CarouselCardData;
    isActive: boolean;
    isTypewriterMode: boolean;
    setIsTypewriterMode: React.Dispatch<React.SetStateAction<boolean>>;
    onUpdateCard: (projectId: string, cardId: string, updates: Partial<Card>) => void;
    onDeleteCard: (projectId: string, cardId: string) => void;
    onDuplicateCard: (projectId: string, cardId: string) => void;
    onShareCard: (card: Card) => void;
    onCompositionEdit: (card: CarouselCardData) => void;
    onNavigateBackToCard: (projectId: string, cardId: string) => void;
}> = ({ card, isActive, isTypewriterMode, setIsTypewriterMode, onUpdateCard, onDeleteCard, onDuplicateCard, onShareCard, onCompositionEdit, onNavigateBackToCard }) => {
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const optionsRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
                setIsOptionsOpen(false);
            }
        };
        if (isOptionsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOptionsOpen]);

    useEffect(() => {
        if (editorRef.current && !isFocused) {
            // Only update innerHTML if it's not what's already there and component is not focused.
            // This prevents overwriting user edits and avoids unnecessary DOM manipulation.
            const currentHTML = editorRef.current.innerHTML;
            const newHTML = card.content || '<p><br></p>';
            if (currentHTML !== newHTML) {
                editorRef.current.innerHTML = newHTML;
            }
        }
    }, [card.id, card.content, isFocused]);

    const saveIfChanged = useCallback(() => {
        if (editorRef.current) {
            const newContent = editorRef.current.innerHTML;
            if (newContent !== card.content) {
                onUpdateCard(card.projectId, card.id, { content: newContent });
            }
        }
    }, [card.content, card.id, card.projectId, onUpdateCard]);

    useEffect(() => {
        return () => {
            saveIfChanged();
        };
    }, [saveIfChanged]);
    
    const handleFocus = () => {
        if (!card.isLocked && isActive) {
            setIsFocused(true);
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        saveIfChanged();
    };

    const handleEditorInteraction = useCallback((isInitial = false) => {
        if (!isTypewriterMode || !scrollerRef.current) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const container = scrollerRef.current;
        if (!editorRef.current?.contains(range.commonAncestorContainer)) return;

        let cursorRect = range.getBoundingClientRect();
        if (cursorRect.height === 0) {
            const tempSpan = document.createElement('span');
            tempSpan.textContent = '\u200b'; // Zero-width space
            range.insertNode(tempSpan);
            cursorRect = tempSpan.getBoundingClientRect();
            tempSpan.remove();
        }

        const containerRect = container.getBoundingClientRect();
        const targetBottom = cursorRect.bottom;
        const containerMidpoint = containerRect.top + containerRect.height / 2;
        const scrollOffset = targetBottom - containerMidpoint;

        container.scrollTo({
            top: container.scrollTop + scrollOffset,
            behavior: isInitial ? 'auto' : 'smooth',
        });
    }, [isTypewriterMode]);

    const scrollToContentMiddle = useCallback(() => {
        if (!scrollerRef.current || !editorRef.current) return;
        const scrollerNode = scrollerRef.current;
        const editorNode = editorRef.current;
        
        const wrapperHeight = scrollerNode.offsetHeight;
        const contentHeight = editorNode.scrollHeight - wrapperHeight;
        
        const targetScrollTop = contentHeight > 0 ? contentHeight / 2 : 0;
        
        scrollerNode.scrollTo({
            top: targetScrollTop,
            behavior: 'auto',
        });
    }, []);

    useEffect(() => {
        const editorNode = editorRef.current;
        const scrollerNode = scrollerRef.current;
        if (isActive && isTypewriterMode && scrollerNode && editorNode) {
            const wrapperHeight = scrollerNode.offsetHeight;
            editorNode.style.paddingTop = `${wrapperHeight / 2}px`;
            editorNode.style.paddingBottom = `${wrapperHeight / 2}px`;
            setTimeout(() => {
                scrollToContentMiddle();
            }, 0);
        } else if (editorNode) {
            editorNode.style.paddingTop = '';
            editorNode.style.paddingBottom = '';
        }
    }, [isActive, isTypewriterMode, scrollToContentMiddle]);

    return (
        <div
            className={`relative w-full h-full p-4 border rounded-lg transition-all duration-300 shadow-xl flex flex-col ${card.color ? `${CARD_COLORS[card.color]?.bg || 'bg-[var(--color-bg-secondary)]'} ${CARD_COLORS[card.color]?.border || 'border-[var(--color-border-primary)]'}` : 'bg-[var(--color-bg-secondary)] border-[var(--color-border-primary)]'}`}
        >
             <div className="relative flex-grow overflow-hidden pr-2">
                {isTypewriterMode && (
                    <div style={{ position: 'absolute', top: '50%', left: 0, right: '0.5rem', height: '1px', backgroundColor: 'var(--color-accent-primary)', opacity: 0.3, pointerEvents: 'none', transform: 'translateY(-50%)', zIndex: 10 }} />
                )}
                <div ref={scrollerRef} className="h-full overflow-y-auto">
                    <div
                        ref={editorRef}
                        contentEditable={!card.isLocked && isActive}
                        suppressContentEditableWarning={true}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyUp={isTypewriterMode && isActive ? () => handleEditorInteraction(false) : undefined}
                        onMouseUp={isTypewriterMode && isActive ? () => handleEditorInteraction(false) : undefined}
                        className="prose-card text-[var(--color-text-primary)] focus:outline-none min-h-full"
                    />
                </div>
            </div>

            <div className="flex-shrink-0 pt-2 mt-2 border-t border-[var(--color-border-primary)]">
                <div className="flex justify-between items-center">
                    <div className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1.5 truncate" title={card.projectName}>
                        <FolderIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{card.projectName}</span>
                    </div>

                    <div className="flex items-center space-x-1">
                        <button onClick={() => setIsTypewriterMode(prev => !prev)} title="Toggle Typewriter Mode" className={`p-1.5 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ${isTypewriterMode ? 'bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-primary)]' : 'hover:bg-[var(--color-element-primary)]'}`}><TypewriterIcon className="w-4 h-4" /></button>
                        <button onClick={() => onShareCard(card)} title="Share Card" className="p-1.5 rounded-full hover:bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primary-hover)]"><ShareIcon className="w-4 h-4" /></button>
                        <div className="relative" ref={optionsRef}>
                            <button onClick={() => setIsOptionsOpen(p => !p)} title="Card Options" className="p-1.5 rounded-full hover:bg-[var(--color-element-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"><PaletteIcon className="w-4 h-4" /></button>
                            {isOptionsOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-56 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg shadow-xl z-20 p-2">
                                    <div className="grid grid-cols-4 gap-2 mb-2">
                                        {Object.keys(CARD_COLORS).map(color => (
                                            <button key={color} onClick={() => { onUpdateCard(card.projectId, card.id, { color }); setIsOptionsOpen(false); }} className={`w-full h-8 rounded ${CARD_COLORS[color].bg} border-2 ${card.color === color ? CARD_COLORS[color].border : 'border-transparent'} hover:border-gray-400 disabled:opacity-50`} disabled={card.isLocked}></button>
                                        ))}
                                        <button onClick={() => { onUpdateCard(card.projectId, card.id, { color: undefined }); setIsOptionsOpen(false); }} className="w-full h-8 rounded bg-white border-2 border-gray-300 flex items-center justify-center hover:border-gray-400 disabled:opacity-50" title="Clear Color" disabled={card.isLocked}><CloseIcon className="w-4 h-4 text-gray-500" /></button>
                                    </div>
                                    <div className="space-y-1 border-t border-[var(--color-border-primary)] mt-2 pt-2">
                                        <button onClick={() => { onUpdateCard(card.projectId, card.id, { isLocked: !card.isLocked }); setIsOptionsOpen(false); }} className="w-full flex items-center text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-md">
                                            {card.isLocked ? <UnlockIcon className="w-4 h-4 mr-2" /> : <LockIcon className="w-4 h-4 mr-2" />}
                                            {card.isLocked ? 'Unlock Card' : 'Lock Card'}
                                        </button>
                                        <button onClick={() => { onUpdateCard(card.projectId, card.id, { isHidden: true }); setIsOptionsOpen(false); }} className="w-full flex items-center text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-md disabled:opacity-50" disabled={card.isLocked}><EyeOffIcon className="w-4 h-4 mr-2" /> Hide Card</button>
                                        <button onClick={() => { onDuplicateCard(card.projectId, card.id); setIsOptionsOpen(false); }} className="w-full flex items-center text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-md disabled:opacity-50" disabled={card.isLocked}><CopyIcon className="w-4 h-4 mr-2" /> Duplicate Card</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={() => onNavigateBackToCard(card.projectId, card.id)} title="Return to Main View" className="p-1.5 rounded-full hover:bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primary-hover)] disabled:opacity-50" disabled={card.isLocked}><EditIcon className="w-4 h-4" /></button>
                        <button onClick={() => onDeleteCard(card.projectId, card.id)} title="Delete Card" className="p-1.5 rounded-full hover:bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] disabled:opacity-50" disabled={card.isLocked}><TrashIcon className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CarouselView: React.FC<CarouselViewProps> = ({ cards, initialIndex, onClose, onAddCard, ...handlers }) => {
    const [activeIndex, setActiveIndex] = useState(initialIndex || 0);
    const [cardScale, setCardScale] = useState(1.4);
    const [isToolbarVisible, setIsToolbarVisible] = useState(true);
    const [isTypewriterMode, setIsTypewriterMode] = useState(true);
    const toolbarTimeoutRef = useRef<number | null>(null);
    const mainWrapperRef = useRef<HTMLDivElement>(null);
    const requestedNewCardIndex = useRef<number | null>(null);

    const handleAddNewCard = useCallback(() => {
        if (cards.length === 0) return;
        const currentCard = cards[activeIndex];
        const insertIndex = activeIndex + 1;
        requestedNewCardIndex.current = insertIndex;
        onAddCard(currentCard.projectId, insertIndex);
    }, [activeIndex, cards, onAddCard]);
    
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (document.activeElement?.hasAttribute('contenteditable')) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                return;
            }
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => Math.min(prev + 1, cards.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Escape') {
            onClose(cards[activeIndex]?.id);
        }
    }, [cards, activeIndex, onClose]);

    useEffect(() => {
        if (requestedNewCardIndex.current !== null) {
            if (cards.length > 0 && requestedNewCardIndex.current < cards.length) {
                 setActiveIndex(requestedNewCardIndex.current);
            }
            requestedNewCardIndex.current = null;
        } else if (activeIndex >= cards.length && cards.length > 0) {
            setActiveIndex(cards.length - 1);
        }
    }, [cards]);
    
    useEffect(() => {
        const showToolbar = () => {
            setIsToolbarVisible(true);
            if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
            toolbarTimeoutRef.current = window.setTimeout(() => setIsToolbarVisible(false), 3000);
        };
    
        const mainWrapper = mainWrapperRef.current;
        mainWrapper?.addEventListener('mousemove', showToolbar);
        showToolbar(); // Initial show
    
        return () => {
            mainWrapper?.removeEventListener('mousemove', showToolbar);
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

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    if (cards.length === 0) {
        return (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => onClose('')}>
                <div className="text-white/80 text-center">
                    <p>No cards to display in focus view.</p>
                    <p className="text-sm mt-2">Click anywhere to close.</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={mainWrapperRef} className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => onClose(cards[activeIndex]?.id)}>
            <div
                className="w-full h-full flex items-center justify-center"
                onClick={e => e.stopPropagation()}
            >
                <div
                    className="w-full max-w-xl h-[50vh]"
                    style={{ perspective: '1500px' }}
                >
                    <div
                        className="relative w-full h-full transition-transform duration-300 ease-out"
                        style={{
                            transformStyle: 'preserve-3d',
                            transform: `scale(${cardScale})`,
                        }}
                    >
                        {cards.map((card, index) => {
                            const offset = index - activeIndex;
                            const isVisible = Math.abs(offset) < 5; 

                            if (!isVisible) return null;

                            const translateY = offset * 50;
                            const scale = 1 - Math.abs(offset) * 0.15;
                            const zIndex = cards.length - Math.abs(offset);
                            const translateZ = -Math.abs(offset) * 150;
                            const opacity = Math.max(0, 1 - Math.abs(offset) * 0.7);

                            return (
                                <div
                                    key={card.id}
                                    className="absolute w-full h-full transition-all duration-500 ease-out cursor-pointer hover:!opacity-100"
                                    style={{
                                        transform: `translateY(${translateY}%) scale(${scale}) translateZ(${translateZ}px)`,
                                        zIndex: zIndex,
                                        opacity: opacity,
                                        backfaceVisibility: 'hidden',
                                    } as React.CSSProperties}
                                    onClick={() => setActiveIndex(index)}
                                >
                                     <CarouselCardItem 
                                        card={card} 
                                        isActive={index === activeIndex} 
                                        isTypewriterMode={isTypewriterMode}
                                        setIsTypewriterMode={setIsTypewriterMode}
                                        {...handlers} 
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="absolute top-1/2 -translate-y-1/2 right-16 md:flex flex-col gap-4 z-20 hidden">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveIndex(prev => Math.max(prev - 1, 0));
                    }}
                    disabled={activeIndex === 0}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    aria-label="Previous card"
                >
                    <ChevronUpIcon className="w-8 h-8" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleAddNewCard();
                    }}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Add new card"
                >
                    <PlusIcon className="w-8 h-8" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveIndex(prev => Math.min(prev + 1, cards.length - 1));
                    }}
                    disabled={activeIndex === cards.length - 1}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    aria-label="Next card"
                >
                    <ChevronDownIcon className="w-8 h-8" />
                </button>
            </div>

            <button onClick={(e) => { e.stopPropagation(); onClose(cards[activeIndex]?.id); }} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                <CloseIcon className="w-6 h-6" />
            </button>
             <ImmersiveToolbar
                width={Math.round(cardScale * 100)}
                onSetWidth={(val) => setCardScale(val / 100)}
                isVisible={isToolbarVisible}
                onMouseEnter={handleToolbarMouseEnter}
                onMouseLeave={handleToolbarMouseLeave}
                min={80}
                max={150}
            />
        </div>
    );
};

export default CarouselView;
