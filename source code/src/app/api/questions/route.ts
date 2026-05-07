import { getAuthSession } from "@/lib/nextauth";
import { getQuestionsSchema } from "@/schemas/questions";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { generateQuestions } from "@/lib/questionGenerator";

export const runtime = "nodejs";
export const maxDuration = 500;

export async function POST(req: Request) {
  try {
    // Check if the user is authenticated
    // const session = await getAuthSession();
    // if (!session?.user) {
    //   return NextResponse.json(
    //     { error: "You must be logged in to create a game." },
    //     { status: 401 }
    //   );
    // }

    // Parse and validate the request body
    const body = await req.json();
    const { amount, topic, type, difficulty } = getQuestionsSchema.parse(body);

    // Generate the questions based on type, topic, and difficulty
    const questions = await generateQuestions({
      amount,
      topic,
      type,
      difficulty,
    });
    return NextResponse.json({ questions }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    } else {
      console.error("Google Generative AI error:", error);
      return NextResponse.json(
        { error: "An unexpected error occurred." },
        { status: 500 }
      );
    }
  }
}
