// The theme catalogue for the theme menu (id → label + swatch gradient). Data,
// not components — kept out of the chrome components per the Fast-Refresh rule.
export interface Theme {
  id: string;
  label: string;
  swatch: string;
}

export const THEMES: Theme[] = [
  { id: 'default', label: 'immediately.run', swatch: 'linear-gradient(96deg,#f6f1fb,#f49ad4 46%,#b285f2)' },
  { id: 'pixies', label: 'Pixies', swatch: 'linear-gradient(96deg,#ffe14d,#ff2d8e 50%,#9d29ff)' },
  { id: 'family', label: 'Family journal', swatch: 'linear-gradient(96deg,#f3cf9a,#e09a6a 50%,#c8744f)' },
  { id: 'lotr', label: 'Middle-earth', swatch: 'linear-gradient(96deg,#b89a56,#8a6a36 50%,#4a5a38)' },
];
