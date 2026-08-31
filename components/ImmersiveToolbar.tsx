import React from 'react';
import { ColumnsIcon } from './icons';

interface ImmersiveToolbarProps {
    width: number;
    onSetWidth: (width: number) => void;
    isVisible: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    min?: number;
    max?: number;
}

const ImmersiveToolbar: React.FC<ImmersiveToolbarProps> = ({
    width, onSetWidth, isVisible, onMouseEnter, onMouseLeave, min = 25, max = 100
}) => {
    return (
        <div
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={e => e.stopPropagation()}
        >
            <div className="flex items-center space-x-3 bg-black/20 backdrop-blur-md text-white/80 p-2 pl-4 rounded-full shadow-lg border border-white/10">
                <ColumnsIcon className="w-5 h-5 text-white/60 flex-shrink-0" />
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={width}
                    onChange={(e) => onSetWidth(parseInt(e.target.value, 10))}
                    className="w-48 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                    aria-label="Adjust page width"
                />
                <span className="text-xs font-mono w-10 text-center flex-shrink-0">{width}</span>
            </div>
        </div>
    );
};

export default ImmersiveToolbar;