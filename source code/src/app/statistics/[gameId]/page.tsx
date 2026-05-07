import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getAuthSession } from "@/lib/nextauth";
import { LucideLayoutDashboard } from "lucide-react";
import Link from "next/link";

import { redirect } from "next/navigation";
import React from "react";
import ResultsCard from "@/components/statistics/ResultsCard";
import AccuracyCard from "@/components/statistics/AccuracyCard";
import TimeTakenCard from "@/components/statistics/TimeTakenCard";
import QuestionsList from "@/components/statistics/QuestionsList";

type Props = {
  params: {
    gameId: string;
  };
};

const Statistics = async ({ params: { gameId } }: Props) => {
  const session = await getAuthSession();
  if (!session?.user) {
    return redirect("/");
  }
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { questions: true },
  });
  if (!game) {
    return redirect("/");
  }

  let accuracy: number = 0;
  const totalQuestions = game.questions.length;
  let correctCount = 0;
  let wrongCount = 0;
  let averageSimilarity = 0;

  if (game.gameType === "mcq") {
    correctCount = game.questions.reduce((acc, question) => {
      if (question.isCorrect) {
        return acc + 1;
      }
      return acc;
    }, 0);
    wrongCount = totalQuestions - correctCount;
    accuracy = (correctCount / totalQuestions) * 100;
  } else if (game.gameType === "open_ended") {
    const totalPercentage = game.questions.reduce((acc, question) => {
      return acc + (question.percentageCorrect ?? 0);
    }, 0);
    averageSimilarity = totalPercentage / totalQuestions;
    accuracy = averageSimilarity;
  }
  accuracy = Math.round(accuracy * 100) / 100;
  averageSimilarity = Math.round(averageSimilarity * 100) / 100;

  const suggestion =
    accuracy < 40
      ? "easy"
      : accuracy < 70
      ? "medium"
      : "hard";

  return (
    <>
      <div className="p-8 mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Summary</h2>
            <p className="mt-1 text-sm text-slate-400">
              Review your quiz performance and correct answers below.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/dashboard" className={buttonVariants()}>
              <LucideLayoutDashboard className="mr-2" />
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-4 mt-6 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
              Total Questions
            </p>
            <p className="mt-3 text-4xl font-semibold text-white">{totalQuestions}</p>
          </div>
          {game.gameType === "mcq" ? (
            <>
              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                  Correct Answers
                </p>
                <p className="mt-3 text-4xl font-semibold text-emerald-400">
                  {correctCount}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-sm">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                  Wrong Answers
                </p>
                <p className="mt-3 text-4xl font-semibold text-rose-400">
                  {wrongCount}
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-sm md:col-span-2">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                Average similarity
              </p>
              <p className="mt-3 text-4xl font-semibold text-cyan-300">
                {averageSimilarity}%
              </p>
              <p className="mt-2 text-sm text-slate-400">
                How closely your answers matched the expected responses.
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-4 mt-6 md:grid-cols-7">
          <ResultsCard accuracy={accuracy} />
          <AccuracyCard accuracy={accuracy} />
          <TimeTakenCard
            timeEnded={new Date(game.timeEnded ?? 0)}
            timeStarted={new Date(game.timeStarted ?? 0)}
          />
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 mt-6">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            Recommended next difficulty
          </p>
          <p className="mt-3 text-3xl font-semibold text-white capitalize">
            Try {suggestion} next
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Based on your score, {suggestion} difficulty is the best next step.
          </p>
        </div>
        <QuestionsList questions={game.questions} />
      </div>
    </>
  );
};

export default Statistics;
