import type { FastifyRequest } from "fastify";

export type AuthenticatedRequest = FastifyRequest & {
  user: { userId: number; email: string };
};

export type CalibrationAnswer = {
  questionOrder: number;
  answer: string;
};
