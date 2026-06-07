/**
 * POST /api/chat
 *
 * Processes a natural language message through the AI agent.
 * The agent uses function calling to build transactions,
 * resolve ENS names, and coordinate with the Ledger.
 */

import { Router, Request, Response } from "express";
import { ChatRequestSchema } from "../validation/schemas.js";
import { AgentOrchestrator } from "../../../agent/orchestrator.js";

// Orchestrator instances keyed by sessionId
const orchestrators = new Map<string, AgentOrchestrator>();

function getOrCreateOrchestrator(sessionId?: string): {
  orchestrator: AgentOrchestrator;
  id: string;
} {
  const id = sessionId || "default";
  if (!orchestrators.has(id)) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    orchestrators.set(id, new AgentOrchestrator({ apiKey }));
  }
  return { orchestrator: orchestrators.get(id)!, id };
}

export const chatRouter = Router();

chatRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Invalid request",
        details: parsed.error.issues,
      });
      return;
    }

    const { message, sessionId } = parsed.data;
    const { orchestrator } = getOrchestratorForSession(sessionId);

    const result = await orchestrator.processMessage(message, sessionId);

    res.json({
      success: true,
      data: {
        reply: result.reply,
        transactionState: result.transactionState,
        sessionId: sessionId || "default",
      },
    });
  } catch (error) {
    console.error("[Chat] Error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Chat processing failed",
    });
  }
});

function getOrchestratorForSession(sessionId?: string): {
  orchestrator: AgentOrchestrator;
  id: string;
} {
  const id = sessionId || "default";

  if (!orchestrators.has(id)) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set. Set it in your .env file.");
    }
    orchestrators.set(id, new AgentOrchestrator({ apiKey }));
  }

  return { orchestrator: orchestrators.get(id)!, id };
}