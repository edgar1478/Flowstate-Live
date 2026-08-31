import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import DOMPurify from 'dompurify';

// Set the worker source for pdf.js. This is crucial for it to work in a browser environment.
// The URL is sourced from the import map in index.html.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs';

/**
 * Parses the content of a file (.txt, .docx, .pdf) and returns it as a single string.
 * @param file The file to parse.
 * @returns A promise that resolves with the text content of the file.
 */
export const parseDocument = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'txt') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = () => reject(new Error('Error reading text file.'));
            reader.readAsText(file);
        });
    }

    if (extension === 'docx') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    resolve(result.value);
                } catch (err) {
                    reject(new Error('Error parsing .docx file. It might be corrupted or in an unsupported format.'));
                }
            };
            reader.onerror = () => reject(new Error('Error reading .docx file.'));
            reader.readAsArrayBuffer(file);
        });
    }

    if (extension === 'pdf') {
         return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        // Join text items with a space. This is a simple text extraction.
                        const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
                        fullText += pageText + '\n\n'; // Add double newline between pages to signify a break
                    }
                    resolve(fullText);
                } catch (err) {
                    reject(new Error('Error parsing .pdf file. It may be encrypted or corrupted.'));
                }
            };
             reader.onerror = () => reject(new Error('Error reading .pdf file.'));
            reader.readAsArrayBuffer(file);
        });
    }

    return Promise.reject(new Error('Unsupported file type. Please use .txt, .docx, or .pdf.'));
};

/**
 * Strips HTML tags from a string to return plain text.
 * @param html The HTML string.
 * @returns The plain text content.
 */
export const htmlToPlainText = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
};

// Helper for escaping HTML, used by formatting functions below
const escapeHTML = (str: string) => {
    const p = document.createElement("p");
    p.textContent = str;
    return p.innerHTML;
};

/**
 * Wraps plain text in default paragraph and font tags for a new card.
 * @param plainText The plain text to format.
 * @param fontFamily The font family.
 * @param fontSize The font size (HTML size attribute '1'-'7').
 * @returns An HTML string.
 */
export const formatNewCardContent = (plainText: string, fontFamily: string, fontSize: string): string => {
    const escapedText = escapeHTML(plainText);
    // If plaintext is empty, we need a <br> to make the paragraph editable.
    if (escapedText.trim() === '') {
        return `<p><font face="${fontFamily}" size="${fontSize}"><br></font></p>`;
    }
    return `<p><font face="${fontFamily}" size="${fontSize}">${escapedText}</font></p>`;
};

/**
 * Formats multi-paragraph plain text from AI into styled HTML.
 * @param plainText The plain text from the AI, with paragraphs separated by double newlines.
 * @param fontFamily The font family.
 * @param fontSize The font size (HTML size attribute '1'-'7').
 * @returns An HTML string with each paragraph correctly formatted.
 */
export const formatAIGeneratedContent = (plainText: string, fontFamily: string, fontSize: string): string => {
    const paragraphs = plainText.trim().split(/\r?\n\n+/);
    return paragraphs.map(p => {
        const trimmed = p.trim();
        if (trimmed === '') {
            return `<p><font face="${fontFamily}" size="${fontSize}"><br></font></p>`;
        }
        const escapedText = escapeHTML(trimmed);
        return `<p><font face="${fontFamily}" size="${fontSize}">${escapedText}</font></p>`;
    }).join('');
};

/**
 * Sanitizes an HTML string using DOMPurify and returns an object suitable for `dangerouslySetInnerHTML`.
 * It ensures that empty content renders as a non-collapsing paragraph with a placeholder.
 * @param html The HTML string to sanitize.
 * @returns An object with a sanitized `__html` property.
 */
export const createSanitizedMarkup = (html: string | null | undefined): { __html: string } => {
    const content = (html || '').trim() === '' ? '<p>&nbsp;</p>' : html;
    return { __html: DOMPurify.sanitize(content) };
};
