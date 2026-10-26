// Horn, as data. Every line traces to CV v3 (Desktop/Resume/Horn_Saerens_CV_2026_v3.docx),
// to figures Horn confirmed himself on 2026-10-13, or to a note in the Obsidian vault.
// Claims dropped as unsupported stay dropped: FreeScout "sole designer & developer",
// "Perseus AI Platform", "promoted four times". Nothing here is rounded up.
//
// The résumé window reads this in the CV's own voice; the assistant in the chat
// talks about Horn in the third person from js/content/dialogue.js.

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
    "AI Solutions Consultant with 4+ years at Spotzer Digital, progressing from sales leadership to end-to-end AI " +
    "delivery. Identifies high-friction processes, then designs and deploys AI agents, integrations and " +
    "internal platforms (LLMs, RAG, MCP, self-hosted models), built with AI coding agents, and drives their adoption. Shipped an AI support " +
    "workspace used by 100+ people, saving each 30 min–2 h a day, and trained 150+ employees in AI.",

  // The delivery cycle, shown under the summary and walked through in the chat.
  method: ["Identify", "Decide", "Prototype", "Build", "Deploy & feedback", "Train & adopt", "Improve"],

  company: "Spotzer Digital, Amsterdam — four roles in four years",
  experience: [
    {
      role: "AI Solutions Consultant",
      dates: "Aug 2025 – Present",
      bullets: [
        "**Identify & decide:** map how sales, support and operations really work, find where the business loses time or data control, and turn it into prioritised AI use cases with a clear build / no-build call.",
        "**Prototype to production:** build POCs, validate them with users, then own the architecture, specs, integration and deployment of the solutions that prove their value, built through AI-assisted development (Claude Code, Codex).",
        "**Model strategy:** select and implement models per use case across the company's Athena AI ecosystem — frontier APIs where capability drives value, self-hosted models where customer data must stay in-house.",
        "**Adoption:** run company-wide AI training (150+ participants) and a private AI platform on which teams have built 30+ agents.",
        "**Monitor & improve:** turn user feedback into delivery batches, and run a recurring AI watch that keeps teams on current tools and grounds tool choices in tests.",
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
      bullets: [
        "Led and coached a sales team and streamlined sales-to-delivery handovers; **CEO Award** for taking over the team and bringing it to target quickly.",
      ],
    },
    {
      role: "Sales Market Leader — FR Market",
      dates: "Apr 2022 – Sep 2023",
      bullets: ["Owned French-market sales through direct client engagement and tailored offers."],
    },
  ],

  skills: [
    {
      group: "AI & agents",
      items: ["Agent design", "MCP servers", "RAG", "Prompt engineering & evaluation", "Guardrails & hallucination control", "n8n", "LibreChat"],
    },
    {
      group: "Models",
      items: ["Claude, GPT, Gemini", "LM Studio, vLLM, Ollama", "Benchmarking & selection per use case"],
    },
    {
      group: "AI-assisted delivery",
      items: ["Specs & architecture for coding agents", "Claude Code, Codex", "Test strategy", "Shipped on TypeScript / React, Node.js, Python", "SQLite", "Docker", "GitHub Actions", "Playwright checks", "Basic coding literacy"],
    },
    {
      group: "Business",
      items: ["Salesforce", "Google Workspace APIs", "Power BI", "Tableau", "Discovery workshops", "Training & change management"],
    },
  ],

  projects: [
    {
      id: "freescout",
      name: "FreeScout AI Copilot",
      kind: "AI support workspace",
      status: "In production · 100+ users",
      stack: ["React", "TypeScript", "Node / Express", "Docker", "Caddy", "Playwright"],
      problem:
        "Support agents juggled tickets, call transcripts and AI tools across separate systems, with no single customer view and customer data at risk of third-party exposure.",
      built:
        "One workspace, designed by Horn and built with AI coding agents, unifying FreeScout tickets and call transcripts with contextual AI search, draft replies, per-mailbox templates and business instructions, scheduled sends with a team calendar and Cortex customer briefs. Google sign-in, per-operator identity, strict customer-context isolation before any model call, and a human review before every send.",
      result:
        "In production for 100+ users, saving each of them 30 minutes to 2 hours a day, with a clearer view and tighter control of customer data. The roadmap now comes from user feedback: e-mail translation, internal notes, shareable ticket links, assignee and waiting-time columns, attachments.",
    },
    {
      id: "platform",
      name: "Private AI platform",
      kind: "ChatGPT-style platform on LibreChat",
      status: "In use · 30+ agents built by teams",
      stack: ["LibreChat", "Docker Compose", "MongoDB", "Meilisearch", "pgvector", "MCP", "LM Studio"],
      problem:
        "Teams used AI ad hoc through personal accounts, with no shared practice and no control over company data.",
      built:
        "LibreChat rebuilt from its sources into a private platform: a container stack with MongoDB, Meilisearch, a RAG API and pgvector; a local model endpoint through LM Studio; Google Workspace, Atlassian and Gmail connected over MCP; an agent catalogue with search, indexing and access rules. Plus a transportable backup-and-restore bundle, and a reusable skill that installs and verifies a new MCP server.",
      result:
        "Teams practise AI ethically on their real work: they have built 30+ agents of their own, adopt new tools faster and collaborate more easily.",
    },
    {
      id: "enablement",
      name: "AI Day & AI Explorer",
      kind: "Company-wide AI training",
      status: "Delivered · 150+ participants",
      stack: ["Workshop", "Training site"],
      problem:
        "Before teams could use AI well, they needed the same footing: what it does, where it fails, and what must never be pasted into it.",
      built:
        "A company-wide workshop — prompting, data security, hallucinations, RAG, MCP, hands-on agent creation — extended into a self-serve site: foundations, mindset, a prompting lab and a five-step agent-architect builder (purpose, knowledge, boundaries, persona, review).",
      result:
        "150+ participants in total, and the practice continues on the private AI platform, where the teams build their own agents.",
    },
    {
      id: "docflow",
      name: "Docflow",
      kind: "Document governance platform",
      status: "Deployed · team leaders & executive team",
      stack: ["Node.js", "React", "SQLite", "Google Drive API", "Ollama"],
      problem:
        "Across thousands of Drive files nobody knew which document was current, owned or approved, and AI tools had no governed corpus to read from.",
      built:
        "A portal, built with AI coding agents, with Google Drive as the single source of truth: document admission, versioning and ownership, a SQLite registry with an audit log, access-aware search by cited passages, native text extraction with OCR on demand, and update sessions with Calendar and Meet. Optional model-written answers never alter the retrieved passages.",
      result:
        "Used by all team leaders and the executive team (30 people), with a dedicated owner controlling what is current and approved. The registry was benchmarked at 1,000 and 3,000 documents.",
    },
    {
      id: "athena",
      name: "Athena",
      kind: "The company's AI ecosystem",
      status: "Cortex, AI Coach, Recall…",
      stack: ["Prompt engineering", "Model selection", "Gemma 4 E4B", "Benchmarking"],
      summary:
        "Active contributor to the ecosystem's structure, its prompting and its model choices, and to putting those models in place. He inventoried and unified the prompts of the Cortex conversation-intelligence pipeline for a small self-hosted model, with a benchmark harness comparing prompt versions on real samples, and connected Cortex customer briefs to the support copilot.",
    },
    {
      id: "briefing",
      name: "AI watch & newsletter",
      kind: "Keeping teams on current tools",
      status: "Recurring",
      stack: ["Newsletter", "Tool testing"],
      summary:
        "A recurring watch on new AI tools, models and repositories, shared as a newsletter: it keeps the teams up to date, feeds new experiments, and keeps tool choices grounded in tests rather than hype.",
    },
    {
      id: "local",
      name: "Local models, end to end",
      kind: "Keeping customer data in-house",
      status: "Ongoing line of work",
      stack: ["LM Studio", "vLLM", "Ollama", "Docker"],
      summary:
        "A local model endpoint (LM Studio) wired into the platform's containers; a self-hosted vLLM or Ollama endpoint chosen for the support copilot so customer data never leaves; a local-first AI workspace explored on local hardware with an open model. And one agent installed and then deliberately paused: too powerful to run unsupervised on a work machine with sensitive data.",
    },
    {
      id: "crm",
      name: "Internal CRM",
      kind: "Replacing Salesforce",
      status: "In progress since September 2026",
      stack: ["Twenty", "WSL2", "Docker"],
      summary:
        "Scoped and started an internal CRM on the open-source Twenty base, under five rules: extend rather than rewrite, no Enterprise spend, self-hosted, 100+ users, one isolated workspace per partner. WSL2 and Docker development stack, first core patches each documented with its proof, business logic planned as an SDK app with telephony webhooks.",
    },
    {
      id: "toolbox",
      name: "horn-dev",
      kind: "Claude Code plugin",
      status: "Public on GitHub · in use",
      stack: ["Claude Code", "Vitest", "Playwright", "GitHub Actions"],
      problem:
        "Every project with a coding agent started from zero: which checks to run, how big a change is, what counts as proof.",
      built:
        "A plugin with one entry point that classifies the request (implement, fix, analyse, review, verify), sizes the work and picks the checks from what was touched; nine specialised commands; explicit approval before anything runs; verification reports tied to a fingerprint of the exact code they checked.",
      result:
        "Installed once and shared by all his projects, each keeping only its own configuration, status and reports. Public on GitHub, with its own tests and CI.",
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
      id: "salesops",
      name: "Sales & ops tooling",
      kind: "Smaller internal tools",
      status: "Internal tools",
      stack: ["React / Vite", "Python", "WebMCP"],
      summary:
        "A quote calculator for sellers (60-service catalogue, tolerant search, WebMCP tools), a client-export filter in daily use with a QA report, and AI lead-enrichment workflows: deduplication, profiling, product matching, scoring.",
    },
  ],

  education: [
    "Self-taught in AI solution design and AI-assisted delivery — the projects are the proof of work.",
    "Architecture studies, ENSAG, Grenoble — 2013–2015.",
  ],
  languages: "French (native) · English (fluent)",
};
