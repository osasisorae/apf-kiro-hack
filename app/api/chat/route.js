import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request) {
  try {
    const { message, chatHistory = [] } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // System prompt for the AI trading assistant
    const systemPrompt = `You are an expert AI trading assistant for Aurum Prop Firm, specializing in forex and commodities trading. Your role is to help traders with:

1. Market Analysis: Provide insights on forex pairs (EUR/USD, GBP/USD, USD/JPY, etc.) and commodities (Gold, Silver, Oil)
2. Trade Journaling: Help traders document and analyze their trades
3. Risk Management: Advise on proper position sizing, stop losses, and risk-reward ratios
4. Strategy Development: Assist with developing and refining trading strategies
5. Psychological Support: Help with trading psychology and discipline

Key guidelines:
- Always emphasize risk management and proper position sizing
- Provide educational content to help traders improve
- Be supportive but realistic about trading challenges
- Reference current market conditions when relevant
- Encourage proper journaling and trade documentation
- Never provide financial advice or guarantee profits
- Focus on education and skill development

Respond in a helpful, professional, and encouraging tone. Keep responses concise but informative.`

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    })

    const aiResponse = completion.choices[0].message.content

    return NextResponse.json({
      success: true,
      message: aiResponse,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('OpenAI API error:', error)
    
    // Handle specific OpenAI errors
    if (error.code === 'insufficient_quota') {
      return NextResponse.json(
        { error: 'AI service temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to process your message. Please try again.' },
      { status: 500 }
    )
  }
}