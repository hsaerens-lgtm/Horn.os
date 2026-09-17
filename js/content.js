export const content = {
  name: "Horn Saerens",
  title: "AI Solutions Consultant",
  tagline: "AI Agents, Integrations & Adoption",
  location: "Amsterdam",
  contact: {
    email: "saerenshorn@gmail.com",
    phone: "+33 7 86 13 97 87",
    linkedin: "https://www.linkedin.com/in/horn-saerens-7426b022b",
    github: "https://github.com/hsaerens-lgtm",
  },
  resumePdf: "assets/Horn_Saerens_CV_2026.pdf",

  profile:
    "I turn business problems into AI solutions that get deployed and actually used. " +
    "Promoted through four roles in four years at Spotzer Digital — Sales → Team Lead → Sales Operations → AI Solutions Consultant — " +
    "by building the solutions the business needed at each step. Hybrid profile: business understanding, end-to-end technical ownership " +
    "(architecture, development, integration, deployment), and a track record of adoption by non-technical teams.",

  skills: [
    { label: "AI agents & integrations", items: "Agent design, MCP servers (design & deployment), REST APIs, n8n, LibreChat, Codex, Claude Code" },
    { label: "LLMs & model strategy", items: "Frontier models (Claude, GPT, Gemini), local LLMs (LM Studio, vLLM, Ollama), benchmarking & selection per use case, RAG, guardrails & hallucination control" },
    { label: "Deployment & self-hosting", items: "Docker & Docker Compose, CI (GitHub Actions), Caddy, self-hosted model serving" },
    { label: "Engineering", items: "TypeScript, React / Vite, Node.js / Express, Python, Git, Supabase, MongoDB" },
    { label: "Business tools", items: "Salesforce, Google Workspace, Power BI, Tableau" },
  ],

  company: { name: "Spotzer Digital, Amsterdam", note: "promoted four times in four years" },
  experience: [
    {
      role: "AI Solutions Consultant",
      dates: "Aug 2025 – Present",
      bullets: [
        "Own the full delivery cycle of AI solutions across sales, support, production and knowledge access: discovery, architecture, development, integration, deployment and enablement.",
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
      bullets: ["Led and coached a sales team and streamlined sales-to-delivery handovers; CEO Award, Sep 2023."],
    },
    {
      role: "Sales Market Leader — FR Market",
      dates: "Apr 2022 – Oct 2023",
      bullets: ["Owned French-market sales through direct client engagement and tailored offers."],
    },
  ],

  projects: [
    {
      id: "freescout",
      name: "FreeScout AI Copilot",
      file: "freescout_copilot.exe",
      status: "internal tool · self-hosted · sole designer & developer",
      problem: "Support agents juggled tickets, call transcripts and AI tools across separate systems, with customer data at risk of third-party exposure.",
      built: "Full-stack workspace (React / TypeScript, Node / Express) unifying FreeScout tickets and call transcriptions with contextual AI search and draft replies — Google multi-user auth, per-operator isolation, strict customer-context isolation before any model call, automated tests and CI.",
      result: "Self-hosted via Docker / Caddy, designed to run on local models so customer data never leaves the infrastructure; agents work in one workspace with human review before every send.",
    },
    {
      id: "perseus",
      name: "Perseus AI Platform",
      file: "perseus_platform.exe",
      status: "internal platform · in production · LibreChat-based",
      problem: "Give non-technical teams a safe, governed ChatGPT-like environment connected to company tools, instead of scattered personal AI accounts.",
      built: "Rebuilt LibreChat from source into an internal platform: full container stack with RAG, local model endpoint, MCP integrations (Google Workspace, Atlassian, Gmail), an agent catalogue with search and access rules, resilient duplicate detection, and guided agent creation for non-technical users.",
      result: "Business teams create and reuse governed agents on one platform, with privacy and long-term scalability built in.",
    },
    {
      id: "aiday",
      name: "AI Day Workshop",
      file: "ai_day_workshop.ppt",
      status: "company-wide enablement · delivered",
      summary: "Designed and delivered a company-wide workshop — prompting, data security, hallucinations, RAG and hands-on agent creation — giving business teams shared vocabulary and practical guardrails.",
    },
    {
      id: "docflow",
      name: "Docflow",
      file: "docflow_portal.exe",
      status: "document governance portal · POC",
      summary: "Designed a portal with Google Drive as single source of truth: document admission with taxonomy and OCR, ownership tracking, and structured update sessions producing traceable annotations — architected for 1,000–10,000 documents.",
    },
    {
      id: "conversation",
      name: "Conversation Intelligence Platform",
      file: "call_intelligence.exe",
      status: "internal tool · contributor",
      summary: "Contributed to a local transcription platform with call search, AI chat, translation, speaker separation and multilingual export — customer conversations become searchable and reusable across teams.",
    },
    {
      id: "salesai",
      name: "Sales AI Workflows",
      file: "sales_workflows.bat",
      status: "internal tools · designer",
      summary: "Designed AI workflows for lead enrichment (deduplication, profiling, product matching, scoring) and call-quality coaching with reusable scoring templates for structured, repeatable coaching.",
    },
  ],

  education: [
    "Self-taught in AI engineering and software delivery — the projects on this desktop are the proof of work.",
    "Architecture studies, ENSAG, Grenoble — 2013–2015.",
  ],
  languages: "French (native) · English (fluent)",
};
