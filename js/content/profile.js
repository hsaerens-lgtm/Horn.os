// Horn, as data. Every line traces to CV v2 (Desktop/Resume/Horn_Saerens_CV_2026_v2.docx)
// or to a note in the Obsidian vault. Claims dropped as unsupported stay dropped:
// FreeScout "sole designer & developer", "Perseus AI Platform", the LibreChat
// platform "in production". Nothing here is rounded up.
//
// The résumé window reads this in the CV's own first person; the assistant in
// the chat talks about Horn in the third person from js/content/dialogue.js.

export const profile = {
  name: "Horn Saerens",
  title: "AI Solutions Consultant",
  focus: "AI agents, integrations & adoption",
  location: "Amsterdam",
  availability: "Based in Amsterdam · EU citizen · one-month notice",
  email: "saerenshorn@gmail.com",
  links: {
    linkedin: "https://www.linkedin.com/in/horn-saerens-7426b022b",
    github: "https://github.com/hsaerens-lgtm",
  },
  resumePdf: "assets/Horn_Saerens_CV_2026.pdf",

  summary:
    "I turn business problems into AI solutions that get deployed and actually used. Promoted through " +
    "four roles in four years at Spotzer Digital — Sales → Team Lead → Sales Operations → AI Solutions " +
    "Consultant — by building the solutions the business needed at each step. Hybrid profile: business " +
    "understanding, end-to-end technical ownership (architecture, development, integration, deployment), " +
    "and a track record of adoption by non-technical teams.",

  company: "Spotzer Digital, Amsterdam — promoted four times in four years",
  experience: [
    {
      role: "AI Solutions Consultant",
      dates: "Aug 2025 – Present",
      bullets: [
        "Own the full delivery cycle of AI solutions across sales, support, production, CRM and knowledge access: discovery, architecture, development, integration, deployment and enablement.",
        "Design AI agents connected to business tools and data (CRM, Google Workspace, support systems), with grounded outputs and human validation embedded in every flow.",
        "Benchmark and select models per use case: frontier APIs where capability drives value, self-hosted local models where customer data must stay in-house.",
        "Lead company-wide AI enablement on prompting, data security, hallucination control and agent creation.",
      ],
    },
    {
      role: "Sales Operations Manager",
      dates: "Jul 2024 – Aug 2025",
      bullets: [
        "Owned forecasting, market performance and strategy analysis; introduced the company's first AI-assisted processes into sales operations — the bridge to the AI role.",
      ],
    },
    {
      role: "Team Leader Sales",
      dates: "Sep 2023 – Jul 2024",
      bullets: ["Led and coached a sales team and streamlined sales-to-delivery handovers; **CEO Award**, Sep 2023."],
    },
    {
      role: "Sales Market Leader — FR Market",
      dates: "Apr 2022 – Oct 2023",
      bullets: ["Owned French-market sales through direct client engagement and tailored offers."],
    },
  ],

  skills: [
    {
      group: "AI agents & integrations",
      items: ["Agent design", "MCP servers", "REST APIs", "n8n", "LibreChat", "Codex", "Claude Code", "Prompting small self-hosted models"],
    },
    {
      group: "LLMs & model strategy",
      items: ["Claude, GPT, Gemini", "LM Studio, vLLM, Ollama", "Benchmarking & selection", "RAG", "Prompt evaluation on real samples", "Guardrails & hallucination control"],
    },
    {
      group: "Deployment & self-hosting",
      items: ["Docker & Compose", "GitHub Actions", "Caddy", "Render", "WSL2", "Self-hosted model serving"],
    },
    {
      group: "Engineering",
      items: ["TypeScript", "React / Vite", "Node.js / Express", "Python", "SQLite", "Supabase", "MongoDB", "Vitest / Playwright", "Electron", "Git"],
    },
    {
      group: "Business tools",
      items: ["Salesforce", "Twenty CRM", "Google Workspace APIs", "Power BI", "Tableau"],
    },
  ],

  projects: [
    {
      id: "freescout",
      name: "FreeScout AI Copilot",
      kind: "Support workspace",
      status: "In use by the support team",
      stack: ["React", "TypeScript", "Node / Express", "Docker", "Caddy", "Playwright"],
      problem:
        "Support agents juggled tickets, call transcripts and AI tools across separate systems, with customer data at risk of third-party exposure.",
      built:
        "A full-stack workspace unifying FreeScout tickets and call transcripts with contextual AI search, draft replies, per-mailbox HTML templates and business instructions, scheduled sends with a team calendar and a Cortex customer-brief tab. Google OAuth, per-operator identity, strict customer-context isolation before any model call, timeouts and rate limits on every outbound call.",
      result:
        "Deployed with Docker and Caddy, with a Render blueprint; provider-agnostic, so local models can replace cloud APIs; 268 unit and integration tests, 26 Playwright end-to-end tests, CI; prompts benchmarked on 30 real customer e-mails. The support team uses it with human review before every send.",
    },
    {
      id: "platform",
      name: "Internal AI platform on LibreChat",
      kind: "Internal platform",
      status: "Built from source · local build and online instance",
      stack: ["LibreChat", "Docker Compose", "MongoDB", "Meilisearch", "pgvector", "MCP", "LM Studio"],
      problem:
        "Give non-technical teams a safe, governed ChatGPT-like environment connected to company tools, instead of scattered personal AI accounts.",
      built:
        "LibreChat rebuilt from its sources: a container stack with MongoDB, Meilisearch, a RAG API and pgvector; a local model endpoint through LM Studio; Google Workspace, Atlassian and Gmail connected over MCP; an agent catalogue with search, indexing and access rules; duplicate detection that survives a provider being down. Plus a transportable backup-and-restore bundle for the whole environment, and a reusable skill that installs and verifies a new MCP server.",
      result:
        "Business teams create and reuse governed agents on one platform. The catalogue fixes are documented for replication on the online instance; guided agent creation for non-technical users is the work in progress.",
    },
    {
      id: "docflow",
      name: "Docflow",
      kind: "Document governance portal",
      status: "V1 delivered · connected to Google Workspace",
      stack: ["Node.js", "React", "SQLite", "Google Drive API", "Ollama"],
      problem:
        "Across thousands of Drive files nobody could tell which document was current, owned or approved, and AI tools had no governed corpus to read from.",
      built:
        "A portal with Google Drive as the single source of truth: admission with deterministic classification suggestions and versioning, a SQLite registry with an audit log, ACL-aware search by cited passages, knowledge capsules per audience, update sessions with Calendar and Meet, and local OCR through Ollama. Optional model-written answers never alter the retrieved passages.",
      result:
        "252 backend tests, Playwright end-to-end and CI; registry benchmarked at 1,000 and 3,000 documents; production preflight and Render blueprint ready.",
    },
    {
      id: "crm",
      name: "Daily Spotz",
      kind: "Internal CRM replacing Salesforce",
      status: "In progress since September 2026",
      stack: ["Twenty", "WSL2", "Docker"],
      summary:
        "Scoped and started an internal CRM on the open-source Twenty base, under five rules: extend rather than rewrite, no Enterprise spend, self-hosted, 100+ users, one isolated workspace per partner. WSL2 and Docker development stack, first core patches each documented with its proof, business logic planned as an SDK app with telephony webhooks.",
    },
    {
      id: "cortex",
      name: "Cortex conversation intelligence",
      kind: "Prompt engineering & integration",
      status: "Athena platform",
      stack: ["Gemma 4 E4B", "Prompt benchmarking"],
      summary:
        "Inventoried and unified the LLM prompts of the Cortex pipeline for a small self-hosted model, with a benchmark harness comparing prompt versions on real samples; integrated Cortex customer briefs into the support copilot and its reply prompts.",
    },
    {
      id: "callcoach",
      name: "Call Coach",
      kind: "Desktop call-evaluation app",
      status: "Desktop app",
      stack: ["Electron", "React"],
      summary:
        "Audio import and transcription, AI-generated QA scoring templates for support, sales and compliance, multi-provider model choice with API keys kept out of the renderer, local history and CSV / JSON export.",
    },
    {
      id: "enablement",
      name: "AI Day & AI Explorer",
      kind: "Company-wide AI enablement",
      status: "Delivered",
      stack: ["Workshop", "Training site"],
      summary:
        "A company-wide workshop — prompting, data security, hallucinations, RAG, MCP, hands-on agent creation — extended into a self-serve site: foundations, mindset, a prompting lab and a five-step agent-architect builder (purpose, knowledge, boundaries, persona, review).",
    },
    {
      id: "local",
      name: "Local models, end to end",
      kind: "Keeping customer data in-house",
      status: "Ongoing line of work",
      stack: ["LM Studio", "vLLM", "Ollama", "Docker"],
      summary:
        "A local model endpoint (LM Studio) wired into the platform's containers; a self-hosted vLLM or Ollama endpoint chosen as the support copilot's production target so customer data never leaves; a local-first AI workspace explored on local hardware with an open model. And one agent installed and then deliberately paused: too powerful to run unsupervised on a work machine with sensitive data.",
    },
    {
      id: "toolbox",
      name: "horn-dev",
      kind: "Personal Claude Code plugin",
      status: "Installed and in use",
      stack: ["Claude Code", "Vitest", "Playwright", "GitHub Actions"],
      problem:
        "Every project with a coding agent started from zero: which checks to run, how big a change is, what counts as proof.",
      built:
        "A plugin with one entry point that classifies the request (implement, fix, analyse, review, verify), sizes the work and picks the checks from what was touched; eight specialised commands; explicit approval before anything runs; verification reports tied to a fingerprint of the exact code they checked.",
      result:
        "Installed once and shared by all his projects; each project keeps only its own configuration, status and reports. Thirty tests cover the plugin itself.",
    },
    {
      id: "vault",
      name: "Obsidian working vault",
      kind: "Knowledge base for people and agents",
      status: "In use",
      stack: ["Obsidian", "Claude Code", "Codex"],
      summary:
        "Every project, decision, stack note and lesson in one vault, fed by the coding agents themselves through a sync skill and read by them before they touch a project — what was built, how and why, without moving the code out of its repositories.",
    },
    {
      id: "briefing",
      name: "Automated AI briefing",
      kind: "AI watch",
      status: "Prototype",
      stack: ["Newsletter", "Podcast script"],
      summary:
        "A recurring AI watch written for the job — adoption, agents, local models, simple tools — turned into a readable newsletter and a five-to-eight-minute podcast script. Scheduling it from a local coding agent proved unreliable; an external orchestrator is the recommended next step.",
    },
    {
      id: "salesops",
      name: "Sales & ops tooling",
      kind: "Internal tools",
      status: "Internal tools",
      stack: ["WordPress", "WebMCP"],
      summary:
        "A WordPress quote calculator (60-service catalogue, tolerant search, WebMCP tools), a deterministic client filter for order exports with a QA report, and AI lead-enrichment workflows: deduplication, profiling, product matching, scoring.",
    },
  ],

  education: [
    "Self-taught in AI engineering and software delivery — the projects are the proof of work.",
    "Architecture studies, ENSAG, Grenoble — 2013–2015.",
  ],
  languages: "French (native) · English (fluent)",
};
