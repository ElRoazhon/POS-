import { GoogleGenAI, Type, Schema } from "@google/genai";
import { InvoiceItemCandidate } from "../types";

// NOTE: We do not initialize the client at the top level anymore.
// This prevents the "Blue Screen" crash if process.env.API_KEY is undefined on load.

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key is missing in process.env");
    throw new Error("API Key is missing. Please configure 'API_KEY' in your environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

const invoiceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: "List of items found in the invoice or menu.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the product/dish" },
          price: { type: Type.NUMBER, description: "Price of the product" },
          category: { type: Type.STRING, description: "Suggested category (e.g. Boissons, Plats, Entrées, Divers)" }
        },
        required: ["name", "price", "category"]
      }
    },
    total: { type: Type.NUMBER, description: "Total amount if visible" },
    date: { type: Type.STRING, description: "Date of invoice if visible (YYYY-MM-DD)" },
    supplier: { type: Type.STRING, description: "Supplier or Restaurant name" }
  },
  required: ["items"]
};

export const analyzeInvoiceImage = async (base64Image: string): Promise<{ items: InvoiceItemCandidate[], total?: number, date?: string, supplier?: string }> => {
  try {
    // Initialize client here, safely
    const ai = getAiClient();

    // Remove header if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: "Analyze this image. It is a restaurant invoice or menu. Extract all line items with their prices. Suggest a category for each item (e.g., Boissons, Plats, Entrées, Desserts, Matériel, Entretien). Return strictly JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: invoiceSchema,
        systemInstruction: "You are an expert accountant assistant for a restaurant. You extract data from invoices with high precision."
      }
    });

    const text = response.text;
    if (!text) return { items: [] };
    
    const data = JSON.parse(text);
    return data;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Return empty result instead of crashing the UI
    return { items: [] };
  }
};

const labelSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        productName: { type: Type.STRING, description: "Name of the product found on the label" },
        expiryDate: { type: Type.STRING, description: "Expiration date (DLC) if found (DD/MM/YYYY)" },
        quantity: { type: Type.STRING, description: "Quantity or net weight if found" }
    },
    required: ["productName"]
};

export const analyzeTraceabilityLabel = async (base64Image: string) => {
    try {
        const ai = getAiClient();
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
              { text: "Analyze this food product label. Extract the product name, expiry date (DLC), and quantity/weight." }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: labelSchema
          }
        });
    
        const text = response.text;
        if (!text) return null;
        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini Label Analysis Error:", error);
        return null;
    }
};