-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('BEHAVIORAL', 'TECHNICAL', 'CASE_STUDY', 'MIXED');

-- CreateEnum
CREATE TYPE "InterviewDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "InterviewSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "InterviewQuestionType" AS ENUM ('OPEN', 'SITUATIONAL', 'TECHNICAL', 'BEHAVIORAL', 'FOLLOW_UP');

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "type" "InterviewType" NOT NULL DEFAULT 'MIXED',
    "industry" TEXT,
    "difficulty" "InterviewDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "language" TEXT NOT NULL DEFAULT 'de',
    "jobTitle" TEXT,
    "company" TEXT,
    "jobDescription" TEXT,
    "maxQuestions" INTEGER NOT NULL DEFAULT 10,
    "timeLimitMinutes" INTEGER,
    "status" "InterviewSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "overallScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_questions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "InterviewQuestionType" NOT NULL DEFAULT 'OPEN',
    "expectedTopics" TEXT[],
    "userAnswer" TEXT,
    "answerDuration" INTEGER,
    "score" INTEGER,
    "feedback" TEXT,
    "improvementTips" TEXT[],
    "order" INTEGER NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_feedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "technicalScore" INTEGER,
    "communicationScore" INTEGER NOT NULL,
    "presentationScore" INTEGER NOT NULL,
    "problemSolvingScore" INTEGER,
    "cultureFitScore" INTEGER,
    "strengths" TEXT[],
    "improvements" TEXT[],
    "recommendations" TEXT[],
    "idealAnswers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_sessions_userId_idx" ON "interview_sessions"("userId");

-- CreateIndex
CREATE INDEX "interview_sessions_userId_status_idx" ON "interview_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "interview_sessions_userId_createdAt_idx" ON "interview_sessions"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "interview_sessions_applicationId_idx" ON "interview_sessions"("applicationId");

-- CreateIndex
CREATE INDEX "interview_questions_sessionId_idx" ON "interview_questions"("sessionId");

-- CreateIndex
CREATE INDEX "interview_questions_sessionId_order_idx" ON "interview_questions"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "interview_feedback_sessionId_key" ON "interview_feedback"("sessionId");

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_feedback" ADD CONSTRAINT "interview_feedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
