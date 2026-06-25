import { describe, test, expect } from 'vitest';
import { tokenizeInline, backlinksFor } from './wikiHelpers';
import type { Entry } from '../data/wikiData';

describe('tokenizeInline', () => {
  test('parses plain text', () => {
    const tokens = tokenizeInline('Hello world');
    expect(tokens).toEqual([{ type: 'text', content: 'Hello world' }]);
  });

  test('parses bold text', () => {
    const tokens = tokenizeInline('Hello **world**!');
    expect(tokens).toEqual([
      { type: 'text', content: 'Hello ' },
      { type: 'bold', content: 'world' },
      { type: 'text', content: '!' },
    ]);
  });

  test('parses inline code', () => {
    const tokens = tokenizeInline('Use `const` here.');
    expect(tokens).toEqual([
      { type: 'text', content: 'Use ' },
      { type: 'code', content: 'const' },
      { type: 'text', content: ' here.' },
    ]);
  });

  test('parses wiki-links without label', () => {
    const tokens = tokenizeInline('Check [[handbook/expenses]] now.');
    expect(tokens).toEqual([
      { type: 'text', content: 'Check ' },
      { type: 'wiki-link', target: 'handbook/expenses', label: 'handbook/expenses' },
      { type: 'text', content: ' now.' },
    ]);
  });

  test('parses wiki-links with custom label', () => {
    const tokens = tokenizeInline('Check [[handbook/expenses|expenses policy]] now.');
    expect(tokens).toEqual([
      { type: 'text', content: 'Check ' },
      { type: 'wiki-link', target: 'handbook/expenses', label: 'expenses policy' },
      { type: 'text', content: ' now.' },
    ]);
  });

  test('parses markdown link', () => {
    const tokens = tokenizeInline('Read [onboarding](handbook/onboarding) first.');
    expect(tokens).toEqual([
      { type: 'text', content: 'Read ' },
      { type: 'link', label: 'onboarding', target: 'handbook/onboarding' },
      { type: 'text', content: ' first.' },
    ]);
  });

  test('parses multiple styles combined', () => {
    const tokens = tokenizeInline('Review [[handbook/expenses|expenses]] and **acknowledge** `day-one`.');
    expect(tokens).toEqual([
      { type: 'text', content: 'Review ' },
      { type: 'wiki-link', target: 'handbook/expenses', label: 'expenses' },
      { type: 'text', content: ' and ' },
      { type: 'bold', content: 'acknowledge' },
      { type: 'text', content: ' ' },
      { type: 'code', content: 'day-one' },
      { type: 'text', content: '.' },
    ]);
  });
});

describe('backlinksFor', () => {
  test('finds links to target entry', () => {
    const mockEntries: Record<string, Entry> = {
      onboarding: {
        slug: 'onboarding',
        title: 'Onboarding Checklist',
        layout: 'doc',
        crumb: ['handbook'],
        tags: ['onboarding'],
        date: '2026-06-22',
        mins: 5,
        desc: ' Checklist for new hires.',
        body: [
          {
            type: 'p',
            text: 'Read the [[expenses|expense policy]] and submit expenses.',
          },
        ],
      },
      expenses: {
        slug: 'expenses',
        title: 'Expense Policy',
        layout: 'doc',
        crumb: ['handbook'],
        tags: ['policy'],
        date: '2026-06-22',
        mins: 3,
        desc: 'How to claim expenses.',
        body: [{ type: 'p', text: 'This is the expense policy.' }],
      },
    };

    const backlinks = backlinksFor('expenses', mockEntries);
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].slug).toBe('onboarding');
    expect(backlinks[0].title).toBe('Onboarding Checklist');
    expect(backlinks[0].crumb).toBe('handbook');
    expect(backlinks[0].snip).toContain('Read the expense policy');
  });

  test('does not return self-links or duplicate links', () => {
    const mockEntries: Record<string, Entry> = {
      expenses: {
        slug: 'expenses',
        title: 'Expense Policy',
        layout: 'doc',
        crumb: ['handbook'],
        tags: ['policy'],
        date: '2026-06-22',
        mins: 3,
        desc: 'How to claim expenses.',
        body: [
          {
            type: 'p',
            text: 'Self-referencing [[expenses]] twice [[expenses]].',
          },
        ],
      },
    };

    const backlinks = backlinksFor('expenses', mockEntries);
    expect(backlinks).toHaveLength(0);
  });
});
