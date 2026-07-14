import { describe, expect, it } from 'vitest';
import { makeThinkTagDemux } from './index';

function collect() {
  const text: string[] = [];
  const thinking: string[] = [];
  const demux = makeThinkTagDemux(
    (d) => text.push(d),
    (d) => thinking.push(d),
  );
  return { demux, text: () => text.join(''), thinking: () => thinking.join('') };
}

describe('makeThinkTagDemux', () => {
  it('passes plain text through untouched', () => {
    const c = collect();
    c.demux.push('hello ');
    c.demux.push('world');
    c.demux.flush();
    expect(c.text()).toBe('hello world');
    expect(c.thinking()).toBe('');
  });

  it('routes a think span to the thinking callback', () => {
    const c = collect();
    c.demux.push('<think>pondering</think>answer');
    c.demux.flush();
    expect(c.thinking()).toBe('pondering');
    expect(c.text()).toBe('answer');
  });

  it('handles tags split across delta boundaries', () => {
    const c = collect();
    c.demux.push('<th');
    c.demux.push('ink>reason');
    c.demux.push('ing</thi');
    c.demux.push('nk>done');
    c.demux.flush();
    expect(c.thinking()).toBe('reasoning');
    expect(c.text()).toBe('done');
  });

  it('holds back a possible partial tag until the next delta disambiguates', () => {
    const c = collect();
    c.demux.push('abc<');
    expect(c.text()).toBe('abc');
    c.demux.push('b>def');
    c.demux.flush();
    expect(c.text()).toBe('abc<b>def');
  });

  it('emits a held partial tag on flush', () => {
    const c = collect();
    c.demux.push('abc<think');
    c.demux.flush();
    expect(c.text()).toBe('abc<think');
    expect(c.thinking()).toBe('');
  });

  it('routes an unterminated think span to thinking', () => {
    const c = collect();
    c.demux.push('<think>never closed');
    c.demux.flush();
    expect(c.thinking()).toBe('never closed');
    expect(c.text()).toBe('');
  });

  it('handles multiple think spans in one stream', () => {
    const c = collect();
    c.demux.push('a<think>x</think>b<think>y</think>c');
    c.demux.flush();
    expect(c.text()).toBe('abc');
    expect(c.thinking()).toBe('xy');
  });
});
