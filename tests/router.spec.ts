import { test, expect } from '@playwright/test'
import { matchRuleBasedRoute } from '../lib/router'

test.describe('Hybrid Intent Router Unit Tests', () => {
  test('Routes casual greetings to CHAT', () => {
    expect(matchRuleBasedRoute('hi')?.route).toBe('CHAT')
    expect(matchRuleBasedRoute('hello there!')?.route).toBe('CHAT')
    expect(matchRuleBasedRoute('thanks so much')?.route).toBe('CHAT')
  })

  test('Routes general coding and programming questions to CHAT', () => {
    const pyRes = matchRuleBasedRoute('Give me a Python function to reverse a string')
    expect(pyRes?.route).toBe('CHAT')

    const divRes = matchRuleBasedRoute('how to center a div in CSS')
    expect(divRes?.route).toBe('CHAT')
  })

  test('Routes mathematical expressions to CHAT', () => {
    const mathRes = matchRuleBasedRoute('calculate 150 * 12')
    expect(mathRes?.route).toBe('CHAT')
  })

  test('Routes task actions and workspace summarization to TOOL', () => {
    const taskRes = matchRuleBasedRoute('create a task to review Q3 budget')
    expect(taskRes?.route).toBe('TOOL')

    const summaryRes = matchRuleBasedRoute('summarize workspace documents')
    expect(summaryRes?.route).toBe('TOOL')
  })

  test('Routes explicit document questions to RAG', () => {
    const docRes = matchRuleBasedRoute('According to the uploaded contract, what is the termination clause?')
    expect(docRes?.route).toBe('RAG')
  })

  test('Returns null for ambiguous queries to pass to Stage 2 LLM Classifier', () => {
    expect(matchRuleBasedRoute('What is the standard procedure for setting up local dev environments?')).toBeNull()
  })
})
