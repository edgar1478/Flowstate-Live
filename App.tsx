import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, Card } from './types';
import { loadProjectsFromStorage, saveProjectsToStorage, stringifyProjectsToXml, parseXmlToProjects, saveDirectoryHandle, loadDirectoryHandle, clearDirectoryHandle, loadUserBlueprints, saveUserBlueprint, deleteUserBlueprint } from './services/xmlService';
import { parseDocument, formatNewCardContent } from './services/documentParser';
import { auth, updateUserData, getUserData, subscribeToUserData, Unsubscribe, UserData } from './services/firebaseService';
import { Blueprint } from './services/blueprints';
import ProjectLibrary from './components/ProjectLibrary';
import SplashScreen from './components/SplashScreen';
import SettingsModal from './components/SettingsModal';
import LoginScreen from './components/LoginScreen';
import { INBOX_PROJECT_ID, INBOX_PROJECT_NAME } from './constants';

// Add TypeScript definitions for the File System Access API to prevent compile errors.
// These APIs are available in modern browsers but may not be in the default TS DOM library.
declare global {
  interface Window {
    showDirectoryPicker(options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle;
    }): Promise<FileSystemDirectoryHandle>;
  }

  // This extends the existing FileSystemDirectoryHandle interface
  interface FileSystemDirectoryHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  // This descriptor is used by the permission methods
  type FileSystemHandlePermissionDescriptor = {
    mode: 'read' | 'readwrite';
  };
}

interface TypographySettings {
    lineHeight: number;
    paragraphSpacing: number; // in em
}

// Apply theme on initial load to prevent FOUC
const savedTheme = localStorage.getItem('flowstate-theme') || 'default-light';
document.documentElement.className = `theme-${savedTheme}`;

function App() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [userBlueprints, setUserBlueprints] = useState<Blueprint[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [theme, setTheme] = useState(savedTheme);
    const [compositionTheme, setCompositionTheme] = useState('default');
    const [backupDirectoryHandle, setBackupDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [cardToLocate, setCardToLocate] = useState<{ cardId: string } | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecked, setIsAuthChecked] = useState(false);
    const [defaultImportFont, setDefaultImportFont] = useState({ family: 'Calibri', size: '3' });
    const [typographySettings, setTypographySettings] = useState<TypographySettings>({ lineHeight: 1.45, paragraphSpacing: 0.8 });
    const [desktopBackground, setDesktopBackground] = useState<string | null>(null);
    
    // Firestore sync state
    const [firestoreUnsubscribe, setFirestoreUnsubscribe] = useState<Unsubscribe | null>(null);
    const localXmlRef = useRef<string | null>(null);
    const debounceTimerRef = useRef<number | null>(null);
    const isClosingModalProgrammatically = useRef(false);

    const ensureInboxProject = (projList: Project[]): Project[] => {
        const inboxExists = projList.some(p => p.id === INBOX_PROJECT_ID);
        if (!inboxExists) {
            const inboxProject: Project = {
                id: INBOX_PROJECT_ID,
                name: INBOX_PROJECT_NAME,
                cards: [],
                parentId: null,
                notes: 'This is your central inbox for quick thoughts and ideas. Capture anything here and organize it later.',
                lastModified: new Date().toISOString(),
                category: 'System',
            };
            return [inboxProject, ...projList];
        }
        return projList;
    };


    useEffect(() => {
        // --- AUTH & DATA SYNC ---
        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (firestoreUnsubscribe) {
                firestoreUnsubscribe();
                setFirestoreUnsubscribe(null);
            }
            setIsDataLoaded(false);

            if (user) {
                setIsAuthenticated(true);
                const userData = await getUserData(user.uid);
                let projectsToLoad: Project[];

                if (userData && userData.projectsXml) { // Existing user with data
                    projectsToLoad = parseXmlToProjects(userData.projectsXml);
                } else { // New user or user with no cloud data
                    projectsToLoad = loadProjectsFromStorage(); // Start with local data
                    // Create the initial user document in Firestore with local data
                    await updateUserData(user.uid, {
                        projectsXml: stringifyProjectsToXml(ensureInboxProject(projectsToLoad))
                    });
                }
                
                const finalProjects = ensureInboxProject(projectsToLoad);
                setProjects(finalProjects);
                
                const unsub = subscribeToUserData(user.uid, (newUserData) => {
                    if (newUserData) {
                        const newRemoteXml = newUserData.projectsXml || null;
                        // Only update from Firestore if it's different from what we last saved
                        if (newRemoteXml && newRemoteXml !== localXmlRef.current) {
                            const newProjects = parseXmlToProjects(newRemoteXml);
                            setProjects(newProjects);
                        }
                    }
                });
                setFirestoreUnsubscribe(() => unsub);

            } else { // User is logged out
                setIsAuthenticated(false);
                const localProjects = loadProjectsFromStorage();
                setProjects(localProjects);
            }

            setIsAuthChecked(true);
            setIsDataLoaded(true);
        });

        // --- LOAD OTHER SETTINGS (non-project data) ---
        const loadOtherSettings = async () => {
             try {
                const handle = await loadDirectoryHandle();
                if (handle && (await handle.queryPermission({ mode: 'readwrite' })) === 'granted') {
                    setBackupDirectoryHandle(handle);
                }
             } catch (error) { console.error("Could not load backup directory handle:", error); }

            setUserBlueprints(await loadUserBlueprints());
            setCompositionTheme(localStorage.getItem('flowstate-composition-theme') || 'default');
            
            const savedImport = localStorage.getItem('flowstate-import-settings');
            if (savedImport) try { setDefaultImportFont(JSON.parse(savedImport)); } catch (e) {}

            const savedTypography = localStorage.getItem('flowstate-typography-settings');
            if (savedTypography) try { setTypographySettings(JSON.parse(savedTypography)); } catch(e) {}

            const savedBg = localStorage.getItem('flowstate-desktop-background');
            if (savedBg) {
                setDesktopBackground(savedBg);
            }
        };
        
        loadOtherSettings();

        return () => {
            unsubscribeAuth();
            if (firestoreUnsubscribe) firestoreUnsubscribe();
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    // --- SAVE & SYNC EFFECT ---
    useEffect(() => {
        if (!isDataLoaded || projects.length === 0) return;
        
        const xmlString = stringifyProjectsToXml(projects);
        localXmlRef.current = xmlString; // Update ref immediately to prevent snapshot echoes
        
        // Always save to localStorage for offline reliability
        saveProjectsToStorage(projects);
        
        // Debounced save to Firestore
        if (isAuthenticated && auth.currentUser) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            
            debounceTimerRef.current = window.setTimeout(() => {
                updateUserData(auth.currentUser!.uid, { projectsXml: xmlString }).catch(err => {
                    console.error("Failed to save projects to Firestore:", err);
                });
            }, 1500);
        }
    }, [projects, isDataLoaded, isAuthenticated]);


    // --- Back Button / History Management for Settings Modal ---
    useEffect(() => {
        if (isSettingsOpen) {
            window.history.pushState({ flowstateModal: 'settings' }, '');
        }
        
        const handlePopState = () => {
            if (isClosingModalProgrammatically.current) {
                isClosingModalProgrammatically.current = false;
                return;
            }
            setIsSettingsOpen(false);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isSettingsOpen]);

    const handleCloseSettingsModal = () => {
        if (window.history.state?.flowstateModal === 'settings') {
            isClosingModalProgrammatically.current = true;
            window.history.back();
        }
        setIsSettingsOpen(false);
    };

    useEffect(() => {
        document.documentElement.className = `theme-${theme}`;
        localStorage.setItem('flowstate-theme', theme);
    }, [theme]);
    
    useEffect(() => {
        document.documentElement.style.setProperty('--line-height-paragraph', typographySettings.lineHeight.toString());
        document.documentElement.style.setProperty('--spacing-paragraph', `${typographySettings.paragraphSpacing}em`);
        localStorage.setItem('flowstate-typography-settings', JSON.stringify(typographySettings));
    }, [typographySettings]);

    const handleLogout = () => {
        auth.signOut().catch(error => {
            console.error("Logout failed:", error);
        });
    };

    const handleSetDesktopBackground = (imageDataUrl: string) => {
        localStorage.setItem('flowstate-desktop-background', imageDataUrl);
        setDesktopBackground(imageDataUrl);
    };

    const handleClearDesktopBackground = () => {
        localStorage.removeItem('flowstate-desktop-background');
        setDesktopBackground(null);
    };

    const updateTimestamp = (projectIds: string | string[]) => {
        const idsToUpdate = Array.isArray(projectIds) ? new Set(projectIds) : new Set([projectIds]);
        if (idsToUpdate.size === 0) return;
        
        setProjects(prev => prev.map(p => 
            idsToUpdate.has(p.id) ? { ...p, lastModified: new Date().toISOString() } : p
        ));
    };

    const handleSetActiveProjectId = (id: string) => {
        setActiveProjectId(id);
    };

    const handleAddProject = (details: { name: string; parentId: string | null; category?: string; childCategoryName?: string }) => {
        if (details.name.trim()) {
            const newProject: Project = {
                id: crypto.randomUUID(),
                name: details.name.trim(),
                cards: [],
                parentId: details.parentId,
                category: details.category,
                childCategoryName: details.childCategoryName,
                notes: '',
                lastModified: new Date().toISOString(),
            };
            setProjects(prev => [...prev, newProject]);
            setActiveProjectId(newProject.id);
            if(details.parentId) updateTimestamp(details.parentId);
        }
    };
    
    const handleDeleteProject = (id: string) => {
        let parentIdToUpdate: string | null = null;
        setProjects(prev => {
            const projectToDelete = prev.find(p => p.id === id);
            parentIdToUpdate = projectToDelete?.parentId || null;

            const projectsToDelete = new Set<string>([id]);
            let changed = true;
            while(changed) {
                changed = false;
                const children = prev.filter(p => p.parentId && projectsToDelete.has(p.parentId));
                children.forEach(c => {
                    if (!projectsToDelete.has(c.id)) {
                        projectsToDelete.add(c.id);
                        changed = true;
                    }
                });
            }

            const newProjects = prev.filter(p => !projectsToDelete.has(p.id));
            if (activeProjectId && projectsToDelete.has(activeProjectId)) {
                const topLevel = newProjects.filter(p => !p.parentId);
                setActiveProjectId(topLevel.length > 0 ? topLevel[0].id : newProjects.length > 0 ? newProjects[0].id : null);
            }
            return newProjects;
        });
        if (parentIdToUpdate) updateTimestamp(parentIdToUpdate);
    };

    const handleUpdateProject = (id: string, updates: Partial<Pick<Project, 'name' | 'category' | 'childCategoryName' | 'isHidden'>>) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates, lastModified: new Date().toISOString() } : p));
    };

    const handleUpdateProjectNotes = (id: string, notes: string) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, notes, lastModified: new Date().toISOString() } : p));
    };

    const handleAddCardAtIndex = (projectId: string, cardData: Partial<Omit<Card, 'id'>>, index: number) => {
        if (!cardData.content?.trim() && !cardData.notes?.trim()) return;
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                const newCard: Card = { 
                    id: crypto.randomUUID(), 
                    content: cardData.content || '',
                    notes: cardData.notes,
                    tags: cardData.tags || [],
                    task: cardData.task
                };
                const newCards = [...p.cards];
                newCards.splice(index, 0, newCard);
                return { ...p, cards: newCards, lastModified: new Date().toISOString() };
            }
            return p;
        }));
    };


    const handleDeleteCard = (projectId: string, cardId: string) => {
        setProjects(prev => prev.map(p => 
            p.id === projectId ? { ...p, cards: p.cards.filter(c => c.id !== cardId), lastModified: new Date().toISOString() } : p
        ));
    };

    const handleDuplicateCard = (projectId: string, cardId: string) => {
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                const cardIndex = p.cards.findIndex(c => c.id === cardId);
                if (cardIndex === -1) return p;
    
                const originalCard = p.cards[cardIndex];
                const newCard: Card = {
                    ...originalCard,
                    id: crypto.randomUUID(),
                    isLocked: false,
                };
    
                const newCards = [...p.cards];
                newCards.splice(cardIndex + 1, 0, newCard);
                
                return { ...p, cards: newCards, lastModified: new Date().toISOString() };
            }
            return p;
        }));
    };

    const handleMoveCards = (cardsToMove: Card[], sourceProjectId: string, targetProjectId: string) => {
        if (sourceProjectId === targetProjectId) return;
        setProjects(prev => {
            const cardIdsToMove = new Set(cardsToMove.map(c => c.id));
            let sourceProject = prev.find(p => p.id === sourceProjectId);
            let targetProject = prev.find(p => p.id === targetProjectId);

            if (!sourceProject || !targetProject) return prev;

            const newSourceCards = sourceProject.cards.filter(c => !cardIdsToMove.has(c.id));
            
            const targetCardIds = new Set(targetProject.cards.map(c => c.id));
            const uniqueCardsToAdd = cardsToMove.filter(c => !targetCardIds.has(c.id));
            const newTargetCards = [...targetProject.cards, ...uniqueCardsToAdd];

            const timestamp = new Date().toISOString();
            return prev.map(p => {
                if (p.id === sourceProjectId) return { ...p, cards: newSourceCards, lastModified: timestamp };
                if (p.id === targetProjectId) return { ...p, cards: newTargetCards, lastModified: timestamp };
                return p;
            });
        });
    };

    const handleUpdateCardOrder = (projectId: string, updatedCards: Card[]) => {
        setProjects(prev => prev.map(p =>
            p.id === projectId ? { ...p, cards: updatedCards, lastModified: new Date().toISOString() } : p
        ));
    };

    const handleUpdateCard = (projectId: string, cardId: string, updates: Partial<Card>) => {
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                return {
                    ...p,
                    cards: p.cards.map(c => 
                        c.id === cardId ? { ...c, ...updates } : c
                    ),
                    lastModified: new Date().toISOString()
                };
            }
            return p;
        }));
    };
    
    const isDescendant = (childId: string, parentId: string, allProjects: Project[]): boolean => {
        const child = allProjects.find(p => p.id === childId);
        if (!child || !child.parentId) {
            return false;
        }
        if (child.parentId === parentId) {
            return true;
        }
        return isDescendant(child.parentId, parentId, allProjects);
    };

    const handleReorderProject = (draggedProjectId: string, targetProjectId: string | null, position: 'on' | 'before' | 'after') => {
        if (draggedProjectId === targetProjectId) return;

        if (position === 'on' && targetProjectId && isDescendant(targetProjectId, draggedProjectId, projects)) {
            alert("Cannot move a project into one of its own sub-projects.");
            return;
        }

        setProjects(prev => {
            const draggedProject = prev.find(p => p.id === draggedProjectId);
            if (!draggedProject) return prev;

            let newProjects = [...prev];

            if (position === 'on') {
                 draggedProject.parentId = targetProjectId;
            } else {
                 const targetProject = prev.find(p => p.id === targetProjectId);
                 if (!targetProject) return prev;
                 draggedProject.parentId = targetProject.parentId;
                 
                 const siblings = newProjects.filter(p => p.parentId === targetProject.parentId && p.id !== draggedProjectId);
                 const targetIndex = siblings.findIndex(p => p.id === targetProjectId);
                 
                 if (position === 'before') {
                     siblings.splice(targetIndex, 0, draggedProject);
                 } else { // 'after'
                     siblings.splice(targetIndex + 1, 0, draggedProject);
                 }
                 
                 const nonSiblings = newProjects.filter(p => p.parentId !== targetProject.parentId);
                 newProjects = [...nonSiblings, ...siblings];
            }
            updateTimestamp([draggedProjectId, targetProjectId, draggedProject.parentId].filter(Boolean) as string[]);
            return newProjects;
        });
    };


    const handleExportProject = (projectId: string) => {
        const getDescendants = (pId: string): Project[] => {
            const children = projects.filter(p => p.parentId === pId);
            let descendants = [...children];
            children.forEach(child => {
                descendants.push(...getDescendants(child.id));
            });
            return descendants;
        };

        const rootProject = projects.find(p => p.id === projectId);
        if (!rootProject) return;
        
        const projectsToExport = [rootProject, ...getDescendants(projectId)];
        const xmlString = stringifyProjectsToXml(projectsToExport);
        const blob = new Blob([xmlString], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${rootProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xml`;
        a.click();
        URL.revokeObjectURL(url);
    };
    
    const writeBackupFile = async (content: string) => {
        if (!backupDirectoryHandle) {
            console.error("No backup directory handle available.");
            return;
        }
        try {
            const fileName = `flowstate_backup_${new Date().toISOString().replace(/:/g, '-')}.xml`;
            const fileHandle = await backupDirectoryHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            console.log("Backup successful:", fileName);
        } catch (error) {
            console.error("Failed to write backup file:", error);
            if ((error as DOMException).name === 'NotAllowedError') {
                alert("Permission to write to the backup directory was denied. Please re-select the folder in settings and grant permission.");
                await clearDirectoryHandle();
                setBackupDirectoryHandle(null);
            }
        }
    };
    
    const handleBackup = () => {
        const xmlString = stringifyProjectsToXml(projects);
        if (backupDirectoryHandle) {
            writeBackupFile(xmlString);
        } else {
            const blob = new Blob([xmlString], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flowstate_backup_${new Date().toISOString().replace(/:/g, '-')}.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleRestore = (file: File) => {
        if (!window.confirm("Restoring from backup will overwrite all current projects. Are you sure you want to continue?")) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const xmlString = e.target?.result as string;
                const restoredProjects = parseXmlToProjects(xmlString);
                if (restoredProjects.length > 0) {
                    const finalProjects = ensureInboxProject(restoredProjects);
                    setProjects(finalProjects);
                    setActiveProjectId(finalProjects[0].id);
                } else {
                    alert("Could not find any valid projects in the backup file.");
                }
            } catch (error) {
                alert("Failed to parse the backup file. It might be corrupted.");
                console.error("Restore error:", error);
            }
        };
        reader.readAsText(file);
    };
    
    const handleImportDocument = async (file: File, projectName: string) => {
        try {
            const textContent = await parseDocument(file);
            handlePasteDocument(textContent, projectName);
        } catch (error) {
            alert(`Error importing document: ${(error as Error).message}`);
        }
    };
    
    const handleImportProject = (file: File) => {
         const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const xmlString = e.target?.result as string;
                const importedProjects = parseXmlToProjects(xmlString);
                
                if (importedProjects.length > 0) {
                    const existingIds = new Set(projects.map(p => p.id));
                    const newProjects = importedProjects.map(p => ({
                        ...p,
                        id: existingIds.has(p.id) ? crypto.randomUUID() : p.id
                    }));
                    
                    setProjects(prev => [...prev, ...newProjects]);
                    setActiveProjectId(newProjects[0].id);
                } else {
                    alert("No valid projects found in the imported file.");
                }
            } catch (error) {
                alert("Failed to parse project file.");
                console.error("Import project error:", error);
            }
        };
        reader.readAsText(file);
    };

    const handlePasteDocument = (textContent: string, projectName: string) => {
        const lines = textContent.split(/\r?\n/);
        const newCards: Card[] = lines.map(line => ({
            id: crypto.randomUUID(),
            content: formatNewCardContent(line.trim(), defaultImportFont.family, defaultImportFont.size)
        }));

        const newProject: Project = {
            id: crypto.randomUUID(),
            name: projectName,
            cards: newCards,
            parentId: null,
            lastModified: new Date().toISOString(),
        };
        setProjects(prev => [...prev, newProject]);
        setActiveProjectId(newProject.id);
    };
    
    const handleCombineCards = (projectId: string, cardIds: string[]) => {
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                const cardsToCombine = p.cards.filter(c => cardIds.includes(c.id));
                if (cardsToCombine.length < 2) return p;

                const combinedContent = cardsToCombine.map(c => c.content).join('');
                const firstCard = cardsToCombine[0];
                const updatedCard: Card = { ...firstCard, content: combinedContent };

                const remainingCards = p.cards.filter(c => !cardIds.includes(c.id));
                const firstCardIndex = p.cards.findIndex(c => c.id === firstCard.id);
                
                const newCards = [...remainingCards];
                newCards.splice(firstCardIndex, 0, updatedCard);
                
                return { ...p, cards: newCards, lastModified: new Date().toISOString() };
            }
            return p;
        }));
    };
    
    const handleSetBackupDirectory = async () => {
        try {
            const handle = await window.showDirectoryPicker({ id: 'flowstate-backup', mode: 'readwrite' });
            if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') {
                await saveDirectoryHandle(handle);
                setBackupDirectoryHandle(handle);
            }
        } catch (error) {
            console.error("Error setting backup directory:", error);
        }
    };
    
    const handleClearBackupDirectory = async () => {
        await clearDirectoryHandle();
        setBackupDirectoryHandle(null);
    };
    
    const handleAddProjectFromBlueprint = (xmlString: string, newProjectName: string) => {
        try {
            const blueprintProjects = parseXmlToProjects(xmlString);
            if (blueprintProjects.length === 0) throw new Error("Blueprint is empty.");

            const idMap = new Map<string, string>();
            blueprintProjects.forEach(p => idMap.set(p.id, crypto.randomUUID()));

            const newProjects: Project[] = blueprintProjects.map((p, index) => {
                const newId = idMap.get(p.id)!;
                const newParentId = p.parentId ? idMap.get(p.parentId) || null : null;
                
                const isRoot = index === 0; // Assume the first project in the XML is the root
                
                return {
                    ...p,
                    id: newId,
                    parentId: isRoot ? null : newParentId,
                    name: isRoot ? newProjectName : p.name, // Rename the root project
                    lastModified: new Date().toISOString(),
                    cards: p.cards.map(c => ({...c, id: crypto.randomUUID()}))
                };
            });
            
            setProjects(prev => [...prev, ...newProjects]);
            setActiveProjectId(newProjects[0].id);

        } catch (error) {
            alert("Failed to create project from blueprint.");
            console.error("Blueprint error:", error);
        }
    };
    
    const handleImportBlueprint = async (file: File) => {
        const reader = new FileReader();
        return new Promise<void>((resolve, reject) => {
            reader.onload = async (e) => {
                try {
                    const xmlString = e.target?.result as string;
                    const blueprintProjects = parseXmlToProjects(xmlString);
                    if (blueprintProjects.length === 0) {
                        throw new Error("File does not contain valid project data.");
                    }
                    const rootProject = blueprintProjects.find(p => !p.parentId) || blueprintProjects[0];
                    const newBlueprint: Blueprint = {
                        id: crypto.randomUUID(),
                        name: rootProject.name,
                        description: rootProject.notes || 'User-imported blueprint.',
                        xml: xmlString,
                    };
                    await saveUserBlueprint(newBlueprint);
                    setUserBlueprints(prev => [...prev, newBlueprint]);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read blueprint file.'));
            reader.readAsText(file);
        });
    };
    
    const handleDeleteUserBlueprint = async (id: string) => {
        await deleteUserBlueprint(id);
        setUserBlueprints(prev => prev.filter(bp => bp.id !== id));
    };
    
    const handleAddToInbox = (htmlContent: string) => {
        const newCard: Card = { 
            id: crypto.randomUUID(), 
            content: htmlContent,
        };
        setProjects(prev => prev.map(p => {
            if (p.id === INBOX_PROJECT_ID) {
                const updatedCards = [newCard, ...p.cards];
                return { ...p, cards: updatedCards, lastModified: new Date().toISOString() };
            }
            return p;
        }));
    };
    
    const handleNavigateToCard = (projectId: string, cardId: string) => {
        if (activeProjectId !== projectId) {
            setActiveProjectId(projectId);
        }
        setCardToLocate({ cardId });
    };

    if (!isAuthChecked) {
        return <SplashScreen />;
    }

    if (!isAuthenticated) {
        return <LoginScreen />;
    }

    return (
        <>
            {!isDataLoaded ? <SplashScreen /> : (
                <ProjectLibrary 
                    projects={projects}
                    userBlueprints={userBlueprints}
                    activeProjectId={activeProjectId}
                    onSetActiveProjectId={handleSetActiveProjectId}
                    onAddProject={handleAddProject}
                    onAddProjectFromBlueprint={handleAddProjectFromBlueprint}
                    onImportBlueprint={handleImportBlueprint}
                    onDeleteUserBlueprint={handleDeleteUserBlueprint}
                    onUpdateProject={handleUpdateProject}
                    onUpdateProjectNotes={handleUpdateProjectNotes}
                    onDeleteProject={handleDeleteProject}
                    onDeleteCard={handleDeleteCard}
                    onDuplicateCard={handleDuplicateCard}
                    onMoveCards={handleMoveCards}
                    onUpdateCardOrder={handleUpdateCardOrder}
                    onUpdateCard={handleUpdateCard}
                    onAddCardAtIndex={handleAddCardAtIndex}
                    onExportProject={handleExportProject}
                    onReorderProject={handleReorderProject}
                    onBackup={handleBackup}
                    onRestore={handleRestore}
                    onImportDocument={handleImportDocument}
                    onImportProject={handleImportProject}
                    onPasteDocument={handlePasteDocument}
                    onCombineCards={handleCombineCards}
                    onAddToInbox={handleAddToInbox}
                    theme={theme}
                    onSetTheme={setTheme}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    cardToLocate={cardToLocate}
                    onCardLocated={() => setCardToLocate(null)}
                    onNavigateToCard={handleNavigateToCard}
                    compositionTheme={compositionTheme}
                    defaultImportFont={defaultImportFont}
                    desktopBackground={desktopBackground}
                />
            )}
            <SettingsModal 
                isOpen={isSettingsOpen}
                onClose={handleCloseSettingsModal}
                backupDirectoryName={backupDirectoryHandle?.name || null}
                onSetBackupDirectory={handleSetBackupDirectory}
                onClearBackupDirectory={handleClearBackupDirectory}
                onLogout={handleLogout}
                compositionTheme={compositionTheme}
                onSetCompositionTheme={(theme) => {
                    setCompositionTheme(theme);
                    localStorage.setItem('flowstate-composition-theme', theme);
                }}
                defaultImportFont={defaultImportFont}
                onSetDefaultImportFont={(settings) => {
                    setDefaultImportFont(settings);
                    localStorage.setItem('flowstate-import-settings', JSON.stringify(settings));
                }}
                typographySettings={typographySettings}
                onSetTypographySettings={setTypographySettings}
                desktopBackground={desktopBackground}
                onSetDesktopBackground={handleSetDesktopBackground}
                onClearDesktopBackground={handleClearDesktopBackground}
            />
        </>
    );
}

export default App;
