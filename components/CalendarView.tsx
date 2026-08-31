import React, { useState, useMemo } from 'react';
import { Card } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from './icons';
import { htmlToPlainText } from '../services/documentParser';

interface CalendarTaskData extends Card {
    projectId: string;
    projectName: string;
}

interface CalendarViewProps {
    cards: CalendarTaskData[];
    onCardDoubleClick: (card: CalendarTaskData) => void;
}

const CalendarTask: React.FC<{ card: CalendarTaskData; onCardDoubleClick: (card: CalendarTaskData) => void; }> = ({ card, onCardDoubleClick }) => {
    return (
        <div
            onClick={() => onCardDoubleClick(card)}
            className="p-1.5 mb-1 bg-[var(--color-accent-subtle-bg)] hover:bg-[var(--color-accent-subtle-border)] border border-transparent hover:border-[var(--color-accent-subtle-border)] rounded-md cursor-pointer text-xs"
        >
            <p className="font-medium truncate text-[var(--color-accent-subtle-text)]">{htmlToPlainText(card.content)}</p>
        </div>
    );
};

const CalendarView: React.FC<CalendarViewProps> = ({ cards, onCardDoubleClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const taskCards = useMemo(() => cards.filter(c => c.task && c.task.dueDate), [cards]);

    const tasksByDate = useMemo(() => {
        const grouped: { [key: string]: CalendarTaskData[] } = {};
        for (const card of taskCards) {
            if (card.task?.dueDate) {
                const dateKey = card.task.dueDate; // YYYY-MM-DD
                if (!grouped[dateKey]) {
                    grouped[dateKey] = [];
                }
                grouped[dateKey].push(card);
            }
        }
        return grouped;
    }, [taskCards]);

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const grid: (Date | null)[] = [];

        for (let i = 0; i < firstDayOfMonth; i++) {
            grid.push(null);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            grid.push(new Date(year, month, day));
        }
        
        const remainingCells = 7 - (grid.length % 7);
        if (remainingCells < 7) {
            for (let i = 0; i < remainingCells; i++) {
                grid.push(null);
            }
        }

        return grid;
    }, [currentDate]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (taskCards.length === 0) {
        return (
            <div className="flex-grow flex items-center justify-center h-full text-center border-2 border-dashed border-[var(--color-border-secondary)] rounded-lg">
                <div className="text-[var(--color-text-secondary)]">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-2" />
                    <p className="font-semibold">No tasks with due dates in this project</p>
                    <p className="text-sm mt-1">Double-click a card and set a due date to see it here.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-grow flex flex-col h-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-lg shadow-sm">
            <div className="flex justify-between items-center p-4 border-b border-[var(--color-border-primary)]">
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex items-center space-x-2">
                    <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-[var(--color-element-primary)]"><ChevronLeftIcon className="w-5 h-5"/></button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm font-semibold bg-[var(--color-element-primary)] rounded-md hover:bg-[var(--color-element-primary-hover)]">Today</button>
                    <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-[var(--color-element-primary)]"><ChevronRightIcon className="w-5 h-5"/></button>
                </div>
            </div>

            <div className="grid grid-cols-7 flex-grow min-h-0">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-semibold text-xs text-[var(--color-text-secondary)] py-2 border-b border-r border-[var(--color-border-primary)]">
                        {day}
                    </div>
                ))}

                {calendarGrid.map((date, index) => {
                    if (!date) {
                        return <div key={`empty-${index}`} className="border-r border-b border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]/50"></div>;
                    }

                    const dateKey = date.toISOString().split('T')[0];
                    const tasksForDay = tasksByDate[dateKey] || [];
                    const isToday = date.getTime() === today.getTime();

                    return (
                        <div key={dateKey} className="border-r border-b border-[var(--color-border-primary)] p-1.5 flex flex-col min-h-0">
                            <div className={`text-xs font-semibold self-end mb-1 px-1.5 py-0.5 rounded-full ${isToday ? 'bg-[var(--color-accent-primary)] text-[var(--color-accent-text)]' : 'text-[var(--color-text-secondary)]'}`}>
                                {date.getDate()}
                            </div>
                            <div className="flex-grow overflow-y-auto pr-1">
                                {tasksForDay.map(task => (
                                    <CalendarTask key={task.id} card={task} onCardDoubleClick={onCardDoubleClick} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarView;