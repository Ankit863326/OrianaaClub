import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test } from '@jest/globals';
import OrianaaChatbot from './OrianaaChatbot.jsx';
import { detectChatLanguage } from '../lib/chatbotLanguage.js';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('Orianaa Assistant widget', () => {
  beforeEach(() => fetch.mockReset());

  test('detects English, Hindi and Marathi questions', () => {
    expect(detectChatLanguage('Where are your destinations?', 'en')).toBe('en');
    expect(detectChatLanguage('आपके क्लब में क्या सुविधाएं हैं?', 'en')).toBe('hi');
    expect(detectChatLanguage('माझे सदस्यत्व कसे आहे?', 'en')).toBe('mr');
  });

  test('opens with a welcome, sends a question, and clears the conversation when closed', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ success: true, reply: 'The public site features three destinations.' }));
    render(<OrianaaChatbot />);

    fireEvent.click(screen.getByRole('button', { name: 'Chat with Orianaa Assistant' }));
    expect(screen.getByText('Namaste! Welcome to Orianaa Club. How can I assist you today?')).toBeInTheDocument();

    const input = screen.getByLabelText('Ask us anything about OrianaaClub…');
    fireEvent.change(input, { target: { value: 'Where are your destinations?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('The public site features three destinations.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/chatbot/message'), expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      body: JSON.stringify({ message: 'Where are your destinations?', language: 'en' }),
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Close chat and clear messages' }));
    expect(screen.queryByText('The public site features three destinations.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chat with Orianaa Assistant' }));
    expect(screen.getByText('Namaste! Welcome to Orianaa Club. How can I assist you today?')).toBeInTheDocument();
    expect(screen.queryByText('Where are your destinations?')).not.toBeInTheDocument();
  });

  test('shows a localized service response returned by the backend', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      success: false,
      reply: 'मुझे अभी जवाब देने में कठिनाई हो रही है। कृपया थोड़ी देर बाद फिर कोशिश करें।',
    }, 503));
    render(<OrianaaChatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat with Orianaa Assistant' }));
    fireEvent.change(screen.getByLabelText('Ask us anything about OrianaaClub…'), {
      target: { value: 'आपके क्लब में क्या सुविधाएं हैं?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getByText(/मुझे अभी जवाब देने में कठिनाई हो रही है/)).toBeInTheDocument());
  });
});
