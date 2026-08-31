import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelName = 'gemini-2.5-flash';

interface RephraseResponse {
    alternatives: string[];
}

interface SynonymsResponse {
    synonyms: string[];
}

export interface CritiqueTip {
    title: string;
    tip: string;
    example?: string;
}

interface CritiqueResponse {
    critique: CritiqueTip[];
}

interface ContextualGenerationResponse {
  alternatives: string[];
}

export interface ProofreadSuggestion {
    original_text: string;
    suggested_text: string;
    explanation: string;
    error_type: string;
}

interface ProofreadResponse {
    suggestions: ProofreadSuggestion[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}


const STYLE_INSTRUCTIONS: { [key: string]: string } = {
  // General
  simplify: "Rewrite the text to be simpler and easier to understand. Use shorter sentences, common vocabulary, and a more direct style. Target a general audience.",
  formal: "Adopt a formal tone. Use professional language, avoid contractions and slang, and maintain a serious, respectful style.",
  casual: "Adopt a casual, conversational tone. Use contractions, simpler language, and a friendly, approachable style, as if speaking to a friend.",
  confident: "Rewrite with a confident and assertive tone. Use strong, direct language and avoid hedging or uncertain phrases.",
  shorten: "Condense the text significantly while preserving the core message. Be concise and remove any unnecessary words or sentences.",
  expand: "Expand on the provided text. Add more detail, examples, or elaboration to make the point more thoroughly. Flesh out the ideas.",
  
  // Creative
  descriptive: "Enhance the text with vivid sensory details. Focus on showing, not telling, by adding descriptions of sight, sound, smell, taste, and touch to create a more immersive experience.",
  tense: "Increase the tension and suspense. Use shorter, more impactful sentences, stronger verbs, and a sense of urgency or impending danger.",
  poetic: "Rewrite with a more poetic or lyrical quality. Use figurative language like metaphors and similes, and pay attention to the rhythm and flow of the words.",

  // Professional
  professional: "Adopt a business-professional tone suitable for corporate communication. The language should be clear, concise, and respectful.",
  persuasive: "Strengthen the text to be more persuasive and convincing. Use rhetorical devices, stronger arguments, and a compelling tone to influence the reader.",
  diplomatic: "Rewrite with a diplomatic tone. The language should be polite, tactful, and careful to avoid causing offense, especially when dealing with sensitive topics.",

  // Social Media
  linkedin: "Adapt the text for a LinkedIn post. Use a professional but engaging tone. Structure it for scannability, possibly using bullet points or numbered lists. Include relevant professional hashtags.",
  twitter: "Adapt the text for a platform like Twitter/X. Keep it concise and punchy (under 280 characters if possible). Use a casual tone, relevant emojis, and popular hashtags to increase engagement."
};

const synonymsResponseSchema = {
    type: Type.OBJECT,
    properties: {
        synonyms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of synonyms."
        }
    },
    required: ["synonyms"]
};

const critiqueResponseSchema = {
    type: Type.OBJECT,
    properties: {
        critique: {
            type: Type.ARRAY,
            description: "A list of writing tips and critiques.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: {
                        type: Type.STRING,
                        description: "The title of the writing tip (e.g., 'Clarity', 'Tone')."
                    },
                    tip: {
                        type: Type.STRING,
                        description: "The instructive feedback or tip."
                    },
                    example: {
                        type: Type.STRING,
                        description: "An optional example illustrating the tip."
                    }
                },
                required: ["title", "tip"]
            }
        }
    },
    required: ["critique"]
};

const proofreadResponseSchema = {
    type: Type.OBJECT,
    properties: {
        suggestions: {
            type: Type.ARRAY,
            description: "A list of proofreading suggestions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    original_text: {
                        type: Type.STRING,
                        description: "The exact segment of text that contains the error."
                    },
                    suggested_text: {
                        type: Type.STRING,
                        description: "The corrected version of the text segment."
                    },
                    explanation: {
                        type: Type.STRING,
                        description: "A brief, clear explanation of the error and the correction."
                    },
                    error_type: {
                        type: Type.STRING,
                        description: "The category of the error (e.g., 'Spelling', 'Grammar', 'Punctuation', 'Verb Tense')."
                    }
                },
                required: ["original_text", "suggested_text", "explanation", "error_type"]
            }
        }
    },
    required: ["suggestions"]
};


export const rephraseText = async (
    originalText: string,
    instructions: string,
    style: string | null,
    styleMimicFile: { content: string; type: string } | null,
    numAlternatives: number
): Promise<string[]> => {
    let prompt = `You are an expert editor. Rephrase the text below.
CRITICAL RULE: Preserve the paragraph structure. If the original text has multiple paragraphs (separated by a double newline), your rephrased output must have the same number of paragraphs.`;

    if (style && STYLE_INSTRUCTIONS[style]) {
        prompt += `\n\nSTYLE GUIDELINE:\n${STYLE_INSTRUCTIONS[style]}`;
    }

    if (instructions) {
        prompt += `\n\nADDITIONAL USER INSTRUCTIONS:\n${instructions}`;
    }

    if (styleMimicFile) {
        prompt += `\n\nMIMIC THE WRITING STYLE OF THIS DOCUMENT:\n---\n${styleMimicFile.content}\n---`;
    }

    prompt += `\n\nTEXT TO REPHRASE:\n---\n${originalText}\n---`;
    
    // Create a dynamic schema to guide the model on the number of alternatives
    const dynamicRephraseSchema = {
        type: Type.OBJECT,
        properties: {
            alternatives: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: `A list of exactly ${numAlternatives} distinct rephrased versions of the original text.`
            }
        },
        required: ["alternatives"]
    };

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: dynamicRephraseSchema,
            },
        });

        const jsonText = response.text;
        const parsed: RephraseResponse = JSON.parse(jsonText);
        return parsed.alternatives || [];
    } catch (error) {
        console.error("Error rephrasing text:", error);
        throw new Error("Failed to generate rephrased text. Please check the console for details.");
    }
};

export const findSynonyms = async (term: string): Promise<string[]> => {
    const prompt = `Provide a list of contextually appropriate synonyms for the following word or short phrase, suitable for general writing: "${term}"`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: synonymsResponseSchema,
            },
        });
        
        const jsonText = response.text;
        const parsed: SynonymsResponse = JSON.parse(jsonText);
        return parsed.synonyms || [];
    } catch (error) {
        console.error("Error finding synonyms:", error);
        throw new Error("Failed to find synonyms. Please check the console for details.");
    }
};


export const getWritingCritique = async (textToCritique: string): Promise<CritiqueTip[]> => {
    const prompt = `Provide writing tips and a critique for the following text. The feedback should be based on contemporary best practices from authoritative sources like the Chicago Manual of Style or Strunk & White's "The Elements of Style", but presented in a very friendly, encouraging, and easy-to-understand style, as if for a "Writing for Dummies" book. Focus on actionable advice.
IMPORTANT FORMATTING RULE: For any text that might have multiple paragraphs (like in the 'tip' or 'example' fields), you MUST use double newlines to separate them. This ensures they are displayed correctly as paragraphs.

Text to critique:
---
${textToCritique}
---

Please format your response as a JSON object that adheres to the provided schema. Provide at least 3 distinct tips.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: critiqueResponseSchema,
            },
        });
        
        const jsonText = response.text;
        const parsed: CritiqueResponse = JSON.parse(jsonText);
        return parsed.critique || [];
    } catch (error) {
        console.error("Error getting writing critique:", error);
        throw new Error("Failed to generate writing critique. Please check the console for details.");
    }
};

export const generateContextualText = async (
    prompt: string,
    contextBefore: string,
    contextAfter: string,
    numAlternatives: number
): Promise<string[]> => {
    const alternativesCountText = numAlternatives === 1 ? `Provide exactly one version.` : `Provide exactly ${numAlternatives} distinct versions.`;

    // Dynamically build the core instruction based on context availability.
    let coreInstruction = '';
    if (contextBefore.trim() && contextAfter.trim()) {
        coreInstruction = "Your task is to generate a passage that acts as a perfect narrative bridge between 'PRECEDING TEXT' and 'FOLLOWING TEXT', based on the user's 'INSTRUCTION'.";
    } else if (contextBefore.trim()) {
        coreInstruction = "Your task is to generate a passage that seamlessly follows the 'PRECEDING TEXT', based on the user's 'INSTRUCTION'.";
    } else if (contextAfter.trim()) {
        coreInstruction = "Your task is to generate a passage that serves as a natural lead-in to the 'FOLLOWING TEXT', based on the user's 'INSTRUCTION'.";
    } else {
        coreInstruction = "Your task is to generate a passage based on the user's 'INSTRUCTION'.";
    }

    const fullPrompt = `You are an expert writing assistant, specializing in creating smooth, coherent narratives. ${coreInstruction}

CRITICALLY IMPORTANT RULES:
1. **Seamless Connection**: The generated text must create a seamless and logical connection. It must perfectly match the overall tone, style, and narrative voice of any surrounding text provided.
2. **Derive Narrative Style from Context**: The point of view (e.g., first-person 'I', third-person 'he/she'), tense, and overall narrative voice MUST be derived from the available context ('PRECEDING TEXT' and/or 'FOLLOWING TEXT'). Treat the user's 'INSTRUCTION' as a guideline for **content only**. If the grammatical style of the instruction conflicts with the context, you MUST ignore the instruction's style and adhere to the context's style.
3. **Avoid Redundancy**: If 'FOLLOWING TEXT' is provided, analyze it with extreme care. Your generated passage MUST NOT repeat significant words, phrases, or concepts that appear in it. The goal is to lead into the 'FOLLOWING TEXT' so the entire piece flows naturally.
4. **Output Content Only**: Do not include any of the context text or any meta-commentary in your output.
5. **Paragraph Formatting**: Ensure that paragraph breaks (double newlines) are used where appropriate to structure the text logically, especially if the user's instruction implies multiple paragraphs. The output should be well-formatted and readable.

${alternativesCountText}

[PRECEDING TEXT]:
---
${contextBefore}
---

[FOLLOWING TEXT]:
---
${contextAfter}
---

[INSTRUCTION FOR THE GENERATED PASSAGE]:
---
${prompt}
---

Please format your response as a JSON object that adheres to the provided schema.`;

    const dynamicContextualSchema = {
        type: Type.OBJECT,
        properties: {
            alternatives: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: `A list of exactly ${numAlternatives} distinct versions of the generated passage. Each version must fully satisfy the user's instruction (e.g., if asked for two paragraphs, each alternative must contain two paragraphs).`
            }
        },
        required: ["alternatives"]
    };

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: dynamicContextualSchema,
            },
        });
        
        const jsonText = response.text;
        const parsed: ContextualGenerationResponse = JSON.parse(jsonText);
        return parsed.alternatives || [];
    } catch (error) {
        console.error("Error generating contextual text:", error);
        throw new Error("Failed to generate contextual text. Please check the console for details.");
    }
};

export const improveTextInContext = async ({
    textToImprove,
    instructions,
    contextBefore,
    contextAfter,
    numAlternatives,
}: {
    textToImprove: string;
    instructions: string;
    contextBefore: string;
    contextAfter: string;
    numAlternatives: number;
}): Promise<string[]> => {
    const alternativesCountText = numAlternatives === 1 ? "Generate one distinct, improved alternative." : `Generate ${numAlternatives} distinct, improved alternatives.`;
    
    // Dynamically build the core instruction based on context availability.
    let coreInstruction = '';
    if (contextBefore.trim() && contextAfter.trim()) {
        coreInstruction = "Your task is to rewrite and improve the 'TEXT TO IMPROVE' so it fits perfectly as a narrative bridge between 'PRECEDING TEXT' and 'FOLLOWING TEXT'.";
    } else if (contextBefore.trim()) {
        coreInstruction = "Your task is to rewrite and improve the 'TEXT TO IMPROVE' so it seamlessly follows the 'PRECEDING TEXT'.";
    } else if (contextAfter.trim()) {
        coreInstruction = "Your task is to rewrite and improve the 'TEXT TO IMPROVE' so it serves as a natural lead-in to the 'FOLLOWING TEXT'.";
    } else {
        coreInstruction = "Your task is to rewrite and improve the 'TEXT TO IMPROVE' based on the user's 'INSTRUCTIONS'.";
    }

    const fullPrompt = `You are an expert writing editor. ${coreInstruction}

Your rewritten version must adhere to these CRITICAL rules:
1. **Follow Instructions**: It must follow the user's 'INSTRUCTIONS' for the content and direction of the improvement.
2. **Seamless Connection**: It must create a seamless and logical connection, perfectly matching the overall tone, style, and narrative flow of any surrounding text provided.
3. **Derive Narrative Style from Context**: The point of view (e.g., first-person 'I', third-person 'he/she'), tense, and overall narrative voice MUST be derived from the available context ('PRECEDING TEXT' and/or 'FOLLOWING TEXT'). Treat the user's 'INSTRUCTIONS' as a guideline for **content only**. If the grammatical style of the instructions conflicts with the context, you MUST ignore the instruction's style and adhere to the context's style.
4. **Avoid Redundancy**: If 'FOLLOWING TEXT' is provided, analyze it with extreme care. Your rewritten passage must lead into it naturally and MUST NOT repeat words or phrases that would make the 'FOLLOWING TEXT' feel repetitive.
5. **Output Content Only**: Do not include any of the context text or any meta-commentary in your output.
6. **Paragraph Formatting**: Preserve or create appropriate paragraph breaks (double newlines) to ensure the output is well-formatted and readable.

${alternativesCountText}

[PRECEDING TEXT]:
---
${contextBefore}
---

[FOLLOWING TEXT]:
---
${contextAfter}
---

[TEXT TO IMPROVE]:
---
${textToImprove}
---

[INSTRUCTIONS]:
---
${instructions || "Improve for clarity, flow, and impact."}
---

Please format your response as a JSON object that adheres to the provided schema.`;

    const dynamicContextualSchema = {
        type: Type.OBJECT,
        properties: {
            alternatives: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: `A list of exactly ${numAlternatives} distinct, improved alternatives. Each alternative should be a complete passage.`
            }
        },
        required: ["alternatives"]
    };

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: fullPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: dynamicContextualSchema,
            },
        });
        
        const jsonText = response.text;
        const parsed: ContextualGenerationResponse = JSON.parse(jsonText);
        return parsed.alternatives || [];
    } catch (error) {
        console.error("Error improving contextual text:", error);
        throw new Error("Failed to improve contextual text. Please check the console for details.");
    }
};

export const proofreadText = async (textToProofread: string): Promise<ProofreadSuggestion[]> => {
    const prompt = `Please act as an expert proofreader. Analyze the following text for errors in grammar, spelling, punctuation, verb tense consistency, and awkward phrasing. For each error you find, provide the original text segment, a corrected suggestion, a brief explanation of the correction, and the type of error.
IMPORTANT FORMATTING RULE: For the 'explanation' field, if it contains multiple paragraphs, you MUST use double newlines to separate them.

Text to proofread:
---
${textToProofread}
---

Please format your response as a JSON object that adheres to the provided schema. If there are no errors, return an empty array for "suggestions".`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: proofreadResponseSchema,
            },
        });
        
        const jsonText = response.text;
        const parsed: ProofreadResponse = JSON.parse(jsonText);
        return parsed.suggestions || [];
    } catch (error) {
        console.error("Error proofreading text:", error);
        throw new Error("Failed to generate proofreading suggestions. Please check the console for details.");
    }
};

export const queryDocument = async (documentText: string, userQuery: string): Promise<string> => {
    const prompt = `You are a world-class literary analyst and writing coach. A user has provided you with their full document and a specific question about it. Your task is to provide a thoughtful, constructive, and detailed answer to their question, based on the provided text.
IMPORTANT FORMATTING RULE: Your answer will be rendered as Markdown. Please use double newlines to separate paragraphs for proper formatting.

[DOCUMENT TEXT]:
---
${documentText}
---

[USER'S QUESTION]:
---
${userQuery}
---

Please provide your analysis and answer below.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
        });
        
        return response.text;
    } catch (error) {
        console.error("Error querying document:", error);
        throw new Error("Failed to get a response for your query. Please check the console for details.");
    }
};

export const getSceneBuildingQuestion = async (originalCardContent: string, conversationHistory: ChatMessage[]): Promise<string> => {
    const systemInstruction = `You are a creative writing partner. Your goal is to help a writer flesh out a scene by asking evocative, open-ended, sensory questions.
    RULES:
    1. Ask ONLY ONE question per response.
    2. Focus on sensory details: sight, sound, smell, taste, touch, and mood.
    3. Keep your questions concise and encouraging.
    4. Do not write the scene for the user. Your role is to prompt their imagination.
    5. Analyze the conversation history to ask a logical follow-up question. If the user describes what they see, ask about what they hear or smell next.
    6. Your response should ONLY be the question itself, without any conversational filler.`;

    const historyPrompt = conversationHistory.map(msg => `${msg.role === 'user' ? 'USER' : 'AI'}: ${msg.content}`).join('\n');

    const prompt = `
    The writer is working on a scene based on this initial idea: "${originalCardContent}"

    Here is the conversation so far:
    ${historyPrompt}

    What is the next sensory question you will ask?
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                systemInstruction,
            },
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error getting scene building question:", error);
        throw new Error("Failed to get the next question from the AI.");
    }
};

export const synthesizeSceneNotes = (conversation: ChatMessage[]): string => {
    let summary = "\n\n---\n\n### AI Scene-Building Session\n\n";
    conversation.forEach(msg => {
        if (msg.role === 'model') {
            summary += `**${msg.content}**\n`;
        } else {
            summary += `${msg.content}\n\n`;
        }
    });
    return summary;
};
