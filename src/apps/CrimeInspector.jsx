import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './CrimeInspector.css';

// ── NATIVE forenisc rule engine scanner (highly robust, no heavy npm dependencies) ──
const parseCodeCrime = (code) => {
  const findings = [];
  const lines = code.split('\n');

  // 1. Native compiler syntax check
  try {
    new Function(code);
  } catch (err) {
    // Attempt to extract line number from the syntax error
    let errorLine = 1;
    const match = err.stack?.match(/<anonymous>:(\d+):/);
    if (match) {
      errorLine = parseInt(match[1]) - 2; // Offset for new Function wrapping
      if (errorLine < 1) errorLine = 1;
    }
    findings.push({
      type: 'SYNTAX_VIOLATION',
      severity: 'CRITICAL',
      line: errorLine,
      message: `Syntax violation: ${err.message}`,
      evidence: lines[errorLine - 1] || 'Unknown'
    });
    return findings; // Stop scanning if code has syntax breakdown
  }

  // 2. Scan lines for structural bugs
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const cleanLine = line.trim();

    // Loop perpetual hazard
    if (/while\s*\(\s*(true|1)\s*\)/i.test(cleanLine)) {
      findings.push({
        type: 'INFINITE_LOOP_HAZARD',
        severity: 'HIGH',
        line: lineNum,
        message: 'A perpetual loop was detected. This execution will lock the CPU core indefinitely.',
        evidence: cleanLine
      });
    }

    // Off-by-one loop condition
    if (/<=.*\.length\b/.test(cleanLine)) {
      findings.push({
        type: 'OFF_BY_ONE_ERROR',
        severity: 'MEDIUM',
        line: lineNum,
        message: 'Suspicious loop boundary condition. Accessing index equal to length yields undefined.',
        evidence: cleanLine
      });
    }

    // Unchecked Null properties
    if (/\b(data|item)\.[a-zA-Z_$][a-zA-Z0-9_$]*/.test(cleanLine) && !cleanLine.includes('?') && !cleanLine.includes('&&') && !cleanLine.includes('if')) {
      findings.push({
        type: 'NULL_POINTER_RISK',
        severity: 'MEDIUM',
        line: lineNum,
        message: 'Direct property access on a high-risk null candidate ("data" or "item"). Potential null-pointer ref.',
        evidence: cleanLine
      });
    }
  });

  // Async mistake: check for await inside non-async functions
  // A regex check for `function` definition without `async` preceding it, but containing `await` inside
  let inFunc = false;
  let funcIsAsync = false;
  let funcStartLine = 1;
  let funcBody = [];

  lines.forEach((line, idx) => {
    const cleanLine = line.trim();
    if (/function\b/.test(cleanLine) || /(\bconst\b|\blet\b).*=.*=>/.test(cleanLine)) {
      inFunc = true;
      funcIsAsync = /\basync\b/.test(cleanLine);
      funcStartLine = idx + 1;
      funcBody = [];
    }

    if (inFunc) {
      funcBody.push(cleanLine);
      if (cleanLine.includes('await') && !funcIsAsync) {
        findings.push({
          type: 'ASYNC_MISMANAGEMENT',
          severity: 'HIGH',
          line: idx + 1,
          message: 'Illegal use of "await" within a non-async parent context.',
          evidence: cleanLine
        });
        inFunc = false; // Reset to avoid duplicate triggers
      }
    }
  });

  return findings;
};

// ── Sub-component: Execution Timeline ──
const ExecutionTimeline = ({ timeline }) => {
  if (!timeline) return null;

  return (
    <div className="crime-card">
      <h3 className="crime-sect-title">EXECUTION TRACE TIMELINE</h3>
      <div className="timeline-trail">
        <div className="timeline-line" />
        <div className="timeline-items-list">
          {timeline.map((item, idx) => (
            <motion.div 
              key={idx} 
              className="timeline-step-item"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.15 }}
            >
              <div className={`timeline-dot dot-${item.status || 'neutral'}`} />
              <div className="timeline-step-body">
                <span className="step-num">PHASE {item.step}</span>
                <p className={`step-desc desc-${item.status || 'neutral'}`}>{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Main App Component ──
const CrimeInspector = () => {
  const [appState, setAppState] = useState('input'); // 'input', 'loading', 'dashboard'
  const [code, setCode] = useState('// Paste suspected JS/Python code here...\nfunction calculateTotal(data) {\n  let total = 0;\n  for(let i = 0; i <= data.length; i++) {\n    total += data[i].price;\n  }\n  return total;\n}');
  const [errorMsg, setErrorMsg] = useState('TypeError: Cannot read properties of undefined (reading \'price\')');
  const [language, setLanguage] = useState('javascript');
  const [evidence, setEvidence] = useState({ code: '', error: '' });
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const handleStartAnalysis = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setEvidence({ code, error: errorMsg, language });
    setAppState('loading');
    setErr('');

    try {
      // 1. Run local forensic rule scanner
      const structuralFindings = parseCodeCrime(code);

      // 2. Call Vercel AI Endpoint
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          errorMessage: errorMsg,
          structuralFindings,
          language
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to establish connection to Forensic Command.');
      }

      const report = await response.json();
      setResult(report);
      setAppState('dashboard');
    } catch (error) {
      console.error(error);
      setErr(error.message || 'Forensic system is experiencing offline maintenance.');
      setAppState('input');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return '#EF4444';
      case 'HIGH': return '#F59E0B';
      case 'MEDIUM': return '#10B981';
      case 'LOW': return '#6B7280';
      default: return 'var(--cyber-cyan)';
    }
  };

  return (
    <div className="crime-inspector-container">
      <div className="crime-header">
        <div className="crime-title-row">
          <span className="crime-badge-dot glow-border" />
          <h2 className="crime-header-title glow-text">CRIME // INSPECTOR</h2>
        </div>
        <div className="crime-header-info">
          {appState === 'input' && <span className="crime-status status-patrol">Precinct Patrol</span>}
          {appState === 'loading' && <span className="crime-status status-scan">Scanning Evidence</span>}
          {appState === 'dashboard' && <span className="crime-status status-case">Case Closed</span>}
        </div>
      </div>

      <div className="crime-body">
        {err && <div className="crime-error-box">[ FORENSIC ALERT: {err} ]</div>}

        <AnimatePresence mode="wait">
          {/* STEP: INPUT */}
          {appState === 'input' && (
            <motion.form 
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleStartAnalysis}
              className="crime-input-form"
            >
              <div className="crime-form-grid">
                <div className="form-item select-item">
                  <label className="crime-label">TARGET LANG</label>
                  <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value)} 
                    className="crime-select"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                  </select>
                </div>
                
                <div className="form-item flex-item">
                  <label className="crime-label">RUNTIME TRACE ERROR (OPTIONAL)</label>
                  <input
                    type="text"
                    value={errorMsg}
                    onChange={(e) => setErrorMsg(e.target.value)}
                    placeholder="e.g. Uncaught TypeError: Cannot read property of undefined..."
                    className="crime-text-input"
                  />
                </div>
              </div>

              <div className="form-item code-item">
                <label className="crime-label">EVIDENCE FILE SOURCE MATERIAL</label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste code under investigation here..."
                  className="crime-code-area"
                />
              </div>

              <div className="crime-actions">
                <button type="submit" className="crime-submit-btn">
                  🔍 Initiate Forensic Scan
                </button>
              </div>
            </motion.form>
          )}

          {/* STEP: LOADING */}
          {appState === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="crime-loader-wrapper"
            >
              <div className="radar-scanner">
                <div className="radar-sweep" />
                <div className="radar-blip b1" />
                <div className="radar-blip b2" />
                <span className="radar-core">🔍</span>
              </div>
              <h3 className="loader-title">FORENSIC RULE ANALYSIS ENGINE RUNNING</h3>
              <p className="loader-desc">Tracing syntax tree nodes and compiling telemetry report...</p>
            </motion.div>
          )}

          {/* STEP: DASHBOARD */}
          {appState === 'dashboard' && result && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="crime-dashboard"
            >
              {/* Case Header */}
              <div className="case-header-card" style={{ borderLeftColor: getSeverityColor(result.verdict?.severity) }}>
                <div className="case-header-meta">
                  <span className="case-id glow-text">{result.caseId}</span>
                  <div className="case-category">
                    {result.verdict?.category} // SEVERITY: <span style={{ color: getSeverityColor(result.verdict?.severity) }}>{result.verdict?.severity}</span>
                  </div>
                </div>
                <div className="case-title-row">
                  <h3 className="case-title">{result.verdict?.title}</h3>
                  <button 
                    onClick={() => {
                      setAppState('input');
                      setResult(null);
                    }} 
                    className="crime-reset-btn"
                  >
                    Archive Case File
                  </button>
                </div>
              </div>

              {/* Main Matrix Grid */}
              <div className="crime-grid">
                
                {/* Left Column: Code and Timeline */}
                <div className="crime-grid-col">
                  {/* Code Panel */}
                  <div className="crime-card code-scene-card">
                    <h3 className="crime-sect-title">CRIME SCENE SOURCE EVIDENCE</h3>
                    <div className="evidence-code-box">
                      {evidence.code.split('\n').map((line, idx) => {
                        const lineNum = idx + 1;
                        const isSuspect = lineNum === result.crimeScene?.suspectLine;
                        return (
                          <div 
                            key={idx} 
                            className={`code-line-row ${isSuspect ? 'line-suspect' : ''}`}
                            style={{ borderLeftColor: isSuspect ? getSeverityColor(result.verdict?.severity) : 'transparent' }}
                          >
                            <span className="line-num-lbl">{lineNum}</span>
                            <span className="line-text">{line}</span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="victim-box">
                      <span className="victim-lbl">THE VICTIM:</span>
                      <span className="victim-name glow-text">{result.crimeScene?.theVictim}</span>
                    </div>
                    
                    <div className="victim-box margin-t">
                      <span className="victim-lbl">THE WEAPON:</span>
                      <span className="victim-name">{result.crimeScene?.theWeapon}</span>
                    </div>
                  </div>

                  {/* Timeline Panel */}
                  <ExecutionTimeline timeline={result.executionTimeline} />
                </div>

                {/* Right Column: Investigator notes */}
                <div className="crime-grid-col">
                  {/* Synopsis Panel */}
                  <div className="crime-card">
                    <h3 className="crime-sect-title">INVESTIGATOR NOIR SYNOPSIS</h3>
                    <p className="synopsis-quote">
                      "{result.investigationNotes?.synopsis}"
                    </p>
                    
                    <h3 className="crime-sect-title margin-t-2">FORENSIC BREAKDOWN EVIDENCE</h3>
                    <p className="forensic-breakdown-text">
                      {result.investigationNotes?.forensicEvidence}
                    </p>
                  </div>

                  {/* Rehab / Recommendation Panel */}
                  <div className="crime-card rehab-card">
                    <h3 className="crime-sect-title">CRIMINAL REHABILITATION PLAN</h3>
                    <p className="rehab-text">
                      {result.investigationNotes?.recommendation}
                    </p>
                  </div>
                </div>

              </div>

              {/* Lab Footer */}
              <div className="crime-lab-footer">
                <span>LAB RELIABILITY CONFIDENCE: {result.metadata?.confidenceScore}%</span>
                <span>FORENSIC TELEMETRY TIMESTAMP: {new Date().toISOString()}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CrimeInspector;
