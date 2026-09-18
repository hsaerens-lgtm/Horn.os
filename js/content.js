// The CV, written as the Dungeon Master's character sheet.
// Every fact here is real; only the framing is a game sheet.

export const content = {
  name: "Horn Saerens",
  charClass: "AI Solutions Consultant",
  level: 4,
  background: "Sales Operations",
  alignment: "Pragmatic Good",
  role: "Dungeon Master",
  location: "Amsterdam",
  contact: {
    email: "saerenshorn@gmail.com",
    phone: "+33 7 86 13 97 87",
    linkedin: "https://www.linkedin.com/in/horn-saerens-7426b022b",
    github: "https://github.com/hsaerens-lgtm",
  },
  resumePdf: "assets/Horn_Saerens_CV_2026.pdf",

  tagline: "I run the table: I turn business problems into AI solutions that get deployed and actually used.",

  blurb:
    "Four levels in four years at Spotzer Digital — Sales, Team Lead, Sales Operations, " +
    "AI Solutions Consultant — each one earned by building the solutions the business needed. " +
    "I sit behind the screen: I set the scope, write the rules, hand the agents their tools, " +
    "and make sure what happens at the table is something the business can actually use.",

  // Ability scores are a framing device, not a measurement. Each one names a real
  // strength and says plainly what it means outside the metaphor.
  abilities: [
    { key: "INT", label: "Intelligence", score: 17, mod: "+3", note: "Architecture, integration, systems design" },
    { key: "WIS", label: "Wisdom", score: 16, mod: "+3", note: "Model selection — and knowing when not to use AI" },
    { key: "CHA", label: "Charisma", score: 16, mod: "+3", note: "Stakeholder translation, enablement, adoption" },
    { key: "CON", label: "Constitution", score: 15, mod: "+2", note: "Shipping to production and keeping it running" },
    { key: "DEX", label: "Dexterity", score: 14, mod: "+2", note: "Picking up an unfamiliar stack fast" },
    { key: "STR", label: "Strength", score: 11, mod: "+0", note: "Carrying the laptop to the meeting room" },
  ],

  proficiencies: [
    { name: "Agent design & MCP integration", rank: "Expertise" },
    { name: "LLM selection & benchmarking", rank: "Expertise" },
    { name: "Business process analysis", rank: "Expertise" },
    { name: "Self-hosted deployment (Docker)", rank: "Proficient" },
    { name: "Full-stack delivery (TypeScript, React, Node)", rank: "Proficient" },
    { name: "Python, Git, CI", rank: "Proficient" },
    { name: "RAG, guardrails & hallucination control", rank: "Proficient" },
    { name: "Salesforce, Google Workspace, Power BI", rank: "Proficient" },
  ],

  inventory: [
    { slot: "Frontier models", items: "Claude, GPT, Gemini" },
    { slot: "Local models", items: "LM Studio, vLLM, Ollama" },
    { slot: "Integration", items: "MCP servers, REST APIs, n8n" },
    { slot: "Deployment", items: "Docker & Compose, GitHub Actions, Caddy" },
    { slot: "Engineering", items: "TypeScript, React / Vite, Node / Express, Python, Supabase, MongoDB" },
  ],

  // The AI agents that sit at this table — all real projects.
  // `charClass` and `traits` exist so each one can be read as a character sheet:
  // the shape is a stat block, but every line in it is a fact about the project.
  // `lines` are what they say across the table while the session runs: the
  // corporate world read as a dungeon. The break in each one is placed for the
  // timing of the joke, not for the width of the bubble.
  party: [
    {
      id: "perseus",
      lines: [
        "The stakeholder is immune to charm.\nAnd to logic.",
        "I attack the backlog.\nIt has legendary resistance.",
        "You cannot cast Deadline.\nIt is not on your list.",
        "Roll a Governance check.\nDisadvantage: nobody owns it.",
        "The budget is a bag of holding\nwith a hole in the bottom.",
      ],
      name: "PERSEUS",
      role: "The Platform",
      charClass: "Construct · Governed Platform",
      status: "In production",
      traits: [
        { k: "Deployment", v: "Self-hosted, Docker Compose" },
        { k: "Data", v: "Never leaves company infrastructure" },
        { k: "Reach", v: "Google Workspace, Atlassian, Gmail over MCP" },
      ],
      stack: "LibreChat (built from source) · Docker Compose · RAG + pgvector · MCP · LM Studio",
      quest: "Raising the Platform",
      colour: "#4fc3f7",
      blurb:
        "Internal AI platform, in production. LibreChat rebuilt from source: container stack with RAG, " +
        "a local model endpoint, MCP integrations for Google Workspace, Atlassian and Gmail, and an agent " +
        "catalogue with access rules and guided creation for non-technical users.",
    },
    {
      id: "hermes",
      lines: [
        "Roll for initiative.\nThe stand-up starts in two minutes.",
        "That meeting could have been\na Scroll of Sending.",
        "Natural 20 on Estimation.\nThe sprint slips anyway.",
        "I cast Reschedule.\nThe meeting saves against it.",
        "Do I need to roll\nto leave the call?",
      ],
      name: "HERMES",
      role: "The Messenger",
      charClass: "Scout · Local Agent",
      status: "Running locally",
      traits: [
        { k: "Runs", v: "On the machine, not in someone else's cloud" },
        { k: "Models", v: "Several providers, switchable per task" },
        { k: "Sent on", v: "Lead enrichment, scoring, call-quality coaching" },
      ],
      stack: "Terminal agent · multi-provider model routing · local-first",
      quest: "Sharpening the Blade",
      colour: "#ffb74d",
      blurb:
        "Local terminal agent. Configurable across several model providers, running on the machine rather " +
        "than in someone else's cloud — the scout that goes out and comes back with the answer.",
    },
    {
      id: "odysseus",
      lines: [
        "The requirements document\nis a mimic.",
        "Perception check:\nnobody read the deck.",
        "I have proficiency\nin Nodding Thoughtfully.",
        "The single source of truth\nhas three of them.",
        "Q4 is a lich.\nIt keeps coming back.",
      ],
      name: "ODYSSEUS",
      role: "The Navigator",
      charClass: "Navigator · Knowledge Workspace",
      status: "Under evaluation",
      traits: [
        { k: "Carries", v: "Chat, agents, deep research, memory, tasks" },
        { k: "Hardware", v: "Local, one interface instead of six tools" },
        { k: "Charted for", v: "1,000–10,000 governed documents" },
      ],
      stack: "Self-hosted workspace · chat, agents, deep research, memory · local hardware",
      quest: "The Great Library",
      colour: "#81c784",
      blurb:
        "Self-hosted, local-first AI workspace under evaluation: one interface for chat, agents, deep " +
        "research, model comparison, documents, memory and tasks, all on local hardware.",
    },
    {
      id: "codex",
      lines: [
        "Critical failure.\nHe replied all.",
        "The client wants a wizard.\nOn the login page.",
        "Long rest? We have\na demo on Friday.",
        "It works on my plane\nof existence.",
        "He is not a dragon,\nhe is a director. Same hoard.",
      ],
      name: "CODEX",
      role: "The Artificer",
      charClass: "Artificer · Coding Agent",
      status: "Daily driver",
      traits: [
        { k: "Takes", v: "A written spec and a deadline" },
        { k: "Returns", v: "Tested code, in CI, deployed" },
        { k: "Has built", v: "The support workspace — and this table" },
      ],
      stack: "Coding agent · spec to implementation · used to build this very table",
      quest: "The Support Workspace",
      colour: "#ba68c8",
      blurb:
        "Coding agent. Builds the tools the rest of the party uses — the one I hand a spec to when " +
        "something needs to exist by Friday.",
    },
  ],

  // Experience, as the campaign so far.
  campaign: {
    company: "Spotzer Digital, Amsterdam",
    note: "four levels in four years",
    entries: [
      {
        role: "AI Solutions Consultant",
        dates: "Aug 2025 – Present",
        level: "Level 4",
        bullets: [
          "Own the full delivery cycle of AI solutions across sales, support, production and knowledge access: discovery, architecture, development, integration, deployment and enablement.",
          "Design AI agents connected to business tools and data, with grounded outputs and human validation embedded in every flow.",
          "Benchmark and select models per use case: frontier APIs where capability drives value, self-hosted local models where customer data must stay in-house.",
          "Lead company-wide AI enablement on prompting, data security, hallucination control and agent creation.",
        ],
      },
      {
        role: "Sales Operations Manager",
        dates: "Jul 2024 – Aug 2025",
        level: "Level 3",
        bullets: [
          "Owned forecasting, market performance and strategy analysis; introduced the company's first AI-assisted processes into sales operations — the bridge to the AI role.",
        ],
      },
      {
        role: "Team Leader Sales",
        dates: "Sep 2023 – Jul 2024",
        level: "Level 2",
        bullets: ["Led and coached a sales team and streamlined sales-to-delivery handovers."],
      },
      {
        role: "Sales Market Leader — FR Market",
        dates: "Apr 2022 – Oct 2023",
        level: "Level 1",
        bullets: ["Owned French-market sales through direct client engagement and tailored offers."],
      },
    ],
  },

  // Projects, as completed quests.
  quests: [
    {
      id: "freescout",
      name: "The Support Workspace",
      real: "FreeScout AI Copilot",
      status: "Internal tool · self-hosted · sole designer & developer",
      problem:
        "Support agents juggled tickets, call transcripts and AI tools across separate systems, with customer data at risk of third-party exposure.",
      built:
        "Full-stack workspace (React / TypeScript, Node / Express) unifying FreeScout tickets and call transcriptions with contextual AI search and draft replies — Google multi-user auth, per-operator isolation, strict customer-context isolation before any model call, automated tests and CI.",
      result:
        "Self-hosted via Docker / Caddy, designed to run on local models so customer data never leaves the infrastructure; agents work in one workspace with human review before every send.",
    },
    {
      id: "perseus-quest",
      name: "Raising the Platform",
      real: "Perseus AI Platform",
      status: "Internal platform · in production",
      problem:
        "Give non-technical teams a safe, governed ChatGPT-like environment connected to company tools, instead of scattered personal AI accounts.",
      built:
        "Rebuilt LibreChat from source: container stack with RAG, local model endpoint, MCP integrations (Google Workspace, Atlassian, Gmail), an agent catalogue with search and access rules, resilient duplicate detection, and guided agent creation.",
      result: "Business teams create and reuse governed agents on one platform, with privacy and scalability built in.",
    },
    {
      id: "aiday",
      name: "Teaching the Village",
      real: "AI Day Workshop",
      status: "Company-wide enablement · delivered",
      summary:
        "Designed and delivered a company-wide workshop — prompting, data security, hallucinations, RAG and hands-on agent creation — giving business teams shared vocabulary and practical guardrails.",
    },
    {
      id: "docflow",
      name: "The Great Library",
      real: "Docflow",
      status: "Document governance portal · POC",
      summary:
        "Designed a portal with Google Drive as single source of truth: document admission with taxonomy and OCR, ownership tracking, and structured update sessions producing traceable annotations — architected for 1,000–10,000 documents.",
    },
    {
      id: "conversation",
      name: "Listening to the Realm",
      real: "Conversation Intelligence Platform",
      status: "Internal tool · contributor",
      summary:
        "Contributed to a local transcription platform with call search, AI chat, translation, speaker separation and multilingual export — customer conversations become searchable and reusable across teams.",
    },
    {
      id: "salesai",
      name: "Sharpening the Blade",
      real: "Sales AI Workflows",
      status: "Internal tools · designer",
      summary:
        "Designed AI workflows for lead enrichment (deduplication, profiling, product matching, scoring) and call-quality coaching with reusable scoring templates.",
    },
  ],

  feats: [
    "CEO Award, Spotzer Digital — September 2023",
    "Self-taught in AI engineering and software delivery; the quests above are the proof of work",
    "Architecture studies, ENSAG, Grenoble — 2013–2015",
  ],

  languages: "French (native) · English (fluent)",
};
