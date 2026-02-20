import { createContext, useContext, ParentComponent } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useSDK } from "./SDKContext";
import { PlanAgent, DEFAULT_PLAN_AGENTS } from "@/components/PlanAgentsPanel";

// Phase of the planning process
type PlanPhase = "idle" | "discovery" | "review" | "agents" | "compiling" | "complete";

interface ProjectSpec {
  name: string;
  description: string;
  type: string; // web app, mobile app, api, etc.
  features: string[];
  target_users: string;
  scale: string; // small, medium, large, enterprise
  tech_preferences?: string[];
  constraints?: string[];
  integrations?: string[];
  deadline?: string;
}

interface TechnicalAgentOutput {
  agent_id: string;
  agent_name: string;
  role: string;
  // Technical specifications - not vague recommendations
  specifications: TechnicalSpec[];
  diagrams?: string[]; // ASCII diagrams, mermaid, etc.
  code_snippets?: CodeSnippet[];
  configurations?: Configuration[];
  risk_assessment: RiskAssessment;
}

interface TechnicalSpec {
  category: string;
  title: string;
  details: string;
  technical_requirements: string[];
  implementation_notes: string[];
}

interface CodeSnippet {
  language: string;
  filename: string;
  description: string;
  code: string;
}

interface Configuration {
  name: string;
  type: string; // env, yaml, json, etc.
  content: string;
}

interface RiskAssessment {
  level: "low" | "medium" | "high" | "critical";
  vulnerabilities: string[];
  mitigations: string[];
  priority_actions: string[];
}

interface PlanState {
  phase: PlanPhase;
  originalRequest: string | null;
  projectSpec: ProjectSpec | null;
  agents: PlanAgent[];
  agentOutputs: TechnicalAgentOutput[];
  isCompiling: boolean;
  showAgentsPanel: boolean;
  finalPlan: FinalPlan | null;
}

interface FinalPlan {
  title: string;
  executive_summary: string;
  project_spec: ProjectSpec;
  architecture: ArchitectureSection;
  technical_sections: TechnicalSection[];
  implementation_roadmap: RoadmapPhase[];
  risk_matrix: RiskMatrixItem[];
  success_metrics: string[];
}

interface ArchitectureSection {
  overview: string;
  diagram: string; // ASCII or mermaid
  components: ArchitectureComponent[];
  data_flow: string;
  tech_stack: TechStackItem[];
}

interface ArchitectureComponent {
  name: string;
  type: string;
  responsibility: string;
  technologies: string[];
  interfaces: string[];
}

interface TechStackItem {
  layer: string;
  technology: string;
  version: string;
  justification: string;
}

interface TechnicalSection {
  id: string;
  title: string;
  agent_source: string;
  subsections: TechnicalSubsection[];
}

interface TechnicalSubsection {
  title: string;
  content: string;
  specs: string[];
  code_examples?: CodeSnippet[];
}

interface RoadmapPhase {
  phase: number;
  name: string;
  duration: string;
  deliverables: string[];
  dependencies: string[];
  tasks: RoadmapTask[];
}

interface RoadmapTask {
  id: string;
  title: string;
  description: string;
  complexity: "low" | "medium" | "high";
  estimated_hours: number;
  assignee_role: string;
}

interface RiskMatrixItem {
  risk: string;
  probability: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation: string;
  owner: string;
}

interface PlanContextValue {
  state: PlanState;
  startDiscovery: (request: string) => Promise<void>;
  submitProjectSpec: (spec: ProjectSpec) => Promise<void>;
  startAgentAnalysis: () => Promise<void>;
  cancelPlan: () => void;
  approvePlan: () => Promise<void>;
  rejectPlan: () => void;
}

const PlanContext = createContext<PlanContextValue>();

export const PlanProvider: ParentComponent = (props) => {
  const { sendMessage } = useSDK();
  
  const [state, setState] = createStore<PlanState>({
    phase: "idle",
    originalRequest: null,
    projectSpec: null,
    agents: [],
    agentOutputs: [],
    isCompiling: false,
    showAgentsPanel: false,
    finalPlan: null,
  });

  // Run a single technical agent with deep analysis
  const runTechnicalAgent = async (agent: PlanAgent, spec: ProjectSpec): Promise<TechnicalAgentOutput> => {
    setState(produce((s) => {
      const idx = s.agents.findIndex(a => a.id === agent.id);
      if (idx >= 0) {
        s.agents[idx].status = "running";
        s.agents[idx].startedAt = Date.now();
      }
    }));

    // Simulate processing (in real impl, this calls LLM with technical prompts)
    const delay = 1500 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));

    const output = generateTechnicalOutput(agent.id, spec);

    setState(produce((s) => {
      const idx = s.agents.findIndex(a => a.id === agent.id);
      if (idx >= 0) {
        s.agents[idx].status = "completed";
        s.agents[idx].completedAt = Date.now();
        s.agents[idx].result = {
          findings: output.specifications.map(s => s.title),
          recommendations: output.risk_assessment.priority_actions,
          risk_level: output.risk_assessment.level,
        };
      }
      s.agentOutputs.push(output);
    }));

    return output;
  };

  // Generate deeply technical output per agent
  const generateTechnicalOutput = (agentId: string, spec: ProjectSpec): TechnicalAgentOutput => {
    const outputs: Record<string, TechnicalAgentOutput> = {
      security: {
        agent_id: "security",
        agent_name: "Security Architect",
        role: "Application Security & Infrastructure Hardening",
        specifications: [
          {
            category: "Authentication",
            title: "JWT Authentication Flow",
            details: `OAuth 2.0 + JWT implementation for ${spec.name}`,
            technical_requirements: [
              "Access Token: RS256 signed, 15min expiry, stored in memory",
              "Refresh Token: Opaque, 7d expiry, httpOnly cookie, rotating",
              "Token payload: { sub, iat, exp, roles[], permissions[] }",
              "PKCE flow for public clients (mobile/SPA)",
            ],
            implementation_notes: [
              "Use jose library for JWT operations",
              "Implement token blacklist in Redis for logout",
              "Rate limit auth endpoints: 5 req/min per IP",
            ],
          },
          {
            category: "Authorization",
            title: "RBAC + ABAC Hybrid Model",
            details: "Role-Based + Attribute-Based Access Control",
            technical_requirements: [
              "Roles: admin, dealer, customer, guest",
              "Permissions: CRUD per resource type",
              "Attribute checks: ownership, geo-location, time-based",
              "Policy engine: Open Policy Agent (OPA) or custom",
            ],
            implementation_notes: [
              "Middleware: checkPermission(resource, action)",
              "Cache permissions in Redis (5min TTL)",
              "Audit log all authorization decisions",
            ],
          },
          {
            category: "Data Protection",
            title: "Encryption & Data Security",
            details: "At-rest and in-transit encryption standards",
            technical_requirements: [
              "TLS 1.3 for all connections (HSTS enabled)",
              "AES-256-GCM for PII at rest",
              "Argon2id for password hashing (m=65536, t=3, p=4)",
              "Field-level encryption for: SSN, credit cards, addresses",
            ],
            implementation_notes: [
              "Use AWS KMS or HashiCorp Vault for key management",
              "Rotate encryption keys every 90 days",
              "Implement secure key derivation (HKDF)",
            ],
          },
          {
            category: "Input Validation",
            title: "Input Sanitization & Validation",
            details: "Defense against injection attacks",
            technical_requirements: [
              "Zod schemas for all API inputs",
              "SQL: Parameterized queries only (no string concat)",
              "XSS: DOMPurify for user-generated HTML",
              "CSRF: Double-submit cookie pattern",
              "File uploads: Magic byte validation, virus scan",
            ],
            implementation_notes: [
              "Whitelist allowed file types: [jpg, png, pdf]",
              "Max file size: 10MB",
              "Store uploads in isolated S3 bucket",
            ],
          },
        ],
        code_snippets: [
          {
            language: "typescript",
            filename: "auth/jwt.ts",
            description: "JWT verification middleware",
            code: `import { jwtVerify, SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    algorithms: ['RS256'],
    issuer: 'car-app',
    audience: 'car-app-api',
  });
  return payload;
}

export async function generateTokenPair(userId: string, roles: string[]) {
  const accessToken = await new SignJWT({ sub: userId, roles })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
    
  const refreshToken = crypto.randomUUID();
  await redis.setex(\`refresh:\${refreshToken}\`, 7 * 24 * 60 * 60, userId);
  
  return { accessToken, refreshToken };
}`,
          },
        ],
        configurations: [
          {
            name: "Security Headers",
            type: "nginx",
            content: `add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.example.com;" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`,
          },
        ],
        risk_assessment: {
          level: "medium",
          vulnerabilities: [
            "Session hijacking if JWT stolen",
            "IDOR on car listings without ownership check",
            "Rate limiting bypass via IP rotation",
          ],
          mitigations: [
            "Implement device fingerprinting",
            "Add ownership validation middleware",
            "Use Cloudflare Bot Management",
          ],
          priority_actions: [
            "P0: Implement authentication before launch",
            "P0: Enable HTTPS and security headers",
            "P1: Set up WAF rules",
            "P2: Penetration test before production",
          ],
        },
      },

      performance: {
        agent_id: "performance",
        agent_name: "Performance Engineer",
        role: "Scalability, Optimization & Caching Strategy",
        specifications: [
          {
            category: "Caching Strategy",
            title: "Multi-Layer Cache Architecture",
            details: `Cache hierarchy for ${spec.name}`,
            technical_requirements: [
              "L1: Browser cache (static assets, 1 year max-age)",
              "L2: CDN edge cache (HTML 5min, API 1min)",
              "L3: Redis application cache (queries, sessions)",
              "L4: Database query cache (PostgreSQL)",
            ],
            implementation_notes: [
              "Cache keys: resource:id:version",
              "Implement cache stampede protection (singleflight)",
              "Use stale-while-revalidate for UX",
            ],
          },
          {
            category: "Database Optimization",
            title: "PostgreSQL Performance Tuning",
            details: "Index strategy and query optimization",
            technical_requirements: [
              "Composite index: cars(make, model, year, price)",
              "Partial index: cars(status) WHERE status = 'available'",
              "GiST index for geo queries: cars(location)",
              "Connection pooling: PgBouncer (max 100 connections)",
            ],
            implementation_notes: [
              "EXPLAIN ANALYZE all queries > 100ms",
              "Implement read replicas for search queries",
              "Partition large tables by created_at (monthly)",
            ],
          },
          {
            category: "Frontend Performance",
            title: "Bundle & Loading Optimization",
            details: "Core Web Vitals targets",
            technical_requirements: [
              "LCP < 2.5s, FID < 100ms, CLS < 0.1",
              "Initial bundle < 200KB gzipped",
              "Route-based code splitting",
              "Image optimization: WebP/AVIF, srcset",
            ],
            implementation_notes: [
              "Use dynamic imports for heavy components",
              "Implement virtual scrolling for car lists",
              "Preload critical resources",
            ],
          },
        ],
        code_snippets: [
          {
            language: "typescript",
            filename: "cache/redis-cache.ts",
            description: "Redis caching layer with stampede protection",
            code: `import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const locks = new Map<string, Promise<any>>();

export async function cachedQuery<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check cache first
  const cached = await redis.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      console.debug("[Plan] Cache parse failed:", err);
    }
  }
  
  // Stampede protection - only one request fetches
  if (locks.has(key)) return locks.get(key);
  
  const promise = (async () => {
    const data = await fetcher();
    await redis.setex(key, ttl, JSON.stringify(data));
    locks.delete(key);
    return data;
  })();
  
  locks.set(key, promise);
  return promise;
}

// Usage
const cars = await cachedQuery(
  \`cars:search:\${JSON.stringify(filters)}\`,
  60, // 1 minute TTL
  () => db.cars.findMany({ where: filters })
);`,
          },
        ],
        configurations: [
          {
            name: "CDN Configuration",
            type: "cloudflare",
            content: `// Page Rules
/*.js, /*.css -> Cache Everything, Edge TTL: 1 year
/api/* -> Bypass Cache
/cars/* -> Cache Everything, Edge TTL: 5 minutes

// Cache Rules
Browser TTL: Respect Existing Headers
Always Online: Enabled
Development Mode: Off in Production`,
          },
        ],
        risk_assessment: {
          level: "low",
          vulnerabilities: [
            "Cache poisoning on CDN",
            "Memory exhaustion from unbounded cache",
            "Slow queries blocking connection pool",
          ],
          mitigations: [
            "Validate cache keys, use Vary headers",
            "Set max memory limits on Redis (2GB)",
            "Query timeout: 5s, implement circuit breaker",
          ],
          priority_actions: [
            "P0: Set up Redis cluster before launch",
            "P1: Implement database indexes",
            "P1: Configure CDN caching rules",
            "P2: Load test to 10x expected traffic",
          ],
        },
      },

      ux: {
        agent_id: "ux",
        agent_name: "UX/UI Architect",
        role: "Design System, Accessibility & User Experience",
        specifications: [
          {
            category: "Design System",
            title: "Component Library & Theming",
            details: `Design tokens for ${spec.name}`,
            technical_requirements: [
              "Color palette: Primary #2563EB, Secondary #7C3AED, Neutral gray-50 to gray-900",
              "Typography: Inter for UI, DM Sans for headings",
              "Spacing scale: 4px base (4, 8, 12, 16, 24, 32, 48, 64)",
              "Border radius: sm=4px, md=8px, lg=12px, full=9999px",
              "Shadows: sm, md, lg, xl (elevation system)",
            ],
            implementation_notes: [
              "Use CSS custom properties for theming",
              "Support dark mode via prefers-color-scheme",
              "Implement design tokens as JSON for tooling",
            ],
          },
          {
            category: "Accessibility",
            title: "WCAG 2.1 AA Compliance",
            details: "Accessibility requirements and implementation",
            technical_requirements: [
              "Color contrast: 4.5:1 for text, 3:1 for large text",
              "Focus indicators: 2px solid ring, offset 2px",
              "ARIA labels on all interactive elements",
              "Keyboard navigation: Tab order, skip links",
              "Screen reader: Live regions for dynamic content",
            ],
            implementation_notes: [
              "Test with VoiceOver, NVDA, JAWS",
              "Use axe-core in CI pipeline",
              "Implement reduced motion preferences",
            ],
          },
          {
            category: "Responsive Design",
            title: "Breakpoint System",
            details: "Mobile-first responsive strategy",
            technical_requirements: [
              "Breakpoints: sm=640px, md=768px, lg=1024px, xl=1280px, 2xl=1536px",
              "Touch targets: minimum 44x44px",
              "Grid: 12 columns, 16px gutter (24px on lg+)",
              "Container max-width: 1280px",
            ],
            implementation_notes: [
              "Use container queries for component responsiveness",
              "Implement responsive images with srcset",
              "Test on real devices, not just emulators",
            ],
          },
        ],
        code_snippets: [
          {
            language: "css",
            filename: "design-tokens.css",
            description: "CSS custom properties for design system",
            code: `:root {
  /* Colors */
  --color-primary-50: #eff6ff;
  --color-primary-500: #2563eb;
  --color-primary-600: #1d4ed8;
  --color-primary-700: #1e40af;
  
  --color-secondary-500: #7c3aed;
  
  --color-neutral-50: #fafafa;
  --color-neutral-100: #f4f4f5;
  --color-neutral-900: #18181b;
  
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;
  
  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-heading: 'DM Sans', sans-serif;
  
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  
  /* Spacing */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-neutral-50: #18181b;
    --color-neutral-900: #fafafa;
  }
}`,
          },
        ],
        configurations: [],
        risk_assessment: {
          level: "low",
          vulnerabilities: [
            "Accessibility lawsuits if non-compliant",
            "Poor mobile UX losing 60%+ of users",
            "Inconsistent UI degrading brand trust",
          ],
          mitigations: [
            "Automated a11y testing in CI",
            "Mobile-first development approach",
            "Storybook for component documentation",
          ],
          priority_actions: [
            "P0: Implement design tokens",
            "P0: Set up accessibility testing",
            "P1: Build core component library",
            "P2: User testing with 5 users",
          ],
        },
      },

      devops: {
        agent_id: "devops",
        agent_name: "DevOps/SRE Engineer",
        role: "Infrastructure, CI/CD & Observability",
        specifications: [
          {
            category: "Infrastructure",
            title: "Cloud Architecture",
            details: `Production infrastructure for ${spec.name}`,
            technical_requirements: [
              "Compute: Vercel (frontend), Railway/Fly.io (backend)",
              "Database: Neon PostgreSQL (serverless, auto-scaling)",
              "Cache: Upstash Redis (serverless)",
              "Storage: Cloudflare R2 (S3-compatible)",
              "CDN: Cloudflare (with WAF)",
            ],
            implementation_notes: [
              "Use Infrastructure as Code (Pulumi/Terraform)",
              "Multi-region deployment for latency",
              "Auto-scaling based on CPU/memory",
            ],
          },
          {
            category: "CI/CD Pipeline",
            title: "GitHub Actions Workflow",
            details: "Automated build, test, deploy pipeline",
            technical_requirements: [
              "Trigger: Push to main, PR events",
              "Stages: Lint → Type-check → Test → Build → Deploy",
              "Environments: preview (PR), staging (main), production (tag)",
              "Deployment: Zero-downtime rolling updates",
            ],
            implementation_notes: [
              "Cache node_modules between runs",
              "Parallel test execution",
              "Require PR approval for production",
            ],
          },
          {
            category: "Observability",
            title: "Monitoring & Alerting Stack",
            details: "Full observability implementation",
            technical_requirements: [
              "Metrics: Prometheus + Grafana (or Datadog)",
              "Logs: Structured JSON, shipped to Loki/Datadog",
              "Traces: OpenTelemetry → Jaeger/Datadog",
              "Errors: Sentry with source maps",
              "Uptime: Checkly or Better Uptime",
            ],
            implementation_notes: [
              "Alert on: error rate > 1%, p99 > 2s, CPU > 80%",
              "PagerDuty integration for on-call",
              "Runbooks in Notion/Confluence",
            ],
          },
        ],
        code_snippets: [
          {
            language: "yaml",
            filename: ".github/workflows/ci.yml",
            description: "GitHub Actions CI/CD pipeline",
            code: `name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Lint
        run: pnpm lint
      
      - name: Type check
        run: pnpm typecheck
      
      - name: Unit tests
        run: pnpm test:unit --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e:
    runs-on: ubuntu-latest
    needs: lint-and-test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
      
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  deploy-preview:
    if: github.event_name == 'pull_request'
    needs: [lint-and-test, e2e]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: [lint-and-test, e2e]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel Production
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'`,
          },
        ],
        configurations: [
          {
            name: "Dockerfile",
            type: "dockerfile",
            content: `FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 app
USER app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/server.js"]`,
          },
        ],
        risk_assessment: {
          level: "medium",
          vulnerabilities: [
            "Single point of failure if main region down",
            "Secret exposure in CI logs",
            "Slow rollback if deployment fails",
          ],
          mitigations: [
            "Multi-region with failover",
            "Use GitHub Secrets, never echo",
            "Implement blue-green deployments",
          ],
          priority_actions: [
            "P0: Set up CI/CD pipeline",
            "P0: Configure secrets management",
            "P1: Implement monitoring and alerting",
            "P1: Create incident response runbooks",
          ],
        },
      },

      qa: {
        agent_id: "qa",
        agent_name: "QA/Test Architect",
        role: "Test Strategy, Automation & Quality Gates",
        specifications: [
          {
            category: "Test Strategy",
            title: "Testing Pyramid",
            details: `Test coverage strategy for ${spec.name}`,
            technical_requirements: [
              "Unit tests: 80% coverage, all business logic",
              "Integration tests: API endpoints, DB queries",
              "E2E tests: Critical user flows (happy path)",
              "Visual regression: Key pages and components",
            ],
            implementation_notes: [
              "Unit: Vitest + Testing Library",
              "E2E: Playwright",
              "Visual: Percy or Chromatic",
              "Run in CI, block merge on failure",
            ],
          },
          {
            category: "Test Scenarios",
            title: "Critical Path Coverage",
            details: "E2E test scenarios for core functionality",
            technical_requirements: [
              "Auth: Login, logout, password reset, session expiry",
              "Search: Filter cars, sort, pagination",
              "Listing: View car, contact dealer, save favorite",
              "Checkout: Reserve car, payment flow (if applicable)",
            ],
            implementation_notes: [
              "Use page object model pattern",
              "Seed test data before each run",
              "Test on Chrome, Firefox, Safari",
            ],
          },
          {
            category: "Quality Gates",
            title: "CI Quality Checks",
            details: "Automated quality enforcement",
            technical_requirements: [
              "Lint: ESLint + Prettier (no warnings)",
              "Types: Strict TypeScript, no any",
              "Coverage: Minimum 80% lines",
              "Bundle: Max 200KB initial JS",
              "Lighthouse: Performance > 90",
            ],
            implementation_notes: [
              "Fail CI if gates not met",
              "Track metrics over time",
              "Weekly quality reports",
            ],
          },
        ],
        code_snippets: [
          {
            language: "typescript",
            filename: "tests/e2e/car-search.spec.ts",
            description: "E2E test for car search functionality",
            code: `import { test, expect } from '@playwright/test';

test.describe('Car Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cars');
  });

  test('should filter cars by make', async ({ page }) => {
    // Select make filter
    await page.getByRole('combobox', { name: 'Make' }).click();
    await page.getByRole('option', { name: 'Toyota' }).click();
    
    // Wait for results to update
    await page.waitForResponse(resp => 
      resp.url().includes('/api/cars') && resp.status() === 200
    );
    
    // Verify all results are Toyota
    const carCards = page.getByTestId('car-card');
    await expect(carCards).toHaveCount(greaterThan(0));
    
    for (const card of await carCards.all()) {
      await expect(card.getByTestId('car-make')).toHaveText('Toyota');
    }
  });

  test('should sort cars by price', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Sort by' }).click();
    await page.getByRole('option', { name: 'Price: Low to High' }).click();
    
    await page.waitForLoadState('networkidle');
    
    const prices = await page.getByTestId('car-price').allTextContents();
    const numericPrices = prices.map(p => parseInt(p.replace(/\\D/g, '')));
    
    expect(numericPrices).toEqual([...numericPrices].sort((a, b) => a - b));
  });

  test('should handle empty results gracefully', async ({ page }) => {
    // Apply impossible filter combination
    await page.getByRole('combobox', { name: 'Make' }).selectOption('Tesla');
    await page.getByRole('spinbutton', { name: 'Max Price' }).fill('1000');
    
    await expect(page.getByText('No cars found')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  });
});`,
          },
        ],
        configurations: [
          {
            name: "vitest.config.ts",
            type: "typescript",
            content: `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});`,
          },
        ],
        risk_assessment: {
          level: "low",
          vulnerabilities: [
            "Flaky tests causing false failures",
            "Slow test suite delaying releases",
            "Missing edge case coverage",
          ],
          mitigations: [
            "Quarantine flaky tests, fix in sprints",
            "Parallelize tests, use test sharding",
            "Regular edge case review sessions",
          ],
          priority_actions: [
            "P0: Set up unit test framework",
            "P0: Create E2E tests for auth flow",
            "P1: Implement coverage gates in CI",
            "P2: Add visual regression tests",
          ],
        },
      },

      data: {
        agent_id: "data",
        agent_name: "Data Architect",
        role: "Database Design, Migrations & Data Integrity",
        specifications: [
          {
            category: "Database Schema",
            title: "Core Data Model",
            details: `PostgreSQL schema for ${spec.name}`,
            technical_requirements: [
              "Users: id, email, password_hash, role, created_at, updated_at",
              "Cars: id, make, model, year, price, mileage, status, dealer_id, location (PostGIS)",
              "Dealers: id, name, address, phone, rating, user_id",
              "Favorites: user_id, car_id, created_at (composite PK)",
              "Inquiries: id, car_id, user_id, message, status, created_at",
            ],
            implementation_notes: [
              "Use UUIDs for all primary keys",
              "Implement soft deletes (deleted_at)",
              "Add audit columns (created_by, updated_by)",
            ],
          },
          {
            category: "Indexes",
            title: "Query Optimization Indexes",
            details: "Index strategy for common queries",
            technical_requirements: [
              "cars(make, model) - Search filtering",
              "cars(price) - Price range queries",
              "cars(dealer_id) - Dealer listings",
              "cars(location) USING GIST - Geo queries",
              "cars(created_at DESC) - Latest listings",
            ],
            implementation_notes: [
              "Monitor slow queries, add indexes as needed",
              "Use partial indexes for filtered queries",
              "VACUUM ANALYZE after bulk inserts",
            ],
          },
          {
            category: "Migrations",
            title: "Database Migration Strategy",
            details: "Safe schema evolution",
            technical_requirements: [
              "Use Prisma Migrate or Drizzle Kit",
              "All migrations must be reversible",
              "No breaking changes in production",
              "Blue-green for major schema changes",
            ],
            implementation_notes: [
              "Test migrations against production clone",
              "Lock timeout: 5s to prevent blocking",
              "Schedule major migrations during low traffic",
            ],
          },
        ],
        code_snippets: [
          {
            language: "prisma",
            filename: "prisma/schema.prisma",
            description: "Prisma database schema",
            code: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String     @id @default(uuid())
  email        String     @unique
  passwordHash String     @map("password_hash")
  role         Role       @default(CUSTOMER)
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")
  deletedAt    DateTime?  @map("deleted_at")
  
  dealer       Dealer?
  favorites    Favorite[]
  inquiries    Inquiry[]
  
  @@map("users")
}

enum Role {
  ADMIN
  DEALER
  CUSTOMER
}

model Car {
  id          String      @id @default(uuid())
  make        String
  model       String
  year        Int
  price       Decimal     @db.Decimal(10, 2)
  mileage     Int
  status      CarStatus   @default(AVAILABLE)
  description String?
  images      String[]
  features    String[]
  location    Unsupported("geometry(Point, 4326)")?
  
  dealerId    String      @map("dealer_id")
  dealer      Dealer      @relation(fields: [dealerId], references: [id])
  
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")
  deletedAt   DateTime?   @map("deleted_at")
  
  favorites   Favorite[]
  inquiries   Inquiry[]
  
  @@index([make, model])
  @@index([price])
  @@index([dealerId])
  @@index([createdAt(sort: Desc)])
  @@map("cars")
}

enum CarStatus {
  AVAILABLE
  RESERVED
  SOLD
}

model Dealer {
  id        String   @id @default(uuid())
  name      String
  address   String
  phone     String
  rating    Decimal  @default(0) @db.Decimal(2, 1)
  
  userId    String   @unique @map("user_id")
  user      User     @relation(fields: [userId], references: [id])
  
  cars      Car[]
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@map("dealers")
}

model Favorite {
  userId    String   @map("user_id")
  carId     String   @map("car_id")
  createdAt DateTime @default(now()) @map("created_at")
  
  user      User     @relation(fields: [userId], references: [id])
  car       Car      @relation(fields: [carId], references: [id])
  
  @@id([userId, carId])
  @@map("favorites")
}

model Inquiry {
  id        String        @id @default(uuid())
  message   String
  status    InquiryStatus @default(PENDING)
  
  userId    String        @map("user_id")
  carId     String        @map("car_id")
  
  user      User          @relation(fields: [userId], references: [id])
  car       Car           @relation(fields: [carId], references: [id])
  
  createdAt DateTime      @default(now()) @map("created_at")
  updatedAt DateTime      @updatedAt @map("updated_at")
  
  @@map("inquiries")
}

enum InquiryStatus {
  PENDING
  RESPONDED
  CLOSED
}`,
          },
        ],
        configurations: [
          {
            name: "Backup Strategy",
            type: "markdown",
            content: `## Backup Configuration

### Automated Backups (Neon)
- Continuous WAL archiving
- Point-in-time recovery up to 7 days
- Daily snapshots retained for 30 days

### Manual Backup Script
\`\`\`bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > backup_$DATE.sql.gz
aws s3 cp backup_$DATE.sql.gz s3://car-app-backups/
\`\`\`

### Recovery Procedure
1. Stop application traffic
2. Restore from latest backup
3. Replay WAL to desired point
4. Verify data integrity
5. Resume traffic`,
          },
        ],
        risk_assessment: {
          level: "low",
          vulnerabilities: [
            "Data loss from accidental deletion",
            "Performance degradation from missing indexes",
            "Migration failures blocking deploys",
          ],
          mitigations: [
            "Soft deletes + delayed purge (30 days)",
            "Query performance monitoring",
            "Staging migration testing",
          ],
          priority_actions: [
            "P0: Design and implement core schema",
            "P0: Set up automated backups",
            "P1: Implement soft delete pattern",
            "P1: Create migration testing workflow",
          ],
        },
      },
    };

    return outputs[agentId] || {
      agent_id: agentId,
      agent_name: "Unknown Agent",
      role: "Analysis",
      specifications: [],
      risk_assessment: {
        level: "low",
        vulnerabilities: [],
        mitigations: [],
        priority_actions: [],
      },
    };
  };

  // Phase 1: Start discovery - send to LLM to use Questions tool
  const startDiscovery = async (request: string) => {
    setState({
      phase: "discovery",
      originalRequest: request,
      projectSpec: null,
      agents: [],
      agentOutputs: [],
      isCompiling: false,
      showAgentsPanel: false,
      finalPlan: null,
    });

    // Send discovery message - let the LLM decide what questions to ask
    await sendMessage(`I want to plan: "${request}"

Use the Questions tool to ask me clarifying questions about this project.

Rules:
- Ask questions SPECIFIC to this project, not generic ones
- Don't ask what's already clear from my request
- Use "selected: true" on options you recommend based on context
- Keep it to 4-6 important questions max

After I answer, use the Plan tool to create a formal implementation plan that I can approve or reject.`);
  };

  // Phase 2: User submits validated project spec
  const submitProjectSpec = async (spec: ProjectSpec) => {
    setState({
      phase: "review",
      projectSpec: spec,
    });
  };

  // Phase 3: Start technical agent analysis
  const startAgentAnalysis = async () => {
    if (!state.projectSpec) return;

    const agents: PlanAgent[] = DEFAULT_PLAN_AGENTS.map(a => ({
      ...a,
      status: "pending" as const,
    }));

    setState({
      phase: "agents",
      agents,
      agentOutputs: [],
      showAgentsPanel: true,
    });

    // Run all agents in parallel
    const promises = agents.map(agent => 
      runTechnicalAgent(agent, state.projectSpec!)
    );
    await Promise.all(promises);

    // Compile final plan
    setState("phase", "compiling");
    setState("isCompiling", true);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send comprehensive results to LLM for final plan creation
    const agentResults = state.agentOutputs.map(o => ({
      agent: o.agent_name,
      role: o.role,
      specifications: o.specifications,
      code_snippets: o.code_snippets?.map(s => ({ filename: s.filename, description: s.description })),
      configurations: o.configurations?.map(c => ({ name: c.name, type: c.type })),
      risk_level: o.risk_assessment.level,
      priority_actions: o.risk_assessment.priority_actions,
    }));

    await sendMessage(`Based on the deep technical analyses from all expert agents, create a comprehensive implementation Plan using the Plan tool.

**Project Specification:**
${JSON.stringify(state.projectSpec, null, 2)}

**Technical Agent Analyses:**
${JSON.stringify(agentResults, null, 2)}

Create a Plan with:
1. All agent_analyses populated with the findings above
2. Detailed tasks with subtasks, complexity, and time estimates
3. Technical architecture based on agent recommendations
4. Risk matrix from all agent risk assessments
5. Implementation roadmap with dependencies
6. Success criteria

The plan should be highly technical and actionable.`);

    setState("isCompiling", false);
    setState("phase", "complete");
  };

  const cancelPlan = () => {
    setState({
      phase: "idle",
      originalRequest: null,
      projectSpec: null,
      agents: [],
      agentOutputs: [],
      isCompiling: false,
      showAgentsPanel: false,
      finalPlan: null,
    });
  };

  const approvePlan = async () => {
    await sendMessage("I approve this plan. Please proceed with implementation, starting with the highest priority tasks.");
    cancelPlan();
  };

  const rejectPlan = () => {
    sendMessage("I'd like to modify this plan. Let's discuss the changes needed.");
  };

  return (
    <PlanContext.Provider
      value={{
        state,
        startDiscovery,
        submitProjectSpec,
        startAgentAnalysis,
        cancelPlan,
        approvePlan,
        rejectPlan,
      }}
    >
      {props.children}
    </PlanContext.Provider>
  );
};

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
