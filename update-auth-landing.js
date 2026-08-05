const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/landing-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Change LandingPage signature
content = content.replace(
  'export default function LandingPage() {',
  'export default function LandingPage({ isAuthenticated }: { isAuthenticated: boolean }) {'
);

// 2. Pass prop
content = content.replace('<Navbar />', '<Navbar isAuthenticated={isAuthenticated} />');
content = content.replace('<Hero />', '<Hero isAuthenticated={isAuthenticated} />');
content = content.replace('<FinalCTA />', '<FinalCTA isAuthenticated={isAuthenticated} />');

// 3. Navbar signature
content = content.replace(
  'function Navbar() {',
  'function Navbar({ isAuthenticated }: { isAuthenticated?: boolean }) {'
);

// Navbar buttons
content = content.replace(
  '<a href="/login" className="hidden sm:block text-[13px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">\n            Sign in\n          </a>',
  `{!isAuthenticated && (
            <a href="/login" className="hidden sm:block text-[13px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
              Sign in
            </a>
          )}`
);
content = content.replace(
  '<a\n            href="/signup"\n            className="text-[13px] font-medium text-primary bg-primary/10 hover:bg-white px-4 py-1.5 rounded-lg transition-colors"\n          >\n            Get started\n          </a>',
  `<a
            href={isAuthenticated ? "/dashboard" : "/signup"}
            className="text-[13px] font-medium text-primary bg-primary/10 hover:bg-white px-4 py-1.5 rounded-lg transition-colors"
          >
            {isAuthenticated ? "Go to workspace" : "Get started"}
          </a>`
);

// 4. Hero signature
content = content.replace(
  'function Hero() {',
  'function Hero({ isAuthenticated }: { isAuthenticated?: boolean }) {'
);

// Hero button
content = content.replace(
  '<a\n                href="/signup"\n                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary text-[14px] font-medium hover:bg-white transition-colors group"\n              >\n                Start building for free\n                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />\n              </a>',
  `<a
                href={isAuthenticated ? "/dashboard" : "/signup"}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary text-[14px] font-medium hover:bg-white transition-colors group"
              >
                {isAuthenticated ? "Go to workspace" : "Start building for free"}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>`
);

// 5. FinalCTA signature
content = content.replace(
  'function FinalCTA() {',
  'function FinalCTA({ isAuthenticated }: { isAuthenticated?: boolean }) {'
);

// FinalCTA button
content = content.replace(
  '<a\n                  href="/signup"\n                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/10 text-primary text-[14px] font-medium hover:bg-white transition-colors group"\n                >\n                  Get started free\n                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />\n                </a>',
  `<a
                  href={isAuthenticated ? "/dashboard" : "/signup"}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/10 text-primary text-[14px] font-medium hover:bg-white transition-colors group"
                >
                  {isAuthenticated ? "Go to workspace" : "Get started free"}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </a>`
);

fs.writeFileSync(filePath, content);
console.log("Updated landing page with auth state");
