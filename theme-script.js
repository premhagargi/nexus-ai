const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'app/page.tsx',
  'components/app-sidebar.tsx',
  'app/dashboard/[workspaceId]/page.tsx',
  'app/dashboard/[workspaceId]/chat/page.tsx',
  'app/dashboard/[workspaceId]/documents/data-table.tsx',
  'app/dashboard/[workspaceId]/documents/columns.tsx',
  'app/login/page.tsx',
  'app/signup/page.tsx',
];

const replacements = [
  { search: /bg-zinc-950/g, replace: 'bg-background' },
  { search: /bg-zinc-900\/[0-9]+/g, replace: 'bg-background/80' },
  { search: /bg-zinc-900/g, replace: 'bg-card' },
  { search: /bg-zinc-800\/[0-9]+/g, replace: 'bg-muted/50' },
  { search: /bg-zinc-800/g, replace: 'bg-muted' },
  { search: /border-zinc-800\/[0-9]+/g, replace: 'border-border/50' },
  { search: /border-zinc-800/g, replace: 'border-border' },
  { search: /border-zinc-700\/[0-9]+/g, replace: 'border-border' },
  { search: /text-zinc-400/g, replace: 'text-muted-foreground' },
  { search: /text-zinc-500/g, replace: 'text-muted-foreground' },
  { search: /text-zinc-600/g, replace: 'text-muted-foreground' },
  { search: /text-zinc-100/g, replace: 'text-foreground' },
  { search: /text-zinc-200/g, replace: 'text-foreground' },
  { search: /text-zinc-950/g, replace: 'text-primary' },
  { search: /bg-zinc-100/g, replace: 'bg-primary/10' },
  { search: /border-zinc-600\/[0-9]+/g, replace: 'border-primary/20' },
  { search: /border-white\/10/g, replace: 'border-border' },
  { search: /border-white\/5/g, replace: 'border-border/50' },
  { search: /bg-white\/5/g, replace: 'bg-muted/50' },
  { search: /bg-white\/10/g, replace: 'bg-muted' },
  { search: /bg-white\/15/g, replace: 'bg-muted' },
  { search: /hover:bg-white\/10/g, replace: 'hover:bg-accent hover:text-accent-foreground' },
  { search: /hover:bg-white\/5/g, replace: 'hover:bg-accent/50' },
  { search: /text-white\/70/g, replace: 'text-muted-foreground' },
  { search: /text-white\/80/g, replace: 'text-muted-foreground' },
  { search: /text-white\/40/g, replace: 'text-muted-foreground/50' },
  // Keep some text-white for primary buttons, but change the specific gradient ones:
  { search: /from-white to-white\/70/g, replace: 'from-primary to-primary/70' },
  { search: /from-white to-white\/80/g, replace: 'from-primary to-primary/80' },
  { search: /bg-black\/40/g, replace: 'bg-background/80' },
  { search: /bg-black\/20/g, replace: 'bg-muted' },
  { search: /shadow-black\/40/g, replace: 'shadow-primary/5' },
  { search: /shadow-black\/30/g, replace: 'shadow-primary/5' },
];

filesToProcess.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Specific overrides for specific components to prevent ruining them:
  // Data table overrides
  content = content.replace(/border-white\/10 hover:bg-transparent/g, 'border-border hover:bg-transparent');
  content = content.replace(/border-white\/10 hover:bg-white\/5/g, 'border-border hover:bg-muted/50');
  
  replacements.forEach(r => {
    content = content.replace(r.search, r.replace);
  });
  
  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${filePath}`);
});
