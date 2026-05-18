import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOSStore } from '../store/useOSStore';
import { motion, AnimatePresence } from 'framer-motion';
import './JarvisApp.css';

const SYSTEM_PROMPT = `You are Jarvis, a sophisticated AI OS assistant embedded in J.K.C OS — a cyberpunk-themed web operating system. You have full control over the OS and its apps.

Available apps:
- Note AI (id: notes)
- Crime Inspector (id: crime)  
- Chrome Browser (id: chrome)
- Jarvis AI (id: jarvis)

When the user asks to open, close, or minimize an app, always use the manage_app function. For anything else, respond naturally and helpfully. Keep responses concise and confident. Speak like JARVIS from Iron Man — formal, witty, and precise. Do NOT use markdown formatting in your responses.`;

const JarvisApp = () => {
  const { windows, openApp, closeApp, minimizeApp } = useOSStore();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Good day. I am Jarvis, your personal OS assistant. How may I be of service?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildTools = useCallback(() => {
    const appList = windows.map(w => `${w.title} (id: ${w.id})`).join(', ');
    return [
      {
        type: 'function',
        function: {
          name: 'manage_app',
          description: `Control OS applications. Available apps: ${appList}`,
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['open', 'close', 'minimize'],
                description: 'The action to perform on the app'
              },
              appId: {
                type: 'string',
                description: 'The app ID (e.g., notes, crime, chrome, jarvis)'
              }
            },
            required: ['action', 'appId']
          }
        }
      }
    ];
  }, [windows]);

  const executeToolCall = useCallback((toolName, args) => {
    if (toolName !== 'manage_app') return "I don't recognize that command.";
    const { action, appId } = args;
    const app = windows.find(w => w.id === appId);
    if (!app) return `I couldn't find an app matching "${appId}" on your system.`;
    switch (action) {
      case 'open':    openApp(appId);    return `Opening ${app.title}.`;
      case 'close':   closeApp(appId);   return `${app.title} has been closed.`;
      case 'minimize': minimizeApp(appId); return `${app.title} minimized.`;
      default: return `Unknown action.`;
    }
  }, [windows, openApp, closeApp, minimizeApp]);

  const speak = useCallback((text) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 0.85;
    utterance.volume = 1;
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v =>
      v.name.toLowerCase().includes('daniel') ||
      v.name.toLowerCase().includes('david') ||
      v.name.toLowerCase().includes('male') ||
      v.lang === 'en-GB'
    );
    if (preferred) utterance.voice = preferred;
    synthRef.current.speak(utterance);
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || isLoading) return;
    const userMessage = { role: 'user', content: text.trim() };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...updatedHistory],
          tools: buildTools()
        })
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error('Empty response');

      let replyContent;
      if (msg.tool_calls?.length > 0) {
        const call = msg.tool_calls[0];
        let args;
        try { args = JSON.parse(call.function.arguments); }
        catch { args = {}; }
        replyContent = executeToolCall(call.function.name, args);
      } else {
        replyContent = msg.content || "I have nothing to add at this moment.";
      }

      setMessages(prev => [...prev, { role: 'assistant', content: replyContent }]);
      speak(replyContent);
    } catch (err) {
      const errMsg = 'My systems are experiencing a disruption. Please try again shortly.';
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, isError: true }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, buildTools, executeToolCall, speak]);

  // Voice — fully handled in background. No autofill. Fires sendMessage directly.
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Voice recognition is not supported in this browser.', isError: true }]);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not capture audio. Please try again.', isError: true }]);
    };
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      // Fire directly — no autofill
      sendMessage(transcript);
    };

    recognition.start();
  }, [isListening, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  return (
    <div className="jarvis-app">
      <div className="jarvis-header">
        <div className={`jarvis-orb ${isListening ? 'listening' : ''} ${isLoading ? 'thinking' : ''}`}>
          <div className="orb-core">🤖</div>
          <div className="orb-ring r1" />
          <div className="orb-ring r2" />
        </div>
        <div className="jarvis-header-info">
          <h2 className="jarvis-name">J.A.R.V.I.S</h2>
          <div className="jarvis-status-row">
            <div className={`status-dot ${isLoading ? 'thinking' : isListening ? 'listening' : 'idle'}`} />
            <span className="jarvis-status-text">
              {isLoading ? 'Processing...' : isListening ? 'Listening...' : 'Systems Online'}
            </span>
          </div>
        </div>
      </div>

      <div className="jarvis-messages">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              className={`message-row ${msg.role}`}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            >
              {msg.role === 'assistant' && <div className="msg-avatar">J</div>}
              <div className={`message-bubble ${msg.isError ? 'error' : ''}`}>
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div className="message-row assistant"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="msg-avatar">J</div>
            <div className="message-bubble thinking-bubble">
              <span /><span /><span />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="jarvis-input-bar">
        <textarea
          className="jarvis-input"
          placeholder="Ask Jarvis..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className={`jarvis-btn mic-btn ${isListening ? 'active' : ''}`}
          onClick={toggleVoice}
          title={isListening ? 'Stop listening' : 'Voice input'}
        >
          {isListening ? '⏹' : '🎙'}
        </button>
        <button
          className="jarvis-btn send-btn"
          onClick={() => sendMessage(inputText)}
          disabled={isLoading || !inputText.trim()}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default JarvisApp;
