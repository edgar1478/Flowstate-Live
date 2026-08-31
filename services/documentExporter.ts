import { Packer, Document, Paragraph, TextRun, IRunOptions, HeadingLevel, AlignmentType } from 'docx';
import { Card } from '../types';
import { htmlToPlainText } from './documentParser';

const saveFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportToTxt = (cards: Card[], indentStyle: 'block' | 'first-line', projectName: string) => {
    const separator = '\n\n';
    const content = cards.map(card => htmlToPlainText(card.content)).join(separator);
    const blob = new Blob([content], { type: 'text/plain' });
    saveFile(blob, `${projectName}.txt`);
};

const generateRunsRecursive = (node: Node, style: IRunOptions = {}): TextRun[] => {
    const runs: TextRun[] = [];

    if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) {
            runs.push(new TextRun({ text: node.textContent, ...style }));
        }
        return runs;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        let newStyle = { ...style };
        switch(el.tagName.toLowerCase()) {
            case 'b': case 'strong': newStyle.bold = true; break;
            case 'i': case 'em': newStyle.italics = true; break;
            // Add more inline styles here if needed (e.g., u for underline)
        }
        
        for (const child of Array.from(el.childNodes)) {
            runs.push(...generateRunsRecursive(child, newStyle));
        }
        return runs;
    }
    return [];
};


export const exportToDocx = async (cards: Card[], indentStyle: 'block' | 'first-line', projectName: string) => {
    const paragraphs: Paragraph[] = [];
    const combinedHtml = cards.map(c => c.content).join('');
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(`<body>${combinedHtml}</body>`, 'text/html');
    
    // Read dynamic typography settings from CSS variables
    const rootStyle = getComputedStyle(document.documentElement);
    const paragraphSpacingStr = rootStyle.getPropertyValue('--spacing-paragraph').trim();
    // Convert em to points (1em approx 12pt), then to DXA (20 DXA per point)
    const paragraphSpacingEm = parseFloat(paragraphSpacingStr) || 0.8;
    const spacingAfter = Math.round(paragraphSpacingEm * 12 * 20); // em -> pt -> DXA

    const generateDocxChildren = (element: HTMLElement): Paragraph[] => {
        const children: Paragraph[] = [];
        
        for (const node of Array.from(element.childNodes)) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            
            const el = node as HTMLElement;
            const tagName = el.tagName.toLowerCase();

            switch (tagName) {
                case 'h1':
                case 'h2':
                case 'h3':
                    children.push(new Paragraph({
                        children: generateRunsRecursive(el),
                        heading: tagName === 'h1' ? HeadingLevel.HEADING_1 : tagName === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
                        spacing: { before: 240, after: 120 },
                    }));
                    break;
                case 'p':
                    children.push(new Paragraph({
                        children: generateRunsRecursive(el),
                        spacing: indentStyle === 'block' ? { after: spacingAfter } : { after: 0 },
                        indent: indentStyle === 'first-line' ? { firstLine: 720 } : undefined,
                    }));
                    break;
                case 'blockquote':
                     children.push(new Paragraph({
                        children: generateRunsRecursive(el),
                        style: "Blockquote",
                    }));
                    break;
                case 'ul':
                case 'ol':
                    for (const li of Array.from(el.querySelectorAll('li'))) {
                        children.push(new Paragraph({
                            children: generateRunsRecursive(li),
                            bullet: tagName === 'ul' ? { level: 0 } : undefined,
                            numbering: tagName === 'ol' ? { reference: 'default-numbering', level: 0 } : undefined,
                        }));
                    }
                    break;
                default:
                    // Handle other block-level elements or just extract text
                    if (el.textContent) {
                         children.push(new Paragraph({
                            children: generateRunsRecursive(el),
                            spacing: indentStyle === 'block' ? { after: spacingAfter } : { after: 0 },
                            indent: indentStyle === 'first-line' ? { firstLine: 720 } : undefined,
                        }));
                    }
            }
        }
        return children;
    }

    const doc = new Document({
        numbering: {
            config: [
                {
                    reference: "default-numbering",
                    levels: [
                        {
                            level: 0,
                            format: "decimal",
                            text: "%1.",
                            alignment: AlignmentType.START,
                            style: {
                                paragraph: {
                                    indent: { left: 720, hanging: 360 },
                                }
                            }
                        },
                    ],
                },
            ],
        },
        styles: {
            paragraphStyles: [
                {
                    id: "Blockquote",
                    name: "Blockquote",
                    basedOn: "Normal",
                    next: "Normal",
                    run: {
                        italics: true,
                        color: "595959",
                    },
                    paragraph: {
                        indent: { left: 720 },
                        spacing: { before: 100, after: 100 },
                        border: {
                            left: {
                                color: "auto",
                                space: 4,
                                style: "single",
                                size: 6,
                            },
                        },
                    },
                },
            ],
        },
        sections: [{
            properties: {},
            children: generateDocxChildren(htmlDoc.body),
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveFile(blob, `${projectName}.docx`);
};