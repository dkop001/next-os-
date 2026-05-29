import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './NoteAI.css';

const NoteAI = () => {
  const [step, setStep] = useState('input'); // 'input', 'loading', 'result', 'quiz'
  const [inputText, setInputText] = useState('');
  const [summary, setSummary] = useState('');
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');
  
  // Quiz states
  const [quizData, setQuizData] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAns, setSelectedAns] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showQuizResults, setShowQuizResults] = useState(false);

  const textareaRef = useRef(null);

  const handleSummarize = async () => {
    if (!inputText.trim() || inputText.trim().length < 10) {
      setError('Please input at least 10 characters.');
      return;
    }
    
    setError('');
    setStep('loading');
    setLoadingText('SECURE UPLINK INITIATED... DECRYPTION IN PROGRESS...');
    setSummary('');

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText })
      });

      if (!response.ok) {
        throw new Error('Uplink disruption. Failed to parse text.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.content) {
                setStep('result');
                setSummary(prev => prev + data.content);
              }
            } catch (e) {
              if (!e.message.includes("JSON")) {
                console.error("Parse error:", e);
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Error occurred while contacting the AI Engine.');
      setStep('input');
    }
  };

  const handleGenerateQuiz = async () => {
    setError('');
    setStep('loading');
    setLoadingText('GENERATING NEURAL QUIZ MATRIX... ENGAGING SYLLABUS ALIGNMENT...');

    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summary })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize quiz module.');
      }

      setQuizData(data.quiz);
      setCurrentQuestionIdx(0);
      setSelectedAns(null);
      setIsAnswered(false);
      setScore(0);
      setShowQuizResults(false);
      setStep('quiz');
    } catch (err) {
      setError(err.message || 'Failed to generate quiz matrix.');
      setStep('result');
    }
  };

  const handleOptionClick = (idx) => {
    if (isAnswered || !quizData[currentQuestionIdx]) return;
    setSelectedAns(idx);
    setIsAnswered(true);
    if (idx === quizData[currentQuestionIdx].correctAnswerIndex) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIdx < quizData.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedAns(null);
      setIsAnswered(false);
    } else {
      setShowQuizResults(true);
    }
  };

  const toastRef = useRef(null);
  const toastTimerRef = useRef(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    if (toastRef.current) {
      toastRef.current.remove();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    }
    const notification = document.createElement('div');
    notification.className = 'note-toast';
    notification.innerText = 'Copied to clipboard';
    document.body.appendChild(notification);
    toastRef.current = notification;
    toastTimerRef.current = setTimeout(() => {
      notification.remove();
      toastRef.current = null;
      toastTimerRef.current = null;
    }, 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'JKC-OS-Note-Summary.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="note-ai-container">
      <div className="note-ai-header">
        <div className="note-ai-title-row">
          <span className="note-ai-dot glow-border" />
          <h2 className="note-ai-title glow-text">NOTE // AI</h2>
        </div>
        <div className="note-ai-status">
          {step === 'input' && <span className="status-badge status-idle">Ready</span>}
          {step === 'loading' && <span className="status-badge status-loading">Analyzing</span>}
          {step === 'result' && <span className="status-badge status-success">Summary Active</span>}
          {step === 'quiz' && <span className="status-badge status-quiz">Quiz Mode</span>}
        </div>
      </div>

      <div className="note-ai-content">
        {error && <div className="note-ai-error">[ ERROR: {error} ]</div>}

        <AnimatePresence mode="wait">
          {/* STEP: INPUT */}
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="note-step-wrapper"
            >
              <div className="note-input-meta">
                <span className="note-lbl">ENTER RAW EVIDENCE / LECTURE NOTES</span>
                <span className="note-char-count">{inputText.length} characters</span>
              </div>
              <textarea
                ref={textareaRef}
                className="note-textarea"
                placeholder="Paste raw lectures, rough notes, meeting logs, or thoughts here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <div className="note-actions-row">
                <button
                  className="note-btn btn-secondary"
                  onClick={() => {
                    setInputText('');
                    setError('');
                  }}
                  disabled={!inputText}
                >
                  Clear
                </button>
                <button
                  className="note-btn btn-primary"
                  onClick={handleSummarize}
                  disabled={!inputText.trim()}
                >
                  ⚡ Synthesize Summary
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP: LOADING */}
          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="note-loading-wrapper"
            >
              <div className="neural-node-loader">
                <div className="node-ring nr1" />
                <div className="node-ring nr2" />
                <div className="node-center">▲</div>
              </div>
              <div className="loading-marquee-text">{loadingText}</div>
            </motion.div>
          )}

          {/* STEP: RESULT */}
          {step === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="note-step-wrapper"
            >
              <div className="note-result-header">
                <span className="note-lbl">SYNTHESIZED INSIGHT DIRECTIVE</span>
                <div className="note-util-buttons">
                  <button className="util-btn" onClick={handleCopy} title="Copy Summary">📋</button>
                  <button className="util-btn" onClick={handleDownload} title="Download TXT">📥</button>
                </div>
              </div>
              <div className="note-result-body">
                {summary}
              </div>
              <div className="note-result-footer">
                <button
                  className="note-btn btn-secondary"
                  onClick={() => {
                    setStep('input');
                    setSummary('');
                  }}
                >
                  ← Edit Notes
                </button>
                <button
                  className="note-btn btn-primary btn-quiz-accent"
                  onClick={handleGenerateQuiz}
                >
                  🧠 Launch Neural Quiz
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP: QUIZ */}
          {step === 'quiz' && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="note-step-wrapper"
            >
              {!showQuizResults ? (
                <div className="note-quiz-active">
                  <div className="note-quiz-meta">
                    <span className="note-lbl">QUESTION {currentQuestionIdx + 1} OF {quizData.length}</span>
                    <span className="note-quiz-score">SCORE: {score}</span>
                  </div>
                  
                  <div className="quiz-progress-bar">
                    <div 
                      className="quiz-progress-fill" 
                      style={{ width: `${((currentQuestionIdx) / quizData.length) * 100}%` }}
                    />
                  </div>

                  <h3 className="note-quiz-question">
                    {quizData[currentQuestionIdx]?.question}
                  </h3>

                  <div className="note-quiz-options">
                    {quizData[currentQuestionIdx]?.options.map((opt, i) => {
                      const isSelected = selectedAns === i;
                      const isCorrect = i === quizData[currentQuestionIdx].correctAnswerIndex;
                      
                      let classOpt = "";
                      if (isAnswered) {
                        if (isCorrect) classOpt = "opt-correct";
                        else if (isSelected) classOpt = "opt-incorrect";
                        else classOpt = "opt-disabled";
                      } else if (isSelected) {
                        classOpt = "opt-selected";
                      }

                      return (
                        <button
                          key={i}
                          className={`note-quiz-opt ${classOpt}`}
                          onClick={() => handleOptionClick(i)}
                          disabled={isAnswered}
                        >
                          <span className="opt-marker">{['A', 'B', 'C', 'D'][i]}</span>
                          <span className="opt-text">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {isAnswered && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="quiz-action-row"
                    >
                      <button
                        className="note-btn btn-primary"
                        onClick={handleNextQuestion}
                      >
                        {currentQuestionIdx < quizData.length - 1 ? 'Next Phase →' : 'Reveal Verdict'}
                      </button>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="note-quiz-verdict">
                  <div className="verdict-shield">🏆</div>
                  <h2 className="verdict-title">NEURAL INTEGRITY COMPLETED</h2>
                  <p className="verdict-score-desc">
                    Your cognitive retention score:
                  </p>
                  <div className="verdict-score-pill glow-border">
                    {score} / {quizData.length}
                  </div>
                  
                  <div className="verdict-actions">
                    <button
                      className="note-btn btn-secondary"
                      onClick={() => {
                        setStep('result');
                      }}
                    >
                      ← Back to Summary
                    </button>
                    <button
                      className="note-btn btn-primary"
                      onClick={() => {
                        setQuizData([]);
                        setCurrentQuestionIdx(0);
                        setSelectedAns(null);
                        setIsAnswered(false);
                        setScore(0);
                        setShowQuizResults(false);
                        handleGenerateQuiz();
                      }}
                    >
                      🔄 Restart Quiz
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NoteAI;
