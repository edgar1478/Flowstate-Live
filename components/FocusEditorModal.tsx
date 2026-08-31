import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Card, Task, TaskStatus, TaskPriority } from '../types';
import RephrasePanel, { ActiveSelection } from './RephrasePanel';
import { CloseIcon, SaveIcon, BoldIcon, ItalicIcon, Heading1Icon, Heading2Icon, Heading3Icon, ListIcon, ListOrderedIcon, CheckIcon, HashIcon, ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon, TextIcon, TypeIcon, FontSizeIcon, ChevronRightIcon, ChevronLeftIcon } from './icons';
import CompositionPanel from './CompositionPanel';
import DOMPurify from 'dompurify';
import { formatNewCardContent, formatAIGeneratedContent } from '../services/documentParser';

interface FocusEditorModalProps {
    modalState: { mode: 'add', insertIndex: number } | { mode: 'edit', card: Card };
    onClose: () => void;
    onSave: (data: Partial<Omit<Card, 'id'>>, options?: { shouldClose: boolean }) => void;
    compositionTheme: string;
    defaultImportFont: { family: string; size: string };
}

type FormatBlockType = 'p' | 'h1' | 'h2' | 'h3' | 'h4';
type FormatActionType = 'bold' | 'italic' | 'bullet' | 'number' | 'link' | 'fontName' | 'fontSize';
type FormatType = FormatActionType | 'formatBlock';

const FORMAT_OPTIONS: { id: FormatBlockType; label: string }[] = [
    { id: 'p', label: 'Paragraph' },
    { id: 'h1', label: 'Heading 1' },
    { id: 'h2', label: 'Heading 2' },
    { id: 'h3', label: 'Heading 3' },
    { id: 'h4', label: 'Heading 4' },
];

const FONT_FAMILY_OPTIONS = [
    { id: 'Arial', label: 'Arial' },
    { id: 'Calibri', label: 'Calibri' },
    { id: 'Times New Roman', label: 'Times New Roman' },
];

const FONT_SIZE_MAP: { [key: string]: string } = {
    '1': '10px', '2': '12px', '3': '14px', '4': '16px', '5': '18px', '6': '24px', '7': '32px'
};

const FONT_SIZE_OPTIONS = Object.entries(FONT_SIZE_MAP).map(([id, label]) => ({ id, label }));


const FormatDropdown: React.FC<{ onFormat: (type: 'formatBlock', value: FormatBlockType) => void; editorRef: React.RefObject<HTMLDivElement> }> = ({ onFormat, editorRef }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentBlock, setCurrentBlock] = useState<FormatBlockType>('p');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateCurrentBlock = () => {
            if (editorRef.current?.contains(document.activeElement)) {
                const blockType = document.queryCommandValue('formatBlock').toLowerCase() as FormatBlockType;
                setCurrentBlock(FORMAT_OPTIONS.some(o => o.id === blockType) ? blockType : 'p');
            }
        };

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('selectionchange', updateCurrentBlock);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('selectionchange', updateCurrentBlock);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editorRef]);

    const handleSelect = (option: FormatBlockType) => {
        onFormat('formatBlock', option);
        setIsOpen(false);
    };

    const currentLabel = FORMAT_OPTIONS.find(o => o.id === currentBlock)?.label || 'Paragraph';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 p-2.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-element-primary-hover)] hover:text-[var(--color-text-primary)] rounded-md transition-colors md:w-36 text-left"
            >
                <TextIcon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden md:inline-block flex-grow text-sm font-medium truncate">{currentLabel}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1 w-48 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg shadow-xl z-10">
                    {FORMAT_OPTIONS.map(opt => (
                        <button
                            key={opt.id}
                            onMouseDown={e => { e.preventDefault(); handleSelect(opt.id); }}
                            className={`w-full text-left px-3 py-2 text-sm font-medium hover:bg-[var(--color-element-primary)] ${currentBlock === opt.id ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-primary)]'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const FontFamilyDropdown: React.FC<{ onFormat: (type: 'fontName', value: string) => void; editorRef: React.RefObject<HTMLDivElement> }> = ({ onFormat, editorRef }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentFont, setCurrentFont] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateCurrentFont = () => {
            if (editorRef.current?.contains(document.activeElement)) {
                const fontName = document.queryCommandValue('fontName').replace(/['"]/g, '');
                const matchedFont = FONT_FAMILY_OPTIONS.find(f => f.id.toLowerCase() === fontName.toLowerCase());
                setCurrentFont(matchedFont ? matchedFont.id : null);
            }
        };

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
        };

        document.addEventListener('selectionchange', updateCurrentFont);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('selectionchange', updateCurrentFont);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editorRef]);

    const handleSelect = (fontId: string) => {
        onFormat('fontName', fontId);
        setIsOpen(false);
    };

    const currentLabel = FONT_FAMILY_OPTIONS.find(o => o.id === currentFont)?.label || 'Font';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 p-2.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-element-primary-hover)] hover:text-[var(--color-text-primary)] rounded-md transition-colors md:w-36 text-left"
            >
                <TypeIcon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden md:inline-block flex-grow text-sm font-medium truncate">{currentLabel}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1 w-48 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg shadow-xl z-10">
                    {FONT_FAMILY_OPTIONS.map(opt => (
                        <button
                            key={opt.id}
                            onMouseDown={e => { e.preventDefault(); handleSelect(opt.id); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-element-primary)] ${currentFont === opt.id ? 'text-[var(--color-accent-primary)] font-semibold' : 'text-[var(--color-text-primary)]'}`}
                            style={{ fontFamily: opt.id }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const FontSizeDropdown: React.FC<{ onFormat: (type: 'fontSize', value: string) => void; editorRef: React.RefObject<HTMLDivElement> }> = ({ onFormat, editorRef }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentSize, setCurrentSize] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateCurrentSize = () => {
            if (editorRef.current?.contains(document.activeElement)) {
                const sizeValue = document.queryCommandValue('fontSize');
                setCurrentSize(sizeValue || null);
            }
        };

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
        };

        document.addEventListener('selectionchange', updateCurrentSize);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('selectionchange', updateCurrentSize);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editorRef]);

    const handleSelect = (sizeId: string) => {
        onFormat('fontSize', sizeId);
        setIsOpen(false);
    };
    
    const currentLabel = currentSize ? FONT_SIZE_MAP[currentSize] || 'Size' : 'Size';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 p-2.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-element-primary-hover)] hover:text-[var(--color-text-primary)] rounded-md transition-colors md:w-28 text-left"
            >
                <FontSizeIcon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden md:inline-block flex-grow text-sm font-medium truncate">{currentLabel}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1 w-32 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg shadow-xl z-10">
                    {FONT_SIZE_OPTIONS.map(opt => (
                        <button
                            key={opt.id}
                            onMouseDown={e => { e.preventDefault(); handleSelect(opt.id); }}
                            className={`w-full text-left px-3 py-2 text-sm font-medium hover:bg-[var(--color-element-primary)] ${currentSize === opt.id ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-primary)]'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


const FormattingToolbar: React.FC<{ onFormat: (type: FormatType, value?: string) => void; editorRef: React.RefObject<HTMLDivElement> }> = ({ onFormat, editorRef }) => (
    <div className="flex items-center space-x-1 bg-[var(--color-bg-tertiary)] p-1 rounded-t-lg border-b border-[var(--color-border-secondary)] flex-wrap">
        <FormatDropdown onFormat={onFormat as any} editorRef={editorRef} />
        <FontFamilyDropdown onFormat={onFormat as any} editorRef={editorRef} />
        <FontSizeDropdown onFormat={onFormat as any} editorRef={editorRef} />
        <div className="h-5 w-px bg-[var(--color-border-secondary)] mx-1"></div>
        <button onMouseDown={e => { e.preventDefault(); onFormat('bold'); }} title="Bold (Ctrl+B)" className="p-2.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-element-primary-hover)] hover:text-[var(--color-text-primary)] rounded-md transition-colors"><BoldIcon className="w-4 h-4" /></button>
        <button onMouseDown={e => { e.preventDefault(); onFormat('italic'); }} title="Italic (Ctrl+I)" className="p-2.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-element-primary-hover)] hover:text-[var(--color-text-primary)] rounded-md transition-colors"><ItalicIcon className="w-4 h-4" /></button>
        <div className="h-5 w-px bg-[var(--color-border-secondary)] mx-1"></div>
        <button onMouseDown={e => { e.preventDefault(); onFormat('bullet'); }} title="Bulleted List" className="p-2.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-element-primary-hover)] hover:text-[var(--color-text-primary)] rounded-md transition-colors"><ListIcon className="w-4 h-4" /></button>
        <button onMouseDown={e => { e.preventDefault(); onFormat('number'); }} title="Numbered List" className="p-2.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-element-primary-hover)] hover:text-[var(--color-text-primary)] rounded-md transition-colors"><ListOrderedIcon className="w-4 h-4" /></button>
        <div className="h-5 w-px bg-[var(--color-border-secondary)] mx-1"></div>
        <button onMouseDown={e => { e.preventDefault(); onFormat('link'); }} title="Insert Link (Ctrl+K)" className="p-2.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-element-primary-hover)] hover:text-[var(--color-text-primary)] rounded-md transition-colors"><ExternalLinkIcon className="w-4 h-4" /></button>
    </div>
);

const FocusEditorModal: React.FC<FocusEditorModalProps> = ({ modalState, onClose, onSave, compositionTheme, defaultImportFont }) => {
    const isEditMode = modalState.mode === 'edit';
    
    const defaultNewCardContent = useMemo(() => {
        return formatNewCardContent('', defaultImportFont.family, defaultImportFont.size);
    }, [defaultImportFont]);
    
    const initialContent = isEditMode ? modalState.card.content : defaultNewCardContent;
    const initialNotes = isEditMode ? modalState.card.notes || '' : '';
    const initialTags = isEditMode ? modalState.card.tags || [] : [];
    const initialTask = isEditMode ? modalState.card.task : undefined;
    
    const [text, setText] = useState(initialContent);
    const [notes, setNotes] = useState(initialNotes);
    const [tags, setTags] = useState<string[]>(initialTags);
    const [tagInput, setTagInput] = useState('');
    const [isNotesVisible, setIsNotesVisible] = useState(false);
    const [selection, setSelection] = useState<ActiveSelection | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
    const [isAiPanelCollapsed, setIsAiPanelCollapsed] = useState(window.innerWidth < 768);
    const [isCompositionModeActive, setIsCompositionModeActive] = useState(false);

    const [isTask, setIsTask] = useState(!!initialTask);
    const [taskStatus, setTaskStatus] = useState<TaskStatus>(initialTask?.status || 'sketch');
    const [dueDate, setDueDate] = useState(initialTask?.dueDate || '');
    const [taskPriority, setTaskPriority] = useState<TaskPriority>(initialTask?.priority || 'medium');

    const editorRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const saveStatusTimeout = useRef<number | null>(null);
    const mouseDownOnBackdrop = useRef(false);

    // This is the key change. By depending on the card's ID (or the mode for 'add'),
    // this effect will only run when the modal is first opened for a specific card,
    // not on every re-render caused by typing or other state changes.
    const cardId = isEditMode ? modalState.card.id : 'add-mode';

    useEffect(() => {
        const content = isEditMode ? modalState.card.content : defaultNewCardContent;
        const notes = isEditMode ? modalState.card.notes || '' : '';
        const tags = isEditMode ? modalState.card.tags || [] : [];
        const task = isEditMode ? modalState.card.task : undefined;

        // Set state and editor content only when the card itself changes.
        setText(content);
        if (editorRef.current) {
            editorRef.current.innerHTML = content;
        }
        setNotes(notes);
        setTags(tags);
        setIsTask(!!task);
        setTaskStatus(task?.status || 'sketch');
        setDueDate(task?.dueDate || '');
        setTaskPriority(task?.priority || 'medium');

        setIsNotesVisible(!!notes || tags.length > 0 || !!task);
        setSaveStatus('idle');
        setTimeout(() => editorRef.current?.focus(), 100);
        
        return () => {
            if (saveStatusTimeout.current) clearTimeout(saveStatusTimeout.current);
        };
    }, [cardId, defaultNewCardContent]);

    const handleSelectionChange = useCallback(() => {
        const currentSelection = window.getSelection();
        if (currentSelection && currentSelection.rangeCount > 0) {
            const range = currentSelection.getRangeAt(0);
            // Ensure the selection is within the editor before acting on it.
            if (editorRef.current?.contains(range.commonAncestorContainer)) {
                const selectedText = currentSelection.toString();
                if (selectedText.trim() !== '') {
                    setSelection({ text: selectedText });
                    // This is a valid, non-empty selection. Save its range.
                    savedRangeRef.current = range.cloneRange();
                } else {
                    setSelection(null);
                    // This is a collapsed selection (a click) within the editor. Clear any previously saved range.
                    savedRangeRef.current = null;
                }
            }
            // If the selection is outside our editor, we do nothing. This prevents
            // blurring the editor from clearing our saved range.
        } else {
            // There is no selection anywhere in the document.
            setSelection(null);
            savedRangeRef.current = null;
        }
    }, []);
    
    useEffect(() => {
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [handleSelectionChange]);

    const handleFormat = (type: FormatType, value?: string) => {
        const exec = (command: string, val?: any) => document.execCommand(command, false, val);
        
        editorRef.current?.focus();
    
        switch (type) {
            case 'bold': exec('bold'); break;
            case 'italic': exec('italic'); break;
            case 'formatBlock': if (value) exec('formatBlock', value); break;
            case 'bullet': exec('insertUnorderedList'); break;
            case 'number': exec('insertOrderedList'); break;
            case 'link':
                const url = prompt("Enter the URL:", "https://");
                if (url) exec('createLink', url);
                break;
            case 'fontName':
                if (value) exec('fontName', value);
                break;
            case 'fontSize':
                // This command is tricky, but it's the most straightforward way in a contentEditable div.
                // We ensure it uses CSS styles instead of <font> tags.
                exec('styleWithCSS', true);
                if (value) exec('fontSize', value);
                break;
        }
    };


    const handleSave = (options: { shouldClose: boolean }) => {
        const taskData = isTask ? { status: taskStatus, dueDate: dueDate || undefined, priority: taskPriority } : undefined;
        onSave({ content: text, notes, tags, task: taskData }, options);
    };

    const handleQuickSave = () => {
        if (saveStatus === 'saved' || modalState.mode === 'add') return;
        handleSave({ shouldClose: false });
        setSaveStatus('saved');
    
        if (saveStatusTimeout.current) clearTimeout(saveStatusTimeout.current);
        saveStatusTimeout.current = window.setTimeout(() => setSaveStatus('idle'), 2000);
    };

    return (
        <div 
            className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 animate-fade-in"
            onMouseDown={(e) => { if (e.target === e.currentTarget) mouseDownOnBackdrop.current = true; }}
            onMouseUp={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop.current) { handleSave({ shouldClose: true }); onClose(); } mouseDownOnBackdrop.current = false; }}
        >
            <div className="bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl w-full h-full flex flex-col md:flex-row overflow-hidden" style={{ maxWidth: '65vw', maxHeight: '90vh' }}>
                <div className="flex-grow flex flex-col min-w-0">
                    <FormattingToolbar onFormat={handleFormat} editorRef={editorRef} />
                    <div
                        ref={editorRef}
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        onInput={e => setText(e.currentTarget.innerHTML)}
                        onBlur={handleQuickSave}
                        className="flex-grow py-6 md:py-10 px-24 md:px-40 overflow-y-auto text-lg focus:outline-none text-[var(--color-text-primary)] prose-card"
                    />
                     <div className="p-4 border-t border-[var(--color-border-secondary)] flex-shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center space-x-2">
                           <button onClick={() => setIsNotesVisible(!isNotesVisible)} className="p-2.5 rounded-md hover:bg-[var(--color-element-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                                {isNotesVisible ? <ChevronDownIcon className="w-5 h-5" /> : <ChevronUpIcon className="w-5 h-5" />}
                           </button>
                           <button onClick={() => setIsCompositionModeActive(true)} className="flex items-center space-x-2 p-2.5 rounded-md hover:bg-[var(--color-element-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                                <ExternalLinkIcon className="w-5 h-5" />
                                <span className="text-sm font-medium">Focus</span>
                           </button>
                        </div>
                         <div className="flex items-center space-x-3">
                            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)]">Cancel</button>
                            <button onClick={() => handleSave({ shouldClose: true })} className="px-5 py-2 text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] rounded-lg hover:bg-[var(--color-accent-primary-hover)] flex items-center">
                                {saveStatus === 'saved' ? <><CheckIcon className="w-4 h-4 mr-2"/> Saved</> : <><SaveIcon className="w-4 h-4 mr-2"/> Save & Exit</>}
                            </button>
                        </div>
                    </div>
                    {isNotesVisible && (
                        <div className="p-4 border-t border-[var(--color-border-secondary)] flex-shrink-0 bg-[var(--color-bg-tertiary)] space-y-4">
                            <div>
                                <h4 className="text-sm font-semibold mb-2 text-[var(--color-text-primary)]">Notes</h4>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={handleQuickSave} placeholder="Add private notes..." rows={3} className="w-full text-sm bg-[var(--color-bg-secondary)] p-2 rounded-md border border-[var(--color-border-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] resize-none" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold mb-2 text-[var(--color-text-primary)] flex items-center">
                                    <HashIcon className="w-4 h-4 mr-2"/> Tags
                                </h4>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {tags.map(tag => (
                                        <div key={tag} className="flex items-center bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] text-sm font-medium px-2.5 py-1 rounded-full">
                                            <span>{tag}</span>
                                            <button onClick={() => { setTags(tags.filter(t => t !== tag)); handleQuickSave(); }} className="ml-1.5 -mr-1 p-0.5 rounded-full hover:bg-black/10"><CloseIcon className="w-3 h-3"/></button>
                                        </div>
                                    ))}
                                </div>
                                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const newTag = tagInput.trim(); if (newTag && !tags.includes(newTag)) { setTags([...tags, newTag]); handleQuickSave(); } setTagInput(''); } }} placeholder="Add a tag and press Enter" className="w-full text-sm bg-[var(--color-bg-secondary)] p-2 rounded-md border border-[var(--color-border-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]" />
                            </div>
                             <div>
                                <h4 className="text-sm font-semibold mb-2 text-[var(--color-text-primary)] flex items-center">
                                    <CheckIcon className="w-4 h-4 mr-2"/> Task
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-3">
                                        <input type="checkbox" id="isTaskCheckbox" checked={isTask} onChange={e => setIsTask(e.target.checked)} className="h-4 w-4 rounded bg-[var(--color-bg-secondary)] border-[var(--color-border-secondary)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]" />
                                        <label htmlFor="isTaskCheckbox" className="text-sm text-[var(--color-text-primary)]">Mark this card as a to-do item</label>
                                    </div>
                                    {isTask && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-7">
                                            <div>
                                                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Status</label>
                                                <select value={taskStatus} onChange={e => setTaskStatus(e.target.value as TaskStatus)} onBlur={handleQuickSave} className="w-full mt-1 text-sm bg-[var(--color-bg-secondary)] p-2 rounded-md border border-[var(--color-border-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]">
                                                    <option value="sketch">Sketch/Idea</option>
                                                    <option value="revision">Revision</option>
                                                    <option value="proofreading">Proofreading</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Due Date</label>
                                                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} onBlur={handleQuickSave} className="w-full mt-1 text-sm bg-[var(--color-bg-secondary)] p-2 rounded-md border border-[var(--color-border-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-[var(--color-text-secondary)]">Priority</label>
                                                <select value={taskPriority} onChange={e => setTaskPriority(e.target.value as TaskPriority)} onBlur={handleQuickSave} className="w-full mt-1 text-sm bg-[var(--color-bg-secondary)] p-2 rounded-md border border-[var(--color-border-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]">
                                                    <option value="medium">Medium</option>
                                                    <option value="high">High</option>
                                                    <option value="low">Low</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className={`transition-all duration-300 ease-in-out flex-shrink-0 bg-[var(--color-bg-tertiary)] border-l border-[var(--color-border-primary)] ${isAiPanelCollapsed ? 'w-12' : 'w-full md:w-[380px]'}`}>
                    <div className="h-full flex flex-col">
                        <button onClick={() => setIsAiPanelCollapsed(!isAiPanelCollapsed)} className="h-12 w-full flex items-center justify-center bg-[var(--color-bg-secondary)] hover:bg-[var(--color-element-primary)] border-b border-[var(--color-border-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                            {isAiPanelCollapsed ? <ChevronLeftIcon className="w-5 h-5"/> : <ChevronRightIcon className="w-5 h-5"/>}
                        </button>
                        {!isAiPanelCollapsed && (
                             <RephrasePanel 
                                textToEdit={text} 
                                activeSelection={selection}
                                onReplaceSelection={(replacement) => {
                                    if (savedRangeRef.current && editorRef.current?.contains(savedRangeRef.current.commonAncestorContainer)) {
                                        const selection = window.getSelection();
                                        selection?.removeAllRanges();
                                        selection?.addRange(savedRangeRef.current);
                                        document.execCommand('insertHTML', false, replacement);
                                    } else {
                                        document.execCommand('insertHTML', false, replacement);
                                    }
                                    setText(editorRef.current?.innerHTML || '');
                                    handleQuickSave();
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
            {isCompositionModeActive && (
                <CompositionPanel 
                    initialContent={text}
                    onUpdate={setText}
                    onClose={() => setIsCompositionModeActive(false)}
                    onSaveAndClose={(finalContent) => {
                        setText(finalContent);
                        onSave({ content: finalContent, notes, tags, task: isTask ? { status: taskStatus, dueDate, priority: taskPriority } : undefined }, { shouldClose: true });
                        setIsCompositionModeActive(false);
                    }}
                    compositionTheme={compositionTheme}
                />
            )}
        </div>
    );
};
export default FocusEditorModal;