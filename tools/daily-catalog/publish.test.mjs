import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { verifyPublishableArtifact } from './publish.mjs';

const source = JSON.parse(readFileSync(new URL('../../services/daily-content/src/main/resources/catalog/candidate-catalog-v1.json', import.meta.url), 'utf8'));
const copy = (value) => structuredClone(value);

function approvedPair() {
  const catalog = copy(source);
  for (const candidate of catalog.candidates) {
    candidate.approval = { ...candidate.approval, textStatus: 'approved', explanationStatus: 'approved',
      rightsStatus: 'approved', reviewedBy: 'test reviewer', reviewedAt: '2026-09-27' };
  }
  const [old, current] = catalog.candidates;
  const passage = (candidate) => ({
    reference: copy(candidate.reference), translationId: catalog.translationId,
    textLanguage: catalog.translationLanguage, text: candidate.text,
    explanation: copy(candidate.explanation),
    source: { name: candidate.source.name, url: candidate.source.url },
  });
  const date = '2026-10-01';
  const identity = ['daily-word-v1', date, catalog.catalogVersion,
    old.id, old.text, old.explanation.text, current.id, current.text, current.explanation.text].join('\n');
  const hash = createHash('sha256').update(identity).digest('hex').slice(0, 16);
  return { catalog, artifact: {
    schemaVersion: '1', date, timeZone: 'Asia/Seoul', contentVersion: `daily-word-${date}-${hash}`,
    oldTestament: passage(old), newTestament: passage(current),
  } };
}

test('reviewed OT and NT artifact is publishable only with its matching version', () => {
  const { artifact, catalog } = approvedPair();
  assert.equal(verifyPublishableArtifact(artifact, catalog).date, '2026-10-01');
  artifact.contentVersion = 'daily-word-2026-10-01-v1';
  assert.throws(() => verifyPublishableArtifact(artifact, catalog), /contentVersion/);
});

test('pending rights and altered verse or explanation fail closed', () => {
  const { artifact, catalog } = approvedPair();
  catalog.candidates[0].approval.rightsStatus = 'pending';
  assert.throws(() => verifyPublishableArtifact(artifact, catalog), /not fully approved/);
  catalog.candidates[0].approval.rightsStatus = 'approved';
  artifact.oldTestament.text += ' changed';
  assert.throws(() => verifyPublishableArtifact(artifact, catalog), /differs from its reviewed candidate/);
  artifact.oldTestament.text = catalog.candidates[0].text;
  artifact.newTestament.explanation.text += ' changed';
  assert.throws(() => verifyPublishableArtifact(artifact, catalog), /differs from its reviewed candidate/);
});
