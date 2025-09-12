"use client";

import React, { useEffect, useState } from "react";
import MessageContent from "./MessageContent";

export default function SpiritJournalChat({ selectedSymbol, setSelectedSymbol }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "assistant",
      content:
        "Welcome to your AI Trading Assistant! I can help you with market analysis, trade journaling, calculations, and answer any trading questions. You can also pop out a TradingView widget for any major FX pair. What would you like to explore today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showWidget, setShowWidget] = useState(false);
  const [widgetSymbol, setWidgetSymbol] = useState("EURUSD");
  const [showJournalEntries, setShowJournalEntries] = useState(false);
  const [journalEntries, setJournalEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const majorFxPairs = [
    { symbol: "EURUSD", name: "EUR/USD", flag: "🇪🇺🇺🇸" },
    { symbol: "GBPUSD", name: "GBP/USD", flag: "🇬🇧🇺🇸" },
    { symbol: "USDJPY", name: "USD/JPY", flag: "🇺🇸🇯🇵" },
    { symbol: "USDCHF", name: "USD/CHF", flag: "🇺🇸🇨🇭" },
    { symbol: "AUDUSD", name: "AUD/USD", flag: "🇦🇺🇺🇸" },
    { symbol: "USDCAD", name: "USD/CAD", flag: "🇺🇸🇨🇦" },
    { symbol: "NZDUSD", name: "NZD/USD", flag: "🇳🇿🇺🇸" },
    { symbol: "EURJPY", name: "EUR/JPY", flag: "🇪🇺🇯🇵" },
  ];

  // Initialize TradingView widget when showWidget changes
  useEffect(() => {
    if (showWidget && typeof window !== "undefined" && window.TradingView) {
      const initWidget = () => {
        new window.TradingView.widget({
          width: "100%",
          height: 400,
          symbol: `FX_IDC:${widgetSymbol}`,
          interval: "60",
          timezone: "Etc/UTC",
          theme: "light",
          style: "1",
          locale: "en",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: "tradingview_widget_container",
          studies: ["RSI@tv-basicstudies", "MASimple@tv-basicstudies"],
          show_popup_button: true,
          popup_width: "1000",
          popup_height: "650",
        });
      };

      const timer = setTimeout(initWidget, 100);
      return () => clearTimeout(timer);
    }
  }, [showWidget, widgetSymbol]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Check if message is a calculation
      if (isCalculation(inputMessage)) {
        const result = performCalculation(inputMessage);
        const calcMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: `**Calculation Result:**\n${inputMessage} = **${result}**`,
          timestamp: new Date().toISOString(),
          isCalculation: true,
        };
        setMessages((prev) => [...prev, calcMessage]);
        setIsLoading(false);
        return;
      }

      // Send to AI
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: inputMessage,
          chatHistory: messages.slice(-10),
        }),
      });

      const data = await response.json();

      if (data.success) {
        const aiMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: data.message,
          timestamp: data.timestamp,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const isCalculation = (message) => {
    const mathPattern = /^[\d\s+\-*/().%]+$/;
    return mathPattern.test(message.replace(/[,]/g, ""));
  };

  const performCalculation = (expression) => {
    try {
      const cleanExpression = expression
        .replace(/[,]/g, "")
        .replace(/[^0-9+\-*/().%\s]/g, "");
      const result = Function('"use strict"; return (' + cleanExpression + ")")();
      return typeof result === "number" ? result.toLocaleString() : "Invalid calculation";
    } catch {
      return "Invalid calculation";
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openTradingViewWidget = (symbol) => {
    setWidgetSymbol(symbol);
    setShowWidget(true);
  };

  const formatDateTime = (date = new Date()) => {
    const dateStr = date.toLocaleDateString("en-US");
    const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return { dateStr, timeStr };
  };

  const formatDatabaseDateTime = (utcDateString) => {
    const localDate = new Date(utcDateString);
    return formatDateTime(localDate);
  };

  const saveJournalEntry = async () => {
    if (messages.length <= 1 || isSaving) return;

    setIsSaving(true);
    try {
      const { dateStr, timeStr } = formatDateTime();

      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Trading Journal - ${dateStr} at ${timeStr}`,
          conversationData: messages,
          messageCount: messages.length,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages([
          {
            id: Date.now(),
            role: "assistant",
            content:
              "Journal entry saved successfully! Starting a new conversation. How can I help you today?",
            timestamp: new Date().toISOString(),
          },
        ]);

        if (showJournalEntries) {
          loadJournalEntries();
        }
      } else {
        throw new Error(data.error || "Failed to save entry");
      }
    } catch (error) {
      console.error("Save error:", error);
      const errorMessage = {
        id: Date.now(),
        role: "assistant",
        content: "Sorry, I couldn't save your journal entry. Please try again.",
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSaving(false);
    }
  };

  const loadJournalEntries = async () => {
    try {
      const response = await fetch("/api/journal");
      const data = await response.json();

      if (data.success) {
        setJournalEntries(data.entries);
      } else {
        console.error("Failed to load journal entries:", data.error);
      }
    } catch (error) {
      console.error("Load entries error:", error);
    }
  };

  const loadJournalEntry = async (entryId) => {
    try {
      const response = await fetch(`/api/journal/${entryId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedEntry(data.entry);
      } else {
        console.error("Failed to load journal entry:", data.error);
      }
    } catch (error) {
      console.error("Load entry error:", error);
    }
  };

  const startNewConversation = () => {
    setShowJournalEntries(false);
    setSelectedEntry(null);
    setMessages([
      {
        id: Date.now(),
        role: "assistant",
        content:
          "Welcome back! Starting a new conversation. How can I help you today?",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  useEffect(() => {
    if (showJournalEntries) {
      loadJournalEntries();
    }
  }, [showJournalEntries]);

  const quickActions = [
    { icon: "📊", text: "Market Analysis", action: () => setInputMessage("Can you provide a market analysis for the major FX pairs today?") },
    { icon: "🧮", text: "Position Size Calculator", action: () => setInputMessage("Help me calculate position size for a trade with 2% risk on a $10,000 account") },
    { icon: "📝", text: "Trade Journal", action: () => setInputMessage("Help me journal my last trade and analyze what went well and what could be improved") },
    { icon: "💡", text: "Trading Tips", action: () => setInputMessage("Give me 3 practical trading tips for forex trading") },
  ];

  if (showJournalEntries) {
    return (
      <div className="section-content">
        <div className="section-header">
          <h1>Journal Entries</h1>
          <p>View your saved trading conversations and insights</p>
          <button onClick={startNewConversation} className="new-conversation-button">← Start New Conversation</button>
        </div>

        {selectedEntry ? (
          <div className="journal-entry-view">
            <div className="entry-header">
              <h3>{selectedEntry.title}</h3>
              <div className="entry-meta">
                <span>📅 {formatDatabaseDateTime(selectedEntry.created_at).dateStr}</span>
                <span>🕐 {formatDatabaseDateTime(selectedEntry.created_at).timeStr}</span>
                <span>💬 {selectedEntry.message_count} messages</span>
                <button onClick={() => setSelectedEntry(null)} className="back-to-list-button">← Back to List</button>
              </div>
            </div>

            <div className="entry-conversation">
              {selectedEntry.conversation_data.map((message) => (
                <div key={message.id} className={`message ${message.role === "user" ? "user-message" : "ai-message"}`}>
                  <div className="message-avatar">
                    {message.role === "user" ? <div className="user-avatar">U</div> : <div className="ai-avatar">🤖</div>}
                  </div>
                  <div className="message-content">
                    <div className={`message-text ${message.isCalculation ? "calculation-result" : ""}`}>
                      <MessageContent content={message.content} />
                    </div>
                    <div className="message-time">{new Date(message.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="journal-entries-list">
            {journalEntries.length === 0 ? (
              <div className="empty-journal">
                <div className="empty-icon">📝</div>
                <h3>No Journal Entries Yet</h3>
                <p>Start a conversation and save it as a journal entry to see it here.</p>
              </div>
            ) : (
              <div className="entries-grid">
                {journalEntries.map((entry) => (
                  <div key={entry.id} className="entry-card" onClick={() => loadJournalEntry(entry.id)}>
                    <h4>{entry.title}</h4>
                    <div className="entry-stats">
                      <span>💬 {entry.message_count} messages</span>
                      <span>📅 {formatDatabaseDateTime(entry.created_at).dateStr}</span>
                      <span>🕐 {formatDatabaseDateTime(entry.created_at).timeStr}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="section-content">
      <div className="section-header">
        <h1>AI Trading Assistant</h1>
        <p>Chat with AI, perform calculations, and analyze markets with integrated TradingView widgets</p>
        <div className="header-actions">
          <button onClick={() => setShowJournalEntries(true)} className="view-journal-button">📚 View Journal Entries</button>
          {messages.length > 1 && (
            <button onClick={saveJournalEntry} disabled={isSaving} className="save-entry-button">
              {isSaving ? "💾 Saving..." : "💾 Save Entry"}
            </button>
          )}
        </div>
      </div>

      <div className="chat-interface">
        <div className="chat-messages-container">
          <div className="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.role === "user" ? "user-message" : "ai-message"}`}>
                <div className="message-avatar">
                  {message.role === "user" ? <div className="user-avatar">U</div> : <div className="ai-avatar">🤖</div>}
                </div>
                <div className="message-content">
                  <div className={`message-text ${message.isCalculation ? "calculation-result" : ""} ${message.isError ? "error-message" : ""}`}>
                    <MessageContent content={message.content} />
                  </div>
                  <div className="message-time">{new Date(message.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message ai-message">
                <div className="message-avatar">
                  <div className="ai-avatar">🤖</div>
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="chat-input-section">
          <div className="chat-input-container">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask questions, perform calculations (e.g., 100 * 1.5 + 25), or request market analysis..."
              className="chat-input"
              rows="2"
              disabled={isLoading}
            />
            <button onClick={sendMessage} disabled={!inputMessage.trim() || isLoading} className="send-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="2" />
                <polygon points="22,2 15,22 11,13 2,9 22,2" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>

        <div className="quick-actions-section">
          <h4>Quick Actions</h4>
          <div className="quick-actions-grid">
            {quickActions.map((action, index) => (
              <button key={index} onClick={action.action} className="quick-action-button">
                <span className="action-icon">{action.icon}</span>
                <span className="action-text">{action.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="tradingview-section">
          <div className="tradingview-header">
            <h4>TradingView Charts - Major FX Pairs</h4>
            <div className="fx-pairs-grid">
              {majorFxPairs.map((pair) => (
                <button key={pair.symbol} onClick={() => openTradingViewWidget(pair.symbol)} className="fx-pair-button">
                  <span className="pair-flag">{pair.flag}</span>
                  <span className="pair-name">{pair.name}</span>
                </button>
              ))}
            </div>
          </div>

          {showWidget && (
            <div className="tradingview-widget-section">
              <div className="widget-header">
                <h5>📈 {widgetSymbol} Chart</h5>
                <button onClick={() => setShowWidget(false)} className="close-widget-button">✕</button>
              </div>
              <div id="tradingview_widget_container" className="tradingview-widget"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

