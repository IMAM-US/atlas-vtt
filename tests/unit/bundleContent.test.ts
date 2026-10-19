import { describe, expect, it } from 'vitest';
import { rewriteContent } from '../../src/app/services/collectionBundle/bundleContent';
import type { BundleFile } from '../../src/app/services/collectionBundle/bundleFormat';

const encode = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer;
const decode = (buffer: ArrayBuffer): string => new TextDecoder().decode(buffer);

describe('statblock notes', () => {
  const note: BundleFile = { vaultPath: 'B/g.md', role: 'statblock-note', statblockImage: { key: 'image', path: 'B/g.png' } };

  it('rewrites the artwork field it names, not an earlier line with the same value', () => {
    const raw = '---\ntoken-image: B/g.png\nimage: B/g.png\n---\nA goblin.';
    const rewritten = decode(rewriteContent(note, encode(raw), new Map([['B/g.png', "atlas-vtt/x/Gold$'s.png"]])));
    expect(rewritten).toBe('---\ntoken-image: B/g.png\nimage: "atlas-vtt/x/Gold$\'s.png"\n---\nA goblin.');
  });

  it('leaves notes whose artwork did not move, or that have no such field, byte for byte', () => {
    const raw = encode('---\nimage: B/g.png\n---\n');
    expect(rewriteContent(note, raw, new Map([['other', 'x']]))).toBe(raw);
    const plain = encode('No frontmatter here.');
    expect(rewriteContent(note, plain, new Map([['B/g.png', 'x']]))).toBe(plain);
  });
});

describe('JSON files', () => {
  const scene: BundleFile = { vaultPath: 'atlas-vtt/s.json', role: 'asset-file' };

  it('keeps the file\'s indentation and trailing newline when paths move', () => {
    const raw = `${JSON.stringify({ mapPath: 'a/b.atlasmap', n: 1 }, null, 2)}\n`;
    expect(decode(rewriteContent(scene, encode(raw), new Map([['a/b.atlasmap', 'c/b.atlasmap']]))))
      .toBe(`${JSON.stringify({ mapPath: 'c/b.atlasmap', n: 1 }, null, 2)}\n`);
  });

  it('returns the original bytes when no path in it moves', () => {
    const raw = encode('{"mapPath":"a/b.atlasmap"}');
    expect(rewriteContent(scene, raw, new Map([['elsewhere', 'x']]))).toBe(raw);
  });

  it('moves only the account path inside a source reference, even when native identities collide with rewrite keys', () => {
    const path = 'accounts/colleagues.json';
    const reference = { accountPath: path, subjectId: path, native: { nodeId: 'asset-1', accountPath: path } };
    const recordingReference = { recordingId: 'asset-1', sourceRevision: path, kind: 'seat', id: path };
    const raw = encode(JSON.stringify({ sourceReference: reference, recordingReference, imagePath: path }));
    const result = JSON.parse(decode(rewriteContent(scene, raw, new Map([[path, 'copied/account.json']]), new Map([['asset-1', 'asset-2']]))));
    expect(result.sourceReference).toEqual({ ...reference, accountPath: 'copied/account.json' });
    expect(result.recordingReference).toEqual(recordingReference);
    expect(result.imagePath).toBe('copied/account.json');
  });

  it('does not turn an unchanged account path into a new asset ID with the same spelling', () => {
    const sourceReference = { accountPath: 'account.json', subjectId: 'account.json', native: { nodeId: 'account.json' } };
    const raw = encode(JSON.stringify({ tokenId: 'account.json', sourceReference }));
    const result = JSON.parse(decode(rewriteContent(scene, raw, new Map(), new Map([['account.json', 'copied-asset']]))));
    expect(result).toEqual({ tokenId: 'copied-asset', sourceReference });
  });
});

it('carries account documents byte for byte without traversing native metadata or unqualified internal paths', () => {
  const file: BundleFile = { vaultPath: 'accounts/team.json', role: 'source-account' };
  const raw = encode('{ "version": 1, "nodeId": "asset-1", "path": "accounts/team.json", "native": {"file": "/private/example/native.json"} }\n');
  expect(rewriteContent(file, raw, new Map([['accounts/team.json', 'copied/team.json']]), new Map([['asset-1', 'asset-2']]))).toBe(raw);
});
