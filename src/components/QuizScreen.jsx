import React, { useState } from 'react'
import './QuizScreen.css'

export default function QuizScreen() {
  const [selected, setSelected] = useState({ lazy: true, motivation: false, time: false, hard: false })
  const [text, setText] = useState('')

  const toggle = (k) => setSelected((s) => ({ ...s, [k]: !s[k] }))

  return (
    <div className="quiz-layout">
      <div className="quiz-wrap">
        <div className="quiz-shell">
          <div className="quiz-frame">
            <div className="header-row">
              <div className="title">QUIZ</div>
              <div className="progress-outer" aria-hidden>
                <div className="progress-track">
                  <div className="progress-bar" style={{ width: '50%' }} />
                </div>
              </div>
            </div>

            <div className="single-page">
              <div className="question">What is stopping you from achieving your goal?</div>

              <div className="options">
                <button className={`option ${selected.lazy ? 'on' : ''}`} onClick={() => toggle('lazy')}>
                  <span className="tick">✓</span>
                  Too Lazy
                </button>

                <button className={`option ${selected.motivation ? 'on' : ''}`} onClick={() => toggle('motivation')}>
                  <span className="tick">✓</span>
                  Low Motivation
                </button>

                <button className={`option ${selected.time ? 'on' : ''}`} onClick={() => toggle('time')}>
                  <span className="tick">✓</span>
                  Don't Have Time
                </button>

                <button className={`option ${selected.hard ? 'on' : ''}`} onClick={() => toggle('hard')}>
                  <span className="tick">✓</span>
                  Too Hard
                </button>
              </div>

              <label className="custom-label">Type your own problem...</label>
              <textarea
                className="custom-input"
                placeholder="Type here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <div className="footer-row">
              <button className="btn ghost" type="button" disabled aria-label="Back">Back</button>
              <button className="btn neon" type="button" disabled aria-label="Next">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
