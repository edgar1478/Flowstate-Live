import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Project, Card, Task, TaskStatus, TaskPriority } from '../types';
import { generateContextualText, improveTextInContext, proofreadText, ProofreadSuggestion, queryDocument, getSceneBuildingQuestion, synthesizeSceneNotes, ChatMessage } from '../services/geminiService';
import { exportToTxt, exportToDocx } from '../services/documentExporter';
// FIX: Imported `createSanitizedMarkup` to handle safe HTML rendering.
import { htmlToPlainText, formatNewCardContent, createSanitizedMarkup } from '../services/documentParser';
import { stringifyProjectsToXml } from '../services/xmlService';
import { BLUEPRINTS, Blueprint } from '../services/blueprints';
import FocusEditorModal from './FocusEditorModal';
import KanbanView from './KanbanView';
import CalendarView from './CalendarView';
import CompositionPanel from './CompositionPanel';
import FocusPreviewPanel from './FocusPreviewPanel';
// FIX: Imported `CarouselCardData` type for use with the CarouselView component.
import CarouselView, { CarouselCardData } from './CarouselView';
import GenerateInContextModal from './GenerateInContextModal';
import { PlusIcon, TrashIcon, MoreVerticalIcon, CopyIcon, DownloadIcon, UploadIcon, CloseIcon, WandIcon, SaveIcon, ProofreadIcon, RefreshCwIcon, HelpCircleIcon, CheckIcon, CalendarIcon, HashIcon, ListIcon, KanbanIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon, UndoIcon, FilePlusIcon, ArrowDownToLineIcon, ListEndIcon, MousePointerClickIcon, EditIcon, PlusCircleIcon, PaletteIcon, EyeIcon, EyeOffIcon, ExportIcon, ExternalLinkIcon, FileTextIcon, FileWordIcon, SearchIcon, CombineIcon, PasteIcon, SettingsIcon, CheckSquareIcon, ZapIcon, ShareIcon, LockIcon, UnlockIcon, FolderIcon, LayoutTemplateIcon, BookmarkPlusIcon, CritiqueIcon } from './icons';
import DOMPurify from 'dompurify';
import { INBOX_PROJECT_ID } from '../constants';

interface ProjectLibraryProps {
    projects: Project[];
    userBlueprints: Blueprint[];
    activeProjectId: string | null;
    onSetActiveProjectId: (id: string) => void;
    onAddProject: (details: { name: string; parentId: string | null; category?: string; childCategoryName?: string }) => void;
    onAddProjectFromBlueprint: (xmlString: string, newProjectName: string) => void;
    onImportBlueprint: (file: File) => Promise<void>;
    onDeleteUserBlueprint: (id: string) => void;
    onUpdateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'category' | 'childCategoryName' | 'isHidden'>>) => void;
    onUpdateProjectNotes: (id: string, notes: string) => void;
    onDeleteProject: (id: string) => void;
    onDeleteCard: (projectId: string, cardId: string) => void;
    onDuplicateCard: (projectId: string, cardId: string) => void;
    onAddCardAtIndex: (projectId: string, cardData: Partial<Omit<Card, 'id'>>, index: number) => void;
    onMoveCards: (cards: Card[], sourceProjectId: string, targetProjectId: string) => void;
    onUpdateCardOrder: (projectId: string, cards: Card[]) => void;
    onUpdateCard: (projectId: string, cardId: string, updates: Partial<Card>) => void;
    onExportProject: (projectId: string) => void;
    onBackup: () => void;
    onRestore: (file: File) => void;
    onImportDocument: (file: File, projectName: string) => Promise<void>;
    onImportProject: (file: File) => void;
    onPasteDocument: (textContent: string, projectName: string) => void;
    onCombineCards: (projectId: string, cardIds: string[]) => void;
    onReorderProject: (draggedProjectId: string, targetProjectId: string | null, position: 'on' | 'before' | 'after') => void;
    onAddToInbox: (htmlContent: string) => void;
    theme: string;
    onSetTheme: (theme: string) => void;
    onOpenSettings: () => void;
    cardToLocate: { cardId: string } | null;
    onCardLocated: () => void;
    onNavigateToCard: (projectId: string, cardId: string) => void;
    compositionTheme: string;
    defaultImportFont: { family: string; size: string };
    desktopBackground: string | null;
}

type IndentStyle = 'block' | 'first-line';
type WorkspaceTab = 'preview' | 'context' | 'proofread' | 'query' | 'notes';
type GenerationMode = 'GENERATE' | 'IMPROVE_DRAFT' | 'IMPROVE_BEFORE' | 'IMPROVE_AFTER';
type AddEditModalState = { type: 'add_project', parentId: string | null } | { type: 'edit_project', project: Project };
type ModalState = AddEditModalState | { type: 'paste_document' } | { type: 'move_cards', cards: Card[], sourceProjectId: string } | { type: 'blueprint_library' } | { type: 'save_blueprint', project: Project } | { type: 'delete_project', project: Project } | null;
type FocusModalState = { mode: 'add', insertIndex: number } | { mode: 'edit', card: Card, projectId: string } | null;
type ViewMode = 'list' | 'board' | 'calendar';
type HoveredCardInfo = Card & { projectId: string; projectName: string; projectCategory?: string };
interface TouchDragState {
    isDragging: boolean;
    draggedCard: (Card & { projectId: string; }) | null;
    initialTouch: { x: number; y: number } | null;
    ghostElement: HTMLElement | null;
    originalTargetElement: HTMLElement | null;
    placeholderElement: HTMLElement | null;
    longPressTimeout: number | null;
    draggedOverProjectId: string | null;
}
type WindowId = 'projects' | 'selections' | 'workspace' | 'binder';
interface WindowState {
  id: WindowId;
  title: string;
  isOpen: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}


const CARD_COLORS: { [key: string]: { bg: string; border: string; } } = {
    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200' },
    green: { bg: 'bg-green-50', border: 'border-green-200' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200' },
    pink: { bg: 'bg-pink-50', border: 'border-pink-200' },
    gray: { bg: 'bg-gray-100', border: 'border-gray-200' },
};

const THEMES = [
    { id: 'default-light', name: 'Default Light' },
    { id: 'oasis', name: 'Oasis' },
    { id: 'desert-sunset', name: 'Desert Sunset' },
    { id: 'slate-dark', name: 'Slate Dark' },
    { id: 'midnight', name: 'Midnight' },
];

const LoadingSpinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--color-text-inverted)]"></div>
);

const ProjectNode: React.FC<{
    project: Project;
    allProjects: Project[];
    level: number;
    activeProjectId: string | null;
    onSetActiveProjectId: (id: string) => void;
    onOpenModal: (state: ModalState) => void;
    onUpdateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'category' | 'childCategoryName' | 'isHidden'>>) => void;
    onDeleteProject: (id: string) => void;
    onExportProject: (id: string) => void;
    onDropCardOnProject: (e: React.DragEvent, projectId: string) => void;
    onReorderProject: (draggedProjectId: string, targetProjectId: string, position: 'on' | 'before' | 'after') => void;
    showHiddenProjects: boolean;
    expandedProjects: Set<string>;
    onToggleExpansion: (id: string) => void;
    setNodeRef: (id: string, el: HTMLDivElement | null) => void;
    isTouchDropTarget: boolean;
    isQuickCaptureHovered: boolean;
}> = ({ project, allProjects, level, activeProjectId, onSetActiveProjectId, onOpenModal, onUpdateProject, onDeleteProject, onExportProject, onDropCardOnProject, onReorderProject, showHiddenProjects, expandedProjects, onToggleExpansion, setNodeRef, isTouchDropTarget, isQuickCaptureHovered }) => {
    const isExpanded = expandedProjects.has(project.id);
    const [openDropdown, setOpenDropdown] = useState(false);
    const [isDropdownAbove, setIsDropdownAbove] = useState(false);
    const [isCardDragOver, setIsCardDragOver] = useState(false);
    const [dropPosition, setDropPosition] = useState<'before' | 'on' | 'after' | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const children = useMemo(() => allProjects.filter(p => p.parentId === project.id).filter(p => showHiddenProjects || !p.isHidden), [allProjects, project.id, showHiddenProjects]);
    const isInboxProject = project.id === INBOX_PROJECT_ID;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (openDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpenDropdown(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openDropdown]);

    const handleToggleDropdown = (event: React.MouseEvent<HTMLButtonElement>) => {
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        const dropdownHeight = 150; // Approximate height based on 4 items
        
        if (rect.bottom + dropdownHeight > window.innerHeight) {
            setIsDropdownAbove(true);
        } else {
            setIsDropdownAbove(false);
        }
        setOpenDropdown(prev => !prev);
    };

    const handleDragStartProject = (e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.setData('application/vnd.flowstate.project', project.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.types.includes('application/vnd.flowstate.project')) {
            const draggedId = e.dataTransfer.getData('application/vnd.flowstate.project');
            if (draggedId === project.id || isInboxProject) {
                setDropPosition(null);
                return;
            }

            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const height = rect.height;
            
            if (y < height / 3) {
                setDropPosition('before');
            } else if (y > (height * 2) / 3) {
                setDropPosition('on');
            } else {
                setDropPosition('after');
            }
        } else if (e.dataTransfer.types.includes('application/json')) {
            setIsCardDragOver(true);
        }
    };

    const handleDragLeave = () => {
        setIsCardDragOver(false);
        setDropPosition(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedProjectId = e.dataTransfer.getData('application/vnd.flowstate.project');

        if (draggedProjectId && dropPosition) {
            onReorderProject(draggedProjectId, project.id, dropPosition);
        } else {
            onDropCardOnProject(e, project.id);
        }

        setIsCardDragOver(false);
        setDropPosition(null);
    };

    return (
        <div style={{ paddingLeft: `${level * 1.25}rem` }}>
            <div
                ref={(el) => setNodeRef(project.id, el)}
                data-project-id={project.id}
                draggable={!isInboxProject}
                onDragStart={!isInboxProject ? handleDragStartProject : undefined}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex items-center group rounded-md my-0.5 transition-all text-sm relative ${activeProjectId === project.id ? 'bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)]' : isInboxProject && isQuickCaptureHovered ? 'bg-[var(--color-element-primary-hover)]' : 'hover:bg-[var(--color-element-primary)]'} ${isCardDragOver || isTouchDropTarget ? 'bg-[var(--color-accent-subtle-bg)] ring-2 ring-[var(--color-accent-subtle-border)]' : ''} ${dropPosition === 'on' ? 'bg-[var(--color-accent-subtle-bg)] ring-2 ring-[var(--color-accent-subtle-border)]' : ''} ${project.isHidden && !openDropdown ? 'opacity-60 hover:opacity-100' : ''}`}
            >
                <div className={`absolute left-0 top-0 h-full w-1 rounded-l-md transition-colors ${activeProjectId === project.id ? 'bg-[var(--color-accent-primary)]' : 'bg-transparent'}`} />
                <button onClick={() => onToggleExpansion(project.id)} disabled={children.length === 0} className={`p-1.5 transition-transform duration-200 ${children.length > 0 ? '' : 'opacity-0 cursor-default'}`}>
                    <ChevronRightIcon className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                 <div className={`mr-1.5 ${activeProjectId === project.id ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {isInboxProject ? <ZapIcon className="w-5 h-5" /> : <FolderIcon className="w-5 h-5" />}
                </div>
                <div onClick={() => onSetActiveProjectId(project.id)} className="flex-grow cursor-pointer py-2 pr-2 text-sm font-medium whitespace-nowrap truncate min-w-0">
                    {project.name}
                </div>
                <div className="relative opacity-0 group-hover:opacity-100 transition-opacity" ref={dropdownRef}>
                    <button onClick={handleToggleDropdown} className={`p-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-r-md`}>
                        <MoreVerticalIcon className="w-4 h-4" />
                    </button>
                    {openDropdown && (
                        <div className={`absolute right-0 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg shadow-xl z-20 w-48 text-[var(--color-text-primary)] ${isDropdownAbove ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
                            <button onClick={() => { onOpenModal({ type: 'add_project', parentId: project.id }); setOpenDropdown(false); }} className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-[var(--color-element-primary)] rounded-t-lg transition-colors"><PlusIcon className="mr-2 w-4 h-4" /> Add Sub-project</button>
                            <button onClick={() => { onOpenModal({ type: 'edit_project', project }); setOpenDropdown(false); }} className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-[var(--color-element-primary)] transition-colors"><EditIcon className="mr-2 w-4 h-4"/> Edit Details</button>
                            <button onClick={() => { onExportProject(project.id); setOpenDropdown(false); }} className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-[var(--color-element-primary)] transition-colors"><ExportIcon className="mr-2 w-4 h-4" /> Export Project</button>
                            <button onClick={() => { onOpenModal({ type: 'save_blueprint', project }); setOpenDropdown(false); }} disabled={isInboxProject} className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-[var(--color-element-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><BookmarkPlusIcon className="mr-2 w-4 h-4" /> Save as Blueprint</button>
                            <button onClick={() => { onUpdateProject(project.id, { isHidden: !project.isHidden }); setOpenDropdown(false); }} className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-[var(--color-element-primary)] transition-colors">
                                {project.isHidden ? <EyeIcon className="mr-2 w-4 h-4" /> : <EyeOffIcon className="mr-2 w-4 h-4" />}
                                {project.isHidden ? 'Show in Preview' : 'Hide from Preview'}
                            </button>
                            <button onClick={() => { onOpenModal({ type: 'delete_project', project }); setOpenDropdown(false); }} disabled={isInboxProject} className="flex items-center w-full px-4 py-2 text-sm text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] rounded-b-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><TrashIcon className="mr-2 w-4 h-4" /> Delete</button>
                        </div>
                    )}
                </div>
                 <div className={`absolute -top-0.5 left-2 right-2 h-1 bg-[var(--color-accent-primary)] rounded-full transition-opacity duration-200 ${dropPosition === 'before' ? 'opacity-100' : 'opacity-0'}`} />
                 <div className={`absolute -bottom-0.5 left-2 right-2 h-1 bg-[var(--color-accent-primary)] rounded-full transition-opacity duration-200 ${dropPosition === 'after' ? 'opacity-100' : 'opacity-0'}`} />
            </div>
            {isExpanded && children.map(child => (
                <ProjectNode
                    key={child.id}
                    project={child}
                    allProjects={allProjects}
                    level={level + 1}
                    activeProjectId={activeProjectId}
                    onSetActiveProjectId={onSetActiveProjectId}
                    onOpenModal={onOpenModal}
                    onUpdateProject={onUpdateProject}
                    onDeleteProject={onDeleteProject}
                    onExportProject={onExportProject}
                    onDropCardOnProject={onDropCardOnProject}
                    onReorderProject={onReorderProject}
                    showHiddenProjects={showHiddenProjects}
                    expandedProjects={expandedProjects}
                    onToggleExpansion={onToggleExpansion}
                    setNodeRef={setNodeRef}
                    isTouchDropTarget={isTouchDropTarget}
                    isQuickCaptureHovered={isQuickCaptureHovered}
                />
            ))}
        </div>
    );
};

const ProjectModal: React.FC<{
    modalState: AddEditModalState | null;
    onClose: () => void;
    onAddProject: (details: { name: string; parentId: string | null; category?: string; childCategoryName?: string }) => void;
    onUpdateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'category' | 'childCategoryName'>>) => void;
    projects: Project[];
}> = ({ modalState, onClose, onAddProject, onUpdateProject, projects }) => {
    const isEdit = modalState?.type === 'edit_project';
    const parent = modalState?.type === 'add_project' && modalState.parentId ? projects.find(p => p.id === modalState.parentId) : null;
    const initialData = isEdit ? modalState.project : { name: '', category: parent?.childCategoryName || '', childCategoryName: '' };
    
    const [name, setName] = useState(initialData.name);
    const [category, setCategory] = useState(initialData.category);
    const [childCategoryName, setChildCategoryName] = useState(initialData.childCategoryName);
    
    useEffect(() => {
        const isEdit = modalState?.type === 'edit_project';
        const parent = modalState?.type === 'add_project' && modalState.parentId ? projects.find(p => p.id === modalState.parentId) : null;
        const initialData = isEdit ? modalState.project : { name: '', category: parent?.childCategoryName || '', childCategoryName: '' };
        setName(initialData.name);
        setCategory(initialData.category || '');
        setChildCategoryName(initialData.childCategoryName || '');
    }, [modalState, projects]);

    if (!modalState) return null;

    const handleSubmit = () => {
        if (!name.trim()) return;
        if (isEdit) {
            onUpdateProject(modalState.project.id, { name, category, childCategoryName });
        } else {
            onAddProject({ name, parentId: modalState.parentId, category, childCategoryName });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--color-bg-secondary)] rounded-lg shadow-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{isEdit ? 'Edit Project' : (parent ? 'Add Sub-project' : 'Add New Project')}</h2>
                <div>
                    <label className="text-sm font-medium text-[var(--color-text-secondary)]">Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={isEdit ? '' : (parent ? `${parent.childCategoryName || 'Sub-project'} name` : 'Project name')} className="w-full mt-1 bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]" autoFocus/>
                </div>
                 <div>
                    <label className="text-sm font-medium text-[var(--color-text-secondary)]">This item is a...</label>
                    <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Novel, Chapter, Section" disabled={!!(parent?.childCategoryName)} className="w-full mt-1 bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:bg-[var(--color-element-primary)]"/>
                </div>
                 <div>
                    <label className="text-sm font-medium text-[var(--color-text-secondary)]">Its sub-items are called...</label>
                    <input type="text" value={childCategoryName} onChange={e => setChildCategoryName(e.target.value)} placeholder="e.g., Chapter, Scene, Subsection" className="w-full mt-1 bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"/>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)]">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] rounded-lg hover:bg-[var(--color-accent-primary-hover)]">Save</button>
                </div>
            </div>
        </div>
    );
};

const BlueprintModal: React.FC<{
    onClose: () => void;
    userBlueprints: Blueprint[];
    onAddProjectFromBlueprint: (xmlString: string, newProjectName: string) => void;
    onImportBlueprint: (file: File) => Promise<void>;
    onDeleteUserBlueprint: (id: string) => void;
}> = ({ onClose, userBlueprints, onAddProjectFromBlueprint, onImportBlueprint, onDeleteUserBlueprint }) => {
    const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
    const [projectName, setProjectName] = useState('');
    const importBlueprintInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (selectedBlueprint) {
            setProjectName(selectedBlueprint.name);
        } else {
            setProjectName('');
        }
    }, [selectedBlueprint]);

    const handleCreate = () => {
        if (selectedBlueprint && projectName.trim()) {
            onAddProjectFromBlueprint(selectedBlueprint.xml, projectName.trim());
            onClose();
        }
    };

    const handleImportClick = () => {
        importBlueprintInputRef.current?.click();
    };
    
    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                await onImportBlueprint(file);
            } catch (error) {
                alert(`Error importing blueprint: ${(error as Error).message}`);
            } finally {
                e.target.value = ''; // Reset input to allow re-importing same file
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--color-bg-secondary)] rounded-lg shadow-xl w-full max-w-3xl flex flex-col" style={{ height: '80vh' }} onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-[var(--color-border-primary)] flex-shrink-0">
                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Add Project from Blueprint</h2>
                    <p className="text-sm text-[var(--color-text-secondary)]">Start with a proven structure to kickstart your writing process.</p>
                </div>

                <div className="flex-grow flex flex-col md:flex-row min-h-0">
                    <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-[var(--color-border-primary)] overflow-y-auto p-2">
                        <h4 className="px-3 pt-2 pb-1 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Built-in</h4>
                        {BLUEPRINTS.map(bp => (
                            <button
                                key={bp.id}
                                onClick={() => setSelectedBlueprint(bp)}
                                className={`w-full text-left p-3 my-1 rounded-lg transition-colors ${selectedBlueprint?.id === bp.id ? 'bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)]' : 'hover:bg-[var(--color-element-primary)]'}`}
                            >
                                <h3 className="font-semibold text-sm">{bp.name}</h3>
                            </button>
                        ))}
                        <div className="mt-4 px-3 pt-2 pb-1 flex justify-between items-center">
                            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">My Blueprints</h4>
                            <button onClick={handleImportClick} title="Import blueprint from file" className="p-1.5 rounded-full hover:bg-[var(--color-element-primary)]">
                                <PlusIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                            </button>
                            <input type="file" ref={importBlueprintInputRef} onChange={handleFileImport} accept=".xml,.blueprint.xml" className="hidden" />
                        </div>
                        {userBlueprints.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-center text-[var(--color-text-tertiary)] italic">No imported blueprints.</p>
                        ) : (
                            userBlueprints.map(bp => (
                                <div key={bp.id} className="group flex items-center pr-2">
                                    <button
                                        onClick={() => setSelectedBlueprint(bp)}
                                        className={`flex-grow text-left p-3 my-1 rounded-lg transition-colors ${selectedBlueprint?.id === bp.id ? 'bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)]' : 'hover:bg-[var(--color-element-primary)]'}`}
                                    >
                                        <h3 className="font-semibold text-sm truncate">{bp.name}</h3>
                                    </button>
                                    <button onClick={() => onDeleteUserBlueprint(bp.id)} title="Delete blueprint" className="p-1.5 rounded-full text-[var(--color-text-tertiary)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="w-full md:w-2/3 p-6 flex flex-col justify-between">
                        {selectedBlueprint ? (
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{selectedBlueprint.name}</h3>
                                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{selectedBlueprint.description}</p>
                                <div>
                                    <label htmlFor="blueprint-project-name" className="text-sm font-medium text-[var(--color-text-secondary)]">Project Name</label>
                                    <input
                                        id="blueprint-project-name"
                                        type="text"
                                        value={projectName}
                                        onChange={e => setProjectName(e.target.value)}
                                        className="w-full mt-1 bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-center">
                                <p className="text-sm text-[var(--color-text-tertiary)]">Select a blueprint to get started.</p>
                            </div>
                        )}
                        <div className="flex justify-end space-x-3 pt-4">
                            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)]">Cancel</button>
                            <button onClick={handleCreate} disabled={!selectedBlueprint || !projectName.trim()} className="px-4 py-2 text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] rounded-lg hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50">Create Project</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SaveBlueprintModal: React.FC<{
    project: Project;
    allProjects: Project[];
    onClose: () => void;
}> = ({ project, allProjects, onClose }) => {
    const [blueprintName, setBlueprintName] = useState(project.name);
    const [blueprintDescription, setBlueprintDescription] = useState(project.notes || '');
    const [includeContent, setIncludeContent] = useState(true);

    const handleSave = () => {
        const getDescendants = (pId: string, currentAllProjects: Project[]): Project[] => {
            const children = currentAllProjects.filter(p => p.parentId === pId);
            let descendants = [...children];
            children.forEach(child => {
                descendants.push(...getDescendants(child.id, currentAllProjects));
            });
            return descendants;
        };

        const projectsToExport = [project, ...getDescendants(project.id, allProjects)];
        const projectsForBlueprint = JSON.parse(JSON.stringify(projectsToExport)) as Project[];
        
        projectsForBlueprint.forEach((p: Project) => {
            p.lastModified = undefined;
            if (!includeContent) {
                p.cards.forEach(card => {
                    card.content = '';
                    card.notes = undefined;
                });
            }
        });

        const rootBlueprintProject = projectsForBlueprint.find((p: Project) => p.id === project.id);
        if (rootBlueprintProject) {
            rootBlueprintProject.parentId = null;
            // Use the user-provided name and description for the root project
            rootBlueprintProject.name = blueprintName.trim();
            rootBlueprintProject.notes = blueprintDescription.trim();
        }

        const xmlString = stringifyProjectsToXml(projectsForBlueprint);
        const blob = new Blob([xmlString], { type: 'application/xml' });
        const filename = `${blueprintName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.blueprint.xml`;
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--color-bg-secondary)] rounded-lg shadow-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Save as Blueprint</h2>
                <div>
                    <label className="text-sm font-medium text-[var(--color-text-secondary)]">Blueprint Name</label>
                    <input type="text" value={blueprintName} onChange={e => setBlueprintName(e.target.value)} placeholder="Enter a name for the blueprint" className="w-full mt-1 bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]" autoFocus/>
                </div>
                 <div>
                    <label className="text-sm font-medium text-[var(--color-text-secondary)]">Description</label>
                    <textarea value={blueprintDescription} onChange={e => setBlueprintDescription(e.target.value)} placeholder="Describe what this blueprint is for..." rows={3} className="w-full mt-1 bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] resize-none"/>
                </div>
                <div className="flex items-center space-x-3">
                    <input type="checkbox" id="includeContentCheckbox" checked={includeContent} onChange={e => setIncludeContent(e.target.checked)} className="h-4 w-4 rounded bg-[var(--color-bg-tertiary)] border-[var(--color-border-secondary)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]" />
                    <label htmlFor="includeContentCheckbox" className="text-sm text-[var(--color-text-primary)]">Include card content as prompts</label>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)]">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] rounded-lg hover:bg-[var(--color-accent-primary-hover)]">Save Blueprint</button>
                </div>
            </div>
        </div>
    );
};

const DeleteProjectModal: React.FC<{
    project: Project;
    allProjects: Project[];
    onClose: () => void;
    onConfirmDelete: (projectId: string) => void;
}> = ({ project, allProjects, onClose, onConfirmDelete }) => {
    const getDescendants = (pId: string, currentAllProjects: Project[]): Project[] => {
        const children = currentAllProjects.filter(p => p.parentId === pId);
        let descendants = [...children];
        children.forEach(child => {
            descendants.push(...getDescendants(child.id, currentAllProjects));
        });
        return descendants;
    };

    const descendants = useMemo(() => getDescendants(project.id, allProjects), [project.id, allProjects]);
    const totalCardsCount = useMemo(() => {
        const allTargetProjects = [project, ...descendants];
        return allTargetProjects.reduce((acc, p) => acc + (p.cards?.length || 0), 0);
    }, [project, descendants]);

    const handleDelete = () => {
        onConfirmDelete(project.id);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4 border border-[var(--color-border-primary)]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center">
                        <TrashIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Delete Project</h2>
                        <p className="text-xs text-[var(--color-text-secondary)]">This action cannot be undone.</p>
                    </div>
                </div>

                <div className="space-y-2 text-sm bg-[var(--color-bg-tertiary)] p-4 rounded-lg border border-[var(--color-border-secondary)]">
                    <p className="text-[var(--color-text-primary)] font-medium">
                        Are you sure you want to delete <span className="font-bold text-[var(--color-accent-primary)]">"{project.name}"</span>?
                    </p>
                    {descendants.length > 0 ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            ⚠️ This project contains {descendants.length} sub-project{descendants.length > 1 ? 's' : ''} and {totalCardsCount} card{totalCardsCount !== 1 ? 's' : ''} which will also be permanently deleted.
                        </p>
                    ) : (
                        totalCardsCount > 0 && (
                            <p className="text-xs text-[var(--color-text-secondary)]">
                                This project contains {totalCardsCount} card{totalCardsCount !== 1 ? 's' : ''} which will be deleted.
                            </p>
                        )
                    )}
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleDelete} 
                        className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center shadow-sm"
                        autoFocus
                    >
                        <TrashIcon className="w-4 h-4 mr-1.5" />
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};


const PasteModal: React.FC<{
    onClose: () => void;
    onSave: (textContent: string, projectName: string) => void;
}> = ({ onClose, onSave }) => {
    const [textContent, setTextContent] = useState('');
    const [projectName, setProjectName] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setTimeout(() => textareaRef.current?.focus(), 100);
    }, []);

    const handleSave = () => {
        if (projectName.trim() && textContent.trim()) {
            onSave(textContent, projectName.trim());
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--color-bg-secondary)] rounded-lg shadow-xl p-6 w-full max-w-2xl space-y-4 flex flex-col" style={{ height: '80vh' }} onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Paste Document</h2>
                <div className="flex-grow flex flex-col min-h-0">
                    <label htmlFor="project-name-paste" className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">Project Name</label>
                    <input
                        id="project-name-paste"
                        type="text"
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                        placeholder="Enter a name for the new project"
                        className="w-full bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] mb-4"
                    />
                    <label htmlFor="paste-area" className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">Paste your text below</label>
                    <textarea
                        id="paste-area"
                        ref={textareaRef}
                        value={textContent}
                        onChange={e => setTextContent(e.target.value)}
                        placeholder="Paste your content here. Each line break will create a new card."
                        className="w-full flex-grow text-base p-4 resize-none focus:outline-none leading-relaxed text-[var(--color-text-primary)] rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-secondary)] focus:ring-2 focus:ring-[var(--color-ring)] whitespace-pre-wrap"
                    />
                </div>
                <div className="flex justify-end space-x-3 pt-2 flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)]">Cancel</button>
                    <button onClick={handleSave} disabled={!projectName.trim() || !textContent.trim()} className="px-4 py-2 text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] rounded-lg hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50">Create Project</button>
                </div>
            </div>
        </div>
    );
};

const MoveToProjectModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onMove: (targetProjectId: string) => void;
    projects: Project[];
    sourceProjectId: string | null;
    cardsToMoveCount: number;
}> = ({ isOpen, onClose, onMove, projects, sourceProjectId, cardsToMoveCount }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const ProjectMoveNode: React.FC<{ project: Project; level: number }> = ({ project, level }) => {
        const isSource = project.id === sourceProjectId;
        const children = visibleProjects.filter(p => p.parentId === project.id);
        
        return (
            <div style={{ paddingLeft: `${level * 1}rem` }}>
                <button
                    onClick={() => onMove(project.id)}
                    disabled={isSource}
                    className={`w-full text-left px-3 py-2 my-0.5 rounded-md flex items-center gap-2 text-sm transition-colors ${isSource ? 'bg-[var(--color-element-primary)] text-[var(--color-text-tertiary)] cursor-not-allowed' : 'hover:bg-[var(--color-accent-subtle-bg)] text-[var(--color-text-primary)]'}`}
                >
                    <FolderIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{project.name}</span>
                    {isSource && <span className="text-xs ml-auto">(current)</span>}
                </button>
                {children.map(child => <ProjectMoveNode key={child.id} project={child} level={level + 1} />)}
            </div>
        );
    };
    
    const visibleProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const lowerCaseQuery = searchQuery.toLowerCase();
        return projects.filter(p => p.name.toLowerCase().includes(lowerCaseQuery));
    }, [projects, searchQuery]);

    const topLevelProjects = useMemo(() => {
        if (searchQuery.trim()) return visibleProjects; // Flat list for search results
        const inboxProject = visibleProjects.find(p => p.id === INBOX_PROJECT_ID);
        const otherTopLevel = visibleProjects.filter(p => !p.parentId && p.id !== INBOX_PROJECT_ID);
        return inboxProject ? [inboxProject, ...otherTopLevel] : otherTopLevel;
    }, [visibleProjects, searchQuery]);

    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--color-bg-secondary)] rounded-lg shadow-xl p-4 w-full max-w-md space-y-4 flex flex-col" style={{ height: '70vh' }} onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)] px-2">Move {cardsToMoveCount} card{cardsToMoveCount > 1 ? 's' : ''} to...</h2>
                <div className="relative px-2">
                    <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] pl-9 pr-4 py-2 rounded-lg border border-transparent text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:bg-[var(--color-bg-secondary)]"
                        autoFocus
                    />
                </div>
                <div className="flex-grow overflow-y-auto pr-2">
                    {topLevelProjects.map(p => <ProjectMoveNode key={p.id} project={p} level={0} />)}
                </div>
                <div className="flex justify-end space-x-3 pt-2 flex-shrink-0 px-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)]">Cancel</button>
                </div>
            </div>
        </div>
    );
};

// FIX: Added SceneBuilderModal component definition to resolve missing component error.
const SceneBuilderModal: React.FC<{
    card: Card & { projectId: string };
    onClose: () => void;
    onSave: (notes: string) => void;
}> = ({ card, onClose, onSave }) => {
    const [conversation, setConversation] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    };

    useEffect(() => {
        const fetchInitialQuestion = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const firstQuestion = await getSceneBuildingQuestion(card.content, []);
                setConversation([{ role: 'model', content: firstQuestion }]);
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialQuestion();
    }, [card.content]);

    useEffect(() => {
        scrollToBottom();
    }, [conversation]);

    const handleSend = async () => {
        if (!userInput.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: userInput.trim() };
        const newConversation = [...conversation, userMessage];
        setConversation(newConversation);
        setUserInput('');
        setIsLoading(true);
        setError(null);
        
        try {
            const nextQuestion = await getSceneBuildingQuestion(card.content, newConversation);
            setConversation(prev => [...prev, { role: 'model', content: nextQuestion }]);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSaveAndClose = () => {
        const userResponses = conversation.filter(msg => msg.role === 'user');
        if (userResponses.length > 0) {
            const notesToSave = synthesizeSceneNotes(conversation);
            const finalNotes = (card.notes || '') + notesToSave;
            onSave(finalNotes);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-full max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-[var(--color-border-primary)] flex-shrink-0">
                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Flesh out this scene</h2>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        Initial idea: <span className="italic">"{htmlToPlainText(card.content)}"</span>
                    </p>
                </div>
                <div ref={chatContainerRef} className="flex-grow p-6 space-y-4 overflow-y-auto">
                    {conversation.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-md p-3 rounded-lg ${msg.role === 'model' ? 'bg-[var(--color-element-primary)] text-[var(--color-text-secondary)]' : 'bg-[var(--color-accent-primary)] text-[var(--color-accent-text)]'}`}>
                                <p className="text-sm">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="max-w-md p-3 rounded-lg bg-[var(--color-element-primary)] text-[var(--color-text-secondary)]">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
                <div className="p-4 border-t border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <textarea
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Describe what you imagine..."
                            rows={2}
                            className="w-full bg-[var(--color-bg-secondary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] resize-none"
                            disabled={isLoading}
                        />
                        <button onClick={handleSend} disabled={isLoading || !userInput.trim()} className="px-4 py-2 text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] rounded-lg hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50">
                            Send
                        </button>
                    </div>
                     <div className="flex justify-end mt-3">
                        <button onClick={handleSaveAndClose} className="px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)]">
                            Save to Notes & Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const ProjectDashboard: React.FC<{
    project: Project;
    allProjects: Project[];
    wordCount: number;
    cardCount: number;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onToggleProjectPanel?: () => void;
}> = ({ project, allProjects, wordCount, cardCount, searchQuery, onSearchChange, onToggleProjectPanel }) => {
    const breadcrumbs = useMemo(() => {
        const path: Project[] = [];
        let current: Project | undefined = project;
        while (current) {
            path.unshift(current);
            current = allProjects.find(p => p.id === current!.parentId);
        }
        return path;
    }, [project, allProjects]);

    return (
        <div className="bg-[var(--color-bg-secondary-alpha)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg p-3 flex-shrink-0 shadow-sm flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="flex items-center flex-grow min-w-0">
                 {onToggleProjectPanel && (
                    <button onClick={onToggleProjectPanel} className="p-2 -ml-1 mr-1 rounded-full hover:bg-[var(--color-element-primary)] md:hidden">
                        <ListIcon className="w-6 h-6 text-[var(--color-text-primary)]" />
                    </button>
                )}
                <div className="flex-grow min-w-0">
                    <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {breadcrumbs.map((p, i) => (
                            <span key={p.id}>{p.name} {i < breadcrumbs.length - 1 && <span className="mx-1">/</span>}</span>
                        ))}
                    </div>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)] truncate">{project.name}</h3>
                </div>
            </div>
            <div className="relative flex-grow min-w-[200px] sm:min-w-[250px] order-last sm:order-none w-full sm:w-auto">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                <input
                    type="text"
                    placeholder="Search content or #tags..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] pl-9 pr-8 py-2 rounded-lg border border-transparent text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:bg-[var(--color-bg-secondary)]"
                />
                {searchQuery && (
                    <button
                        onClick={() => onSearchChange('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                        aria-label="Clear search"
                    >
                        <CloseIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
            <div className="flex items-center space-x-4 text-sm flex-shrink-0">
                 {project.lastModified && (
                    <div className="flex items-center text-[var(--color-text-secondary)]" title={`Last Modified: ${new Date(project.lastModified).toLocaleString()}`}>
                       <CalendarIcon className="w-4 h-4 mr-1.5" />
                       <span className="font-medium">{new Date(project.lastModified).toLocaleDateString()}</span>
                    </div>
                )}
                <div className="flex items-center text-[var(--color-text-primary)]" title="Word Count"><HashIcon className="w-4 h-4 mr-1.5 text-[var(--color-accent-primary)]" /><span className="font-semibold">{wordCount}</span></div>
                <div className="flex items-center text-[var(--color-text-primary)]" title="Card Count"><ListIcon className="w-4 h-4 mr-1.5 text-[var(--color-accent-secondary)]" /><span className="font-semibold">{cardCount}</span></div>
            </div>
        </div>
    );
};

const HighlightedText: React.FC<{ html: string; highlight: string }> = ({ html, highlight }) => {
    if (!highlight.trim()) {
        return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
    }
    const escapedHighlight = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');
    
    // Sanitize the HTML first, then perform replacement on the sanitized string.
    const sanitizedHtml = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true });
    
    const highlightNodes = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.match(regex)) {
                const fragment = document.createDocumentFragment();
                text.split(regex).forEach(part => {
                    if (part.match(regex)) {
                        const mark = document.createElement('mark');
                        mark.className = "bg-yellow-200 text-black rounded px-0.5 py-0.5";
                        mark.textContent = part;
                        fragment.appendChild(mark);
                    } else {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });
                node.parentNode?.replaceChild(fragment, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Recursively process child nodes of element nodes
            Array.from(node.childNodes).forEach(highlightNodes);
        }
    };
    
    highlightNodes(sanitizedHtml);
    
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(sanitizedHtml);
    
    return <div dangerouslySetInnerHTML={{ __html: tempDiv.innerHTML }} />;
};

const DockButton = React.forwardRef<HTMLButtonElement, { onClick: () => void; isActive?: boolean; title: string; children: React.ReactNode; }>(({ onClick, isActive = false, title, children }, ref) => (
    <button
        ref={ref}
        onClick={onClick}
        title={title}
        className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200 ${isActive ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
    >
        {children}
    </button>
));

const ProjectLibrary: React.FC<ProjectLibraryProps> = ({
    projects, userBlueprints, activeProjectId, onSetActiveProjectId, onAddProject, onAddProjectFromBlueprint, onImportBlueprint, onDeleteUserBlueprint, onUpdateProject, onUpdateProjectNotes, onDeleteProject, onDeleteCard, onDuplicateCard, onMoveCards,
    onUpdateCardOrder, onUpdateCard, onAddCardAtIndex, onExportProject, onBackup, onRestore, onImportDocument, onImportProject, onPasteDocument, onCombineCards, onReorderProject,
    onAddToInbox, theme, onSetTheme, onOpenSettings, cardToLocate, onCardLocated, onNavigateToCard, compositionTheme, defaultImportFont, desktopBackground
}) => {
    const activeProject = projects.find(p => p.id === activeProjectId);
    const [draggedCardInfo, setDraggedCardInfo] = useState<{ cards: Card[], sourceProjectId: string } | null>(null);
    const [indentStyle, setIndentStyle] = useState<IndentStyle>('block');
    const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('preview');
    const [projectNotes, setProjectNotes] = useState('');
    const [beforeContextCards, setBeforeContextCards] = useState<Card[]>([]);
    const [afterContextCards, setAfterContextCards] = useState<Card[]>([]);
    const [contextPrompt, setContextPrompt] = useState('');
    const [generationMode, setGenerationMode] = useState<GenerationMode>('GENERATE');
    const [generatedAlternatives, setGeneratedAlternatives] = useState<string[] | null>(null);
    const [isGeneratingContextual, setIsGeneratingContextual] = useState(false);
    const [numAlternatives, setNumAlternatives] = useState<number>(3);
    const [error, setError] = useState<string | null>(null);
    const [isProofreading, setIsProofreading] = useState(false);
    const [proofreadSuggestions, setProofreadSuggestions] = useState<ProofreadSuggestion[] | null>(null);
    const [documentQuery, setDocumentQuery] = useState('');
    const [queryResponse, setQueryResponse] = useState<string | null>(null);
    const [isQuerying, setIsQuerying] = useState(false);
    const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
    const [modalState, setModalState] = useState<ModalState>(null);
    const [focusModalState, setFocusModalState] = useState<FocusModalState>(null);
    const [isProjectPanelCollapsed, setIsProjectPanelCollapsed] = useState(false);
    const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(true);
    const [undoState, setUndoState] = useState<{ card: Card, projectId: string, originalIndex: number } | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [activeSavePopover, setActiveSavePopover] = useState<number | null>(null);
    const [activeCardOptions, setActiveCardOptions] = useState<string | null>(null);
    const [showHiddenCards, setShowHiddenCards] = useState(false);
    const [showHiddenProjects, setShowHiddenProjects] = useState(false);
    const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false);
    const [isActionsPopoverOpen, setIsActionsPopoverOpen] = useState(false);
    const [isThemePopoverOpen, setIsThemePopoverOpen] = useState(false);
    const [isRootDragOver, setIsRootDragOver] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [isFocusPreviewOpen, setIsFocusPreviewOpen] = useState(false);
    const [isCarouselFocusOpen, setIsCarouselFocusOpen] = useState(false);
    const [initialCarouselIndex, setInitialCarouselIndex] = useState(0);
    const [compositionPanelCard, setCompositionPanelCard] = useState<(Card & { projectId: string }) | null>(null);
    const [touchDragState, setTouchDragState] = useState<TouchDragState>({ isDragging: false, draggedCard: null, initialTouch: null, ghostElement: null, originalTargetElement: null, placeholderElement: null, longPressTimeout: null, draggedOverProjectId: null, });
    const [isQuickCaptureHovered, setIsQuickCaptureHovered] = useState(false);
    const [quickCaptureState, setQuickCaptureState] = useState<{ isOpen: boolean; content: string }>({ isOpen: false, content: '' });
    const [generateInContextState, setGenerateInContextState] = useState<{ insertIndex: number; } | null>(null);
    const [sceneBuilderState, setSceneBuilderState] = useState<{ card: Card & { projectId: string } } | null>(null);
    
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set(projects.map(p => p.id)));
    const projectNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
    const lastEditedCardRef = useRef<{ cardId: string; projectId: string } | null>(null);

    const isClosingModalProgrammatically = useRef(false);

    // --- SYNC SCROLLING ---
    const selectionsContainerRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const isScrollingProgrammatically = useRef<string | null>(null);
    const [activePreviewCardId, setActivePreviewCardId] = useState<string | null>(null);

    const getHierarchicalCards = useCallback((projectId: string | null, allProjects: Project[]): Card[] => {
        if (!projectId) return [];
        const project = allProjects.find(p => p.id === projectId);
        if (!project || project.isHidden) return [];
        
        let cards = [...project.cards];
        const children = allProjects.filter(p => p.parentId === projectId);
        
        for (const child of children) {
            cards.push(...getHierarchicalCards(child.id, allProjects));
        }
        return cards;
    }, []);

    const hierarchicalCards = useMemo(() => {
        const allCards = getHierarchicalCards(activeProjectId, projects);
        return allCards.filter(c => showHiddenCards || !c.isHidden);
    }, [activeProjectId, projects, getHierarchicalCards, showHiddenCards]);

    useEffect(() => {
        const selectionsEl = selectionsContainerRef.current;
        const previewEl = previewContainerRef.current;
        if (!selectionsEl || !previewEl || activeWorkspaceTab !== 'preview') return;

        const selectionsObserver = new IntersectionObserver((entries) => {
            if (isScrollingProgrammatically.current) return;
            const intersectingEntry = entries.find(entry => entry.isIntersecting);
            if (intersectingEntry) {
                const cardId = (intersectingEntry.target as HTMLElement).dataset.cardId;
                if (cardId) {
                    isScrollingProgrammatically.current = 'selections';
                    const previewTarget = document.getElementById(`preview-card-${cardId}`);
                    previewTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setTimeout(() => { isScrollingProgrammatically.current = null; }, 500);
                }
            }
        }, { root: selectionsEl, threshold: 0.5 });

        const previewObserver = new IntersectionObserver((entries) => {
            if (isScrollingProgrammatically.current) return;
            const mostVisibleEntry = entries.reduce((prev, current) => (prev.intersectionRatio > current.intersectionRatio) ? prev : current);
            if (mostVisibleEntry && mostVisibleEntry.isIntersecting) {
                const cardId = (mostVisibleEntry.target as HTMLElement).dataset.cardId;
                if(cardId && cardId !== activePreviewCardId) {
                    setActivePreviewCardId(cardId);
                }
            }
        }, { root: previewEl, threshold: [0.2, 0.4, 0.6, 0.8] });

        const selectionCards = selectionsEl.querySelectorAll('[data-card-id]');
        selectionCards.forEach(card => selectionsObserver.observe(card));
        
        const previewCards = previewEl.querySelectorAll('[data-card-id]');
        previewCards.forEach(card => previewObserver.observe(card));

        return () => {
            selectionsObserver.disconnect();
            previewObserver.disconnect();
        };
    }, [hierarchicalCards, activeWorkspaceTab, activePreviewCardId]);

    useEffect(() => {
        if (activePreviewCardId && !isScrollingProgrammatically.current) {
            isScrollingProgrammatically.current = 'preview';
            const selectionTarget = cardRefs.current.get(activePreviewCardId);
            const wrapper = selectionTarget?.closest('[data-card-wrapper-id]');
            if (wrapper) {
                wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            setTimeout(() => { isScrollingProgrammatically.current = null; }, 500);
        }
    }, [activePreviewCardId]);
    // --- END SYNC SCROLLING ---

    // --- DESKTOP WINDOW MANAGEMENT ---
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
    const zIndexCounter = useRef(3);
    const dragInfo = useRef<{ id: WindowId; initialPos: { x: number, y: number }; initialMouse: { x: number, y: number } } | null>(null);
    const resizeInfo = useRef<{ id: WindowId; initialSize: { width: number, height: number }; initialPos: { x: number, y: number }; initialMouse: { x: number, y: number }; handle: string } | null>(null);
    
    const [windows, setWindows] = useState<Record<WindowId, WindowState>>({
        projects: {
            id: 'projects',
            title: 'Projects',
            isOpen: true,
            position: { x: 100, y: 20 },
            size: { width: 320, height: window.innerHeight - 40 },
            zIndex: 1,
        },
        selections: {
            id: 'selections',
            title: 'Selections',
            isOpen: true,
            position: { x: 440, y: 20 },
            size: { width: 550, height: window.innerHeight - 40 },
            zIndex: 2,
        },
        workspace: {
            id: 'workspace',
            title: 'Workspace',
            isOpen: true,
            position: { x: 1010, y: 20 },
            size: { width: 550, height: window.innerHeight - 40 },
            zIndex: 3,
        },
        binder: { // Added for the potential binder view toggle
            id: 'binder',
            title: 'Binder View',
            isOpen: false,
            position: { x: 200, y: 50},
            size: { width: 1200, height: 800 },
            zIndex: 1,
        }
    });

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth > 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleWindowFocus = useCallback((id: WindowId) => {
        setWindows(prev => {
            if (prev[id].zIndex > zIndexCounter.current - 1) return prev;
            zIndexCounter.current += 1;
            return { ...prev, [id]: { ...prev[id], zIndex: zIndexCounter.current } };
        });
    }, []);

    const handleWindowToggle = useCallback((id: WindowId) => {
        setWindows(prev => {
            const wasOpen = prev[id].isOpen;
            if (!wasOpen) zIndexCounter.current += 1;
            return {
                ...prev,
                [id]: {
                    ...prev[id],
                    isOpen: !wasOpen,
                    zIndex: wasOpen ? prev[id].zIndex : zIndexCounter.current
                }
            };
        });
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (dragInfo.current) {
                const { id, initialPos, initialMouse } = dragInfo.current;
                const dx = e.clientX - initialMouse.x;
                const dy = e.clientY - initialMouse.y;
                setWindows(prev => ({
                    ...prev,
                    [id]: { ...prev[id], position: { x: initialPos.x + dx, y: initialPos.y + dy } }
                }));
            }
            if (resizeInfo.current) {
                const { id, initialSize, initialPos, initialMouse, handle } = resizeInfo.current;
                const dx = e.clientX - initialMouse.x;
                const dy = e.clientY - initialMouse.y;
                let newWidth = initialSize.width, newHeight = initialSize.height, newX = initialPos.x, newY = initialPos.y;

                if (handle.includes('r')) newWidth = Math.max(300, initialSize.width + dx);
                if (handle.includes('b')) newHeight = Math.max(200, initialSize.height + dy);
                if (handle.includes('l')) {
                    newWidth = Math.max(300, initialSize.width - dx);
                    newX = initialPos.x + dx;
                }
                if (handle.includes('t')) {
                    newHeight = Math.max(200, initialSize.height - dy);
                    newY = initialPos.y + dy;
                }
                
                setWindows(prev => ({ ...prev, [id]: { ...prev[id], size: { width: newWidth, height: newHeight }, position: { x: newX, y: newY } } }));
            }
        };

        const handleMouseUp = () => {
            dragInfo.current = null;
            resizeInfo.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleWindowDragStart = useCallback((e: React.MouseEvent, id: WindowId) => {
        e.preventDefault();
        handleWindowFocus(id);
        dragInfo.current = { id, initialPos: windows[id].position, initialMouse: { x: e.clientX, y: e.clientY } };
    }, [windows, handleWindowFocus]);

    const handleWindowResizeStart = useCallback((e: React.MouseEvent, id: WindowId, handle: string) => {
        e.preventDefault();
        e.stopPropagation();
        handleWindowFocus(id);
        resizeInfo.current = { id, initialSize: windows[id].size, initialPos: windows[id].position, initialMouse: { x: e.clientX, y: e.clientY }, handle };
    }, [windows, handleWindowFocus]);
    
    // --- END DESKTOP ---
    
    const anyModalOpen = useMemo(() => {
        return !!modalState || !!focusModalState || isImporting || !!compositionPanelCard || quickCaptureState.isOpen || isFocusPreviewOpen || isCarouselFocusOpen || !!generateInContextState || !!sceneBuilderState;
    }, [modalState, focusModalState, isImporting, compositionPanelCard, quickCaptureState.isOpen, isFocusPreviewOpen, isCarouselFocusOpen, generateInContextState, sceneBuilderState]);

    const prevAnyModalOpen = useRef(anyModalOpen);

    useEffect(() => {
        if (anyModalOpen && !prevAnyModalOpen.current) {
            window.history.pushState({ flowstateModal: true }, '');
        }
        prevAnyModalOpen.current = anyModalOpen;
    }, [anyModalOpen]);

    const closeAllProjectLibraryModals = useCallback(() => {
        setModalState(null);
        setFocusModalState(null);
        setIsImporting(false);
        setCompositionPanelCard(null);
        setQuickCaptureState({ isOpen: false, content: '' });
        setIsFocusPreviewOpen(false);
        setIsCarouselFocusOpen(false);
        setGenerateInContextState(null);
        setSceneBuilderState(null);
    }, []);

    useEffect(() => {
        const handlePopState = () => {
            if (isClosingModalProgrammatically.current) {
                isClosingModalProgrammatically.current = false;
                return;
            }
            closeAllProjectLibraryModals();
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [closeAllProjectLibraryModals]);

    const createCloseHandler = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, closedState: T) => () => {
        if (window.history.state?.flowstateModal) {
            isClosingModalProgrammatically.current = true;
            window.history.back();
        }
        setter(closedState);
    };

    const handleCloseModalState = createCloseHandler(setModalState, null);
    const handleCloseFocusModal = createCloseHandler(setFocusModalState, null);
    const handleCloseCompositionPanel = createCloseHandler(setCompositionPanelCard, null);
    const handleCloseFocusPreview = createCloseHandler(setIsFocusPreviewOpen, false);
    const handleCloseCarouselView = createCloseHandler(setIsCarouselFocusOpen, false);
    const handleCloseGenerateInContext = createCloseHandler(setGenerateInContextState, null);
    const handleCloseSceneBuilder = createCloseHandler(setSceneBuilderState, null);
    
    const handleQuickCaptureClose = () => {
        if (window.history.state?.flowstateModal) {
            isClosingModalProgrammatically.current = true;
            window.history.back();
        }
        setQuickCaptureState({ isOpen: false, content: '' });
    };

    const handleQuickCaptureSaveAndClose = (finalContent: string) => {
        if (htmlToPlainText(finalContent).trim()) {
            onAddToInbox(finalContent);
        }
        handleQuickCaptureClose();
    };

    useEffect(() => {
        if (focusModalState?.mode === 'edit') {
            lastEditedCardRef.current = { cardId: focusModalState.card.id, projectId: focusModalState.projectId };
        } else if (!focusModalState && lastEditedCardRef.current) {
            const { cardId, projectId } = lastEditedCardRef.current;
            onNavigateToCard(projectId, cardId);
            lastEditedCardRef.current = null;
        }
    }, [focusModalState, onNavigateToCard]);

    const highlightCard = useCallback((cardId: string) => {
        const cardEl = cardRefs.current.get(cardId);
        if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardEl.classList.add('card-highlight');
            setTimeout(() => {
                cardEl.classList.remove('card-highlight');
            }, 1500);
        }
    }, []);

    useEffect(() => {
        if (cardToLocate) {
            setTimeout(() => {
                highlightCard(cardToLocate.cardId);
                onCardLocated();
            }, 100);
        }
    }, [cardToLocate, onCardLocated, highlightCard]);

    const handleProjectSelection = (id: string) => {
        onSetActiveProjectId(id);
        if (window.innerWidth < 768) {
            setIsProjectPanelCollapsed(true);
        }
    };

    const toggleProjectExpansion = useCallback((projectId: string) => {
        setExpandedProjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });
    }, []);

    const setNodeRef = useCallback((id: string, el: HTMLDivElement | null) => {
        if (el) {
            projectNodeRefs.current.set(id, el);
        } else {
            projectNodeRefs.current.delete(id);
        }
    }, []);
    
    const visibleProjectOrder = useMemo(() => {
        const order: string[] = [];
        const traverse = (parentId: string | null) => {
            const children = projects.filter(p => p.parentId === parentId);
            for (const project of children) {
                if (showHiddenProjects || !project.isHidden) {
                    order.push(project.id);
                    if (expandedProjects.has(project.id)) {
                        traverse(project.id);
                    }
                }
            }
        };
        const inboxProject = projects.find(p => p.id === INBOX_PROJECT_ID);
        const otherProjects = projects.filter(p => p.parentId === null && p.id !== INBOX_PROJECT_ID);

        if (inboxProject) {
            order.push(inboxProject.id);
            if (expandedProjects.has(inboxProject.id)) traverse(inboxProject.id);
        }

        otherProjects.forEach(p => {
            if (showHiddenProjects || !p.isHidden) {
                order.push(p.id);
                if (expandedProjects.has(p.id)) traverse(p.id);
            }
        });

        return order;
    }, [projects, expandedProjects, showHiddenProjects]);

    const handleProjectListKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        if (visibleProjectOrder.length === 0) return;
        const currentIndex = activeProjectId ? visibleProjectOrder.indexOf(activeProjectId) : -1;
        let nextIndex;
        if (currentIndex === -1) {
            nextIndex = 0;
        } else if (e.key === 'ArrowDown') {
            nextIndex = Math.min(currentIndex + 1, visibleProjectOrder.length - 1);
        } else {
            nextIndex = Math.max(currentIndex - 1, 0);
        }
        const nextProjectId = visibleProjectOrder[nextIndex];
        if (nextProjectId !== activeProjectId) {
            onSetActiveProjectId(nextProjectId);
            projectNodeRefs.current.get(nextProjectId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    const undoTimeoutRef = useRef<number | null>(null);
    const notificationTimeoutRef = useRef<number | null>(null);
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const importProjectInputRef = useRef<HTMLInputElement>(null);
    const savePopoverRef = useRef<HTMLDivElement>(null);
    const cardOptionsRef = useRef<HTMLDivElement>(null);
    const exportPopoverRef = useRef<HTMLDivElement>(null);
    const actionsButtonRef = useRef<HTMLButtonElement>(null);
    const themeButtonRef = useRef<HTMLButtonElement>(null);
    const actionsPopoverRef = useRef<HTMLDivElement>(null);
    const themePopoverRef = useRef<HTMLDivElement>(null);
    const scrollIntervalRef = useRef<number | null>(null);
    const [popoverPositions, setPopoverPositions] = useState({ actions: { top: 0 }, theme: { top: 0 } });

    const hiddenCardCount = useMemo(() => activeProject?.cards.filter(c => c.isHidden).length || 0, [activeProject]);
    const hiddenProjectCount = useMemo(() => projects.filter(p => p.isHidden).length, [projects]);

    const topLevelProjects = useMemo(() => {
        const inboxProject = projects.find(p => p.id === INBOX_PROJECT_ID);
        const otherTopLevel = projects
            .filter(p => !p.parentId && p.id !== INBOX_PROJECT_ID)
            .filter(p => showHiddenProjects || !p.isHidden);
        
        return inboxProject ? [inboxProject, ...otherTopLevel] : otherTopLevel;
    }, [projects, showHiddenProjects]);

    const getHierarchicalText = useCallback((separator: string, asPlainText: boolean = false) => {
        const contentArray = hierarchicalCards.map(c => asPlainText ? htmlToPlainText(c.content) : c.content);
        return contentArray.join(separator);
    }, [hierarchicalCards]);

    const wordCount = useMemo(() => {
        if (hierarchicalCards.length === 0) return 0;
        const allContent = getHierarchicalText(' ', true);
        if (allContent.trim() === '') return 0;
        return allContent.trim().split(/\s+/).length;
    }, [hierarchicalCards, getHierarchicalText]);
    
    const stopAutoScroll = useCallback(() => {
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            stopAutoScroll();
        };
    }, [stopAutoScroll]);
    
    useEffect(() => {
        setBeforeContextCards([]); setAfterContextCards([]); setContextPrompt(''); setGenerationMode('GENERATE');
        setGeneratedAlternatives(null); setProofreadSuggestions(null); setDocumentQuery(''); setQueryResponse(null); setError(null);
        setSelectedCardIds(new Set());
        setSearchQuery('');
        setViewMode('list');
        if (activeProject) {
            setProjectNotes(activeProject.notes || '');
        }
    }, [activeProjectId]);

    useEffect(() => {
        if (generationMode === 'IMPROVE_BEFORE' && beforeContextCards.length === 0) setGenerationMode('GENERATE');
        if (generationMode === 'IMPROVE_AFTER' && afterContextCards.length === 0) setGenerationMode('GENERATE');
    }, [beforeContextCards, afterContextCards, generationMode]);

    useEffect(() => {
        if (!activeProject) return;
        const handler = setTimeout(() => {
            if (projectNotes !== activeProject.notes) {
                onUpdateProjectNotes(activeProject.id, projectNotes);
            }
        }, 500);
        return () => clearTimeout(handler);
    }, [projectNotes, activeProject, onUpdateProjectNotes]);
    
    useEffect(() => {
        if (isDesktop) {
            const updatePositions = () => {
                const actionsRect = actionsButtonRef.current?.getBoundingClientRect();
                const themeRect = themeButtonRef.current?.getBoundingClientRect();
                
                const viewportHeight = window.innerHeight;
                const margin = 20;

                let actionsTop = actionsRect?.top ?? 0;
                if (actionsPopoverRef.current) {
                    const height = actionsPopoverRef.current.offsetHeight;
                    if (actionsTop + height > viewportHeight - margin) {
                        actionsTop = Math.max(margin, viewportHeight - height - margin);
                    }
                }

                let themeTop = themeRect?.top ?? 0;
                if (themePopoverRef.current) {
                    const height = themePopoverRef.current.offsetHeight;
                    if (themeTop + height > viewportHeight - margin) {
                        themeTop = Math.max(margin, viewportHeight - height - margin);
                    }
                }

                setPopoverPositions({
                    actions: { top: actionsTop },
                    theme: { top: themeTop }
                });
            };

            if (isActionsPopoverOpen || isThemePopoverOpen) {
                updatePositions();
                // Second pass to account for rendered height
                const timeoutId = setTimeout(updatePositions, 0);
                window.addEventListener('resize', updatePositions);
                return () => {
                    window.removeEventListener('resize', updatePositions);
                    clearTimeout(timeoutId);
                };
            }
            
            window.addEventListener('resize', updatePositions);
            return () => window.removeEventListener('resize', updatePositions);
        }
    }, [isDesktop, isActionsPopoverOpen, isThemePopoverOpen]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activeSavePopover !== null && savePopoverRef.current && !savePopoverRef.current.contains(event.target as Node)) {
                setActiveSavePopover(null);
            }
            if (activeCardOptions !== null && cardOptionsRef.current && !cardOptionsRef.current.contains(event.target as Node)) {
                setActiveCardOptions(null);
            }
            if (isExportPopoverOpen && exportPopoverRef.current && !exportPopoverRef.current.contains(event.target as Node)) {
                setIsExportPopoverOpen(false);
            }
            if (isActionsPopoverOpen && actionsPopoverRef.current && !actionsPopoverRef.current.contains(event.target as Node) && !actionsButtonRef.current?.contains(event.target as Node)) {
                setIsActionsPopoverOpen(false);
            }
            if (isThemePopoverOpen && themePopoverRef.current && !themePopoverRef.current.contains(event.target as Node) && !themeButtonRef.current?.contains(event.target as Node)) {
                setIsThemePopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeSavePopover, activeCardOptions, isExportPopoverOpen, isThemePopoverOpen, isActionsPopoverOpen]);
    
    const handleDragStartCard = (e: React.DragEvent<HTMLDivElement>, card: Card & { projectId: string }) => {
        stopAutoScroll();
        if (!activeProject || card.isLocked) {
            e.preventDefault();
            return;
        }
    
        let cardsToDrag: Card[];
        const sourceProjectId = card.projectId;
    
        if (searchQuery) {
            cardsToDrag = [card];
        } else {
            const isSelected = selectedCardIds.has(card.id);
            cardsToDrag = isSelected ? activeProject.cards.filter(c => selectedCardIds.has(c.id)) : [card];
        }
        
        const info = { cards: cardsToDrag, sourceProjectId };
        setDraggedCardInfo(info);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify(info));
    };

    const handleDragEndCard = () => {
        stopAutoScroll();
        setDraggedCardInfo(null);
    };
    
    const handleDropCardOnProject = (e: React.DragEvent, targetProjectId: string) => {
        stopAutoScroll();
        const cardDataStr = e.dataTransfer.getData('application/json');
        if (cardDataStr) {
            try {
                const data = JSON.parse(cardDataStr);
                if (data.cards && data.sourceProjectId) {
                    onMoveCards(data.cards, data.sourceProjectId, targetProjectId);
                    setSelectedCardIds(new Set());
                }
            } catch (err) { console.error("Card drag data error", err); }
        }
        setDraggedCardInfo(null);
    };

    const handleDropOnCardReorder = (e: React.DragEvent<HTMLDivElement>, targetCardId: string) => {
        stopAutoScroll();
        e.preventDefault();
        if (!draggedCardInfo || !activeProject || searchQuery) {
            setDraggedCardInfo(null);
            return;
        }
    
        const draggedCardIds = new Set(draggedCardInfo.cards.map(c => c.id));
        if (draggedCardIds.has(targetCardId)) {
            setDraggedCardInfo(null);
            return;
        }
    
        const cardsToMove = activeProject.cards.filter(c => draggedCardIds.has(c.id));
        const remainingCards = activeProject.cards.filter(c => !draggedCardIds.has(c.id));
        const targetIndex = remainingCards.findIndex(c => c.id === targetCardId);
        
        if (targetIndex === -1) {
            setDraggedCardInfo(null);
            return;
        }
    
        remainingCards.splice(targetIndex, 0, ...cardsToMove);
    
        onUpdateCardOrder(activeProject.id, remainingCards);
        setDraggedCardInfo(null);
    };
    
    const handleDragOverSelections = (e: React.DragEvent) => {
        e.preventDefault();
        if (!selectionsContainerRef.current || !draggedCardInfo) return;

        const container = selectionsContainerRef.current;
        const rect = container.getBoundingClientRect();
        const y = e.clientY;
        const scrollZoneHeight = rect.height * 0.15;
        const topZone = rect.top + scrollZoneHeight;
        const bottomZone = rect.bottom - scrollZoneHeight;
        const scrollSpeed = 10;

        if (y < topZone) {
            if (!scrollIntervalRef.current) {
                scrollIntervalRef.current = window.setInterval(() => { container.scrollTop -= scrollSpeed; }, 50);
            }
        } else if (y > bottomZone) {
            if (!scrollIntervalRef.current) {
                scrollIntervalRef.current = window.setInterval(() => { container.scrollTop += scrollSpeed; }, 50);
            }
        } else {
            stopAutoScroll();
        }
    };

    // --- Touch Drag and Drop Implementation ---
    const handleTouchStartCard = (e: React.TouchEvent<HTMLDivElement>, card: Card & { projectId: string }) => {
        if (card.isLocked || searchQuery || selectedCardIds.size > 1 || touchDragState.isDragging) {
            return;
        }
        const touch = e.touches[0];
        const timeout = window.setTimeout(() => {
            if ('vibrate' in navigator) navigator.vibrate(50);

            const cardElement = e.currentTarget;
            const wrapperElement = cardElement.parentElement;
            if (!wrapperElement) return;

            const ghost = wrapperElement.cloneNode(true) as HTMLElement;
            ghost.style.position = 'fixed';
            ghost.style.left = `${wrapperElement.getBoundingClientRect().left}px`;
            ghost.style.top = `${wrapperElement.getBoundingClientRect().top}px`;
            ghost.style.width = `${wrapperElement.offsetWidth}px`;
            ghost.style.pointerEvents = 'none';
            ghost.style.opacity = '0.8';
            ghost.style.zIndex = '1000';
            ghost.style.transform = 'scale(1.05) rotate(2deg)';
            ghost.style.transition = 'none';
            document.body.appendChild(ghost);

            const placeholder = document.createElement('div');
            placeholder.style.height = `${wrapperElement.offsetHeight}px`;
            placeholder.style.backgroundColor = 'var(--color-accent-subtle-bg)';
            placeholder.style.border = '2px dashed var(--color-accent-subtle-border)';
            placeholder.style.borderRadius = '0.5rem';
            placeholder.style.margin = getComputedStyle(wrapperElement).margin;
            
            wrapperElement.parentElement?.insertBefore(placeholder, wrapperElement);
            wrapperElement.style.opacity = '0.3';

            setTouchDragState(prev => ({
                ...prev,
                isDragging: true,
                draggedCard: card,
                ghostElement: ghost,
                originalTargetElement: wrapperElement,
                placeholderElement: placeholder,
                longPressTimeout: null,
            }));
        }, 300);

        setTouchDragState(prev => ({
            ...prev,
            initialTouch: { x: touch.clientX, y: touch.clientY },
            longPressTimeout: timeout,
        }));
    };

    const handleTouchMoveCard = (e: React.TouchEvent<HTMLDivElement>) => {
        if (touchDragState.longPressTimeout && touchDragState.initialTouch) {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - touchDragState.initialTouch.x);
            const deltaY = Math.abs(touch.clientY - touchDragState.initialTouch.y);
            if (deltaX > 10 || deltaY > 10) {
                clearTimeout(touchDragState.longPressTimeout);
                setTouchDragState(prev => ({ ...prev, longPressTimeout: null }));
            }
        }
    };
    
    const handleTouchEndOrCancelCard = () => {
        if (touchDragState.longPressTimeout) {
            clearTimeout(touchDragState.longPressTimeout);
            setTouchDragState(prev => ({ ...prev, longPressTimeout: null }));
        }
    };

    useEffect(() => {
        const handleWindowTouchMove = (e: TouchEvent) => {
            if (!touchDragState.isDragging || !touchDragState.ghostElement || !touchDragState.initialTouch) return;
            
            const touch = e.touches[0];
            const ghost = touchDragState.ghostElement;
            ghost.style.transform = `translate(${touch.clientX - touchDragState.initialTouch.x}px, ${touch.clientY - touchDragState.initialTouch.y}px) scale(1.05) rotate(2deg)`;
            
            const container = selectionsContainerRef.current;
            if (container) {
                const rect = container.getBoundingClientRect();
                const scrollZoneHeight = 50;
                const scrollSpeed = 10;
                if (touch.clientY < rect.top + scrollZoneHeight) {
                    container.scrollTop -= scrollSpeed;
                } else if (touch.clientY > rect.bottom - scrollZoneHeight) {
                    container.scrollTop += scrollSpeed;
                }
            }

            if (touch.clientX < 50 && isProjectPanelCollapsed) {
                setIsProjectPanelCollapsed(false);
            }

            let currentlyOverProjectId: string | null = null;
            if (!isProjectPanelCollapsed) {
                ghost.style.display = 'none';
                const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
                ghost.style.display = '';

                const projectNode = targetElement?.closest('[data-project-id]');
                if (projectNode) {
                    currentlyOverProjectId = projectNode.getAttribute('data-project-id');
                }
            }

            setTouchDragState(prev => ({ ...prev, draggedOverProjectId: currentlyOverProjectId }));
            
            if (currentlyOverProjectId) {
                touchDragState.placeholderElement?.style.setProperty('display', 'none');
            } else {
                touchDragState.placeholderElement?.style.removeProperty('display');
                const cardWrappers = Array.from(container?.querySelectorAll('[data-card-wrapper-id]') || []);
                for (const el of cardWrappers) {
                    if (el === touchDragState.originalTargetElement) continue;
                    const elRect = el.getBoundingClientRect();
                    if (touch.clientY > elRect.top && touch.clientY < elRect.bottom) {
                        const midPoint = elRect.top + elRect.height / 2;
                        if (touch.clientY < midPoint) {
                            el.parentElement?.insertBefore(touchDragState.placeholderElement!, el);
                        } else {
                            el.parentElement?.insertBefore(touchDragState.placeholderElement!, el.nextElementSibling);
                        }
                        break;
                    }
                }
            }
        };

        const handleWindowTouchEnd = () => {
            if (!touchDragState.isDragging) return;
            
            if (touchDragState.draggedOverProjectId && touchDragState.draggedCard) {
                onMoveCards([touchDragState.draggedCard], touchDragState.draggedCard.projectId, touchDragState.draggedOverProjectId);
            } else if (touchDragState.placeholderElement?.parentElement && activeProject) {
                const cardWrappers = Array.from(touchDragState.placeholderElement.parentElement.children).filter(el => el.hasAttribute('data-card-wrapper-id') || el === touchDragState.placeholderElement);
                const orderedIds = cardWrappers.map(el => el === touchDragState.placeholderElement ? touchDragState.draggedCard!.id : el.getAttribute('data-card-wrapper-id'));
                const newCardOrder = orderedIds.map(id => activeProject.cards.find(c => c.id === id)).filter((c): c is Card => c !== undefined);
                if (newCardOrder.length === activeProject.cards.length) {
                    onUpdateCardOrder(activeProject.id, newCardOrder);
                }
            }

            touchDragState.ghostElement?.remove();
            touchDragState.placeholderElement?.remove();
            if (touchDragState.originalTargetElement) touchDragState.originalTargetElement.style.opacity = '1';
            setTouchDragState({ isDragging: false, draggedCard: null, initialTouch: null, ghostElement: null, originalTargetElement: null, placeholderElement: null, longPressTimeout: null, draggedOverProjectId: null });
        };

        if (touchDragState.isDragging) {
            window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
            window.addEventListener('touchend', handleWindowTouchEnd);
            window.addEventListener('touchcancel', handleWindowTouchEnd);
        }

        return () => {
            window.removeEventListener('touchmove', handleWindowTouchMove);
            window.removeEventListener('touchend', handleWindowTouchEnd);
            window.removeEventListener('touchcancel', handleWindowTouchEnd);
        };
    }, [touchDragState.isDragging, touchDragState.initialTouch, isProjectPanelCollapsed, activeProject, onUpdateCardOrder, onMoveCards]);

    const handleBulkAddToContext = (zone: 'before' | 'after') => {
        if (!activeProject) return;
        const cardsToAdd = activeProject.cards.filter(c => selectedCardIds.has(c.id));
        if (cardsToAdd.length === 0) return;

        if (zone === 'before') {
            const existingIds = new Set(beforeContextCards.map(c => c.id));
            const newCards = cardsToAdd.filter(c => !existingIds.has(c.id));
            if (newCards.length > 0) setBeforeContextCards(prev => [...prev, ...newCards]);
        } else {
            const existingIds = new Set(afterContextCards.map(c => c.id));
            const newCards = cardsToAdd.filter(c => !existingIds.has(c.id));
            if (newCards.length > 0) setAfterContextCards(prev => [...prev, ...newCards]);
        }
        setActiveWorkspaceTab('context');
        setSelectedCardIds(new Set());
    };

    const handleCombineCards = () => {
        if (!activeProject || selectedCardIds.size < 2) return;

        const orderedCardIds = activeProject.cards
            .filter(card => selectedCardIds.has(card.id))
            .map(card => card.id);

        if (orderedCardIds.length > 1) {
            onCombineCards(activeProject.id, orderedCardIds);
            setSelectedCardIds(new Set());
        }
    };

    const handleOpenMoveModal = () => {
        if (!activeProject) return;
        const cardsToMove = activeProject.cards.filter(c => selectedCardIds.has(c.id));
        if (cardsToMove.length > 0) {
            setModalState({ type: 'move_cards', cards: cardsToMove, sourceProjectId: activeProject.id });
        }
    };

    const handleConfirmMove = (targetProjectId: string) => {
        if (modalState?.type === 'move_cards') {
            onMoveCards(modalState.cards, modalState.sourceProjectId, targetProjectId);
            setSelectedCardIds(new Set());
        }
        handleCloseModalState();
    };

    const handleGenerateContextualContent = async () => {
        if (!activeProject) return;
        setError(null);
        setIsGeneratingContextual(true);
        setGeneratedAlternatives(null);
        try {
            const contextBefore = beforeContextCards.map(c => htmlToPlainText(c.content)).join('\n\n');
            const contextAfter = afterContextCards.map(c => htmlToPlainText(c.content)).join('\n\n');
            let alternatives: string[];

            if (generationMode === 'GENERATE') {
                alternatives = await generateContextualText(contextPrompt, contextBefore, contextAfter, numAlternatives);
            } else {
                let textToImprove = '';
                let instructions = '';
                if (generationMode === 'IMPROVE_DRAFT') {
                    textToImprove = contextPrompt;
                    instructions = 'Improve for clarity, flow, and impact.';
                } else if (generationMode === 'IMPROVE_BEFORE' && beforeContextCards.length > 0) {
                    textToImprove = htmlToPlainText(beforeContextCards[beforeContextCards.length - 1].content);
                    instructions = contextPrompt || 'Improve this passage to better lead into the following text.';
                } else if (generationMode === 'IMPROVE_AFTER' && afterContextCards.length > 0) {
                    textToImprove = htmlToPlainText(afterContextCards[0].content);
                    instructions = contextPrompt || 'Improve this passage to better follow what came before.';
                }

                if (textToImprove) {
                    alternatives = await improveTextInContext({
                        textToImprove,
                        instructions,
                        contextBefore: (generationMode === 'IMPROVE_BEFORE' && beforeContextCards.length > 0) ? beforeContextCards.slice(0, -1).map(c => htmlToPlainText(c.content)).join('\n\n') : contextBefore,
                        contextAfter: (generationMode === 'IMPROVE_AFTER' && afterContextCards.length > 0) ? afterContextCards.slice(1).map(c => htmlToPlainText(c.content)).join('\n\n') : contextAfter,
                        numAlternatives,
                    });
                } else {
                    alternatives = [];
                }
            }
            setGeneratedAlternatives(alternatives);
            if (alternatives.length === 0) {
                setError("The AI couldn't generate any alternatives. Try adjusting your context or instructions.");
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsGeneratingContextual(false);
        }
    };
    const handleProofread = async () => {
        if (!activeProjectId) return;
        const textToProofread = getHierarchicalText('\n\n', true);
        if (!textToProofread.trim()) {
            setError('There is no text in this project to proofread.');
            return;
        }
        setError(null);
        setIsProofreading(true);
        setProofreadSuggestions(null);
        try {
            const suggestions = await proofreadText(textToProofread);
            setProofreadSuggestions(suggestions);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsProofreading(false);
        }
    };
    const handleDocumentQuery = async () => {
        if (!activeProjectId || !documentQuery.trim()) return;
        const documentText = getHierarchicalText('\n\n', true);
        if (!documentText.trim()) {
            setError('There is no text in this project to query.');
            return;
        }
        setError(null);
        setIsQuerying(true);
        setQueryResponse(null);
        try {
            const response = await queryDocument(documentText, documentQuery);
            setQueryResponse(response);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsQuerying(false);
        }
    };

    const handleSaveInContext = (content: string) => {
        if (!activeProject) return;
        let insertionIndex = 0;
        if (beforeContextCards.length > 0) {
            const lastBeforeCardId = beforeContextCards[beforeContextCards.length - 1].id;
            const indexInProject = activeProject.cards.findIndex(c => c.id === lastBeforeCardId);
            if (indexInProject !== -1) {
                insertionIndex = indexInProject + 1;
            }
        }
        const formattedContent = formatNewCardContent(content, defaultImportFont.family, defaultImportFont.size);
        onAddCardAtIndex(activeProject.id, { content: formattedContent }, insertionIndex);
        setActiveSavePopover(null);
    };
    
    const handleResetContextualGeneration = () => {
        setGeneratedAlternatives(null);
        setContextPrompt('');
        setError(null);
    };
    const handleCopy = () => { if (activeProjectId) {
        navigator.clipboard.writeText(getHierarchicalText('\n\n', true));
    }};
    const handleRestoreClick = () => restoreInputRef.current?.click();
    const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) onRestore(e.target.files[0]); };
    
    const handleRemoveFromContext = (cardId: string, zone: 'before' | 'after') => {
        if (zone === 'before') setBeforeContextCards(prev => prev.filter(c => c.id !== cardId));
        else setAfterContextCards(prev => prev.filter(c => c.id !== cardId));
    };
    
    const toggleCardSelection = (cardId: string) => {
        setSelectedCardIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(cardId)) newSet.delete(cardId);
            else newSet.add(cardId);
            return newSet;
        });
    };

    const handleCardDelete = (projectId: string, cardId: string) => {
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
        setNotification(null);

        const project = projects.find(p => p.id === projectId);
        if (!project) return;
        
        const cardIndex = project.cards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const cardToDelete = project.cards[cardIndex];
        setUndoState({ card: cardToDelete, projectId: projectId, originalIndex: cardIndex });
        onDeleteCard(projectId, cardId);

        undoTimeoutRef.current = window.setTimeout(() => setUndoState(null), 5000);
    };

    const handleShareCard = async (card: Card) => {
        const textParts = [htmlToPlainText(card.content)];
        const taskDetails: string[] = [];

        if (card.task) {
            const { status, dueDate, priority } = card.task;
            if (status) {
                const statusLabels: { [key in TaskStatus]: string } = {
                    sketch: 'Sketch/Idea',
                    revision: 'Revision',
                    proofreading: 'Proofreading',
                };
                taskDetails.push(`- Status: ${statusLabels[status]}`);
            }
            if (dueDate) {
                taskDetails.push(`- Due Date: ${dueDate}`);
            }
            if (priority) {
                taskDetails.push(`- Priority: ${priority.charAt(0).toUpperCase() + priority.slice(1)}`);
            }
        }

        if (taskDetails.length > 0) {
            textParts.push('---\nTask Details:\n' + taskDetails.join('\n'));
        }

        if (card.notes) {
            textParts.push(`---\nNotes:\n${card.notes}`);
        }

        if (card.tags && card.tags.length > 0) {
            textParts.push(`---\nTags: ${card.tags.map(t => `#${t}`).join(', ')}`);
        }

        const sharedText = textParts.join('\n\n');

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'A selection from Flowstate',
                    text: sharedText,
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            navigator.clipboard.writeText(sharedText).then(() => {
                setNotification('Content copied to clipboard!');
                if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
                notificationTimeoutRef.current = window.setTimeout(() => setNotification(null), 3000);
            }).catch(err => {
                console.error('Failed to copy text:', err);
                setNotification('Failed to copy content.');
                if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
                notificationTimeoutRef.current = window.setTimeout(() => setNotification(null), 3000);
            });
        }
    };

    const handleUndoDelete = () => {
        if (!undoState) return;

        const projectToUpdate = projects.find(p => p.id === undoState.projectId);
        if (projectToUpdate) {
            const restoredCards = [...projectToUpdate.cards];
            restoredCards.splice(undoState.originalIndex, 0, undoState.card);
            onUpdateCardOrder(undoState.projectId, restoredCards);
        }
        
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
        setUndoState(null);
    };

    const handleCardDoubleClick = (e: React.MouseEvent<HTMLDivElement>, card: Card & { projectId: string }) => {
        if (card.isLocked) return;
        setFocusModalState({ mode: 'edit', card, projectId: card.projectId });
    };

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const defaultProjectName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const projectName = window.prompt("Enter a name for the new project:", defaultProjectName);

        if (projectName && projectName.trim()) {
            setIsImporting(true);
            try {
                await onImportDocument(file, projectName.trim());
            } catch (error) {
                console.error("Import failed:", error);
            } finally {
                setIsImporting(false);
            }
        }
        
        e.target.value = '';
    };

    const handleImportProjectClick = () => {
        importProjectInputRef.current?.click();
    };

    const handleFileImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onImportProject(file);
            e.target.value = '';
        }
    };

    const handleSaveFromFocusModal = (cardData: Partial<Omit<Card, 'id'>>, options: { shouldClose: boolean } = { shouldClose: true }) => {
        if (!focusModalState) return;
    
        if (focusModalState.mode === 'add') {
             if (activeProject) onAddCardAtIndex(activeProject.id, cardData, focusModalState.insertIndex);
        } else if (focusModalState.mode === 'edit') {
            onUpdateCard(focusModalState.projectId, focusModalState.card.id, cardData);
        }
    
        if (options.shouldClose) {
            handleCloseFocusModal();
        }
    };

    const allCardsForActiveHierarchy = useMemo(() => {
        if (!activeProject) return [];
        
        const cardsWithContext: CarouselCardData[] = [];

        const getCardsRecursive = (pId: string) => {
            const project = projects.find(proj => proj.id === pId);
            if (!project) return;

            project.cards.forEach(card => {
                cardsWithContext.push({
                    ...card,
                    projectId: project.id,
                    projectName: project.name,
                    projectCategory: project.category
                });
            });

            const children = projects.filter(child => child.parentId === pId);
            children.forEach(child => getCardsRecursive(child.id));
        };

        getCardsRecursive(activeProject.id);
        return cardsWithContext;
    }, [activeProject, projects]);

    const visibleCards = useMemo(() => {
        if (!activeProject) return [];
        const trimmedQuery = searchQuery.trim();

        if (!trimmedQuery) {
            return activeProject.cards
                .map(card => ({
                    ...card,
                    projectId: activeProject.id,
                    projectName: activeProject.name,
                    projectCategory: activeProject.category,
                }))
                .filter(card => showHiddenCards || !card.isHidden);
        }

        const cardsToFilter = allCardsForActiveHierarchy.filter(card => showHiddenCards || !card.isHidden);

        if (trimmedQuery.startsWith('#')) {
            const searchTags = trimmedQuery.substring(1).toLowerCase().split(/[\s,]+/).filter(Boolean);
            if (searchTags.length === 0) return cardsToFilter;
            
            return cardsToFilter.filter(card => 
                searchTags.every(searchTag => 
                    card.tags?.some(cardTag => cardTag.toLowerCase() === searchTag)
                )
            );
        }

        return cardsToFilter.filter(card => htmlToPlainText(card.content).toLowerCase().includes(trimmedQuery.toLowerCase()));
            
    }, [activeProject, searchQuery, showHiddenCards, allCardsForActiveHierarchy]);
    
    const handleDropOnRoot = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsRootDragOver(false);
        const draggedProjectId = e.dataTransfer.getData('application/vnd.flowstate.project');
        if (draggedProjectId) {
            onReorderProject(draggedProjectId, null, 'on'); 
        }
    };
    
    const handleDragOverRoot = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('application/vnd.flowstate.project')) {
            const draggedId = e.dataTransfer.getData('application/vnd.flowstate.project');
            if (draggedId !== INBOX_PROJECT_ID) {
                setIsRootDragOver(true);
            }
        }
    };

    const handleDragLeaveRoot = () => {
        setIsRootDragOver(false);
    };

    const previewHtmlWithCardIds = useMemo(() => {
        const htmlParts = hierarchicalCards.map(card => {
            const content = (card.content || '').trim() === '' ? '<p>&nbsp;</p>' : card.content;
            const sanitizedHtml = DOMPurify.sanitize(content);
            return `<div class="card-source-wrapper" data-card-id="${card.id}" id="preview-card-${card.id}">${sanitizedHtml}</div>`;
        });
        return { __html: htmlParts.join('') };
    }, [hierarchicalCards]);

    const handleTagClick = (tag: string) => {
        setSearchQuery(prev => {
            if (prev.startsWith('#')) {
                const existingTags = new Set(prev.substring(1).split(/[\s,]+/).filter(Boolean));
                if (existingTags.has(tag)) {
                    return prev;
                }
                return `${prev} ${tag}`;
            }
            return `#${tag}`;
        });
    };

    const getStatusPill = (status: TaskStatus) => {
        const styles: {[key in TaskStatus]: string} = {
            sketch: 'bg-yellow-200 text-yellow-800',
            revision: 'bg-blue-200 text-blue-800',
            proofreading: 'bg-purple-200 text-purple-800',
        };
        const labels: {[key in TaskStatus]: string} = {
            sketch: 'Sketch/Idea',
            revision: 'Revision',
            proofreading: 'Proofreading',
        };
        return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status]}`}>{labels[status]}</span>;
    };

    const getDueDatePill = (dueDate: string) => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const due = new Date(dueDate + 'T00:00:00-07:00');
        const isOverdue = due < today;
        const isToday = due.getTime() === today.getTime();

        const style = isOverdue ? 'bg-red-200 text-red-800' : isToday ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-800';
        const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(due);
        return (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${style}`}>
                <CalendarIcon className="w-3.5 h-3.5" />
                {formattedDate}
            </span>
        );
    };

    const getPriorityPill = (priority: TaskPriority) => {
        if (priority === 'high') {
            return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-200 text-red-800">High Priority</span>;
        }
        if (priority === 'low') {
            return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-200 text-blue-800">Low Priority</span>;
        }
        return null;
    };

    const handleAddNewCardInFlow = (projectId: string, insertIndex: number) => {
        const newCardData = {
            content: formatNewCardContent('', defaultImportFont.family, defaultImportFont.size),
        };
        onAddCardAtIndex(projectId, newCardData, insertIndex);
    };

    const ContextDropZone = ({ title, cards, zone }: { title: string, cards: Card[], zone: 'before' | 'after' }) => (
        <div className={`flex-1 flex flex-col p-3 space-y-2 overflow-y-auto bg-[var(--color-bg-tertiary)] rounded-lg border-2 border-dashed transition-colors border-[var(--color-border-secondary)]`}>
            <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] text-center sticky top-0 bg-[var(--color-bg-tertiary)]/80 backdrop-blur-sm py-1">{title}</h4>
            {cards.length === 0 ? <p className="text-xs text-[var(--color-text-tertiary)] text-center m-auto">Add selections from the left panel</p> : cards.map(card => (
                <div key={card.id} className="bg-[var(--color-bg-secondary)] p-2.5 rounded-md border border-[var(--color-border-primary)] shadow-sm text-xs text-[var(--color-text-primary)] relative"><p className="whitespace-pre-wrap truncate">{htmlToPlainText(card.content)}</p><button onClick={() => handleRemoveFromContext(card.id, zone)} className="absolute top-1 right-1 p-0.5 rounded-full bg-[var(--color-element-primary)]/50 hover:bg-[var(--color-danger-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger-text)]"><CloseIcon className="w-3 h-3" /></button></div>
            ))}
        </div>
    );

    const GenerationModePicker: React.FC = () => {
        const modes: { mode: GenerationMode; label: string; description: string; disabled?: boolean }[] = [ { mode: 'GENERATE', label: 'Generate New', description: 'Generate a new passage between the context sections based on your instruction.', }, { mode: 'IMPROVE_DRAFT', label: 'Improve Draft', description: 'Paste a draft into the instruction box below for the AI to improve, based on the context.', }, { mode: 'IMPROVE_BEFORE', label: 'Improve "Before" Section', description: 'Improve the last passage from the "Context Before" section to better lead into what comes next.', disabled: beforeContextCards.length === 0, }, { mode: 'IMPROVE_AFTER', label: 'Improve "After" Section', description: 'Improve the first passage from the "Context After" section to better follow what came before.', disabled: afterContextCards.length === 0, }];
        const handleModeChange = (mode: GenerationMode) => { setGenerationMode(mode); setContextPrompt(''); setGeneratedAlternatives(null); setError(null); };
        return ( <div className="space-y-2"> <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"> {modes.map(({ mode, label, disabled }) => ( <button key={mode} onClick={() => !disabled && handleModeChange(mode)} disabled={disabled} className={`p-2 rounded-lg text-left text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-ring)] ${ generationMode === mode ? 'bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] shadow-md' : 'bg-[var(--color-element-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary-hover)]' } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} > <span className="font-semibold">{label}</span> </button> ))} </div> <p className="text-xs text-[var(--color-text-secondary)] px-1 h-8 flex items-center"> {modes.find(m => m.mode === generationMode)?.description} </p> </div> );
    };
    
    const promptPlaceholders: Record<GenerationMode, string> = { 'GENERATE': "Your instruction for the AI...", 'IMPROVE_DRAFT': "Paste your draft here for the AI to improve...", 'IMPROVE_BEFORE': "Optional instructions to guide the improvement...", 'IMPROVE_AFTER': "Optional instructions to guide the improvement...", };

    const handlePreviewDoubleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const cardWrapper = target.closest('.card-source-wrapper');

        if (cardWrapper instanceof HTMLElement && cardWrapper.dataset.cardId) {
            const cardId = cardWrapper.dataset.cardId;
            const card = allCardsForActiveHierarchy.find(c => c.id === cardId);
            if (card && !card.isLocked) {
                setFocusModalState({ mode: 'edit', card, projectId: card.projectId });
                if (window.innerWidth < 1024) {
                    setIsWorkspaceCollapsed(true);
                }
            }
        }
    };
    
    const handleFocusPreviewDoubleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const cardWrapper = target.closest('.card-source-wrapper');

        if (cardWrapper instanceof HTMLElement && cardWrapper.dataset.cardId) {
            const cardId = cardWrapper.dataset.cardId;
            const card = allCardsForActiveHierarchy.find(c => c.id === cardId);
            if (card && !card.isLocked) {
                handleCloseFocusPreview();
                setFocusModalState({ mode: 'edit', card, projectId: card.projectId });
            }
        }
    };

    const hasLockedSelection = useMemo(() => {
        if (!activeProject || selectedCardIds.size === 0) return false;
        return activeProject.cards.some(c => selectedCardIds.has(c.id) && c.isLocked);
    }, [selectedCardIds, activeProject]);

    const handleOpenCardFlow = (cardId: string) => {
        const allVisibleCards = searchQuery ? visibleCards : allCardsForActiveHierarchy.filter(c => showHiddenCards || !c.isHidden);
        const cardIndex = allVisibleCards.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            setInitialCarouselIndex(cardIndex);
            setIsCarouselFocusOpen(true);
        }
    };

    const handleNavigateBackToCard = (projectId: string, cardId: string) => {
        handleCloseCarouselView();
        onNavigateToCard(projectId, cardId);
    };

    const renderProjectsPanel = () => (
        <div className="flex flex-col h-full overflow-hidden whitespace-nowrap">
            <div className="p-4 border-b border-[var(--color-border-primary)] flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Projects</h2>
                    <div className="flex items-center space-x-2">
                         <button onClick={() => setIsProjectPanelCollapsed(true)} className="md:hidden p-2 bg-[var(--color-element-primary)] hover:bg-[var(--color-element-primary-hover)] text-[var(--color-text-secondary)] rounded-full transition-colors"><ChevronLeftIcon className="w-5 h-5" /></button>
                    </div>
                </div>
                <input type="file" ref={restoreInputRef} onChange={handleFileRestore} accept=".xml" className="hidden" />
                <input type="file" ref={importInputRef} onChange={handleFileImport} accept=".txt,.docx,.pdf" className="hidden" />
                <input type="file" ref={importProjectInputRef} onChange={handleFileImportProject} accept=".xml" className="hidden" />

                {hiddenProjectCount > 0 && (
                    <div className="mt-3">
                        <button onClick={() => setShowHiddenProjects(prev => !prev)} title={showHiddenProjects ? 'Hide hidden projects' : 'Show hidden projects'} className={`w-full p-1.5 rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5 ${showHiddenProjects ? 'bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)]' : 'bg-[var(--color-element-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-element-primary-hover)]'}`}>
                            {showHiddenProjects ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                            <span>{showHiddenProjects ? 'Hide Hidden' : 'Show Hidden'} ({hiddenProjectCount})</span>
                        </button>
                    </div>
                )}
            </div>
            <div
                tabIndex={0}
                onKeyDown={handleProjectListKeyDown}
                className={`flex-grow overflow-y-auto px-2 pt-2 pb-4 transition-colors ${isRootDragOver ? 'bg-green-100 border-2 border-dashed border-green-300 rounded-lg' : ''} focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-inset`}
                onDrop={handleDropOnRoot}
                onDragOver={handleDragOverRoot}
                onDragLeave={handleDragLeaveRoot}
            >
                {topLevelProjects.map(p => <ProjectNode key={p.id} project={p} allProjects={projects} level={0} activeProjectId={activeProjectId} onSetActiveProjectId={handleProjectSelection} onOpenModal={setModalState} onUpdateProject={onUpdateProject} onDeleteProject={onDeleteProject} onExportProject={onExportProject} onDropCardOnProject={handleDropCardOnProject} onReorderProject={onReorderProject} showHiddenProjects={showHiddenProjects} expandedProjects={expandedProjects} onToggleExpansion={toggleProjectExpansion} setNodeRef={setNodeRef} isTouchDropTarget={touchDragState.isDragging && touchDragState.draggedOverProjectId === p.id} isQuickCaptureHovered={isQuickCaptureHovered} />)}
                 {!isRootDragOver && projects.length > 0 && topLevelProjects.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center text-[var(--color-text-tertiary)] text-sm p-4">
                        No top-level projects to show.
                    </div>
                )}
            </div>
        </div>
    );
    
    const renderSelectionsPanel = () => (
        <div className="p-2 sm:p-4 flex flex-col h-full overflow-hidden">
        {activeProject ? (
            <>
                <ProjectDashboard project={activeProject} allProjects={projects} wordCount={wordCount} cardCount={hierarchicalCards.length} searchQuery={searchQuery} onSearchChange={setSearchQuery} onToggleProjectPanel={() => setIsProjectPanelCollapsed(false)} />
                <div className="flex flex-col min-h-0 flex-grow mt-4">
                     <div className="flex justify-between items-center mb-4 flex-shrink-0">
                        <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Selections</h3>
                            <div className="flex items-center space-x-1 bg-[var(--color-element-primary)] p-0.5 rounded-lg">
                                <button onClick={() => setViewMode('list')} title="List View" className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}><ListIcon className="w-5 h-5" /></button>
                                <button onClick={() => setViewMode('board')} title="Board View" className={`p-1.5 rounded-md transition-colors ${viewMode === 'board' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}><KanbanIcon className="w-5 h-5" /></button>
                                <button onClick={() => setViewMode('calendar')} title="Calendar View" className={`p-1.5 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}><CalendarIcon className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {hiddenCardCount > 0 && (
                                <button onClick={() => setShowHiddenCards(prev => !prev)} title={showHiddenCards ? 'Hide hidden cards' : 'Show hidden cards'} className={`p-1.5 rounded-lg transition-colors ${showHiddenCards ? 'bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)]' : 'bg-[var(--color-element-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-element-primary-hover)]'}`}>
                                    {showHiddenCards ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                </button>
                            )}
                        </div>
                    </div>
                    {selectedCardIds.size > 0 && !searchQuery && ( <div className="mb-3 p-2 bg-[var(--color-accent-subtle-bg)] border border-[var(--color-accent-subtle-border)] rounded-lg flex flex-wrap items-center justify-between gap-2 flex-shrink-0"> <span className="text-sm font-medium text-[var(--color-accent-subtle-text)]">{selectedCardIds.size} selected</span> <div className="flex items-center flex-wrap gap-2"> {selectedCardIds.size > 1 && ( <button onClick={handleCombineCards} disabled={hasLockedSelection} title={hasLockedSelection ? "Cannot combine locked cards" : ""} className="px-3 py-1.5 text-xs font-semibold bg-[var(--color-bg-secondary)] text-[var(--color-accent-secondary)] border border-[var(--color-border-secondary)] rounded-md hover:bg-[var(--color-element-primary)] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"> <CombineIcon className="w-3.5 h-3.5" /> <span>Combine</span> </button> )} <button onClick={handleOpenMoveModal} className="px-3 py-1.5 text-xs font-semibold bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] border border-[var(--color-border-primary)] rounded-md hover:bg-[var(--color-element-primary)] flex items-center gap-1.5"><FolderIcon className="w-3.5 h-3.5"/><span>Move</span></button> {activeWorkspaceTab === 'context' && (<><button onClick={() => handleBulkAddToContext('before')} className="px-3 py-1.5 text-xs font-semibold bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] border border-[var(--color-border-primary)] rounded-md hover:bg-[var(--color-element-primary)]">Add to Before</button> <button onClick={() => handleBulkAddToContext('after')} className="px-3 py-1.5 text-xs font-semibold bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] border border-[var(--color-border-primary)] rounded-md hover:bg-[var(--color-element-primary)]">Add to After</button></>)} </div> </div> )}
                    {viewMode === 'list' ? (
                    <div ref={selectionsContainerRef} onDragOver={handleDragOverSelections} onDragLeave={stopAutoScroll} className="flex-grow overflow-y-auto pr-2 space-y-2">
                         {!searchQuery && (
                            <div className="h-4 my-[-6px] relative flex items-center justify-center group">
                                <div className="w-full h-0.5 bg-transparent group-hover:bg-[var(--color-accent-primary)]/50 opacity-0 group-hover:opacity-100 transition-all duration-200" />
                                <div className="absolute flex items-center space-x-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                    <button 
                                        onClick={() => setFocusModalState({ mode: 'add', insertIndex: 0 })}
                                        title="Add New Card"
                                        className="h-6 w-6 bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-secondary)] rounded-full flex items-center justify-center hover:border-[var(--color-accent-primary)] hover:scale-110 transition-all"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent-primary)]" />
                                    </button>
                                    <button 
                                        onClick={() => setGenerateInContextState({ insertIndex: 0 })}
                                        title="Generate with AI"
                                        className="h-6 w-6 bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-secondary)] rounded-full flex items-center justify-center hover:border-[var(--color-accent-primary)] hover:scale-110 transition-all"
                                    >
                                        <ZapIcon className="w-3.5 h-3.5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent-primary)]" />
                                    </button>
                                </div>
                            </div>
                         )}
                        {visibleCards.map((card, index) => {
                            const isSearchResultFromOtherProject = !!searchQuery && card.projectId !== activeProject?.id;
                            const isHighlightedByScroll = activePreviewCardId === card.id;
                            return (
                                <React.Fragment key={card.id}>
                                    {isSearchResultFromOtherProject && (
                                        <div className="text-xs text-[var(--color-text-secondary)] pt-2 pb-1 pl-4 italic">
                                            In: {card.projectCategory && `${card.projectCategory} > `}{card.projectName}
                                        </div>
                                    )}
                                    <div className="relative group/card py-1" data-card-wrapper-id={card.id}>
                                        <div
                                            ref={(el) => { if (el) cardRefs.current.set(card.id, el as HTMLElement); else cardRefs.current.delete(card.id); }}
                                            data-card-id={card.id}
                                            draggable={!card.isLocked && selectedCardIds.size <= 1}
                                            onDragStart={(e) => handleDragStartCard(e, card)} onDragEnd={handleDragEndCard} onDragOver={(e) => e.preventDefault()} onDrop={(e) => !card.isLocked && !searchQuery && handleDropOnCardReorder(e, card.id)}
                                            onClick={() => handleOpenCardFlow(card.id)}
                                            onDoubleClick={(e) => { e.stopPropagation(); handleCardDoubleClick(e, card); }}
                                            onTouchStart={(e) => handleTouchStartCard(e, card)} onTouchMove={handleTouchMoveCard} onTouchEnd={handleTouchEndOrCancelCard} onTouchCancel={handleTouchEndOrCancelCard}
                                            className={`flex items-start space-x-3 p-4 border rounded-lg transition-all duration-200 shadow-sm hover:shadow-xl hover:-translate-y-1 ${card.isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${card.color ? `${CARD_COLORS[card.color]?.bg || 'bg-[var(--color-bg-secondary)]'} ${CARD_COLORS[card.color]?.border || 'border-[var(--color-border-primary)]'}` : 'bg-[var(--color-bg-secondary)] border-[var(--color-border-primary)]'} ${selectedCardIds.has(card.id) ? '!border-[var(--color-accent-primary)] ring-2 ring-[var(--color-ring)]' : ''} ${isHighlightedByScroll ? '!border-[var(--color-accent-secondary)] ring-2 ring-[var(--color-accent-secondary)]/50' : ''} ${draggedCardInfo?.cards.some(c=>c.id === card.id) ? 'opacity-30 scale-95' : 'opacity-100'} ${card.isHidden ? 'opacity-50' : ''}`} title={card.isLocked ? "This card is locked. Unlock it from the options menu to edit." : "Single-click to open Card Flow. Double-click to open editor."}>
                                            <input type="checkbox" checked={selectedCardIds.has(card.id)} onChange={() => toggleCardSelection(card.id)} onClick={e => e.stopPropagation()} disabled={card.isLocked} className="mt-1.5 flex-shrink-0 form-checkbox h-4 w-4 bg-[var(--color-bg-tertiary)] border-[var(--color-border-secondary)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)] rounded disabled:opacity-50" />
                                            <div className="flex-grow">
                                                <div className="flex justify-between items-start space-x-3">
                                                    <div className={`flex-grow pt-0.5 text-[var(--color-text-primary)] text-base`}>
                                                        {searchQuery && !searchQuery.startsWith('#') ? (
                                                            <div className="prose-card">
                                                                <HighlightedText html={card.content} highlight={searchQuery} />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="prose-card"
                                                                dangerouslySetInnerHTML={createSanitizedMarkup(card.content)}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                        {card.isHidden ? (
                                                            <button onClick={() => onUpdateCard(card.projectId, card.id, { isHidden: false })} title="Unhide Card" className="p-1.5 rounded-full bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] hover:bg-[var(--color-accent-subtle-border)]"><EyeIcon className="w-4 h-4" /></button>
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
                                                                <button onClick={() => setSceneBuilderState({ card })} title="Flesh out scene with AI" className="p-1.5 rounded-full hover:bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-primary)] hover:text-[var(--color-accent-primary-hover)]"><CritiqueIcon className="w-4 h-4" /></button>
                                                                <div className="relative" ref={activeCardOptions === card.id ? cardOptionsRef : null}>
                                                                    <button onClick={() => setActiveCardOptions(prev => prev === card.id ? null : card.id)} title="Card Options" className="p-1.5 rounded-full hover:bg-[var(--color-element-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"><PaletteIcon className="w-4 h-4" /></button>
                                                                    {activeCardOptions === card.id && (
                                                                        <div className="absolute top-full right-0 mt-2 w-56 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg shadow-xl z-20 p-2">
                                                                            <div className="grid grid-cols-4 gap-2 mb-2">
                                                                                {Object.keys(CARD_COLORS).map(color => (
                                                                                    <button key={color} onClick={() => { onUpdateCard(card.projectId, card.id, { color }); setActiveCardOptions(null); }} className={`w-full h-8 rounded ${CARD_COLORS[color].bg} border-2 ${card.color === color ? CARD_COLORS[color].border : 'border-transparent'} hover:border-gray-400 disabled:opacity-50`} disabled={card.isLocked}></button>
                                                                                ))}
                                                                                <button onClick={() => { onUpdateCard(card.projectId, card.id, { color: undefined }); setActiveCardOptions(null); }} className="w-full h-8 rounded bg-white border-2 border-gray-300 flex items-center justify-center hover:border-gray-400 disabled:opacity-50" title="Clear Color" disabled={card.isLocked}><CloseIcon className="w-4 h-4 text-gray-500" /></button>
                                                                            </div>
                                                                            <div className="space-y-1 border-t border-[var(--color-border-primary)] mt-2 pt-2">
                                                                                <button onClick={() => { onUpdateCard(card.projectId, card.id, { isLocked: !card.isLocked }); setActiveCardOptions(null); }} className="w-full flex items-center text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-md">
                                                                                    {card.isLocked ? <UnlockIcon className="w-4 h-4 mr-2" /> : <LockIcon className="w-4 h-4 mr-2" />}
                                                                                    {card.isLocked ? 'Unlock Card' : 'Lock Card'}
                                                                                </button>
                                                                                <button onClick={() => { onUpdateCard(card.projectId, card.id, { isHidden: true }); setActiveCardOptions(null); }} className="w-full flex items-center text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-md disabled:opacity-50" disabled={card.isLocked}><EyeOffIcon className="w-4 h-4 mr-2" /> Hide Card</button>
                                                                                <button onClick={() => { onDuplicateCard(card.projectId, card.id); setActiveCardOptions(null); }} className="w-full flex items-center text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-md disabled:opacity-50" disabled={card.isLocked}><CopyIcon className="w-4 h-4 mr-2" /> Duplicate Card</button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <button onClick={() => onDuplicateCard(card.projectId, card.id)} title="Duplicate Card" className="p-1.5 rounded-full hover:bg-[var(--color-element-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50" disabled={card.isLocked}>
                                                                    <CopyIcon className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => handleCardDelete(card.projectId, card.id)} title="Delete Card" className="p-1.5 rounded-full hover:bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] disabled:opacity-50" disabled={card.isLocked}><TrashIcon className="w-4 h-4" /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                 {card.task && (
                                                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                                                        {getStatusPill(card.task.status)}
                                                        {card.task.dueDate && getDueDatePill(card.task.dueDate)}
                                                        {getPriorityPill(card.task.priority || 'medium')}
                                                    </div>
                                                )}
                                                {card.tags && card.tags.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {card.tags.map(tag => (
                                                            <button key={tag} onClick={(e) => { e.stopPropagation(); handleTagClick(tag);}} className="text-xs bg-[var(--color-accent-subtle-bg)] text-[var(--color-accent-subtle-text)] font-medium px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity">
                                                                #{tag}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {!searchQuery && !card.isHidden && !card.isLocked && (
                                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-4 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150 z-10">
                                                <button 
                                                    onClick={() => {
                                                        if (!activeProject) return;
                                                        const insertIndex = activeProject.cards.findIndex(c => c.id === card.id) + 1;
                                                        setFocusModalState({ mode: 'add', insertIndex });
                                                    }}
                                                    title="Add New Card Here"
                                                    className="h-6 w-6 bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-secondary)] rounded-full flex items-center justify-center hover:border-[var(--color-accent-primary)] hover:scale-110 transition-all"
                                                >
                                                    <PlusIcon className="w-3.5 h-3.5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent-primary)]" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if (!activeProject) return;
                                                        const insertIndex = activeProject.cards.findIndex(c => c.id === card.id) + 1;
                                                        setGenerateInContextState({ insertIndex });
                                                    }}
                                                    title="Generate with AI"
                                                    className="h-6 w-6 bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-secondary)] rounded-full flex items-center justify-center hover:border-[var(--color-accent-primary)] hover:scale-110 transition-all"
                                                >
                                                    <ZapIcon className="w-3.5 h-3.5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent-primary)]" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </React.Fragment>
                            )
                        })}
                        {activeProject?.cards.length > 0 && visibleCards.length === 0 && searchQuery && (
                            <div className="flex items-center justify-center h-48 text-center border-2 border-dashed border-[var(--color-border-secondary)] rounded-lg">
                                <div className="text-[var(--color-text-secondary)]">
                                    <p className="font-semibold">No results found</p>
                                    <p className="text-sm mt-1">Try a different search term.</p>
                                </div>
                            </div>
                        )}
                        {activeProject?.cards.length === 0 && (
                            <div className="flex items-center justify-center h-48 text-center border-2 border-dashed border-[var(--color-border-secondary)] rounded-lg">
                                <button onClick={() => setFocusModalState({ mode: 'add', insertIndex: 0 })} className="flex flex-col items-center text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition-colors">
                                    <PlusCircleIcon className="w-12 h-12 mb-2" />
                                    <span className="font-semibold">Add your first card</span>
                                </button>
                            </div>
                        )}
                    </div>
                    ) : viewMode === 'board' ? (
                        <KanbanView
                            cards={allCardsForActiveHierarchy.filter(c => showHiddenCards || !c.isHidden)}
                            onUpdateCard={onUpdateCard}
                            onCardDoubleClick={(card) => setFocusModalState({ mode: 'edit', card, projectId: card.projectId })}
                        />
                    ) : (
                        <CalendarView
                            cards={allCardsForActiveHierarchy.filter(c => showHiddenCards || !c.isHidden)}
                            onCardDoubleClick={(card) => setFocusModalState({ mode: 'edit', card, projectId: card.projectId })}
                        />
                    )}
                </div>
            </>
        ) : (
             <div className="flex-grow flex items-center justify-center h-full">
                <div className="text-center text-[var(--color-text-secondary)]">
                    <h3 className="text-xl font-semibold">No project selected</h3>
                    <p className="mt-2">Select a project from the list or create a new one.</p>
                </div>
            </div>
        )}
        </div>
    );

    const renderWorkspacePanel = () => (
        <div className="p-2 sm:p-4 flex flex-col h-full overflow-hidden">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4 flex-shrink-0">
                <div className="flex items-center flex-wrap gap-1 bg-[var(--color-element-primary)] p-0.5 rounded-lg">
                    <button onClick={() => setActiveWorkspaceTab('preview')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${activeWorkspaceTab === 'preview' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}>Preview</button>
                    <button onClick={() => setActiveWorkspaceTab('context')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${activeWorkspaceTab === 'context' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}>Generate</button>
                    <button onClick={() => setActiveWorkspaceTab('proofread')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${activeWorkspaceTab === 'proofread' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}>Proofread</button>
                    <button onClick={() => setActiveWorkspaceTab('query')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${activeWorkspaceTab === 'query' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}>Query</button>
                    <button onClick={() => setActiveWorkspaceTab('notes')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${activeWorkspaceTab === 'notes' ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}>Notes</button>
                </div>
                {activeWorkspaceTab === 'preview' && (
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-2">
                        <div className="flex items-center space-x-1 bg-[var(--color-element-primary)] p-0.5 rounded-lg">
                            {(['block', 'first-line'] as const).map(style => (
                                <button key={style} onClick={() => setIndentStyle(style)} className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${indentStyle === style ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}>{style === 'block' ? 'Block' : 'Indent'}</button>
                            ))}
                        </div>
                        <button onClick={() => setIsFocusPreviewOpen(true)} className="flex items-center text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] text-[var(--color-text-primary)] font-semibold hover:bg-[var(--color-element-primary)] px-3 py-1.5 rounded-lg"><ExternalLinkIcon className="w-4 h-4 mr-2" /> Full Preview</button>
                        <button onClick={handleCopy} className="flex items-center text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] text-[var(--color-text-primary)] font-semibold hover:bg-[var(--color-element-primary)] px-3 py-1.5 rounded-lg"><CopyIcon className="w-4 h-4 mr-2" /> Copy All</button>
                        <div className="relative" ref={exportPopoverRef}>
                            <button
                                onClick={() => setIsExportPopoverOpen(prev => !prev)}
                                className="flex items-center text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-secondary)] text-[var(--color-text-primary)] font-semibold hover:bg-[var(--color-element-primary)] px-3 py-1.5 rounded-lg"
                            >
                                <ExportIcon className="w-4 h-4 mr-2" /> Export
                            </button>
                            {isExportPopoverOpen && (
                                <div className="absolute top-full right-0 mt-2 w-64 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg shadow-xl z-20">
                                    <button
                                        onClick={() => { activeProject && exportToTxt(hierarchicalCards, indentStyle, activeProject.name); setIsExportPopoverOpen(false); }}
                                        className="w-full text-left px-3 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-t-lg transition-colors flex items-center"
                                    >
                                        <FileTextIcon className="mr-2 w-4 h-4" /> Text File (.txt)
                                    </button>
                                    <button
                                        onClick={() => { activeProject && exportToDocx(hierarchicalCards, indentStyle, activeProject.name); setIsExportPopoverOpen(false); }}
                                        className="w-full text-left px-3 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-b-lg transition-colors flex items-center"
                                    >
                                        <FileWordIcon className="mr-2 w-4 h-4" /> Word / Google Docs (.docx)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {activeWorkspaceTab === 'preview' && (
                <div
                    ref={previewContainerRef}
                    onDoubleClick={handlePreviewDoubleClick}
                    className={`bg-[var(--color-bg-secondary)] p-4 sm:p-6 rounded-lg flex-grow overflow-y-auto text-[var(--color-text-primary)] border border-[var(--color-border-primary)] shadow-sm prose-preview cursor-pointer text-base`}
                >
                    {hierarchicalCards.length > 0 ? (
                        <div
                            className={
                                indentStyle === 'first-line'
                                    ? '[&_.card-source-wrapper_p]:indent-[2em] [&_.card-source-wrapper_p]:my-0'
                                    : ''
                            }
                            dangerouslySetInnerHTML={previewHtmlWithCardIds}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-[var(--color-text-tertiary)] italic">This project has no text to display.</div>
                    )}
                </div>
            )}
            {activeWorkspaceTab === 'context' && (<div className="flex flex-col flex-grow min-h-0 space-y-4">{error && <div className="bg-red-100 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex-shrink-0">{error}</div>}<ContextDropZone title="Context Before" cards={beforeContextCards} zone="before" /><div className="overflow-y-auto bg-[var(--color-bg-secondary)] p-4 rounded-lg border border-[var(--color-border-primary)] shadow-sm space-y-3"><GenerationModePicker /><textarea value={contextPrompt} onChange={e => setContextPrompt(e.target.value)} placeholder={promptPlaceholders[generationMode]} className="w-full text-sm bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] p-2 rounded-md border-[var(--color-border-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] whitespace-pre-wrap" rows={2}/><div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"><div className="flex items-center space-x-2"><span className="text-xs font-medium text-[var(--color-text-secondary)]">Alternatives:</span><div className="flex items-center space-x-1 bg-[var(--color-element-primary)] p-0.5 rounded-lg">{[ 1, 2, 3 ].map(num => (<button key={num} onClick={() => setNumAlternatives(num)} className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${numAlternatives === num ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]/70'}`}>{num}</button>))}</div></div><div className="flex items-center justify-end space-x-2"><button onClick={handleGenerateContextualContent} disabled={isGeneratingContextual || (!contextPrompt.trim() && (generationMode === 'GENERATE' || generationMode === 'IMPROVE_DRAFT'))} className="flex items-center justify-center bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] hover:from-[var(--color-accent-primary-hover)] hover:to-[var(--color-accent-secondary-hover)] text-[var(--color-accent-text)] font-semibold px-4 py-2 rounded-lg shadow disabled:opacity-50">{isGeneratingContextual ? <LoadingSpinner /> : <><WandIcon className="w-5 h-5 sm:mr-2"/><span className="hidden sm:inline">Generate</span></>}</button></div></div>{generatedAlternatives && generatedAlternatives.length > 0 && (<div className="pt-3 border-t border-[var(--color-border-primary)] space-y-3"><div className="flex justify-between items-center"><h4 className="text-sm font-semibold text-[var(--color-text-secondary)]">Choose an alternative:</h4><button onClick={handleResetContextualGeneration} className="flex items-center text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)]/50 px-2.5 py-1.5 rounded-lg transition-colors"><RefreshCwIcon className="mr-1.5 w-3.5 h-3.5" /> Start Over</button></div>{generatedAlternatives.map((alt, index) => (<div key={index} className="bg-[var(--color-accent-subtle-bg)] p-3 rounded-lg border border-[var(--color-accent-subtle-border)] space-y-2"><div className="text-sm text-[var(--color-text-primary)] prose-card" dangerouslySetInnerHTML={createSanitizedMarkup(alt)} /><div className="flex justify-end"><div className="relative" ref={index === activeSavePopover ? savePopoverRef : null}><button onClick={() => setActiveSavePopover(prev => prev === index ? null : index)} className="flex items-center text-xs bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary-hover)] text-[var(--color-accent-text)] font-semibold px-3 py-1.5 rounded-lg"><SaveIcon className="mr-1.5 w-3 h-3"/> Save...</button>{activeSavePopover === index && (<div className="absolute bottom-full right-0 mb-2 w-52 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-sm border border-[var(--color-border-primary)] rounded-lg shadow-xl z-20"><button onClick={() => handleSaveInContext(alt)} disabled={beforeContextCards.length === 0 && afterContextCards.length === 0} className="w-full text-left px-3 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-t-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed" title={beforeContextCards.length === 0 && afterContextCards.length === 0 ? "Add cards to context to enable this" : "Insert between context cards"}><ArrowDownToLineIcon className="mr-2 w-4 h-4" /> Insert in Context</button><button onClick={() => { activeProject && onAddCardAtIndex(activeProject.id, { content: formatNewCardContent(alt, defaultImportFont.family, defaultImportFont.size) }, activeProject.cards.length); setActiveSavePopover(null); }} className="w-full text-left px-3 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] transition-colors flex items-center"><ListEndIcon className="mr-2 w-4 h-4" /> Add to End</button><button onClick={() => { setActiveSavePopover(null); }} className="w-full text-left px-3 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-element-primary)] rounded-b-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"><MousePointerClickIcon className="mr-2 w-4 h-4" /> Choose Position...</button></div>)}</div></div></div>))}</div>)}</div><ContextDropZone title="Context After" cards={afterContextCards} zone="after" /></div>)}
            {activeWorkspaceTab === 'proofread' && (<div className="flex flex-col flex-grow min-h-0 space-y-4">{error && <div className="bg-red-100 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex-shrink-0">{error}</div>}<div className="flex-shrink-0"><button onClick={handleProofread} disabled={isProofreading} className="w-full flex items-center justify-center bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] hover:from-[var(--color-accent-primary-hover)] hover:to-[var(--color-accent-secondary-hover)] text-[var(--color-accent-text)] font-semibold px-4 py-2.5 rounded-lg shadow disabled:opacity-50">{isProofreading ? <LoadingSpinner /> : <><ProofreadIcon className="w-5 h-5 mr-2" /> Proofread Entire Project</>}</button></div><div className="flex-grow overflow-y-auto bg-[var(--color-bg-secondary)] p-4 rounded-lg border border-[var(--color-border-primary)] shadow-sm space-y-4">{proofreadSuggestions === null && !isProofreading && <div className="flex items-center justify-center h-full text-center"><p className="text-[var(--color-text-secondary)] text-sm italic">Click the button above to start proofreading.</p></div>}{isProofreading && <div className="flex items-center justify-center h-full text-center"><div className="flex flex-col items-center gap-4 text-[var(--color-text-secondary)]"><LoadingSpinner /><span>Analyzing text...</span></div></div>}{proofreadSuggestions && proofreadSuggestions.length > 0 ? (proofreadSuggestions.map((s, i) => (<div key={i} className="bg-[var(--color-bg-tertiary)] p-3 rounded-lg border border-[var(--color-border-secondary)]"><div className="flex justify-between items-start mb-2"><span className="text-xs font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-secondary)] px-2 py-1 rounded-full">{s.error_type}</span></div><p className="text-sm text-[var(--color-text-tertiary)]">Original: <del className="bg-red-100/50">{s.original_text}</del></p><p className="text-sm text-[var(--color-text-primary)]">Suggestion: <ins className="bg-green-100/50 no-underline">{s.suggested_text}</ins></p><p className="text-sm text-[var(--color-text-secondary)] mt-2 italic">{s.explanation}</p></div>))) : proofreadSuggestions && proofreadSuggestions.length === 0 && (<div className="flex items-center justify-center h-full text-center"><div className="text-[var(--color-text-secondary)]"><CheckIcon className="w-10 h-10 mx-auto mb-2 text-green-500" /><p className="font-semibold">No issues found!</p></div></div>)}</div></div>)}
            {activeWorkspaceTab === 'query' && (<div className="flex flex-col flex-grow min-h-0 space-y-4">{error && <div className="bg-red-100 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex-shrink-0">{error}</div>}<div className="flex-shrink-0 flex items-center gap-3"><input type="text" value={documentQuery} onChange={e => setDocumentQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleDocumentQuery()} placeholder="Ask a question about your project..." className="flex-grow w-full bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]" /><button onClick={handleDocumentQuery} disabled={isQuerying || !documentQuery.trim()} className="flex items-center justify-center bg-gradient-to-r from-[var(--color-accent-primary)] to-[var(--color-accent-secondary)] hover:from-[var(--color-accent-primary-hover)] hover:to-[var(--color-accent-secondary-hover)] text-[var(--color-accent-text)] font-semibold px-4 py-2 rounded-lg shadow disabled:opacity-50">{isQuerying ? <LoadingSpinner /> : <SearchIcon className="w-5 h-5" />}</button></div><div className="flex-grow overflow-y-auto bg-[var(--color-bg-secondary)] p-4 rounded-lg border border-[var(--color-border-primary)] shadow-sm">{queryResponse === null && !isQuerying && <div className="flex items-center justify-center h-full text-center"><div className="text-[var(--color-text-secondary)]"><HelpCircleIcon className="w-10 h-10 mx-auto mb-2" /><p className="font-semibold">Query Your Document</p><p className="text-sm mt-1 max-w-xs">Ask about plot holes, character consistency, pacing, or anything else related to your text.</p></div></div>}{isQuerying && <div className="flex items-center justify-center h-full text-center"><div className="flex flex-col items-center gap-4 text-[var(--color-text-secondary)]"><LoadingSpinner /><span>Consulting the manuscript...</span></div></div>}{queryResponse && <div className="prose-card text-[var(--color-text-primary)] whitespace-pre-wrap" dangerouslySetInnerHTML={createSanitizedMarkup(queryResponse)}/>}</div></div>)}
            {activeWorkspaceTab === 'notes' && (<textarea value={projectNotes} onChange={e => setProjectNotes(e.target.value)} placeholder="Add high-level notes, an outline, or a synopsis for this project..." className="w-full h-full flex-grow text-sm bg-[var(--color-bg-secondary)] p-4 rounded-lg border border-[var(--color-border-primary)] shadow-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)] text-[var(--color-text-primary)] whitespace-pre-wrap"/>)}
        </div>
    );

    return (
        <main className={`h-screen w-screen font-sans ${theme}`}>
            <div 
                className="relative h-full w-full bg-cover bg-center"
                style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    backgroundImage: desktopBackground ? `url(${desktopBackground})` : 'none'
                }}
            >
                <div className="absolute inset-0 bg-black/10"></div>

                {isDesktop ? (
                    <>
                        <div className="absolute left-0 top-0 h-full w-20 z-50 flex flex-col items-center justify-between p-3 bg-black/20 backdrop-blur-md">
                            <div className="flex flex-col items-center space-y-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg flex items-center justify-center text-white font-bold text-2xl">
                                    F
                                </div>
                                <div className="w-full h-px bg-white/10 my-2"></div>
                                <DockButton onClick={() => handleWindowToggle('projects')} isActive={windows.projects.isOpen} title={`Projects (${windows.projects.isOpen ? 'Open' : 'Closed'})`}>
                                    <FolderIcon className="w-6 h-6" />
                                </DockButton>
                                <DockButton onClick={() => handleWindowToggle('selections')} isActive={windows.selections.isOpen} title={`Selections (${windows.selections.isOpen ? 'Open' : 'Closed'})`}>
                                    <ListIcon className="w-6 h-6" />
                                </DockButton>
                                <DockButton onClick={() => handleWindowToggle('workspace')} isActive={windows.workspace.isOpen} title={`Workspace (${windows.workspace.isOpen ? 'Open' : 'Closed'})`}>
                                    <LayoutTemplateIcon className="w-6 h-6" />
                                </DockButton>
                            </div>
                            <div className="flex flex-col items-center space-y-4">
                                <DockButton ref={actionsButtonRef} onClick={() => setIsActionsPopoverOpen(p => !p)} title="Actions">
                                    <WandIcon className="w-6 h-6" />
                                </DockButton>
                                <DockButton ref={themeButtonRef} onClick={() => setIsThemePopoverOpen(p => !p)} title="Change Theme">
                                    <PaletteIcon className="w-6 h-6" />
                                </DockButton>
                                <DockButton onClick={onOpenSettings} title="Settings">
                                    <SettingsIcon className="w-6 h-6" />
                                </DockButton>
                            </div>
                        </div>

                        {isActionsPopoverOpen && (
                            <div
                                ref={actionsPopoverRef}
                                className="absolute left-24 z-50 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-lg border border-[var(--color-border-primary)] rounded-lg shadow-xl w-60 text-[var(--color-text-primary)] animate-fade-in max-h-[calc(100vh-40px)] overflow-y-auto"
                                style={{ top: popoverPositions.actions.top }}
                            >
                                <div className="p-2 space-y-1">
                                    <button onClick={() => { setModalState({ type: 'add_project', parentId: null }); setIsActionsPopoverOpen(false); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-[var(--color-element-primary)] rounded-md transition-colors"><PlusIcon className="mr-3 w-4 h-4" /> New Project</button>
                                    <button onClick={() => { setModalState({ type: 'blueprint_library' }); setIsActionsPopoverOpen(false); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-[var(--color-element-primary)] rounded-md transition-colors"><LayoutTemplateIcon className="mr-3 w-4 h-4" /> New from Blueprint</button>
                                </div>
                                <div className="h-px bg-[var(--color-border-primary)] mx-2 my-1"></div>
                                <div className="p-2 space-y-1">
                                    <button onClick={() => { setModalState({ type: 'paste_document' }); setIsActionsPopoverOpen(false); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-[var(--color-element-primary)] rounded-md transition-colors"><PasteIcon className="mr-3 w-4 h-4" /> Paste Document</button>
                                    <button onClick={() => { handleImportClick(); setIsActionsPopoverOpen(false); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-[var(--color-element-primary)] rounded-md transition-colors"><FilePlusIcon className="mr-3 w-4 h-4" /> Import Document</button>
                                    <button onClick={() => { handleImportProjectClick(); setIsActionsPopoverOpen(false); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-[var(--color-element-primary)] rounded-md transition-colors"><FolderIcon className="mr-3 w-4 h-4" /> Import Project File</button>
                                </div>
                                <div className="h-px bg-[var(--color-border-primary)] mx-2 my-1"></div>
                                <div className="p-2 space-y-1">
                                    <button onClick={() => { onBackup(); setIsActionsPopoverOpen(false); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-[var(--color-element-primary)] rounded-md transition-colors"><DownloadIcon className="mr-3 w-4 h-4" /> Backup All</button>
                                    <button onClick={() => { handleRestoreClick(); setIsActionsPopoverOpen(false); }} className="w-full flex items-center text-left px-3 py-2 text-sm hover:bg-[var(--color-element-primary)] rounded-md transition-colors"><UploadIcon className="mr-3 w-4 h-4" /> Restore from Backup</button>
                                </div>
                            </div>
                        )}

                        {isThemePopoverOpen && (
                            <div
                                ref={themePopoverRef}
                                className="absolute left-24 z-50 bg-[var(--color-bg-secondary-alpha)] backdrop-blur-lg border border-[var(--color-border-primary)] rounded-lg shadow-xl w-48 text-[var(--color-text-primary)] animate-fade-in max-h-[calc(100vh-40px)] overflow-y-auto"
                                style={{ top: popoverPositions.theme.top }}
                            >
                                {THEMES.map(t => (
                                    <button key={t.id} onClick={() => { onSetTheme(t.id); setIsThemePopoverOpen(false); }} className={`w-full flex items-center justify-between text-left px-4 py-2 text-sm hover:bg-[var(--color-element-primary)] transition-colors first:rounded-t-lg last:rounded-b-lg ${theme === t.id ? 'font-bold' : ''}`}>
                                        <span>{t.name}</span>
                                        {theme === t.id && <CheckIcon className="w-4 h-4 text-[var(--color-accent-primary)]" />}
                                    </button>
                                ))}
                            </div>
                        )}

                        {Object.values(windows).map(win => (
                            <div
                                key={win.id}
                                className={`absolute bg-[var(--color-bg-primary-alpha)] backdrop-blur-lg border border-[var(--color-border-primary)] rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${win.isOpen ? 'opacity-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                                style={{
                                    left: win.position.x,
                                    top: win.position.y,
                                    width: win.size.width,
                                    height: win.size.height,
                                    zIndex: win.zIndex,
                                }}
                                onMouseDown={() => handleWindowFocus(win.id)}
                            >
                                <div
                                    onMouseDown={(e) => handleWindowDragStart(e, win.id)}
                                    className="h-9 bg-[var(--color-bg-secondary-alpha)]/50 flex-shrink-0 cursor-move flex items-center justify-between px-3"
                                >
                                    <span className="font-semibold text-sm text-[var(--color-text-secondary)]">{win.title}</span>
                                    <button onClick={() => handleWindowToggle(win.id)} className="p-1 rounded-full hover:bg-[var(--color-element-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"><CloseIcon className="w-4 h-4"/></button>
                                </div>
                                <div className="flex-grow min-h-0">
                                    {win.id === 'projects' && renderProjectsPanel()}
                                    {win.id === 'selections' && renderSelectionsPanel()}
                                    {win.id === 'workspace' && renderWorkspacePanel()}
                                </div>
                                {/* Resize handles */}
                                <div onMouseDown={(e) => handleWindowResizeStart(e, win.id, 't')} className="absolute top-0 left-0 w-full h-2 cursor-n-resize"></div>
                                <div onMouseDown={(e) => handleWindowResizeStart(e, win.id, 'b')} className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize"></div>
                                <div onMouseDown={(e) => handleWindowResizeStart(e, win.id, 'l')} className="absolute top-0 left-0 h-full w-2 cursor-w-resize"></div>
                                <div onMouseDown={(e) => handleWindowResizeStart(e, win.id, 'r')} className="absolute top-0 right-0 h-full w-2 cursor-e-resize"></div>
                                <div onMouseDown={(e) => handleWindowResizeStart(e, win.id, 'tl')} className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize"></div>
                                <div onMouseDown={(e) => handleWindowResizeStart(e, win.id, 'tr')} className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize"></div>
                                <div onMouseDown={(e) => handleWindowResizeStart(e, win.id, 'bl')} className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize"></div>
                                <div onMouseDown={(e) => handleWindowResizeStart(e, win.id, 'br')} className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"></div>
                            </div>
                        ))}
                    </>
                ) : (
                    <div className="relative h-full w-full overflow-hidden">
                        {/* Selections Panel (Base Layer for Mobile) */}
                        <div className="w-full h-full bg-[var(--color-bg-primary-alpha)]/70 backdrop-blur-sm">
                            {renderSelectionsPanel()}
                        </div>

                        {/* Projects Panel (Mobile: Slide-over) */}
                        <div className={`absolute top-0 left-0 h-full bg-[var(--color-bg-primary-alpha)] text-[var(--color-text-primary)] border-r border-[var(--color-border-primary)] backdrop-blur-lg transition-transform duration-300 ease-in-out w-full z-20 ${isProjectPanelCollapsed ? '-translate-x-full' : 'translate-x-0'}`}>
                            {renderProjectsPanel()}
                        </div>

                        {/* Workspace Panel (Mobile: Bottom Sheet) */}
                        <div className={`fixed bottom-0 left-0 right-0 h-full bg-[var(--color-bg-secondary)] border-t border-[var(--color-border-secondary)] shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out z-30 ${isWorkspaceCollapsed ? 'translate-y-[calc(100%-3.5rem)]' : 'translate-y-0'}`}>
                            <div className="flex flex-col h-full">
                                <button onClick={() => setIsWorkspaceCollapsed(!isWorkspaceCollapsed)} className="h-14 flex-shrink-0 border-b border-[var(--color-border-primary)] flex items-center justify-center p-4 hover:bg-[var(--color-element-primary)] transition-colors">
                                    {isWorkspaceCollapsed ? <ChevronUpIcon className="w-6 h-6" /> : <ChevronDownIcon className="w-6 h-6" />}
                                </button>
                                <div className={`flex-grow min-h-0 ${isWorkspaceCollapsed ? 'hidden' : ''}`}>
                                    {renderWorkspacePanel()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            <button
                onClick={() => setQuickCaptureState({ isOpen: true, content: '' })}
                onMouseEnter={() => setIsQuickCaptureHovered(true)}
                onMouseLeave={() => setIsQuickCaptureHovered(false)}
                title="Quick Capture (to Inbox)"
                className="fixed bottom-6 right-6 z-40 bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-[var(--color-accent-primary-hover)] transition-all transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-bg-primary)] focus:ring-[var(--color-accent-primary)]"
                aria-label="Quick Capture"
            >
                <ZapIcon className="w-8 h-8" />
            </button>


            {focusModalState && ( <FocusEditorModal modalState={focusModalState} onClose={handleCloseFocusModal} onSave={handleSaveFromFocusModal} compositionTheme={compositionTheme} defaultImportFont={defaultImportFont} /> )}
            {modalState && modalState.type !== 'save_blueprint' && modalState.type !== 'blueprint_library' && modalState.type !== 'move_cards' && modalState.type !== 'paste_document' && modalState.type !== 'delete_project' && ( <ProjectModal modalState={modalState} onClose={handleCloseModalState} onAddProject={onAddProject} onUpdateProject={onUpdateProject} projects={projects} /> )}
            {modalState?.type === 'delete_project' && ( <DeleteProjectModal project={modalState.project} allProjects={projects} onClose={handleCloseModalState} onConfirmDelete={onDeleteProject} /> )}
            {modalState?.type === 'paste_document' && ( <PasteModal onClose={handleCloseModalState} onSave={onPasteDocument} /> )}
            {modalState?.type === 'move_cards' && ( <MoveToProjectModal isOpen={true} onClose={handleCloseModalState} onMove={handleConfirmMove} projects={projects} sourceProjectId={modalState.sourceProjectId} cardsToMoveCount={modalState.cards.length} /> )}
            {modalState?.type === 'blueprint_library' && ( <BlueprintModal onClose={handleCloseModalState} userBlueprints={userBlueprints} onAddProjectFromBlueprint={onAddProjectFromBlueprint} onImportBlueprint={onImportBlueprint} onDeleteUserBlueprint={onDeleteUserBlueprint}/> )}
            {modalState?.type === 'save_blueprint' && ( <SaveBlueprintModal project={modalState.project} allProjects={projects} onClose={handleCloseModalState} /> )}
            {isFocusPreviewOpen && activeProject && ( <FocusPreviewPanel projectName={activeProject.name} onClose={handleCloseFocusPreview} htmlContent={previewHtmlWithCardIds} onDoubleClick={handleFocusPreviewDoubleClick} compositionTheme={compositionTheme} indentStyle={indentStyle} /> )}
            {isCarouselFocusOpen && ( <CarouselView cards={allCardsForActiveHierarchy.filter(c => showHiddenCards || !c.isHidden)} initialIndex={initialCarouselIndex} onClose={(lastCardId) => { handleCloseCarouselView(); if(lastCardId) { onNavigateToCard(activeProjectId!, lastCardId); } }} onUpdateCard={onUpdateCard} onDeleteCard={handleCardDelete} onDuplicateCard={onDuplicateCard} onShareCard={handleShareCard} onCompositionEdit={(card) => { handleCloseCarouselView(); setFocusModalState({ mode: 'edit', card, projectId: card.projectId }); }} onNavigateBackToCard={handleNavigateBackToCard} onAddCard={handleAddNewCardInFlow} /> )}
            {compositionPanelCard && ( <CompositionPanel initialContent={compositionPanelCard.content} onUpdate={(newContent) => setCompositionPanelCard(prev => prev ? {...prev, content: newContent } : null)} onClose={handleCloseCompositionPanel} onSaveAndClose={(finalContent) => { onUpdateCard(compositionPanelCard.projectId, compositionPanelCard.id, { content: finalContent }); handleCloseCompositionPanel(); }} compositionTheme={compositionTheme} /> )}
            {quickCaptureState.isOpen && (
                <CompositionPanel
                    initialContent={quickCaptureState.content}
                    onUpdate={(newContent) => setQuickCaptureState(s => ({ ...s, content: newContent }))}
                    onClose={handleQuickCaptureClose}
                    onSaveAndClose={handleQuickCaptureSaveAndClose}
                    compositionTheme={compositionTheme}
                    saveButtonText="Save to Inbox"
                />
            )}
            {generateInContextState && (
                 <GenerateInContextModal
                    isOpen={!!generateInContextState}
                    onClose={handleCloseGenerateInContext}
                    onAddCard={(cardData, index) => {
                        if (activeProject) {
                            onAddCardAtIndex(activeProject.id, cardData, index);
                        }
                    }}
                    precedingCard={activeProject?.cards[generateInContextState.insertIndex - 1] || null}
                    followingCard={activeProject?.cards[generateInContextState.insertIndex] || null}
                    insertIndex={generateInContextState.insertIndex}
                    defaultImportFont={defaultImportFont}
                />
            )}
            {sceneBuilderState && (
                <SceneBuilderModal 
                    card={sceneBuilderState.card}
                    onClose={handleCloseSceneBuilder}
                    onSave={(notes) => {
                        onUpdateCard(sceneBuilderState.card.projectId, sceneBuilderState.card.id, { notes });
                        handleCloseSceneBuilder();
                    }}
                />
            )}

            {undoState && ( <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-4 animate-fade-in-up"> <span className="text-sm">Card deleted.</span> <button onClick={handleUndoDelete} className="text-sm font-semibold text-blue-300 hover:text-blue-200 flex items-center"><UndoIcon className="w-4 h-4 mr-1.5"/> Undo</button> </div> )}
            {notification && ( <div className="absolute bottom-6 right-6 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 animate-fade-in-up"> <CheckIcon className="w-4 h-4 text-green-400"/> <span className="text-sm">{notification}</span> </div> )}
            {isImporting && ( <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"> <div className="bg-[var(--color-bg-secondary)] p-6 rounded-lg shadow-xl flex items-center space-x-4"> <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent-primary)]"></div> <span className="text-lg font-semibold text-[var(--color-text-primary)]">Importing document...</span> </div> </div> )}
        </main>
    );
};

export default ProjectLibrary;