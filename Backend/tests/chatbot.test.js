import { describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { createApp } from './helpers/createApp.js';
import { detectChatLanguage, findRelevantFaqs, getFallbackReply } from '../src/services/chatbot.service.js';

const app = createApp();

describe('public chatbot endpoint', () => {
  test('selects only relevant approved FAQ entries for English, Hindi and Marathi prompts', () => {
    expect(findRelevantFaqs('Where are your destinations?')[0].question).toMatch(/destinations/i);
    expect(findRelevantFaqs('आपके गंतव्य कहाँ हैं?')[0].question).toMatch(/destinations/i);
    expect(findRelevantFaqs('आपली ठिकाणे कोठे आहेत?')[0].question).toMatch(/destinations/i);
    expect(detectChatLanguage('आपके क्लब में क्या सुविधाएं हैं?', 'en')).toBe('hi');
    expect(detectChatLanguage('माझे सदस्यत्व कसे आहे?', 'en')).toBe('mr');
    expect(findRelevantFaqs('Where can I book a table?')).toHaveLength(0);
  });

  test('returns a polite answer for questions outside the approved FAQ set without calling OpenAI', async () => {
    const result = await request(app).post('/api/chatbot/message').send({
      message: 'What is the weather on Mars?',
      language: 'en',
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, reply: getFallbackReply('en') });
    expect(globalThis.fetch).not.toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.anything());
  });

  test('rejects empty and overlong messages without sending them to the provider', async () => {
    const empty = await request(app).post('/api/chatbot/message').send({ message: '   ', language: 'en' });
    expect(empty.status).toBe(400);
    expect(empty.body.success).toBe(false);

    const long = await request(app).post('/api/chatbot/message').send({ message: 'x'.repeat(1001), language: 'en' });
    expect(long.status).toBe(400);
    expect(long.body.success).toBe(false);
  });

  test('responds in Marathi for an unsupported question written in Marathi', async () => {
    const result = await request(app).post('/api/chatbot/message').send({
      message: 'मंगळ ग्रहावर हवामान कसे असते?',
      language: 'en',
    });
    expect(result.status).toBe(200);
    expect(result.body.reply).toMatch(/क्षमस्व/);
  });
});
