"use client";
import { cn, formatTimeDelta } from "@/lib/utils";
import { Game, Question } from "@prisma/client";
import { differenceInSeconds } from "date-fns";
import { BarChart, ChevronRight, Loader2, Timer } from "lucide-react";
import React from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "./ui/button";
import OpenEndedPercentage from "./OpenEndedPercentage";
import BlankAnswerInput from "./BlankAnswerInput";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { checkAnswerSchema, endGameSchema } from "@/schemas/questions";
import axios from "axios";
import { useToast } from "./ui/use-toast";
import Link from "next/link";

type Props = {
  game: Game & { questions: Pick<Question, "id" | "question" | "answer">[] };
};

const OpenEnded = ({ game }: Props) => {
  const [hasEnded, setHasEnded] = React.useState(false);
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [blankAnswer, setBlankAnswer] = React.useState("");
  const [averagePercentage, setAveragePercentage] = React.useState(0);
  const [hasSubmitted, setHasSubmitted] = React.useState(false);
  const [feedback, setFeedback] = React.useState<
    | {
        percentageSimilar: number;
        correctAnswer: string;
        userAnswer: string;
      }
    | null
  >(null);
  const currentQuestion = React.useMemo(() => {
    return game.questions[questionIndex];
  }, [questionIndex, game.questions]);
  const { mutate: endGame } = useMutation({
    mutationFn: async () => {
      const payload: z.infer<typeof endGameSchema> = {
        gameId: game.id,
      };
      const response = await axios.post(`/api/endGame`, payload);
      return response.data;
    },
  });
  const { toast } = useToast();
  const [now, setNow] = React.useState(new Date());
  const [displayStartTime, setDisplayStartTime] = React.useState<Date>(
    game.timeStarted
  );
  const { mutate: checkAnswer, isLoading: isChecking } = useMutation({
    mutationFn: async (userInput: string) => {
      const payload: z.infer<typeof checkAnswerSchema> = {
        questionId: currentQuestion.id,
        userInput,
      };
      const response = await axios.post(`/api/checkAnswer`, payload);
      return response.data;
    },
  });
  React.useEffect(() => {
    if (differenceInSeconds(new Date(), game.timeStarted) > 5) {
      setDisplayStartTime(new Date());
    } else {
      setDisplayStartTime(game.timeStarted);
    }
  }, [game.timeStarted]);

  React.useEffect(() => {
    if (!hasEnded) {
      const interval = setInterval(() => {
        setNow(new Date());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [hasEnded]);

  const handleNext = React.useCallback(() => {
    if (!hasSubmitted) {
      let filledAnswer = blankAnswer;
      document.querySelectorAll("#user-blank-input").forEach((input) => {
        const inputElement = input as HTMLInputElement;
        filledAnswer = filledAnswer.replace("_____", inputElement.value);
      });
      checkAnswer(filledAnswer, {
        onSuccess: ({ percentageSimilar }) => {
          toast({
            title: `Your answer is ${percentageSimilar}% similar to the correct answer`,
          });
          setFeedback({
            percentageSimilar,
            correctAnswer: currentQuestion.answer,
            userAnswer: filledAnswer,
          });
          setHasSubmitted(true);
          setAveragePercentage((prev) => {
            return (prev + percentageSimilar) / (questionIndex + 1);
          });
        },
        onError: (error) => {
          console.error(error);
          toast({
            title: "Something went wrong",
            variant: "destructive",
          });
        },
      });
      return;
    }

    if (questionIndex === game.questions.length - 1) {
      endGame();
      setHasEnded(true);
      return;
    }

    setQuestionIndex((prev) => prev + 1);
    setHasSubmitted(false);
    setFeedback(null);
  }, [blankAnswer, checkAnswer, currentQuestion.answer, endGame, game.questions.length, hasSubmitted, questionIndex, toast]);
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (key === "Enter") {
        handleNext();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleNext]);

  if (hasEnded) {
    return (
      <div className="absolute flex flex-col justify-center -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
        <div className="px-4 py-2 mt-2 font-semibold text-white bg-green-500 rounded-md whitespace-nowrap">
          You Completed in{" "}
          {formatTimeDelta(differenceInSeconds(now, displayStartTime))}
        </div>
        <Link
          href={`/statistics/${game.id}`}
          className={cn(buttonVariants({ size: "lg" }), "mt-2")}
        >
          View Statistics
          <BarChart className="w-4 h-4 ml-2" />
        </Link>
      </div>
    );
  }

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 md:w-[80vw] max-w-4xl w-[90vw] top-1/2 left-1/2">
      <div className="flex flex-row justify-between">
        <div className="flex flex-col">
          {/* topic */}
          <p>
            <span className="text-slate-400">Topic</span> &nbsp;
            <span className="px-2 py-1 text-white rounded-lg bg-slate-800">
              {game.topic}
            </span>
          </p>
          <div className="flex self-start mt-3 text-slate-400">
            <Timer className="mr-2" />
            {formatTimeDelta(differenceInSeconds(now, displayStartTime))}
          </div>
        </div>
        <OpenEndedPercentage percentage={averagePercentage} />
      </div>
      <Card className="w-full mt-4">
        <CardHeader className="flex flex-row items-center">
          <CardTitle className="mr-5 text-center divide-y divide-zinc-600/50">
            <div>{questionIndex + 1}</div>
            <div className="text-base text-slate-400">
              {game.questions.length}
            </div>
          </CardTitle>
          <CardDescription className="flex-grow text-lg">
            {currentQuestion?.question}
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="flex flex-col items-center justify-center w-full mt-4">
        <BlankAnswerInput
          setBlankAnswer={setBlankAnswer}
          answer={currentQuestion.answer}
        />
        {feedback && (
          <div className="w-full p-4 mt-4 text-left rounded-lg border bg-slate-950 border-slate-700">
            <p className="font-semibold text-slate-100">Answer feedback</p>
            <p className="mt-2 text-sm text-slate-300">
              Correct answer: <span className="font-semibold">{feedback.correctAnswer}</span>
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Your answer: <span className="font-semibold">{feedback.userAnswer}</span>
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Similarity: <span className="font-semibold">{feedback.percentageSimilar}%</span>
            </p>
          </div>
        )}
        <Button
          variant="outline"
          className="mt-4"
          disabled={isChecking || hasEnded}
          onClick={() => {
            handleNext();
          }}
        >
          {isChecking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {hasSubmitted
            ? questionIndex === game.questions.length - 1
              ? "Finish"
              : "Next"
            : "Submit"}{" "}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default OpenEnded;
