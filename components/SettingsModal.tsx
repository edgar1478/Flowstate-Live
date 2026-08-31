import React, { useRef } from 'react';
import { CloseIcon, FolderIcon, TrashIcon, LogOutIcon } from './icons';

interface TypographySettings {
    lineHeight: number;
    paragraphSpacing: number;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    backupDirectoryName: string | null;
    onSetBackupDirectory: () => void;
    onClearBackupDirectory: () => void;
    onLogout: () => void;
    compositionTheme: string;
    onSetCompositionTheme: (themeName: string) => void;
    defaultImportFont: { family: string; size: string };
    onSetDefaultImportFont: (settings: { family: string; size: string }) => void;
    typographySettings: TypographySettings;
    onSetTypographySettings: (settings: TypographySettings) => void;
    desktopBackground: string | null;
    onSetDesktopBackground: (imageDataUrl: string) => void;
    onClearDesktopBackground: () => void;
}

const COMPOSITION_THEMES = [
    { id: 'default', name: 'Follow Theme', bg: 'var(--color-bg-primary)', border: 'var(--color-border-primary)' },
    { id: 'paper', name: 'Paper', bg: '#fdf6e3', border: '#93a1a1' },
    { id: 'charcoal', name: 'Charcoal', bg: '#2d2d2d', border: '#585858' },
    { id: 'contrast', name: 'Black on White', bg: '#ffffff', border: '#cccccc' },
];

const FONT_SIZE_MAP: { [key: string]: string } = {
    '1': '10px', '2': '12px', '3': '14px', '4': '16px', '5': '18px', '6': '24px', '7': '32px'
};

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, backupDirectoryName, onSetBackupDirectory, onClearBackupDirectory, 
    onLogout, compositionTheme, onSetCompositionTheme, defaultImportFont, 
    onSetDefaultImportFont, typographySettings, onSetTypographySettings,
    desktopBackground, onSetDesktopBackground, onClearDesktopBackground
}) => {
    if (!isOpen) return null;

    const bgUploadRef = useRef<HTMLInputElement>(null);

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onSetDesktopBackground(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onSetDefaultImportFont({ ...defaultImportFont, family: e.target.value });
    };

    const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onSetDefaultImportFont({ ...defaultImportFont, size: e.target.value });
    };

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--color-bg-secondary)] rounded-lg shadow-xl p-6 w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Settings</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--color-element-primary)]"><CloseIcon className="w-5 h-5 text-[var(--color-text-secondary)]"/></button>
                </div>
                
                <div className="space-y-6 my-6 max-h-[75vh] overflow-y-auto pr-4 -mr-4">
                    <div className="space-y-4">
                        <h3 className="text-md font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border-primary)] pb-2">Backup Location</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Set a local folder for your backups. This allows the application to save backups directly to your computer without prompting for a location each time. Your browser will ask for permission to access this folder.
                        </p>
                        <div className="bg-[var(--color-bg-tertiary)] p-4 rounded-lg flex items-center justify-between">
                            {backupDirectoryName ? (
                                <div className="flex items-center space-x-3 text-sm text-[var(--color-text-primary)] min-w-0">
                                    <FolderIcon className="w-5 h-5 text-[var(--color-accent-primary)] flex-shrink-0" />
                                    <span className="font-mono bg-[var(--color-bg-secondary)] px-2 py-1 rounded truncate" title={backupDirectoryName}>{backupDirectoryName}</span>
                                </div>
                            ) : (
                                <span className="text-sm italic text-[var(--color-text-tertiary)]">No backup folder selected</span>
                            )}
                            {backupDirectoryName && (
                                <button onClick={onClearBackupDirectory} title="Clear backup folder setting" className="p-2 text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] rounded-full ml-2">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <button onClick={onSetBackupDirectory} className="w-full px-4 py-2 text-sm font-semibold bg-[var(--color-accent-primary)] text-[var(--color-accent-text)] rounded-lg hover:bg-[var(--color-accent-primary-hover)]">
                            Choose Folder
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-md font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border-primary)] pb-2">Typography</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Customize the readability of your text in the preview and on cards.
                        </p>
                        <div className="space-y-4">
                             <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label htmlFor="lineHeight" className="text-sm font-medium text-[var(--color-text-secondary)]">In-Paragraph Line Height</label>
                                    <span className="text-sm font-mono text-[var(--color-text-tertiary)]">{typographySettings.lineHeight.toFixed(2)}</span>
                                </div>
                                <input
                                    id="lineHeight"
                                    type="range"
                                    min="1.2"
                                    max="2.0"
                                    step="0.05"
                                    value={typographySettings.lineHeight}
                                    onChange={e => onSetTypographySettings({ ...typographySettings, lineHeight: parseFloat(e.target.value) })}
                                    className="w-full h-2 bg-[var(--color-element-primary)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent-primary)]"
                                />
                            </div>
                             <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label htmlFor="paragraphSpacing" className="text-sm font-medium text-[var(--color-text-secondary)]">Between-Paragraph Spacing</label>
                                    <span className="text-sm font-mono text-[var(--color-text-tertiary)]">{typographySettings.paragraphSpacing.toFixed(2)}em</span>
                                </div>
                                <input
                                    id="paragraphSpacing"
                                    type="range"
                                    min="0.2"
                                    max="1.5"
                                    step="0.05"
                                    value={typographySettings.paragraphSpacing}
                                    onChange={e => onSetTypographySettings({ ...typographySettings, paragraphSpacing: parseFloat(e.target.value) })}
                                    className="w-full h-2 bg-[var(--color-element-primary)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent-primary)]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-md font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border-primary)] pb-2">Default Import Formatting</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Choose the default font family and size for content imported from documents or pasted into new projects.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="defaultFontFamily" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Font Family</label>
                                <select
                                    id="defaultFontFamily"
                                    value={defaultImportFont.family}
                                    onChange={handleFontFamilyChange}
                                    className="w-full bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
                                >
                                    <option>Arial</option>
                                    <option>Calibri</option>
                                    <option>Times New Roman</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="defaultFontSize" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Font Size</label>
                                <select
                                    id="defaultFontSize"
                                    value={defaultImportFont.size}
                                    onChange={handleFontSizeChange}
                                    className="w-full bg-[var(--color-bg-tertiary)] p-2.5 rounded-lg border border-[var(--color-border-secondary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
                                >
                                    {Object.entries(FONT_SIZE_MAP).map(([size, label]) => (
                                        <option key={size} value={size}>{label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-md font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border-primary)] pb-2">Composition Mode Background</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Choose the background color for the distraction-free composition mode to suit your writing mood.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {COMPOSITION_THEMES.map(theme => (
                                <button
                                    key={theme.id}
                                    onClick={() => onSetCompositionTheme(theme.id)}
                                    className={`p-4 rounded-lg text-left transition-all duration-200 border-2 ${compositionTheme === theme.id ? 'ring-2 ring-offset-2 ring-[var(--color-ring)] ring-offset-[var(--color-bg-secondary)] border-transparent' : 'border-[var(--color-border-secondary)] hover:border-[var(--color-ring)]'}`}
                                >
                                    <div style={{ backgroundColor: theme.bg, borderColor: theme.border }} className="w-full h-10 rounded-md border mb-2"></div>
                                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{theme.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-md font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border-primary)] pb-2">Desktop Background</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Upload a custom background image for the desktop view. Recommended size: 1920x1080px.
                        </p>
                        <div className="flex items-center space-x-4">
                            {desktopBackground && (
                                <img src={desktopBackground} alt="Background preview" className="w-24 h-14 object-cover rounded-md border border-[var(--color-border-primary)] flex-shrink-0" />
                            )}
                            <div className="flex-grow flex items-center space-x-2">
                                <input type="file" accept="image/*" ref={bgUploadRef} onChange={handleBgUpload} className="hidden" />
                                <button onClick={() => bgUploadRef.current?.click()} className="flex-1 px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)]">
                                    Upload Image
                                </button>
                                {desktopBackground && (
                                    <button onClick={onClearDesktopBackground} className="flex-1 px-4 py-2 text-sm font-semibold bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] rounded-lg hover:opacity-80">
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-md font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border-primary)] pb-2">Account</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Sign out of your current session. You will be returned to the login screen.
                        </p>
                        <button onClick={onLogout} className="w-full flex items-center justify-center px-4 py-2 text-sm font-semibold bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] rounded-lg hover:opacity-80 transition-opacity">
                            <LogOutIcon className="w-4 h-4 mr-2" />
                            Logout
                        </button>
                    </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t border-[var(--color-border-primary)] flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold bg-[var(--color-element-primary)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-element-primary-hover)]">Close</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;