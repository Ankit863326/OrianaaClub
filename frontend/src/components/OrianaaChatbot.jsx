import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Mic, MicOff, Minus, Send, X } from 'lucide-react';
import { sendChatbotMessage } from '../lib/chatbotApi.js';
import { detectChatLanguage, getBrowserChatLanguage } from '../lib/chatbotLanguage.js';
import brandMark from '../assets/oriana-brand-mark.png';
import './OrianaaChatbot.css';

const COPY = Object.freeze({
  en: {
    welcome: 'Namaste! Welcome to Orianaa Club. How can I assist you today?',
    farewell: 'Thanks for chatting with OrianaaClub. We hope to welcome you back soon!',
    launcher: 'Chat with Orianaa Assistant',
    subtitle: 'Your OrianaaClub concierge',
    placeholder: 'Ask us anything about OrianaaClub…',
    send: 'Send message',
    minimize: 'Minimize chat',
    restore: 'Restore chat',
    close: 'Close chat and clear messages',
    typing: 'Orianaa Assistant is typing',
    topics: 'Membership · Destinations · Experiences',
    failed: 'I’m having trouble responding right now. Please try again shortly or call OrianaaClub at 087945 15151.',
    unsupported: 'Please ask in English, Hindi or Marathi.',
    chatLanguageLabel: 'Reply language',
    languageHint: 'Replies follow this language. Voice input uses your browser’s speech service.',
    languageEnglish: 'English',
    languageHindi: 'Hindi',
    languageMarathi: 'Marathi',
    startVoice: 'Start voice typing',
    stopVoice: 'Stop voice typing',
    voiceListening: 'Listening… speak now.',
    voiceInserted: 'Voice text added. Review it before sending.',
    voiceUnsupported: 'Voice typing is not supported in this browser. Please type your message.',
    voicePermission: 'Microphone access was denied. Allow it in your browser settings and try again.',
    voiceNoSpeech: 'No speech was detected. Try again.',
    voiceNoMicrophone: 'No microphone is available on this device.',
    voiceNetwork: 'The browser speech service could not connect. Check your connection and try again.',
    voiceError: 'Voice typing could not start. Please try again or type your message.',
  },
  hi: {
    welcome: 'नमस्ते! ओरियाना क्लब में आपका स्वागत है। मैं आपकी किस प्रकार सहायता कर सकता हूँ?',
    farewell: 'OrianaaClub से बात करने के लिए धन्यवाद। हम जल्द ही आपका फिर से स्वागत करने की उम्मीद करते हैं।',
    launcher: 'ओरियाना असिस्टेंट से चैट करें',
    subtitle: 'आपकी ओरियाना क्लब सहायता',
    placeholder: 'ओरियाना क्लब के बारे में पूछें…',
    send: 'संदेश भेजें',
    minimize: 'चैट छोटा करें',
    restore: 'चैट खोलें',
    close: 'चैट बंद करें और संदेश मिटाएँ',
    typing: 'ओरियाना असिस्टेंट जवाब लिख रहा है',
    topics: 'सदस्यता · गंतव्य · अनुभव',
    failed: 'मुझे अभी जवाब देने में कठिनाई हो रही है। कृपया थोड़ी देर बाद फिर कोशिश करें या OrianaaClub को 087945 15151 पर कॉल करें।',
    unsupported: 'कृपया अंग्रेज़ी, हिंदी या मराठी में पूछें।',
    chatLanguageLabel: 'जवाब की भाषा',
    languageHint: 'जवाब चुनी गई भाषा में मिलेगा। वॉइस इनपुट आपके ब्राउज़र की वाणी सेवा का उपयोग करता है।',
    languageEnglish: 'अंग्रेज़ी',
    languageHindi: 'हिंदी',
    languageMarathi: 'मराठी',
    startVoice: 'बोलकर लिखें',
    stopVoice: 'बोलना रोकें',
    voiceListening: 'सुन रहा हूँ… अब बोलें।',
    voiceInserted: 'आपकी बात लिख दी गई है। भेजने से पहले जाँच लें।',
    voiceUnsupported: 'इस ब्राउज़र में वॉइस टाइपिंग उपलब्ध नहीं है। कृपया अपना संदेश टाइप करें।',
    voicePermission: 'माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र सेटिंग में अनुमति देकर फिर कोशिश करें।',
    voiceNoSpeech: 'कोई आवाज़ नहीं मिली। फिर से कोशिश करें।',
    voiceNoMicrophone: 'इस डिवाइस पर माइक्रोफ़ोन उपलब्ध नहीं है।',
    voiceNetwork: 'ब्राउज़र की वाणी सेवा से कनेक्ट नहीं हो पाया। इंटरनेट जाँचकर फिर कोशिश करें।',
    voiceError: 'वॉइस टाइपिंग शुरू नहीं हो सकी। फिर कोशिश करें या संदेश टाइप करें।',
  },
  mr: {
    welcome: 'नमस्कार! ओरियाना क्लबमध्ये आपले स्वागत आहे. मी आपली कशी मदत करू शकतो?',
    farewell: 'OrianaaClub शी संवाद साधल्याबद्दल धन्यवाद. आम्ही लवकरच पुन्हा आपले स्वागत करू अशी आशा आहे.',
    launcher: 'ओरियाना असिस्टंटशी बोला',
    subtitle: 'आपला ओरियाना क्लब सहाय्यक',
    placeholder: 'ओरियाना क्लबबद्दल विचारा…',
    send: 'संदेश पाठवा',
    minimize: 'चॅट लहान करा',
    restore: 'चॅट पुन्हा उघडा',
    close: 'चॅट बंद करा आणि संदेश पुसा',
    typing: 'ओरियाना असिस्टंट उत्तर देत आहे',
    topics: 'सदस्यत्व · गंतव्ये · अनुभव',
    failed: 'मला आत्ता उत्तर देताना अडचण येत आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा किंवा OrianaaClub ला 087945 15151 वर कॉल करा.',
    unsupported: 'कृपया इंग्रजी, हिंदी किंवा मराठीत विचारा.',
    chatLanguageLabel: 'उत्तराची भाषा',
    languageHint: 'उत्तर निवडलेल्या भाषेत मिळेल. व्हॉइस इनपुटसाठी तुमच्या ब्राउझरची वाणी सेवा वापरली जाते.',
    languageEnglish: 'इंग्रजी',
    languageHindi: 'हिंदी',
    languageMarathi: 'मराठी',
    startVoice: 'बोलून मजकूर लिहा',
    stopVoice: 'बोलणे थांबवा',
    voiceListening: 'ऐकत आहे… आता बोला.',
    voiceInserted: 'बोललेला मजकूर जोडला आहे. पाठवण्यापूर्वी तपासा.',
    voiceUnsupported: 'या ब्राउझरमध्ये व्हॉइस टायपिंग उपलब्ध नाही. कृपया संदेश टाइप करा.',
    voicePermission: 'मायक्रोफोनची परवानगी नाकारली गेली. ब्राउझर सेटिंगमध्ये परवानगी देऊन पुन्हा प्रयत्न करा.',
    voiceNoSpeech: 'आवाज ऐकू आला नाही. पुन्हा प्रयत्न करा.',
    voiceNoMicrophone: 'या डिव्हाइसवर मायक्रोफोन उपलब्ध नाही.',
    voiceNetwork: 'ब्राउझरच्या वाणी सेवेशी जोडता आले नाही. इंटरनेट तपासून पुन्हा प्रयत्न करा.',
    voiceError: 'व्हॉइस टायपिंग सुरू झाले नाही. पुन्हा प्रयत्न करा किंवा संदेश टाइप करा.',
  },
});

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function renderAssistantMessage(text) {
  const linkPattern = /(087945 15151|https:\/\/orianaaclub\.com\/(?:membership-benefits|#enquiry))/g;
  return String(text).split(linkPattern).map((part, index) => {
    if (part === '087945 15151') {
      return <a key={`phone-${index}`} href="tel:08794515151">{part}</a>;
    }
    if (part === 'https://orianaaclub.com/membership-benefits') {
      return <a key={`membership-${index}`} href={part} target="_blank" rel="noreferrer">Membership Benefits</a>;
    }
    if (part === 'https://orianaaclub.com/#enquiry') {
      return <a key={`enquiry-${index}`} href={part} target="_blank" rel="noreferrer">Get in Touch</a>;
    }
    return part;
  });
}

const SPEECH_LANGUAGES = Object.freeze({
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
});

function getVoiceErrorMessage(errorCode, copy) {
  if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') return copy.voicePermission;
  if (errorCode === 'no-speech') return copy.voiceNoSpeech;
  if (errorCode === 'audio-capture') return copy.voiceNoMicrophone;
  if (errorCode === 'network') return copy.voiceNetwork;
  return copy.voiceError;
}

export default function OrianaaChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [language, setLanguage] = useState(() => getBrowserChatLanguage());
  const [chatLanguagePreference, setChatLanguagePreference] = useState(() => getBrowserChatLanguage());
  const [draft, setDraft] = useState('');
  const [draftLanguageOverride, setDraftLanguageOverride] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [messages, setMessages] = useState([]);
  const [exitGreeting, setExitGreeting] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messageListRef = useRef(null);
  const requestRef = useRef(null);
  const recognitionRef = useRef(null);
  const copy = COPY[language];

  useEffect(() => () => {
    requestRef.current?.abort();
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try {
      recognition.abort();
    } catch {
      // The recognition service may already have ended during unmount.
    }
    recognitionRef.current = null;
  }, []);

  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    if (!exitGreeting) return undefined;
    const timeout = window.setTimeout(() => setExitGreeting(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [exitGreeting]);

  function openChat() {
    if (isOpen) {
      setIsMinimized(false);
      return;
    }

    const preferredLanguage = chatLanguagePreference;
    setExitGreeting('');
    setLanguage(preferredLanguage);
    setMessages([{ id: createMessageId(), role: 'assistant', text: COPY[preferredLanguage].welcome }]);
    setIsMinimized(false);
    setIsOpen(true);
  }

  function closeChat() {
    setExitGreeting(COPY[language].farewell);
    requestRef.current?.abort();
    requestRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.abort();
      } catch {
        // The recognition service may already have ended.
      }
    }
    setIsLoading(false);
    setIsListening(false);
    setVoiceStatus('');
    setDraft('');
    setDraftLanguageOverride(null);
    setMessages([]);
    setIsMinimized(false);
    setIsOpen(false);
  }

  function cancelVoiceInput() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.abort();
      } catch {
        // The recognition service may already have ended.
      }
    }
    setIsListening(false);
    setVoiceStatus('');
  }

  function toggleVoiceInput() {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        cancelVoiceInput();
      }
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus(copy.voiceUnsupported);
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = SPEECH_LANGUAGES[chatLanguagePreference];
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      let errorMessage = '';
      let receivedFinalResult = false;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceStatus(copy.voiceListening);
      };
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results || [])
          .slice(event.resultIndex || 0)
          .filter((result) => result.isFinal)
          .map((result) => result[0]?.transcript || '')
          .join(' ')
          .trim();
        if (!transcript) return;
        receivedFinalResult = true;
        setDraft((current) => `${current.trim()}${current.trim() ? ' ' : ''}${transcript}`.slice(0, 1000));
        setDraftLanguageOverride(chatLanguagePreference);
        setLanguage(chatLanguagePreference);
      };
      recognition.onerror = (event) => {
        errorMessage = getVoiceErrorMessage(event.error, copy);
        setVoiceStatus(errorMessage);
        setIsListening(false);
      };
      recognition.onnomatch = () => {
        errorMessage = copy.voiceNoSpeech;
        setVoiceStatus(errorMessage);
        setIsListening(false);
      };
      recognition.onend = () => {
        setIsListening(false);
        if (!errorMessage) setVoiceStatus(receivedFinalResult ? copy.voiceInserted : '');
        if (recognitionRef.current === recognition) recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      setVoiceStatus(copy.voiceListening);
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceStatus(error?.name === 'NotAllowedError' ? copy.voicePermission : copy.voiceError);
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isLoading || isListening) return;

    const messageLanguage = detectChatLanguage(message, draftLanguageOverride || chatLanguagePreference);
    setLanguage(messageLanguage);
    setChatLanguagePreference(messageLanguage);
    setDraft('');
    setDraftLanguageOverride(null);
    setVoiceStatus('');
    setMessages((current) => [...current, { id: createMessageId(), role: 'user', text: message }]);
    setIsLoading(true);

    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const reply = await sendChatbotMessage({ message, language: messageLanguage, signal: controller.signal });
      if (!controller.signal.aborted) {
        setMessages((current) => [...current, { id: createMessageId(), role: 'assistant', text: reply }]);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessages((current) => [...current, {
          id: createMessageId(),
          role: 'assistant',
          text: error?.message || COPY[messageLanguage].failed,
        }]);
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }

  return (
    <div className="oriana-chatbot">
      {!isOpen && exitGreeting && (
        <div className="oriana-chatbot__exit-greeting" role="status" aria-live="polite">
          {exitGreeting}
        </div>
      )}
      {isOpen && (
        <section
          className={`oriana-chatbot__panel${isMinimized ? ' oriana-chatbot__panel--minimized' : ''}`}
          role="dialog"
          aria-labelledby="oriana-chatbot-title"
          aria-describedby="oriana-chatbot-subtitle"
        >
          <header className="oriana-chatbot__header">
            <div className="oriana-chatbot__identity">
              <span className="oriana-chatbot__mark" aria-hidden="true">
                <img src={brandMark} alt="" />
              </span>
              <div className="oriana-chatbot__heading">
                <h2 id="oriana-chatbot-title">Orianaa Assistant</h2>
                <p id="oriana-chatbot-subtitle">{copy.subtitle}</p>
              </div>
            </div>
            <div className="oriana-chatbot__controls">
              {isMinimized ? (
                <button type="button" aria-label={copy.restore} onClick={() => setIsMinimized(false)}>
                  <ChevronUp size={17} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" aria-label={copy.minimize} onClick={() => {
                  cancelVoiceInput();
                  setIsMinimized(true);
                }}>
                  <Minus size={17} aria-hidden="true" />
                </button>
              )}
              <button type="button" aria-label={copy.close} onClick={closeChat}>
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          </header>

          {!isMinimized && (
            <>
              <div className="oriana-chatbot__topic-line">{copy.topics}</div>
              <div className="oriana-chatbot__messages" ref={messageListRef} role="log" aria-live="polite" aria-relevant="additions">
                {messages.map((message) => (
                  <div key={message.id} className={`oriana-chatbot__row oriana-chatbot__row--${message.role}`}>
                    {message.role === 'assistant' && (
                      <span className="oriana-chatbot__avatar" aria-hidden="true">
                        <img src={brandMark} alt="" />
                      </span>
                    )}
                    <p className="oriana-chatbot__bubble">
                      {message.role === 'assistant' ? renderAssistantMessage(message.text) : message.text}
                    </p>
                  </div>
                ))}
                {isLoading && (
                  <div className="oriana-chatbot__row oriana-chatbot__row--assistant" role="status" aria-label={copy.typing}>
                    <span className="oriana-chatbot__avatar" aria-hidden="true">
                      <img src={brandMark} alt="" />
                    </span>
                    <div className="oriana-chatbot__typing" aria-hidden="true"><i /><i /><i /></div>
                  </div>
                )}
              </div>
              <form className="oriana-chatbot__composer" onSubmit={submitMessage}>
                <div className="oriana-chatbot__voice-toolbar">
                  <label htmlFor="oriana-chatbot-language">{copy.chatLanguageLabel}</label>
                  <select
                    id="oriana-chatbot-language"
                    value={chatLanguagePreference}
                    onChange={(event) => {
                      const selectedLanguage = event.target.value;
                      setChatLanguagePreference(selectedLanguage);
                      setDraftLanguageOverride(null);
                      setLanguage(selectedLanguage);
                      setMessages((current) => current.length === 1 && current[0].role === 'assistant'
                        ? [{ ...current[0], text: COPY[selectedLanguage].welcome }]
                        : current);
                    }}
                    disabled={isLoading || isListening}
                  >
                    <option value="en">{copy.languageEnglish}</option>
                    <option value="hi">{copy.languageHindi}</option>
                    <option value="mr">{copy.languageMarathi}</option>
                  </select>
                  <button
                    className={`oriana-chatbot__voice-button${isListening ? ' is-listening' : ''}`}
                    type="button"
                    aria-label={isListening ? copy.stopVoice : copy.startVoice}
                    aria-pressed={isListening}
                    title={isListening ? copy.stopVoice : copy.startVoice}
                    onClick={toggleVoiceInput}
                    disabled={isLoading}
                  >
                    {isListening ? <MicOff size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
                  </button>
                </div>
                <p className="oriana-chatbot__voice-status" role="status" aria-live="polite">
                  {voiceStatus || copy.languageHint}
                </p>
                <div className="oriana-chatbot__message-row">
                  <label className="oriana-chatbot__sr-only" htmlFor="oriana-chatbot-input">{copy.placeholder}</label>
                  <input
                    id="oriana-chatbot-input"
                    type="text"
                    value={draft}
                    maxLength={1000}
                    autoComplete="off"
                    placeholder={copy.placeholder}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={isLoading}
                  />
                  <button type="submit" aria-label={copy.send} disabled={!draft.trim() || isLoading || isListening}>
                    <Send size={17} aria-hidden="true" />
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      )}

      {(!isOpen || isMinimized) && (
        <button className="oriana-chatbot__launcher" type="button" aria-label={copy.launcher} onClick={openChat}>
          <span className="oriana-chatbot__launcher-glow" aria-hidden="true" />
          <img className="oriana-chatbot__launcher-mark" src={brandMark} alt="" aria-hidden="true" />
          <span className="oriana-chatbot__launcher-label">{copy.launcher}</span>
        </button>
      )}
    </div>
  );
}
