import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256, validateCatalog } from './validate.mjs';

// Test values are explicitly placeholders; this fixture contains no Scripture or approved editorial content.
const fixture = () => {
  const makeCandidate = (testament, bookId, chapter, verse) => {
    const text = '[TEST FIXTURE — NOT SCRIPTURE]';
    return {
      candidateId: `${testament}:${bookId}:${chapter}:${verse}`,
      testament,
      reference: { bookId, chapter, verse },
      text,
      textSha256: sha256(text),
      source: {
        name: 'Test-only placeholder',
        url: 'https://example.invalid/test-only',
        accessedAt: '2026-09-27T00:00:00Z',
      },
      rightsReview: {
        status: 'approved',
        basis: 'Test-only placeholder; not a rights assertion',
        reviewer: 'test fixture',
        reviewedAt: '2026-09-27T00:00:00Z',
        evidenceUrl: 'https://example.invalid/test-only-rights',
      },
      explanation: {
        text: '[TEST FIXTURE — NOT AN EXPLANATION]',
        language: 'ko',
        status: 'approved',
        reviewer: 'test fixture',
        reviewedAt: '2026-09-27T00:00:00Z',
      },
    };
  };
  return {
    schemaVersion: '1',
    poolVersion: 'fixture-v1',
    translationId: 'fixture-only',
    textLanguage: 'ko',
    candidates: [makeCandidate('OT', 'GEN', 1, 1), makeCandidate('NT', 'MAT', 1, 1)],
  };
};

test('accepts a structurally valid OT/NT catalog fixture', () => {
  assert.deepEqual(validateCatalog(fixture()), []);
});

test('rejects wrong testament, duplicate reference, and content hash mismatch', () => {
  const manifest = fixture();
  manifest.candidates[0].testament = 'NT';
  manifest.candidates[1].reference = { bookId: 'GEN', chapter: 1, verse: 1 };
  manifest.candidates[1].candidateId = 'NT:GEN:1:1';
  manifest.candidates[0].textSha256 = '0'.repeat(64);
  const errors = validateCatalog(manifest);
  assert(errors.some((error) => error.includes('wrong testament')));
  assert(errors.some((error) => error.includes('duplicates reference')));
  assert(errors.some((error) => error.includes('does not match')));
});

test('requires explicit rights and explanation review metadata', () => {
  const manifest = fixture();
  manifest.candidates[0].rightsReview.status = 'pending';
  manifest.candidates[1].explanation.reviewer = '';
  const errors = validateCatalog(manifest);
  assert(errors.some((error) => error.includes('rightsReview.status must be approved')));
  assert(errors.some((error) => error.includes('explanation.reviewer must be a non-empty string')));
});

test('rejects an empty pool and an unknown book ID', () => {
  const empty = fixture();
  empty.candidates = [];
  assert(validateCatalog(empty).some((error) => error.includes('at least one approved candidate')));

  const unknown = fixture();
  unknown.candidates[0].reference.bookId = 'ZZZ';
  assert(validateCatalog(unknown).some((error) => error.includes('supported Bible catalog')));
});
