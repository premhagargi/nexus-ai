import { test, expect } from '@playwright/test'
import {
  normalizeText,
  buildSourceTitle,
  levenshteinDistance,
  fuzzyMatchToken,
} from '../lib/rag'

test.describe('RAG Engine & Utility Unit Tests', () => {
  test('normalizeText cleans whitespace and zero-width spaces', () => {
    const raw = '  Hello   World \u200B with   spaces  '
    expect(normalizeText(raw)).toBe('Hello World with spaces')
  })

  test('buildSourceTitle converts file basenames into human titles', () => {
    expect(buildSourceTitle('Q3_financial_report_v2.pdf')).toBe('Q3 financial report v2')
    expect(buildSourceTitle('project-architecture-notes.docx')).toBe('project architecture notes')
  })

  test('levenshteinDistance calculates correct edit distance', () => {
    expect(levenshteinDistance('cat', 'hat')).toBe(1)
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    expect(levenshteinDistance('same', 'same')).toBe(0)
  })

  test('fuzzyMatchToken detects typo matches within max distance', () => {
    expect(fuzzyMatchToken('revenue', 'Company quarterly revnue summary', 2)).toBe(true)
    expect(fuzzyMatchToken('budget', 'Completely unrelated text', 2)).toBe(false)
  })
})
