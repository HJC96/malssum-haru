#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog } from './validate.mjs';

const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Verify the exact reviewed text and explanation before an artifact can leave this repository. */
export function verifyPublishableArtifact(artifact, catalog) {
  const errors = validateCatalog(catalog);
  if (errors.length) throw new Error(`Catalog invalid: ${errors.join('; ')}`);
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)
      || artifact.schemaVersion !== '1' || artifact.timeZone !== 'Asia/Seoul'
      || !validDate(artifact.date)) {
    throw new Error('Artifact must have a valid date and DailyWordContent v1 envelope');
  }
  const selected = [];
  for (const testament of ['oldTestament', 'newTestament']) {
    const passage = artifact[testament];
    const reference = passage?.reference;
    const candidate = catalog.candidates.find((item) => item.testament === testament
      && item.reference.bookId === reference?.bookId
      && item.reference.chapter === reference?.chapter
      && item.reference.verse === reference?.verse);
    if (!candidate) throw new Error(`${testament} is absent from the reviewed catalog`);
    const approval = candidate.approval;
    if (['textStatus', 'explanationStatus', 'rightsStatus'].some((key) => approval[key] !== 'approved')
        || !approval.reviewedBy?.trim() || !approval.reviewedAt || !approval.rightsEvidenceUrl?.trim()) {
      throw new Error(`${testament} is not fully approved for publication`);
    }
    const expected = {
      reference: candidate.reference,
      translationId: catalog.translationId,
      textLanguage: catalog.translationLanguage,
      text: candidate.text,
      explanation: candidate.explanation,
      source: { name: candidate.source.name, url: candidate.source.url },
    };
    if (JSON.stringify(passage) !== JSON.stringify(expected)) {
      throw new Error(`${testament} differs from its reviewed candidate`);
    }
    selected.push(candidate);
  }
  const identity = ['daily-word-v1', artifact.date, catalog.catalogVersion,
    selected[0].id, selected[0].text, selected[0].explanation.text,
    selected[1].id, selected[1].text, selected[1].explanation.text].join('\n');
  const expectedVersion = `daily-word-${artifact.date}-${digest(identity).slice(0, 16)}`;
  if (artifact.contentVersion !== expectedVersion) throw new Error('Artifact contentVersion differs from reviewed content');
  const keys = Object.keys(artifact).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['contentVersion', 'date', 'newTestament', 'oldTestament', 'schemaVersion', 'timeZone'])) {
    throw new Error('Artifact contains unsupported fields');
  }
  return { date: artifact.date, contentVersion: expectedVersion };
}

function aws(args) {
  const result = spawnSync('aws', ['s3api', ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.error) throw result.error;
  return result;
}

function option(args, name) {
  const prefix = `--${name}=`;
  const found = args.filter((arg) => arg.startsWith(prefix));
  if (found.length !== 1 || found[0].slice(prefix.length) === '') throw new Error(`Exactly one ${prefix}<value> is required`);
  return found[0].slice(prefix.length);
}

function main(args) {
  const allowed = ['file', 'catalog', 'bucket'];
  if (args.some((arg) => arg !== '--publish' && !allowed.some((name) => arg.startsWith(`--${name}=`)))) {
    throw new Error('Usage: publish.mjs --file=path --catalog=path --bucket=name [--publish]');
  }
  const file = resolve(option(args, 'file'));
  const catalog = JSON.parse(readFileSync(resolve(option(args, 'catalog')), 'utf8'));
  const bucket = option(args, 'bucket');
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Invalid S3 bucket name');
  const bytes = readFileSync(file);
  const artifact = JSON.parse(bytes.toString('utf8'));
  const { date, contentVersion } = verifyPublishableArtifact(artifact, catalog);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const key = `daily-word/${date}.json`;
  if (!args.includes('--publish')) {
    console.log(`Validated ${key} (${contentVersion}, SHA-256 ${sha256}). Add --publish for conditional S3 upload.`);
    return;
  }
  const result = aws(['put-object', '--bucket', bucket, '--key', key, '--body', file,
    '--content-type', 'application/json; charset=utf-8',
    '--cache-control', 'public, max-age=60, s-maxage=300',
    '--metadata', `sha256=${sha256}`, '--if-none-match', '*']);
  if (result.status === 0) {
    console.log(`Published s3://${bucket}/${key} (${contentVersion})`);
    return;
  }
  if (!/PreconditionFailed|412/.test(result.stderr)) {
    throw new Error(`S3 upload failed: ${result.stderr.trim()}`);
  }
  const existing = aws(['head-object', '--bucket', bucket, '--key', key, '--query', 'Metadata.sha256', '--output', 'text']);
  if (existing.status === 0 && existing.stdout.trim() === sha256) {
    console.log(`Already published with identical SHA-256: s3://${bucket}/${key}`);
    return;
  }
  throw new Error(`Different content already exists at s3://${bucket}/${key}; use a reviewed correction workflow`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
