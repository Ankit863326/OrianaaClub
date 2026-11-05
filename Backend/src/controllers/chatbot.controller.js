import asyncHandler from '../utils/asyncHandler.js';
import {
  CHATBOT_LANGUAGES,
  detectChatLanguage,
  generateChatbotReply,
  getServiceErrorReply,
  getUnsupportedLanguageReply,
} from '../services/chatbot.service.js';

const MAX_MESSAGE_LENGTH = 1000;

export const createMessage = asyncHandler(async (request, response) => {
  response.set('Cache-Control', 'no-store');

  const { message, language } = request.body || {};
  if (typeof message !== 'string' || !message.trim() || message.trim().length > MAX_MESSAGE_LENGTH) {
    response.status(400).json({
      success: false,
      reply: 'Please enter a message of 1 to 1000 characters.',
      message: 'Please enter a message of 1 to 1000 characters.',
    });
    return;
  }

  if (language !== undefined && !CHATBOT_LANGUAGES.includes(language)) {
    const safeLanguage = detectChatLanguage(message.trim(), language);
    const reply = getUnsupportedLanguageReply(safeLanguage);
    response.status(400).json({ success: false, reply, message: reply });
    return;
  }

  try {
    const reply = await generateChatbotReply({ message: message.trim(), language });
    response.json({ success: true, reply });
  } catch {
    const safeLanguage = detectChatLanguage(message.trim(), language);
    const reply = getServiceErrorReply(safeLanguage);
    response.status(503).json({ success: false, reply, message: reply });
  }
});
