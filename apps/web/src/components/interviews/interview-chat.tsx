'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Clock,
  Send,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type { InterviewSessionDetail, InterviewQuestion } from '@/types';
import { useSubmitAnswer, useGetNextQuestion, useCompleteInterview, useAbandonInterview } from '@/hooks/use-interviews';
import { toast } from 'sonner';

interface InterviewChatProps {
  session: InterviewSessionDetail;
  onComplete: () => void;
  onAbandon: () => void;
}

type ChatMessage = {
  id: string;
  type: 'question' | 'answer' | 'feedback' | 'system';
  content: string;
  timestamp: Date;
  question?: InterviewQuestion;
  score?: number;
};

export function InterviewChat({ session, onComplete, onAbandon }: InterviewChatProps) {
  // Find first unanswered question for initialization
  const initialQuestion = session.questions.find((q) => !q.answeredAt) || null;
  
  const [answer, setAnswer] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!initialQuestion) return [];
    return [
      {
        id: 'welcome',
        type: 'system',
        content: `Willkommen zum Interview! Du wirst ${session.maxQuestions} Fragen beantworten. Nimm dir Zeit für durchdachte Antworten.`,
        timestamp: new Date(),
      },
      {
        id: `question-${initialQuestion.id}`,
        type: 'question',
        content: initialQuestion.questionText,
        timestamp: new Date(),
        question: initialQuestion,
      },
    ];
  });
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(initialQuestion);
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(!!initialQuestion);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Pass sessionId to hooks
  const submitAnswerMutation = useSubmitAnswer(session.id);
  const getNextQuestionMutation = useGetNextQuestion(session.id);
  const completeMutation = useCompleteInterview(session.id);
  const abandonMutation = useAbandonInterview(session.id);

  // Calculate progress
  const totalQuestions = session.maxQuestions;
  const answeredQuestions = session.answeredCount;
  const progress = (answeredQuestions / totalQuestions) * 100;
  const isLastQuestion = answeredQuestions === totalQuestions - 1 && currentQuestion;

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitAnswer = useCallback(async () => {
    if (!answer.trim() || !currentQuestion) return;

    const answerContent = answer.trim();
    setAnswer('');

    // Add user's answer to chat
    setMessages((prev) => [
      ...prev,
      {
        id: `answer-${currentQuestion.id}`,
        type: 'answer',
        content: answerContent,
        timestamp: new Date(),
      },
    ]);

    try {
      // Submit answer and get feedback
      const response = await submitAnswerMutation.mutateAsync({
        questionId: currentQuestion.id,
        data: { answer: answerContent, answerDuration: timer },
      });

      // Add feedback message if available
      if (response.question.feedback) {
        setMessages((prev) => [
          ...prev,
          {
            id: `feedback-${currentQuestion.id}`,
            type: 'feedback',
            content: response.question.feedback || 'Feedback wird generiert...',
            timestamp: new Date(),
            score: response.question.score,
          },
        ]);
      }

      // Check if this was the last question
      if (!response.hasMoreQuestions || isLastQuestion) {
        setIsTimerRunning(false);
        setCurrentQuestion(null);
        setMessages((prev) => [
          ...prev,
          {
            id: 'complete',
            type: 'system',
            content: 'Alle Fragen beantwortet! Klicke auf "Interview abschließen", um deine Gesamtbewertung zu sehen.',
            timestamp: new Date(),
          },
        ]);
      } else {
        // Get next question
        const nextResponse = await getNextQuestionMutation.mutateAsync();
        if (nextResponse?.question) {
          setCurrentQuestion(nextResponse.question);
          setMessages((prev) => [
            ...prev,
            {
              id: `question-${nextResponse.question.id}`,
              type: 'question',
              content: nextResponse.question.questionText,
              timestamp: new Date(),
              question: nextResponse.question,
            },
          ]);
        }
      }
    } catch {
      toast.error('Fehler beim Senden der Antwort');
      // Restore the answer
      setAnswer(answerContent);
    }
  }, [answer, currentQuestion, timer, isLastQuestion, submitAnswerMutation, getNextQuestionMutation]);

  const handleComplete = async () => {
    try {
      await completeMutation.mutateAsync();
      toast.success('Interview abgeschlossen!');
      onComplete();
    } catch {
      toast.error('Fehler beim Abschließen des Interviews');
    }
  };

  const handleAbandon = async () => {
    try {
      await abandonMutation.mutateAsync();
      toast.success('Interview abgebrochen');
      onAbandon();
    } catch {
      toast.error('Fehler beim Abbrechen des Interviews');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const isLoading = submitAnswerMutation.isPending || getNextQuestionMutation.isPending;
  const allQuestionsAnswered = !currentQuestion && answeredQuestions >= totalQuestions;

  return (
    <>
      <Card className="flex flex-col h-[calc(100vh-12rem)] max-h-[800px]">
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Interview-Simulation</CardTitle>
            <div className="flex items-center gap-4">
              {/* Timer */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-mono">{formatTime(timer)}</span>
              </div>
              {/* Abandon button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAbandonDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Abbrechen
              </Button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Frage {answeredQuestions + (currentQuestion ? 1 : 0)} von {totalQuestions}
              </span>
              <span>{Math.round(progress)}% abgeschlossen</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-4 px-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.type === 'answer' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.type === 'question'
                    ? 'bg-primary text-primary-foreground'
                    : message.type === 'answer'
                      ? 'bg-secondary'
                      : message.type === 'feedback'
                        ? 'bg-amber-500 text-white'
                        : 'bg-muted'
                }`}
              >
                {message.type === 'question' && <Bot className="h-4 w-4" />}
                {message.type === 'answer' && <User className="h-4 w-4" />}
                {message.type === 'feedback' && <CheckCircle2 className="h-4 w-4" />}
                {message.type === 'system' && <AlertTriangle className="h-4 w-4" />}
              </div>

              {/* Message content */}
              <div
                className={`flex-1 max-w-[85%] ${message.type === 'answer' ? 'text-right' : ''}`}
              >
                <div
                  className={`inline-block rounded-lg px-4 py-2 ${
                    message.type === 'question'
                      ? 'bg-muted'
                      : message.type === 'answer'
                        ? 'bg-primary text-primary-foreground'
                        : message.type === 'feedback'
                          ? 'bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100'
                          : 'bg-muted/50 text-muted-foreground text-sm italic'
                  }`}
                >
                  {message.type === 'question' && message.question && (
                    <Badge variant="outline" className="mb-2">
                      {message.question.questionType === 'BEHAVIORAL' && 'Verhalten'}
                      {message.question.questionType === 'TECHNICAL' && 'Technisch'}
                      {message.question.questionType === 'SITUATIONAL' && 'Situativ'}
                      {message.question.questionType === 'OPEN' && 'Offen'}
                      {message.question.questionType === 'FOLLOW_UP' && 'Nachfrage'}
                    </Badge>
                  )}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.type === 'feedback' && message.score !== undefined && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium">Score:</span>
                      <Badge
                        variant={
                          message.score >= 80
                            ? 'default'
                            : message.score >= 60
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {message.score}/100
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </CardContent>

        <CardFooter className="flex-shrink-0 border-t pt-4">
          {allQuestionsAnswered ? (
            <div className="w-full flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground text-center">
                Du hast alle Fragen beantwortet. Schließe das Interview ab, um deine Gesamtbewertung
                zu erhalten.
              </p>
              <Button onClick={handleComplete} disabled={completeMutation.isPending}>
                {completeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Interview abschließen
              </Button>
            </div>
          ) : (
            <div className="w-full flex gap-2">
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Deine Antwort eingeben... (Enter zum Senden, Shift+Enter für Zeilenumbruch)"
                className="flex-1 min-h-[80px] max-h-[200px] resize-none"
                disabled={isLoading || !currentQuestion}
              />
              <Button
                onClick={handleSubmitAnswer}
                disabled={!answer.trim() || isLoading || !currentQuestion}
                className="self-end"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Senden
                  </>
                )}
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Abandon confirmation dialog */}
      <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Interview abbrechen?</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du das Interview abbrechen möchtest? Dein Fortschritt geht
              verloren und du erhältst keine Gesamtbewertung.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter machen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAbandon}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {abandonMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Abbrechen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
