import { Project, Card, Task, TaskStatus, TaskPriority } from '../types';
import { DUMMY_XML_DATA, LOCAL_STORAGE_KEY } from '../constants';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Blueprint } from './blueprints';

const escapeXml = (unsafe: string): string => {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

export const parseXmlToProjects = (xmlString: string): Project[] => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const projectNodes = xmlDoc.getElementsByTagName('Project');
        const projects: Project[] = [];

        for (let i = 0; i < projectNodes.length; i++) {
            const projectNode = projectNodes[i];
            const id = projectNode.getAttribute('id') || crypto.randomUUID();
            const name = projectNode.getAttribute('name') || 'Untitled Project';
            const parentId = projectNode.getAttribute('parentId') || null;
            const category = projectNode.getAttribute('category') || undefined;
            const childCategoryName = projectNode.getAttribute('childCategoryName') || undefined;
            const notes = projectNode.getAttribute('notes') || undefined;
            const lastModified = projectNode.getAttribute('lastModified') || undefined;
            const isHidden = projectNode.getAttribute('isHidden') === 'true';
            
            const cardNodes = projectNode.getElementsByTagName('Card');
            const cards: Card[] = [];

            for (let j = 0; j < cardNodes.length; j++) {
                const cardNode = cardNodes[j];
                const cardId = cardNode.getAttribute('id') || crypto.randomUUID();
                const color = cardNode.getAttribute('color') || undefined;
                const isHidden = cardNode.getAttribute('isHidden') === 'true';
                const isLocked = cardNode.getAttribute('isLocked') === 'true';
                const tags = cardNode.getAttribute('tags')?.split(',').filter(Boolean) || [];

                const contentNode = cardNode.querySelector('Content');
                const notesNode = cardNode.querySelector('Notes');
                const taskNode = cardNode.querySelector('Task');

                let content = '';
                let cardNotes: string | undefined = undefined;
                let task: Task | undefined = undefined;

                if (contentNode) {
                    content = contentNode.textContent || '';
                    if (notesNode) {
                        cardNotes = notesNode.textContent || undefined;
                    }
                } else {
                    // Backward compatibility for old format where content is the textContent of the card
                    content = cardNode.textContent || '';
                }

                if (taskNode) {
                    const status = taskNode.getAttribute('status') as TaskStatus;
                    const dueDate = taskNode.getAttribute('dueDate') || undefined;
                    const priorityAttr = taskNode.getAttribute('priority') as TaskPriority;

                    if (status && ['sketch', 'revision', 'proofreading'].includes(status)) {
                        const priority = (priorityAttr && ['low', 'medium', 'high'].includes(priorityAttr)) ? priorityAttr : 'medium';
                        task = { status, dueDate, priority };
                    }
                }

                cards.push({ id: cardId, content, notes: cardNotes, color, isHidden, tags, task, isLocked });
            }

            projects.push({ id, name, cards, parentId, category, childCategoryName, notes, lastModified, isHidden });
        }
        return projects;
    } catch (error) {
        console.error("Failed to parse XML:", error);
        return [];
    }
};

export const stringifyProjectsToXml = (projects: Project[]): string => {
    const projectsXml = projects.map(project => {
        const cardsXml = project.cards.map(card => {
            const cardAttributes = [
                `id="${card.id}"`,
                card.color ? `color="${escapeXml(card.color)}"` : '',
                card.isHidden ? `isHidden="true"` : '',
                card.isLocked ? `isLocked="true"` : '',
                card.tags?.length ? `tags="${escapeXml(card.tags.join(','))}"` : ''
            ].filter(Boolean).join(' ');
            
            const contentNode = `\n                    <Content><![CDATA[${card.content || ''}]]></Content>`;
            const notesNode = card.notes ? `\n                    <Notes><![CDATA[${card.notes}]]></Notes>` : '';
            const taskNode = card.task
                ? `\n                    <Task status="${card.task.status}"${card.task.dueDate ? ` dueDate="${escapeXml(card.task.dueDate)}"` : ''}${card.task.priority && card.task.priority !== 'medium' ? ` priority="${card.task.priority}"` : ''} />`
                : '';

            return `                <Card ${cardAttributes}>${contentNode}${notesNode}${taskNode}\n                </Card>`;
        }).join('\n');
        
        const attributes = [
            `id="${project.id}"`,
            `name="${escapeXml(project.name)}"`,
            `parentId="${project.parentId || ''}"`,
            project.category ? `category="${escapeXml(project.category)}"` : '',
            project.childCategoryName ? `childCategoryName="${escapeXml(project.childCategoryName)}"` : '',
            project.notes ? `notes="${escapeXml(project.notes)}"` : '',
            project.lastModified ? `lastModified="${escapeXml(project.lastModified)}"` : '',
            project.isHidden ? 'isHidden="true"' : ''
        ].filter(Boolean).join(' ');

        return `        <Project ${attributes}>
            <Cards>
${cardsXml}
            </Cards>
        </Project>`;
    }).join('\n');

    return `<WriterAidData>
    <Projects>
${projectsXml}
    </Projects>
</WriterAidData>`;
};


export const loadProjectsFromStorage = (): Project[] => {
    const xmlData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (xmlData) {
        return parseXmlToProjects(xmlData);
    }
    const defaultProjects = parseXmlToProjects(DUMMY_XML_DATA);
    saveProjectsToStorage(defaultProjects);
    return defaultProjects;
};

export const saveProjectsToStorage = (projects: Project[]) => {
    const xmlString = stringifyProjectsToXml(projects);
    localStorage.setItem(LOCAL_STORAGE_KEY, xmlString);
};

// --- Database for persistent app data ---

interface FlowstateDB extends DBSchema {
  'fs-handles': {
    key: string;
    value: FileSystemDirectoryHandle;
  };
  'user-blueprints': {
    key: string;
    value: Blueprint;
  };
}

const DB_NAME = 'flowstate-fs-handles';
const FS_STORE_NAME = 'fs-handles';
const BLUEPRINT_STORE_NAME = 'user-blueprints';
const DB_VERSION = 2; // Incremented version for schema update
let dbPromise: Promise<IDBPDatabase<FlowstateDB>>;

const getDb = (): Promise<IDBPDatabase<FlowstateDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<FlowstateDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(FS_STORE_NAME);
        }
        if (oldVersion < 2) {
          db.createObjectStore(BLUEPRINT_STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

// --- File System Access API Handle Storage ---

export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  const db = await getDb();
  await db.put(FS_STORE_NAME, handle, 'backup-directory');
};

export const loadDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | undefined> => {
  try {
    const db = await getDb();
    return await db.get(FS_STORE_NAME, 'backup-directory');
  } catch (e) {
    console.error("IndexedDB is not available in this context.", e);
    return undefined;
  }
};

export const clearDirectoryHandle = async (): Promise<void> => {
    const db = await getDb();
    await db.delete(FS_STORE_NAME, 'backup-directory');
};

// --- User Blueprint Storage ---

export const saveUserBlueprint = async (blueprint: Blueprint): Promise<void> => {
    const db = await getDb();
    await db.put(BLUEPRINT_STORE_NAME, blueprint);
};

export const loadUserBlueprints = async (): Promise<Blueprint[]> => {
    try {
        const db = await getDb();
        return await db.getAll(BLUEPRINT_STORE_NAME);
    } catch (e) {
        console.error("IndexedDB is not available for blueprints.", e);
        return [];
    }
};

export const deleteUserBlueprint = async (id: string): Promise<void> => {
    const db = await getDb();
    await db.delete(BLUEPRINT_STORE_NAME, id);
};