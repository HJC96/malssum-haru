import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256, validateCatalog } from './validate.mjs';

// Test values are explicitly placeholders; this fixture contains no Scripture or approved editorial content.
const fixture = () => {
  const makeCandidate = (testament, bookId, chapter, verse) => {
    const text = '[TEST FIXTURE — NOT SCRIPTURE]';
    return {
      id: `${testament === 'oldTestament' ? 'ot' : 'nt'}-${bookId.toLowerCase()}-${chapter}-${verse}`,
      testament,
      reference: { bookId, chapter, verse },
      text,
      source: {
        name: 'Test-only placeholder',
        url: 'https://example.invalid/test-only',
        textSha256: sha256(text),
      },
      explanation: {
        text: '[TEST FIXTURE — NOT AN EXPLANATION]',
        language: 'ko',
        kind: 'editorial',
      },
      approval: {
        textStatus: 'pending',
        explanationStatus: 'pending',
        rightsStatus: 'pending',
        reviewedBy: '',
        reviewedAt: null,
        rightsEvidenceUrl: 'https://example.invalid/test-only-rights',
      },
    };
  };
  return {
    catalogVersion: 'fixture-v1',
    translationId: 'fixture-only',
    translationLanguage: 'ko',
    candidates: [makeCandidate('oldTestament', 'GEN', 1, 1), makeCandidate('newTestament', 'MAT', 1, 1)],
  };
};

test('accepts a structurally valid OT/NT catalog fixture', () => {
  assert.deepEqual(validateCatalog(fixture()), []);
});

test('rejects wrong testament, duplicate reference, and content hash mismatch', () => {
  const manifest = fixture();
  manifest.candidates[0].testament = 'newTestament';
  manifest.candidates[1].reference = { bookId: 'GEN', chapter: 1, verse: 1 };
  manifest.candidates[1].id = 'nt-gen-1-1';
  manifest.candidates[0].source.textSha256 = '0'.repeat(64);
  const errors = validateCatalog(manifest);
  assert(errors.some((error) => error.includes('wrong testament')));
  assert(errors.some((error) => error.includes('duplicates reference')));
  assert(errors.some((error) => error.includes('does not match')));
});

test('requires explicit rights and explanation review metadata', () => {
  const manifest = fixture();
  manifest.candidates[0].approval.rightsStatus = 'unknown';
  manifest.candidates[1].approval = null;
  const errors = validateCatalog(manifest);
  assert(errors.some((error) => error.includes('approval.rightsStatus must be pending, approved, or rejected')));
  assert(errors.some((error) => error.includes('approval must record explicit human review states')));
});

test('rejects an empty pool and an unknown book ID', () => {
  const empty = fixture();
  empty.candidates = [];
  assert(validateCatalog(empty).some((error) => error.includes('at least one candidate')));

  const unknown = fixture();
  unknown.candidates[0].reference.bookId = 'ZZZ';
  assert(validateCatalog(unknown).some((error) => error.includes('supported Bible catalog')));
});

test('requires all three human approvals for publication mode', () => {
  assert(validateCatalog(fixture(), undefined, { requireApproved: true })
    .some((error) => error.includes('fully approved before publication')));
});
