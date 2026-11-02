import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createMessage } from '../controllers/chatbot.controller.js';
import { detectChatLanguage, getRateLimitReply } from '../services/chatbot.service.js';

const router = Router();
const messageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  handler(request, response) {
    const language = detectChatLanguage(request.body?.message || '', request.body?.language);
    const reply = getRateLimitReply(language);
    response.status(429).json({ success: false, reply, message: reply });
  },
});

router.post('/message', messageLimiter, createMessage);

export default router;
