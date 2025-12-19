import { GoogleGenAI, Type } from "@google/genai";
import { VideoMetadata } from "../types";

const MODEL_NAME = "gemini-2.5-flash-latest"; 

export const generateVideoMetadata = async (fileName: string): Promise<VideoMetadata> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Analyze this video filename: "${fileName}".
  Generate a JSON response with the following fields:
  - title: A clean, professional title.
  - plot: A short, professional synopsis (max 2 sentences).
  - tags: An array of 3-5 relevant genres or categories (e.g., "Action", "Tutorial", "Family").
  Do not guess specifics if unknown, keep it generic but professional.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            plot: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "plot", "tags"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as VideoMetadata;

  } catch (error) {
    console.error("Gemini generation error:", error);
    // Fallback
    return {
      title: fileName,
      plot: "No description available.",
      tags: ["Uncategorized"]
    };
  }
};