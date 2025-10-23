import { GoogleGenAI, Type } from "@google/genai";
import type { DiagnosticReport, DTCCodeMeaning } from '../types';

const getCarDiagnostic = async (problemDescription: string, apiKey: string): Promise<DiagnosticReport> => {
    if (!apiKey) {
        throw new Error("API Key is missing. Please provide a valid API key to continue.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are an expert car mechanic AI. Your task is to analyze the user's description of a car problem and provide a detailed diagnosis. 
    If the user provides OBD-II fault codes (e.g., P0300, C0121), prioritize diagnosing based on those codes as they are the most critical data.
    You must respond ONLY with a valid JSON object that adheres to the provided schema. Do not include any introductory text, markdown formatting, or any content outside of the JSON structure.
    - 'likelihood' must be one of 'High', 'Medium', or 'Low'.
    - 'difficulty' must be one of 'Easy', 'Moderate', or 'Hard'.
    - 'estimated_cost' should be a realistic price range in South African Rand (ZAR) (e.g., 'R1500 - R4500').`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            possible_causes: {
                type: Type.ARRAY,
                description: 'A list of potential causes for the described car problem.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        cause: {
                            type: Type.STRING,
                            description: 'A concise description of the possible cause.',
                        },
                        likelihood: {
                            type: Type.STRING,
                            description: 'The likelihood of this being the cause (High, Medium, or Low).',
                            enum: ['High', 'Medium', 'Low'],
                        },
                    },
                    required: ['cause', 'likelihood'],
                },
            },
            recommended_solutions: {
                type: Type.ARRAY,
                description: 'A list of recommended solutions or next steps.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        solution: {
                            type: Type.STRING,
                            description: 'A clear, actionable solution or diagnostic step.',
                        },
                        difficulty: {
                            type: Type.STRING,
                            description: 'The difficulty of implementing the solution (Easy, Moderate, Hard).',
                            enum: ['Easy', 'Moderate', 'Hard'],
                        },
                    },
                    required: ['solution', 'difficulty'],
                },
            },
            estimated_cost: {
                type: Type.STRING,
                description: 'A rough estimate of the potential repair costs in South African Rand (ZAR).',
            },
        },
        required: ['possible_causes', 'recommended_solutions', 'estimated_cost'],
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: problemDescription,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2,
            },
        });

        const jsonText = response.text.trim();
        const diagnosticData: DiagnosticReport = JSON.parse(jsonText);
        return diagnosticData;

    } catch (error) {
        console.error("Error fetching or parsing car diagnostic:", error);
        throw new Error("Failed to get a valid diagnosis from the AI. This could be due to an invalid API key or network issue.");
    }
};

const getDTCMeaning = async (code: string, apiKey: string): Promise<DTCCodeMeaning> => {
    if (!apiKey) {
        throw new Error("API Key is missing. Please provide a valid API key to continue.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are an expert automotive technician AI. Your task is to provide a detailed explanation for the given OBD-II Diagnostic Trouble Code (DTC).
    You must respond ONLY with a valid JSON object that adheres to the provided schema. Do not include any introductory text, markdown formatting, or any content outside of the JSON structure.`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            code: { type: Type.STRING, description: 'The DTC that was provided.' },
            title: { type: Type.STRING, description: 'A short, clear title for the code (e.g., "Misfire Detected").' },
            description: { type: Type.STRING, description: 'A detailed explanation of what the code means.' },
            common_symptoms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'A list of common symptoms associated with this code.'
            },
            possible_causes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'A list of possible causes that could trigger this code.'
            }
        },
        required: ['code', 'title', 'description', 'common_symptoms', 'possible_causes']
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Explain the OBD-II code: ${code}`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.1,
            },
        });
        const jsonText = response.text.trim();
        const meaningData: DTCCodeMeaning = JSON.parse(jsonText);
        return meaningData;
    } catch (error) {
        console.error("Error fetching or parsing DTC meaning:", error);
        throw new Error("Failed to get an explanation. Please check the code format and your API key.");
    }
};

export { getCarDiagnostic, getDTCMeaning };