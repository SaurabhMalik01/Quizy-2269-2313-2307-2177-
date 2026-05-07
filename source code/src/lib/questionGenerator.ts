import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Please add it to your environment variables."
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0,
      topP: 0.95,
    },
  });
}

function stripCodeFence(text: string): string {
  const codeFenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = text.match(codeFenceRegex);
  return match ? match[1] : text;
}

function extractFirstJsonArray(text: string): string {
  const start = text.indexOf("[");
  if (start === -1) {
    throw new Error("Unable to parse AI response: no JSON array found.");
  }

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "[") {
      depth += 1;
    } else if (text[i] === "]") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new Error("Unable to parse AI response: unmatched JSON array brackets.");
}

function parseJsonArray(rawText: string): any {
  const cleaned = stripCodeFence(rawText).trim();
  const jsonText = extractFirstJsonArray(cleaned);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      `Unable to parse AI response as JSON array. Response excerpt: ${JSON.stringify(
        cleaned.slice(0, 500)
      )}. Parse error: ${error}`
    );
  }
}

const mcqSchema = z.object({
  question: z.string(),
  answer: z.string(),
  options: z.array(z.string()).length(4),
});

const openEndedSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export async function generateQuestions({
  amount,
  topic,
  type,
  difficulty,
}: {
  amount: number;
  topic: string;
  type: string;
  difficulty: string;
}): Promise<any[]> {
  const difficultyDescription =
    difficulty === "easy"
      ? "simple and introductory, suitable for beginners"
      : difficulty === "hard"
      ? "challenging and advanced, requiring deeper reasoning"
      : "moderately challenging, testing solid understanding";

  const typeDescription =
    type === "open_ended"
      ? "open-ended questions with a short answer"
      : "multiple-choice questions with four answer options";

  const basePrompt = `Generate exactly ${amount} ${typeDescription} about the topic \"${topic}\" using Bloom's Taxonomy. Each question should be ${difficultyDescription}. Each answer must be 15 words or less.`;

  const formatHint =
    type === "open_ended"
      ? `Return only a JSON array with this schema:\n[\n  {\"question\":\"...\", \"answer\":\"...\"}\n]`
      : `Return only a JSON array with this schema:\n[\n  {\"question\":\"...\", \"answer\":\"...\", \"options\": [\"...\", \"...\", \"...\", \"...\"]}\n]`;

  const prompt = `${basePrompt}\n\n${formatHint}\n\nDo not include markdown fences, explanations, or extra text.`;

  const model = getModel();
  const result = await model.generateContent(prompt);
  const responseText = await result.response.text();

  const questions = parseJsonArray(responseText);

  const validated =
    type === "open_ended"
      ? openEndedSchema.array().parse(questions)
      : mcqSchema.array().parse(questions);

  if (!Array.isArray(validated) || validated.length === 0) {
    throw new Error("AI returned no questions.");
  }

  return validated;
}
