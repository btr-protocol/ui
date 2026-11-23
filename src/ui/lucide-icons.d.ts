// lucide-preact ships no types for its per-icon modules; each default-exports one icon.
declare module 'lucide-preact/dist/esm/icons/*' {
  const icon: import('lucide-preact').LucideIcon;
  export default icon;
}
declare module 'lucide-preact/dist/esm/createLucideIcon.js' {
  const createLucideIcon: typeof import('lucide-preact').createLucideIcon;
  export default createLucideIcon;
}
