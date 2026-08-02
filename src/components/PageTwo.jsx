import React from 'react'

export default function PageTwo({ selected, text, setText, toggle }) {
  const options = [
    { key: 'plan', label: 'MAKE A PLAN' },
    { key: 'timer', label: 'SET A TIMER' },
    { key: 'accountability', label: 'GET ACCOUNTABILITY' },
    { key: 'startsmall', label: 'START SMALL' },
  ]

  return (
    <div className="page page-2-inner">
      <div className="question">HOW WILL YOU START?</div>

      <div className="options">
        {options.map((o) => (
          <button
            key={o.key}
            className={`option ${selected[o.key] ? 'on' : ''}`}
            onClick={() => toggle(o.key)}
          >
            <span className="tick">✓</span>
            {o.label}
          </button>
        ))}
      </div>

      <label className="custom-label">ADD DETAILS / PLAN:</label>
      <textarea
        className="custom-input"
        placeholder="TYPE HERE..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  )
}
