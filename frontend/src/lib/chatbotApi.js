import { API_BASE_URL } from '../config/api.js';

export async function sendChatbotMessage({ message, language, signal }) {
  const response = await fetch(`${API_BASE_URL}/chatbot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    signal,
    body: JSON.stringify({ message, language }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success !== true || typeof payload.reply !== 'string') {
    throw new Error(payload?.reply || 'The assistant could not respond right now.');
  }

  return payload.reply;
}
