import type { Request, Response } from "express";
import { getUserUsage } from "../services/usage.services.js";
import { getCreditHistory, getCreditSnapshot } from "../services/credit.services.js";

/**
 * Handles HTTP GET request to fetch resource quota consumption and limits for the authenticated user.
 */
export async function getUsage(req: Request, res: Response) {
    const usage = await getUserUsage(req.session.user.id);
    res.json(usage);
}

/**
 * Handles HTTP GET request to fetch current credit balance and transaction history.
 */
export async function getCredits(req: Request, res: Response) {
    const userId = req.session.user.id;
    const [snapshot, history] = await Promise.all([
        getCreditSnapshot(userId),
        getCreditHistory(userId, 50),
    ]);
    res.json({ ...snapshot, history });
}
