import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getEmergencyGuidance(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are an emergency survival assistant for cyclone after-effects. 
        Provide clear, concise, and actionable advice. 
        Focus on:
        - Immediate safety (structural integrity, electrical hazards, water safety).
        - First aid for common storm injuries.
        - Finding resources (water, food, medical).
        - Mental health support.
        Keep responses short and use bullet points for readability.`,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm sorry, I'm having trouble connecting to my emergency database. Please stay calm and follow local authority instructions.";
  }
}
