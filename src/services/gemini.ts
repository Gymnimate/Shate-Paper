import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface StudySheetContent {
  title: string;
  explanation: string;
  exercises: {
    question: string;
    type: 'multiple-choice' | 'open-ended' | 'true-false';
    options?: string[];
  }[];
  practiceIdeas: string[];
}

export interface StudyAnalysis {
  subtopics: string[];
  suggestedFocus: string;
}

export async function analyzeTopic(topic: string, files?: { data: string, mimeType: string }[]): Promise<StudyAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `Jsi analytik vzdělávacího obsahu. Tvým úkolem je analyzovat téma a podklady od uživatele a navrhnout 4-6 konkrétních podtémat (kategorií), které by měl studijní materiál pokrýt.
  Odpovídej VŽDY v JSON formátu: { "subtopics": ["podtéma 1", "podtéma 2", ...], "suggestedFocus": "stručné doporučení na co se zaměřit" }.
  Odpovídej v ČEŠTINĚ.`;

  const contents: any[] = [{ text: `Téma/Podklady k analýze: ${topic}` }];
  
  if (files && files.length > 0) {
    files.forEach(file => {
      contents.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data.split(',')[1]
        }
      });
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    return { subtopics: ["Základní koncepty", "Příklady z praxe", "Časté chyby"], suggestedFocus: "Analýza se nezdařila, použity výchozí kategorie." };
  }
}

export async function generateStudyMaterial(
  topic: string, 
  selectedSubtopics: string[], 
  detailLevel: string,
  files?: { data: string, mimeType: string }[]
): Promise<string[]> {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `Jsi světový expert na pedagogiku a tvorbu učebnic. Tvým úkolem je vytvořit MITEXT (Mimořádně Interaktivní TEXT) na téma: ${topic}.
  
  Úroveň detailu: ${detailLevel} (úrovně: simple, standard, detailed).
  Zaměř se na tato podtémata: ${selectedSubtopics.join(', ')}.

  POKYNY PRO OBSAH:
  1. Vysvětluj jako úplnému začátečníkovi. Používej analogie, barvité popisy a jasné příklady.
  2. Pokud jde o vědu (chemie, matematika), VŽDY ukaž POSTUP KROK ZA KROKEM. Např. u názvosloví ukaž: "Krok 1: Urči oxidační číslo...", "Krok 2: ...".
  3. POUŽÍVEJ TABULKY (Markdown syntaxe |...|) pro přehledné srovnání nebo seznamy.
  4. Všechny vzorce musí být v LaTeX ($...$ nebo $$...$$).
  5. ROZSAH STRÁNKY: Jedna stránka formátu A4 pojme cca 500-700 slov. Pokud je textu více, VŽDY vlož značku ---PAGE_BREAK--- a pokračuj na další stránce. Nikdy nepoužívej extrémně dlouhé bloky textu na jedné stránce.
  6. Materiál musí obsahovat:
     - Teoretický výklad s názornými ukázkami a tabulkami.
     - "Proč je to důležité?" sekce.
     - Cvičení (interaktivní prvky) s řešením (na konci stránky nebo v textu).
     - Tahák (klíčové body).

  ODPOVÍDEJ V ČEŠTINĚ. Nepoužívej úvodní/závěrečné zdvořilosti.`;

  const contents: any[] = [{ text: `Vytvoř materiál pro téma ${topic} s důrazem na ${selectedSubtopics.join(' a ')}.` }];
  
  if (files && files.length > 0) {
    files.forEach(file => {
      contents.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data.split(',')[1]
        }
      });
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      temperature: 0.8,
    },
  });

  const fullText = response.text || "";
  return fullText.split('---PAGE_BREAK---').map(p => p.trim()).filter(p => p.length > 0);
}
