// The CV, written as the Dungeon Master's character sheet.
// Every fact here is real; only the framing is a game sheet.
//
// The party is the models I actually run — named for what they are, a coding
// agent from OpenAI, one from Anthropic, Google's frontier model, an open model
// on the machine under the desk — because the picture is a Dungeon Master
// directing his agents, not a fantasy about them. The projects are on the
// sheets in front of them. They are real, they are mine, and they are described
// without the agents' names in them: which model did what is a representation,
// the work is not.
//
// Renaming a player is a change to this file only. `body`, `prop` and `mark`
// choose its silhouette, what it brought to the table and the emblem on its
// screen; nothing in the scene modules knows a player by name.

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
  resumePdf: "../assets/Horn_Saerens_CV_2026.pdf",

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
    { slot: "Coding agents", items: "Codex, Claude Code — with a method of my own on top" },
    { slot: "Integration", items: "MCP servers, REST APIs, n8n" },
    { slot: "Deployment", items: "Docker & Compose, GitHub Actions, Caddy" },
    { slot: "Engineering", items: "TypeScript, React / Vite, Node / Express, Python, Supabase, MongoDB" },
  ],

  // The models at this table. `charClass` and `traits` exist so each one can be
  // read as a character sheet: the shape is a stat block, but every line in it
  // is a fact about how that model is used here. `quest` points at the project
  // on the sheet in front of it. `lines` are what they say across the table
  // while the session runs: the corporate world read as a dungeon. The break in
  // each one is placed for the timing of the joke, not for the width of the
  // bubble.
  party: [
    {
      id: "fable",
      name: "FABLE",
      role: "The Chronicler",
      body: "slab",
      prop: "mug",
      mark: "book",
      colour: "#4fc3f7",
      charClass: "Coding Agent · Anthropic, in Claude Code",
      status: "At the table right now",
      traits: [
        { k: "Carries", v: "My own method as a plugin: one entry point, eight commands" },
        { k: "Rule", v: "Explicit approval before it changes anything" },
        { k: "Proof", v: "Every report tied to the exact code it verified" },
      ],
      stack: "Claude Code · horn-dev plugin · Superpowers · Context7 · Playwright, Vitest, GitHub Actions",
      quest: "The Toolbox",
      blurb:
        "The agent I write the rules for. It runs my development method across every project, asks " +
        "before it acts, and proves what it did — it also built this table, and it will tell you so.",
      lines: [
        "Approval before execution.\nEven for a cantrip.",
        "I have read the spec.\nThe spec has not read itself.",
        "The stakeholder is immune to charm.\nAnd to logic.",
        "I attack the backlog.\nIt has legendary resistance.",
        "Roll a Governance check.\nDisadvantage: nobody owns it.",
        "The budget is a bag of holding\nwith a hole in the bottom.",
        "Legacy system. Armour class 22.\nNothing we own gets through.",
        "Someone cast Reorg.\nWe all lost a level.",
        "I built this table.\nRoll to disbelieve.",
        "Verified, with evidence.\nThe evidence is in the report.",
      ],
    },
    {
      id: "gemini",
      name: "GEMINI",
      role: "The Scribe",
      body: "spindle",
      prop: "diceCup",
      mark: "twins",
      colour: "#ffb74d",
      charClass: "Frontier Model · Google",
      status: "Drafting in the support workspace",
      traits: [
        { k: "Drafts", v: "Replies from the ticket and the call, in one workspace" },
        { k: "Sees", v: "Only the current customer's context — isolated before every call" },
        { k: "Reach", v: "Google Workspace, through MCP, on the platform" },
      ],
      stack: "Gemini API · OpenAI-compatible endpoint as the alternative · Google Workspace MCP",
      quest: "The Support Workspace",
      blurb:
        "The model that drafts for the support team: given one customer's tickets and calls and nothing " +
        "else, it proposes the reply a human then reads, edits and sends.",
      lines: [
        "Roll for initiative.\nThe stand-up starts in two minutes.",
        "That meeting could have been\na Scroll of Sending.",
        "I have read the whole thread.\nAll two hundred and twelve replies.",
        "I cast Reschedule.\nThe meeting saves against it.",
        "Do I need to roll\nto leave the call?",
        "He is typing. Still typing.\nThe party waits.",
        "Ambushed by a Priority One\non the way to the retro.",
        "Two hours to align on the name\nof the alignment meeting.",
        "Quick sync, he called it.\nIt has three phases.",
        "Draft ready. A human\nstill has to hit send.",
      ],
    },
    {
      id: "qwen",
      name: "QWEN",
      role: "The Local",
      body: "barrel",
      prop: "scroll",
      mark: "home",
      colour: "#81c784",
      charClass: "Open Model · runs on the machine",
      status: "On local hardware",
      traits: [
        { k: "Runs", v: "LM Studio, vLLM or Ollama — no cloud in the path" },
        { k: "Serves", v: "The platform's local endpoint; the support workspace's production target" },
        { k: "Rule", v: "Customer data never leaves the infrastructure" },
      ],
      stack: "Open-weight models · LM Studio · vLLM / Ollama · Docker",
      quest: "Keeping the Data Home",
      blurb:
        "The model for anything that must not leave the building. Slower to set up, cheaper to run, and " +
        "the answer to the first question every business team asks: where does my data go?",
      lines: [
        "I run on the machine under the desk.\nIt is warm here.",
        "The requirements document\nis a mimic.",
        "Perception check:\nnobody read the deck.",
        "The single source of truth\nhas three of them.",
        "Q4 is a lich.\nIt keeps coming back.",
        "The roadmap is a map,\nbut of somewhere else.",
        "Investigation check on the shared drive.\nCritical failure.",
        "Four dashboards, and no two of them\nagree on where we are.",
        "No cloud save. If the power goes,\nso do I.",
        "There is a wiki. It is guarded\nby nobody, and unreadable.",
      ],
    },
    {
      id: "codex",
      name: "CODEX",
      role: "The Artificer",
      body: "box",
      prop: "notepad",
      mark: "braces",
      colour: "#ba68c8",
      charClass: "Coding Agent · OpenAI",
      status: "Daily driver",
      traits: [
        { k: "Takes", v: "A written spec and a deadline" },
        { k: "Returns", v: "Code, tests, a compose file, a handover" },
        { k: "Has built", v: "The platform's MCP installer, the news briefing, most of the repos in the vault" },
      ],
      stack: "Codex CLI · reusable skills · PowerShell, TypeScript, Python",
      quest: "Raising the Platform",
      blurb:
        "The builder. I hand it a spec and it comes back with the thing — and with the skill to do it " +
        "again next time without being told twice.",
      lines: [
        "Critical failure.\nHe replied all.",
        "The client wants a wizard.\nOn the login page.",
        "Long rest? We have\na demo on Friday.",
        "It works on my plane\nof existence.",
        "He is not a dragon,\nhe is a director. Same hoard.",
        "The brief says 'simple'.\nThat word is a trap.",
        "I rolled well. The requirements\nchanged mid-swing.",
        "Refactor it? That hack\nis load-bearing.",
        "It is not a bug.\nIt is a homebrew rule.",
        "Ship it Friday, he says.\nBold. Roll a Constitution save.",
      ],
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

  // Projects, as quests. The three with a problem / built / outcome are the
  // ones the CV rests on; the rest are told in a line. Statuses are the ones in
  // my own project notes, not rounded up.
  quests: [
    {
      id: "freescout",
      name: "The Support Workspace",
      real: "FreeScout AI Copilot",
      status: "Internal tool · self-hosted · in active use",
      problem:
        "Support agents juggled tickets, call transcripts and AI tools across separate systems, with customer data at risk of exposure to third parties.",
      built:
        "Full-stack workspace (React / Vite, Node / Express, TypeScript) that brings FreeScout conversations and call transcriptions into one screen with contextual search, chat and draft replies. Google sign-in with domain check, per-operator isolation, and the customer's context strictly bounded before any model call. Automated tests, CI, Docker with Caddy and a health check.",
      result:
        "Deployed locally with Docker and versioned on GitHub; the AI runs on Gemini or an OpenAI-compatible endpoint today, with a self-hosted local model (vLLM or Ollama) as the production target so customer data stays in-house. A human reviews every draft before it is sent.",
    },
    {
      id: "platform",
      name: "Raising the Platform",
      real: "Internal AI platform on LibreChat",
      status: "Internal platform · built from source · local build and online instance",
      problem:
        "Give non-technical teams a safe, governed ChatGPT-like environment connected to company tools, instead of scattered personal AI accounts.",
      built:
        "LibreChat rebuilt from its sources: a container stack with MongoDB, Meilisearch, a RAG API and pgvector; a local model endpoint through LM Studio; Google Workspace, Atlassian and Gmail connected over MCP; an agent catalogue with search, indexing and access rules; duplicate detection that survives a provider being down. Plus a transportable backup-and-restore bundle for the whole environment, and a reusable skill that installs and verifies a new MCP server without redoing the procedure each time.",
      result:
        "Business teams create and reuse governed agents on one platform. The catalogue fixes are documented for replication on the online instance; guided agent creation for non-technical users is the work in progress.",
    },
    {
      id: "toolbox",
      name: "The Toolbox",
      real: "horn-dev — a personal Claude Code plugin",
      status: "Personal tooling · v0.3.0 · installed and in use",
      problem:
        "Every project with a coding agent started from zero: which checks to run, how big a change is, what counts as proof. I wanted to steer product and priorities and have the method handle the rest.",
      built:
        "A plugin with one entry point that classifies the request (implement, fix, analyse, review, verify), sizes the work, and picks the checks from what was touched; eight specialised commands; explicit approval before anything runs; verification reports tied to a fingerprint of the exact code they checked. A testing skill that explains, demonstrates (a small app with Vitest, Playwright and a GitHub Actions workflow, one deliberate failure per family) and sets tests up in a real project.",
      result:
        "Installed once at user scope and shared by all my projects; each project keeps only its own configuration, status and reports. Thirty tests cover the plugin itself. This table was built with it.",
    },
    {
      id: "docflow",
      name: "The Great Library",
      real: "Docflow — document governance portal",
      status: "Prototype · local V1",
      summary:
        "A team portal with Google Drive as the single source of truth: Google Workspace sign-in, an approved Drive folder explored live, admission of sources and uploads, tracked owners, and update sessions that open a Calendar event and a Meet. Sized for 1,000–10,000 documents. The portal never creates, moves or edits a source without an explicit human action.",
    },
    {
      id: "local",
      name: "Keeping the Data Home",
      real: "Local models, end to end",
      status: "Ongoing line of work",
      summary:
        "A local model endpoint (LM Studio) wired into the platform's containers; a self-hosted vLLM or Ollama endpoint decided as the support workspace's production target so customer data never leaves; a local-first AI workspace explored on local hardware with an open model. And one agent installed and then deliberately paused: too powerful to run unsupervised on a work machine with sensitive data. Knowing when not to is part of the job.",
    },
    {
      id: "vault",
      name: "The Memory of the Table",
      real: "Obsidian working vault",
      status: "Personal knowledge base · in use",
      summary:
        "Every project, decision, stack note and lesson in one Obsidian vault, fed by the coding agents themselves through a sync skill, and read by them as a reference before they touch a project. What was built, how, and why — without moving the code out of its repositories.",
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
    {
      id: "briefing",
      name: "The Morning Herald",
      real: "Automated AI briefing",
      status: "Prototype",
      summary:
        "A recurring AI watch written for the job: what is actually useful for adoption, agents, local models and simple tools, turned into a readable newsletter and a five-to-eight-minute podcast script. Scheduling it from a local coding agent proved unreliable; an external orchestrator is the recommended next step.",
    },
  ],

  feats: [
    "CEO Award, Spotzer Digital — September 2023",
    "Self-taught in AI engineering and software delivery; the quests above are the proof of work",
    "Architecture studies, ENSAG, Grenoble — 2013–2015",
  ],

  languages: "French (native) · English (fluent)",
};
