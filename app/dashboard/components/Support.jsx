"use client";

import React from "react";

export default function Support() {
  return (
    <div className="section-content">
      <div className="section-header">
        <h1>Support & Feedback</h1>
        <p>Get help from our team or share your suggestions and complaints</p>
      </div>

      <div className="support-options">
        <div className="support-card">
          <div className="support-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M21 15A2 2 0 0 1 19 17H7L4 20V5A2 2 0 0 1 6 3H19A2 2 0 0 1 21 5Z" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h3>Live Chat</h3>
          <p>Chat with our AI assistant or connect with a human agent</p>
          <button className="support-button">Start Chat</button>
        </div>

        <div className="support-card">
          <div className="support-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" />
              <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h3>Email Support</h3>
          <p>Send us detailed questions or feedback via email</p>
          <button className="support-button">Send Email</button>
        </div>

        <div className="support-card">
          <div className="support-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M9 11H15M9 15H15M17 21L12 16L7 21V5A2 2 0 0 1 9 3H15A2 2 0 0 1 17 5V21Z" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h3>Submit Feedback</h3>
          <p>Share suggestions, complaints, or feature requests</p>
          <button className="support-button">Give Feedback</button>
        </div>
      </div>
    </div>
  );
}

