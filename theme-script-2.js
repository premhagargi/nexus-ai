const fs = require('fs');
const path = require('path');

const dashPage = path.join(__dirname, 'app/dashboard/[workspaceId]/page.tsx');
let content = fs.readFileSync(dashPage, 'utf8');
content = content.replace(/text-white/g, 'text-foreground');
fs.writeFileSync(dashPage, content);

const cols = path.join(__dirname, 'app/dashboard/[workspaceId]/documents/columns.tsx');
content = fs.readFileSync(cols, 'utf8');
content = content.replace(/text-white/g, 'text-foreground');
fs.writeFileSync(cols, content);

const landPage = path.join(__dirname, 'app/page.tsx');
content = fs.readFileSync(landPage, 'utf8');
content = content.replace(/className="text-white"/g, 'className="text-foreground"');
// Let's also ensure bg-black/40 and similar dark things in signup/login are light
content = content.replace(/bg-black/g, 'bg-white');
fs.writeFileSync(landPage, content);

// Chat input button was bg-white text-black, let's make it bg-primary text-primary-foreground
const chatPage = path.join(__dirname, 'app/dashboard/[workspaceId]/chat/page.tsx');
content = fs.readFileSync(chatPage, 'utf8');
content = content.replace(/bg-white text-black/g, 'bg-primary text-primary-foreground');
content = content.replace(/hover:bg-zinc-200/g, 'hover:bg-primary/90');
content = content.replace(/disabled:bg-white\/10 disabled:text-white\/40/g, 'disabled:bg-muted disabled:text-muted-foreground');
fs.writeFileSync(chatPage, content);

console.log("Done");
