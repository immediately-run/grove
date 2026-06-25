/* eslint-disable @typescript-eslint/no-explicit-any */
export interface EntryBlock {
  type: 'lede' | 'p' | 'h2' | 'h3' | 'ul' | 'callout' | 'table' | 'image' | 'infobox' | 'component';
  text?: string;
  items?: string[];
  variant?: 'tip' | 'note' | 'warning';
  title?: string;
  head?: string[];
  rows?: string[][];
  label?: string;
  cover?: boolean;
  fields?: [string, string][];
  name?: string;
  props?: any;
}

export interface Entry {
  slug: string;
  title: string;
  layout: 'doc' | 'post' | 'full';
  crumb: string[];
  tags: string[];
  date: string;
  mins: number;
  desc: string;
  body: EntryBlock[];
  grad?: boolean;
  isView?: boolean;
}

export interface Person {
  slug: string;
  name: string;
  role: string;
  team: string;
  phone: string;
  email: string;
}

export interface TreeNode {
  type: 'folder' | 'file';
  name: string;
  slug?: string;
  count?: number;
  children?: TreeNode[];
}

export const SITE = {
  title: 'Meridian handbook',
};

export const INITIAL_ENTRIES: Record<string, Entry> = {
  home: {
    slug: 'home',
    title: 'Meridian handbook.',
    layout: 'post',
    crumb: [],
    tags: ['handbook'],
    date: '2026-06-22',
    mins: 2,
    grad: true,
    desc: 'Everything the team needs, as one interlinked wiki.',
    body: [
      {
        type: 'lede',
        text: 'The company wiki — processes, policies, teams, and the phone book — as plain MDX entries that interlink. Most of this you change by **asking Grove**, not by editing files.',
      },
      {
        type: 'component',
        name: 'doclist',
        props: {
          shape: 'feed',
          title: 'Recently updated',
          slugs: [
            'handbook/onboarding',
            'processes/incident-response',
            'reports/q2-2026',
            'handbook/expenses',
          ],
        },
      },
      { type: 'h2', text: 'Browse by area' },
      {
        type: 'component',
        name: 'doclist',
        props: {
          shape: 'grid',
          title: null,
          slugs: [
            'handbook/onboarding',
            'teams/engineering',
            'processes/incident-response',
            'reports/q2-2026',
          ],
        },
      },
      { type: 'h2', text: 'Tags' },
      { type: 'component', name: 'tagcloud' },
    ],
  },
  'handbook/onboarding': {
    slug: 'handbook/onboarding',
    title: 'Onboarding, day one to week one.',
    layout: 'doc',
    crumb: ['handbook'],
    tags: ['handbook', 'onboarding', 'process'],
    date: '2026-06-22',
    mins: 6,
    desc: 'What every new hire does in their first week at Meridian.',
    body: [
      {
        type: 'p',
        text: 'Welcome to Meridian. This entry is the canonical first-week checklist. It links out to the policies and people you will need — follow the [[handbook/expenses|expense policy]] before your first trip, and find your team in the [[directory|phone book]].',
      },
      {
        type: 'callout',
        variant: 'tip',
        title: 'Start here',
        text: 'Your manager will have tagged the entries relevant to your team. Open the sidebar and look under your team’s namespace.',
      },
      { type: 'h2', text: 'Day one' },
      {
        type: 'p',
        text: 'Collect your laptop from IT, sign the [[handbook/security|security policy]], and set up your accounts. If a link looks dim and dotted — like [[travel-policy]] — that entry doesn’t exist yet; ask Grove to create it.',
      },
      {
        type: 'ul',
        items: [
          'Pick up hardware and badge',
          'Read and acknowledge [[handbook/security|the security policy]]',
          'Add yourself to the [[directory|directory]] with your `role` and `phone`',
        ],
      },
      { type: 'h2', text: 'Week one' },
      {
        type: 'p',
        text: 'Shadow an [[teams/engineering|engineering]] standup, file your first expense, and read the [[processes/incident-response|incident-response runbook]]. The runbook matters even if you are not on-call.',
      },
      { type: 'h3', text: 'Filing your first expense' },
      {
        type: 'p',
        text: 'Expenses are submitted through the portal. The categories and limits live in [[handbook/expenses|the expense policy]]; a quick reference:',
      },
      {
        type: 'table',
        head: ['Category', 'Limit', 'Approval'],
        rows: [
          ['Meals (travel)', '$75 / day', 'auto'],
          ['Lodging', '$240 / night', 'manager'],
          ['Software', '$500 / yr', 'manager'],
          ['Equipment', '—', 'finance'],
        ],
      },
      { type: 'h2', text: 'Conventions' },
      {
        type: 'p',
        text: 'This wiki follows a few rules so agents and people read it the same way. Tags drive the menus; frontmatter drives ordering. See [[about|about this wiki]] for the full colophon.',
      },
      {
        type: 'callout',
        variant: 'note',
        title: 'A note on editing',
        text: 'You rarely edit MDX by hand here. Ask Grove ("add my desk phone to the directory") and it writes the frontmatter for you.',
      },
    ],
  },
  'handbook/expenses': {
    slug: 'handbook/expenses',
    title: 'Expense policy.',
    layout: 'doc',
    crumb: ['handbook'],
    tags: ['handbook', 'policy'],
    date: '2026-05-30',
    mins: 4,
    desc: 'Categories, limits, and how to file. Referenced by onboarding.',
    body: [
      {
        type: 'p',
        text: 'What Meridian reimburses, the limits, and the approval path. New hires reach this from [[handbook/onboarding|onboarding]].',
      },
      { type: 'h2', text: 'Limits' },
      {
        type: 'table',
        head: ['Category', 'Limit', 'Approval'],
        rows: [
          ['Meals (travel)', '$75 / day', 'auto'],
          ['Lodging', '$240 / night', 'manager'],
          ['Software', '$500 / yr', 'manager'],
          ['Equipment', '—', 'finance'],
        ],
      },
      { type: 'h2', text: 'How to file' },
      {
        type: 'ul',
        items: [
          'Submit within `30 days` of the expense',
          'Attach a receipt for anything over `$25`',
          'Tag the project so finance can allocate it',
        ],
      },
      {
        type: 'callout',
        variant: 'warning',
        title: 'Out-of-policy spend',
        text: 'Anything above the limits needs finance sign-off in advance. Filing after the fact risks a rejection.',
      },
    ],
  },
  'handbook/security': {
    slug: 'handbook/security',
    title: 'Security policy.',
    layout: 'doc',
    crumb: ['handbook'],
    tags: ['handbook', 'policy', 'security'],
    date: '2026-06-10',
    mins: 5,
    desc: 'Accounts, devices, and what to do if something looks wrong.',
    body: [
      {
        type: 'p',
        text: 'Every new hire acknowledges this on day one (see [[handbook/onboarding|onboarding]]). It is also the first reference when an [[processes/incident-response|incident]] is declared.',
      },
      { type: 'h2', text: 'Accounts' },
      {
        type: 'ul',
        items: [
          'Hardware keys for anything production-adjacent',
          'No shared logins — ask Grove to add a person to the [[directory|directory]] instead',
          'Rotate API tokens every `90 days`',
        ],
      },
      { type: 'h2', text: 'If something looks wrong' },
      {
        type: 'callout',
        variant: 'warning',
        title: 'Report first, fix second',
        text: 'Page the on-call security lead before you touch anything. The [[processes/incident-response|incident runbook]] takes over from there.',
      },
    ],
  },
  'teams/engineering': {
    slug: 'teams/engineering',
    title: 'Engineering.',
    layout: 'doc',
    crumb: ['teams'],
    tags: ['team', 'engineering'],
    date: '2026-06-18',
    mins: 3,
    desc: 'How the engineering team works, who is on it, and how to reach them.',
    body: [
      {
        type: 'infobox',
        title: 'Engineering',
        cover: true,
        fields: [
          ['Lead', 'Grace Hopper'],
          ['Size', '9 people'],
          ['Standup', '09:30 daily'],
          ['On-call', 'PagerDuty'],
        ],
      },
      {
        type: 'p',
        text: 'Engineering owns the platform and the on-call rotation. The runbook for outages is [[processes/incident-response|incident response]]; the team roster lives in the [[directory|directory]].',
      },
      { type: 'h2', text: 'How we work' },
      {
        type: 'p',
        text: 'Small PRs, review within a day, deploy on green. Standup is `09:30`. The security baseline is non-negotiable — read [[handbook/security|the security policy]].',
      },
      { type: 'h2', text: 'People' },
      {
        type: 'component',
        name: 'directory',
        props: { compact: true, team: 'Engineering' },
      },
    ],
  },
  'processes/incident-response': {
    slug: 'processes/incident-response',
    title: 'Incident response.',
    layout: 'doc',
    crumb: ['processes'],
    tags: ['process', 'security'],
    date: '2026-06-20',
    mins: 5,
    desc: 'The runbook for outages: declare, mitigate, communicate, review.',
    body: [
      {
        type: 'p',
        text: 'When production breaks, follow this. It assumes you have read the [[handbook/security|security policy]] and can reach the [[teams/engineering|engineering]] on-call.',
      },
      {
        type: 'callout',
        variant: 'warning',
        title: 'Declare early',
        text: 'A false alarm costs minutes. A late declaration costs the customer. When in doubt, declare.',
      },
      { type: 'h2', text: 'The four steps' },
      {
        type: 'ul',
        items: [
          '**Declare** — open an incident channel, page the lead',
          '**Mitigate** — stop the bleeding before you find the cause',
          '**Communicate** — status page every `15 min`',
          '**Review** — a blameless write-up within `48 h`',
        ],
      },
      { type: 'h2', text: 'Roles' },
      {
        type: 'table',
        head: ['Role', 'Who', 'Reach'],
        rows: [
          ['Commander', 'on-call lead', 'PagerDuty'],
          ['Comms', 'duty manager', 'status page'],
          ['Scribe', 'any responder', 'incident channel'],
        ],
      },
    ],
  },
  'reports/q2-2026': {
    slug: 'reports/q2-2026',
    title: 'Q2 2026 review.',
    layout: 'post',
    crumb: ['reports'],
    tags: ['report'],
    date: '2026-06-15',
    mins: 4,
    desc: 'The numbers and the narrative for the second quarter.',
    body: [
      {
        type: 'lede',
        text: 'A solid quarter: revenue up, churn down, two product lines shipped. The detail, by team.',
      },
      { type: 'h2', text: 'Headline numbers' },
      {
        type: 'table',
        head: ['Metric', 'Q1', 'Q2', 'Δ'],
        rows: [
          ['Revenue', '$2.1M', '$2.6M', '+24%'],
          ['Churn', '3.1%', '2.4%', '-0.7pt'],
          ['Headcount', '41', '48', '+7'],
        ],
      },
      {
        type: 'p',
        text: 'Engineering shipped the platform rewrite (see [[teams/engineering|engineering]]); the incident rate fell after the new [[processes/incident-response|runbook]] landed.',
      },
      { type: 'image', label: 'REVENUE BY MONTH' },
    ],
  },
  directory: {
    slug: 'directory',
    title: 'Directory.',
    layout: 'full',
    crumb: [],
    tags: ['handbook'],
    date: '2026-06-22',
    mins: 1,
    isView: true,
    desc: 'The company phone book — a sortable, filterable table from per-person entries.',
    body: [{ type: 'component', name: 'directory', props: {} }],
  },
  about: {
    slug: 'about',
    title: 'About this wiki.',
    layout: 'doc',
    crumb: [],
    tags: ['handbook'],
    date: '2026-06-22',
    mins: 3,
    desc: 'The colophon: what the tags mean, what components exist, how to extend it.',
    body: [
      {
        type: 'p',
        text: 'This is a Grove — a wiki where every entry is one MDX file and the chrome is composed from tagged entries. This page is an ordinary entry, not special chrome.',
      },
      { type: 'h2', text: 'Conventions' },
      {
        type: 'ul',
        items: [
          '`ui/nav` tags become top-nav items, ordered by `order`',
          '`ui/sidebar` tags become sidebar panels',
          'Person entries carry `role`, `phone`, and `team` — read by the directory view',
        ],
      },
      { type: 'h2', text: 'Components in use' },
      {
        type: 'ul',
        items: [
          '`<DocList>` — the index feed and grid',
          '`<Backlinks>` — who links here',
          '`<Directory>` — the phone book (agent-added view)',
        ],
      },
      {
        type: 'callout',
        variant: 'note',
        title: 'For the next agent',
        text: 'These conventions also live in `GROVE.md` at the content root, kept in sync by Grove’s agent. Read it before changing structure.',
      },
    ],
  },
};

export const PEOPLE: Person[] = [
  {
    slug: 'people/grace-hopper',
    name: 'Grace Hopper',
    role: 'Eng lead',
    team: 'Engineering',
    phone: 'x2201',
    email: 'grace@meridian.co',
  },
  {
    slug: 'people/ada-lovelace',
    name: 'Ada Lovelace',
    role: 'Staff engineer',
    team: 'Engineering',
    phone: 'x2204',
    email: 'ada@meridian.co',
  },
  {
    slug: 'people/alan-turing',
    name: 'Alan Turing',
    role: 'Platform engineer',
    team: 'Engineering',
    phone: 'x2208',
    email: 'alan@meridian.co',
  },
  {
    slug: 'people/katherine-johnson',
    name: 'Katherine Johnson',
    role: 'Data lead',
    team: 'Data',
    phone: 'x3110',
    email: 'kj@meridian.co',
  },
  {
    slug: 'people/margaret-hamilton',
    name: 'Margaret Hamilton',
    role: 'Eng manager',
    team: 'Engineering',
    phone: 'x2202',
    email: 'mh@meridian.co',
  },
  {
    slug: 'people/dorothy-vaughan',
    name: 'Dorothy Vaughan',
    role: 'Ops manager',
    team: 'Operations',
    phone: 'x4001',
    email: 'dv@meridian.co',
  },
  {
    slug: 'people/john-mccarthy',
    name: 'John McCarthy',
    role: 'Research',
    team: 'Data',
    phone: 'x3120',
    email: 'jm@meridian.co',
  },
];

export const NAV = [
  { label: 'Home', slug: 'home' },
  { label: 'Handbook', slug: 'handbook/onboarding' },
  { label: 'Teams', slug: 'teams/engineering' },
  { label: 'Reports', slug: 'reports/q2-2026' },
  { label: 'Directory', slug: 'directory' },
  { label: 'About', slug: 'about' },
];

export const INITIAL_TREE: TreeNode[] = [
  {
    type: 'folder',
    name: 'handbook',
    count: 3,
    children: [
      { type: 'file', slug: 'handbook/onboarding', name: 'onboarding' },
      { type: 'file', slug: 'handbook/expenses', name: 'expenses' },
      { type: 'file', slug: 'handbook/security', name: 'security' },
    ],
  },
  {
    type: 'folder',
    name: 'teams',
    count: 1,
    children: [{ type: 'file', slug: 'teams/engineering', name: 'engineering' }],
  },
  {
    type: 'folder',
    name: 'processes',
    count: 1,
    children: [{ type: 'file', slug: 'processes/incident-response', name: 'incident-response' }],
  },
  {
    type: 'folder',
    name: 'reports',
    count: 1,
    children: [{ type: 'file', slug: 'reports/q2-2026', name: 'q2-2026' }],
  },
  {
    type: 'folder',
    name: 'people',
    count: 7,
    children: PEOPLE.map((p) => ({
      type: 'file',
      slug: p.slug,
      name: p.name.toLowerCase().replace(/ /g, '-'),
    })),
  },
];

// Dynamically generate person entries and merge them into our full entries map
export function getEntriesMap(): Record<string, Entry> {
  const entries: Record<string, Entry> = { ...INITIAL_ENTRIES };
  
  PEOPLE.forEach((p) => {
    if (!entries[p.slug]) {
      entries[p.slug] = {
        slug: p.slug,
        title: p.name + '.',
        layout: 'doc',
        crumb: ['people'],
        tags: ['person', p.team.toLowerCase()],
        date: '2026-06-22',
        mins: 1,
        desc: p.role + ' on ' + p.team + '.',
        body: [
          {
            type: 'infobox',
            title: p.name,
            fields: [
              ['Role', p.role],
              ['Team', p.team],
              ['Phone', p.phone],
              ['Email', p.email],
            ],
          },
          {
            type: 'p',
            text: `${p.name} is ${p.role.toLowerCase()} on the [[${
              p.team === 'Engineering' ? 'teams/engineering|' : 'directory|'
            }${p.team}]] team. Reach them at \`${p.phone}\`.`,
          },
        ],
      };
    }
  });

  return entries;
}
