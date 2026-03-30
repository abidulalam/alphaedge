/**
 * Integration tests for POST /api/chat
 * Mocks the Groq API fetch call.
 */

// Mock global fetch before importing the route
const mockFetch = jest.fn()
global.fetch = mockFetch

import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const GROQ_SUCCESS = {
  choices: [{ message: { content: 'NVDA looks bullish based on the signals.' } }],
}

beforeEach(() => {
  mockFetch.mockReset()
  process.env.GROQ_API_KEY = 'test-groq-key'
})

afterEach(() => {
  delete process.env.GROQ_API_KEY
})

describe('POST /api/chat', () => {
  it('returns 400 when messages is missing', async () => {
    const res = await POST(makeRequest({ stockContext: null }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/messages required/i)
  })

  it('returns 400 when messages is not an array', async () => {
    const res = await POST(makeRequest({ messages: 'hello' }))
    expect(res.status).toBe(400)
  })

  it('returns 500 when GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY
    const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/api key/i)
  })

  it('returns AI reply on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => GROQ_SUCCESS,
    })
    const res = await POST(makeRequest({
      messages: [{ role: 'user', content: 'Should I buy NVDA?' }],
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reply).toBe('NVDA looks bullish based on the signals.')
  })

  it('includes stock context in system prompt when provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => GROQ_SUCCESS })

    const stockContext = {
      ticker: 'AAPL', name: 'Apple Inc.', price: 180, changePct: 1.5,
      marketCap: 2.8e12, sector: 'Technology', pe: 28, moatScore: 85,
    }
    await POST(makeRequest({ messages: [{ role: 'user', content: 'hi' }], stockContext }))

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const systemMsg = callBody.messages.find((m: any) => m.role === 'system')
    expect(systemMsg).toBeDefined()
    expect(systemMsg.content).toContain('AAPL')
    expect(systemMsg.content).toContain('Apple Inc.')
  })

  it('uses generic system prompt when no stock context', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => GROQ_SUCCESS })
    await POST(makeRequest({ messages: [{ role: 'user', content: 'what is PE ratio?' }] }))

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    const systemMsg = callBody.messages.find((m: any) => m.role === 'system')
    expect(systemMsg.content).toContain('financial analyst')
  })

  it('returns 500 when Groq API returns an error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'rate limit exceeded',
    })
    const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/api error/i)
  })

  it('sends the correct model and temperature to Groq', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => GROQ_SUCCESS })
    await POST(makeRequest({ messages: [{ role: 'user', content: 'hi' }] }))

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.model).toBe('llama-3.1-8b-instant')
    expect(callBody.temperature).toBe(0.7)
    expect(callBody.max_tokens).toBe(512)
  })

  it('passes full message history to Groq', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => GROQ_SUCCESS })
    const messages = [
      { role: 'user', content: 'first message' },
      { role: 'assistant', content: 'first reply' },
      { role: 'user', content: 'second message' },
    ]
    await POST(makeRequest({ messages }))

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    // system + 3 history messages
    expect(callBody.messages.length).toBe(4)
  })

  it('returns fallback text when choices is empty', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [] }) })
    const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reply).toBe('No response generated.')
  })
})
