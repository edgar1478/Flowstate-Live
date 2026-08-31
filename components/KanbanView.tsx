import React, { useState, useMemo } from 'react';
import { Card, TaskStatus, Task, TaskPriority } from '../types';
import { CalendarIcon, CheckSquareIcon, FolderIcon, LockIcon } from './icons';
import { htmlToPlainText } from '../services/documentParser';

interface KanbanCardData extends Card {
    projectId: string;
    projectName: string;
}

interface KanbanViewProps {
    cards: KanbanCardData[];
    onUpdateCard: (projectId: string, cardId: string, updates: Partial<Card>) => void;
    onCardDoubleClick: (card: KanbanCardData) => void;
}

const KanbanCard: React.FC<{ card: KanbanCardData; onCardDoubleClick: (card: KanbanCardData) => void; }> = ({ card, onCardDoubleClick }) => {
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (card.isLocked) {
            e.preventDefault();
            return;
        }
        const data = JSON.stringify({ cardId: card.id, projectId: card.projectId });
        e.dataTransfer.setData('application/vnd.flowstate.kanban-card', data);
        e.dataTransfer.effectAllowed = 'move';
        document.body.classList.add('dragging');
    };

    const handleDragEnd = () => {
        document.body.classList.remove('dragging');
    };

    const getDueDatePill = (dueDate: string) => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const due = new Date(dueDate + 'T00:00:00-07:00');
        const isOverdue = due < today;
        const style = isOverdue ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-800';
        const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(due);
        return (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 ${style}`}>
                <CalendarIcon className="w-3.5 h-3.5" />
                {formattedDate}
            </span>
        );
    };
    
    const priorityBorders: Record<TaskPriority, string> = {
        high: 'border-l-red-500',
        medium: 'border-l-transparent',
        low: 'border-l-blue-500',
    };
    const borderClass = priorityBorders[card.task?.priority || 'medium'];

    return (
        <div
            draggable={!card.isLocked}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDoubleClick={() => !card.isLocked && onCardDoubleClick(card)}
            className={`bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--color-border-primary)] shadow-sm mb-3 space-y-2 border-l-4 ${borderClass} ${card.isLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
            title={card.isLocked ? "This card is locked. Unlock it to make changes." : ""}
        >
            <div className="flex justify-between items-start gap-2">
                <p className="text-sm text-[var(--color-text-primary)] break-words flex-grow">{htmlToPlainText(card.content)}</p>
                {card.isLocked && <LockIcon className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />}
            </div>
            
            <div className="flex items-center justify-between text-xs">
                {card.task?.dueDate ? getDueDatePill(card.task.dueDate) : <div />}
                {card.tags && card.tags.length > 0 && (
                     <span className="text-[var(--color-text-tertiary)]" title={card.tags.join(', ')}>#{card.tags.length}</span>
                )}
            </div>
            
            <div className="pt-2 border-t border-[var(--color-border-primary)] text-xs text-[var(--color-text-tertiary)] flex items-center gap-1.5" title={card.projectName}>
                <FolderIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{card.projectName}</span>
            </div>
        </div>
    );
};

const KanbanColumn: React.FC<{
    status: TaskStatus;
    title: string;
    cards: KanbanCardData[];
    onDrop: (status: TaskStatus, e: React.DragEvent<HTMLDivElement>) => void;
    onCardDoubleClick: (card: KanbanCardData) => void;
}> = ({ status, title, cards, onDrop, onCardDoubleClick }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop(status, e);
    };

    const statusColors: Record<TaskStatus, { bg: string, text: string }> = {
        sketch: { bg: 'bg-yellow-500', text: 'text-yellow-100' },
        revision: { bg: 'bg-blue-500', text: 'text-blue-100' },
        proofreading: { bg: 'bg-purple-500', text: 'text-purple-100' },
    };

    const priorityOrder: Record<TaskPriority, number> = {
        high: 0,
        medium: 1,
        low: 2,
    };

    const sortedCards = useMemo(() => {
        return [...cards].sort((a, b) => {
            const priorityA = priorityOrder[a.task?.priority || 'medium'];
            const priorityB = priorityOrder[b.task?.priority || 'medium'];
            return priorityA - priorityB;
        });
    }, [cards]);


    return (
        <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-[var(--color-bg-tertiary)] rounded-lg p-3 flex flex-col transition-colors ${isDragOver ? 'bg-[var(--color-accent-subtle-bg)]' : ''}`}
        >
            <h3 className="font-semibold text-sm text-[var(--color-text-primary)] mb-3 px-1 flex items-center">
                 <span className={`w-2.5 h-2.5 rounded-full mr-2 ${statusColors[status].bg}`}></span>
                {title}
                <span className="ml-2 text-xs font-normal bg-[var(--color-element-primary)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full">{cards.length}</span>
            </h3>
            <div className="flex-grow min-h-[100px] overflow-y-auto pr-1">
                {sortedCards.map(card => <KanbanCard key={card.id} card={card} onCardDoubleClick={onCardDoubleClick}/>)}
                 {cards.length === 0 && !isDragOver && (
                    <div className="flex items-center justify-center h-full text-xs text-center text-[var(--color-text-tertiary)] italic">
                        No tasks in this stage.
                    </div>
                )}
                {isDragOver && (
                     <div className="flex items-center justify-center h-24 text-sm text-center text-[var(--color-accent-subtle-text)] border-2 border-dashed border-[var(--color-accent-subtle-border)] rounded-lg">
                        Drop here
                    </div>
                )}
            </div>
        </div>
    );
};

const KanbanView: React.FC<KanbanViewProps> = ({ cards, onUpdateCard, onCardDoubleClick }) => {
    
    const taskCards = useMemo(() => cards.filter(c => c.task), [cards]);

    const columns: Record<TaskStatus, KanbanCardData[]> = useMemo(() => ({
        sketch: taskCards.filter(c => c.task?.status === 'sketch'),
        revision: taskCards.filter(c => c.task?.status === 'revision'),
        proofreading: taskCards.filter(c => c.task?.status === 'proofreading'),
    }), [taskCards]);

    const handleDrop = (newStatus: TaskStatus, e: React.DragEvent<HTMLDivElement>) => {
        const dataStr = e.dataTransfer.getData('application/vnd.flowstate.kanban-card');
        if (!dataStr) return;
        
        try {
            const { cardId, projectId } = JSON.parse(dataStr);
            const card = cards.find(c => c.id === cardId);
            if (card && card.task && card.task.status !== newStatus) {
                const updatedTask: Task = { ...card.task, status: newStatus };
                onUpdateCard(projectId, cardId, { task: updatedTask });
            }
        } catch (error) {
            console.error("Error handling drop:", error);
        }
    };

    if (taskCards.length === 0) {
        return (
            <div className="flex-grow flex items-center justify-center h-full text-center border-2 border-dashed border-[var(--color-border-secondary)] rounded-lg">
                <div className="text-[var(--color-text-secondary)]">
                    <CheckSquareIcon className="w-12 h-12 mx-auto mb-2" />
                    <p className="font-semibold">No tasks in this project</p>
                    <p className="text-sm mt-1">Double-click a card to mark it as a to-do item.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 overflow-x-auto">
            <KanbanColumn
                status="sketch"
                title="Sketch/Idea"
                cards={columns.sketch}
                onDrop={handleDrop}
                onCardDoubleClick={onCardDoubleClick}
            />
             <KanbanColumn
                status="revision"
                title="Revision"
                cards={columns.revision}
                onDrop={handleDrop}
                onCardDoubleClick={onCardDoubleClick}
            />
             <KanbanColumn
                status="proofreading"
                title="Proofreading"
                cards={columns.proofreading}
                onDrop={handleDrop}
                onCardDoubleClick={onCardDoubleClick}
            />
             <style>{`
                body.dragging, body.dragging * { cursor: grabbing !important; }
            `}</style>
        </div>
    );
};

export default KanbanView;