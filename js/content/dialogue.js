// What Horn's assistant says in Horn.os. A tree of scripted answers: the visitor
// picks a question (or "types" it — every keystroke writes the scripted text),
// and each answer offers the next questions. There is no model behind it, so it
// can never say anything that is not written here.
//
// Rules for editing: the assistant talks about Horn in the third person; every
// claim traces to CV v2 or the vault, like js/content/profile.js; 1–4 `next`
// questions per node (2–4 at the start); never point `next` at "root" — the
// chat adds "Back to topics" itself. `node --test test/unit/dialogue.test.mjs`
// catches dead ends, unreachable nodes and unknown project ids.
//
// Blocks: { p } paragraph, { list } bullets, { project: id } a card that opens
// the Projects window, { open: windowId, label } a button that opens a window.
// Text supports **bold** and [label](href), not nested.

export const dialogue = {
  start: "root",
  nodes: {
    root: {
      answer: [
        { p: "Hi, I'm Horn's assistant. I can tell you about his work, his projects, or why he'd fit your team." },
        { p: "Pick a question below — or just start typing." },
      ],
      again: [{ p: "Sure. What would you like to know?" }],
      next: ["who", "built", "agents", "contact"],
    },

    who: {
      question: "Who is Horn?",
      answer: [
        {
          p: "**Horn Saerens** is an AI Solutions Consultant at Spotzer Digital in Amsterdam. He turns business problems into AI solutions that get deployed and actually used — from discovery and architecture to development, integration, deployment and training the people who use them.",
        },
        { p: "His profile is hybrid: he came up through the business, and he now owns the technical delivery end to end." },
      ],
      next: ["background", "roles", "where", "skills"],
    },

    background: {
      question: "What's his background?",
      answer: [
        { p: "He was promoted **four times in four years** at Spotzer Digital, each time by building what the business needed next:" },
        {
          list: [
            "**Sales Market Leader**, French market — from 2022",
            "**Team Leader Sales** — from 2023, with a CEO Award that September",
            "**Sales Operations Manager** — from 2024, where he brought the first AI-assisted processes into sales operations",
            "**AI Solutions Consultant** — since August 2025",
          ],
        },
        { p: "He is self-taught in AI engineering and software delivery. Before that, he studied architecture at ENSAG in Grenoble." },
        { open: "resume", label: "Open the résumé" },
      ],
      next: ["roles", "built"],
    },

    roles: {
      question: "What roles is he looking for?",
      answer: [
        { p: "Roles where AI has to work in a real business, not just in a demo:" },
        { list: ["**AI Solutions Consultant / Engineer**", "**Forward Deployed Engineer**", "**Applied AI Engineer**"] },
        {
          p: "In practice: sitting with a team, understanding the process, building the agent or the integration, deploying it, and making sure people actually adopt it.",
        },
      ],
      next: ["fit", "where"],
    },

    fit: {
      question: "Why would he fit an AI Solutions or FDE role?",
      answer: [
        { p: "Because it's the job he already does:" },
        {
          list: [
            "**He speaks both languages.** Years in sales and sales operations mean he starts from the business problem, not from the model.",
            "**He ships end to end.** Architecture, code, Docker deployment, CI and tests — the support copilot alone carries 268 unit and integration tests and 26 end-to-end tests.",
            "**He picks the right model.** Frontier APIs where capability matters, self-hosted models where customer data must stay in-house — benchmarked on real samples.",
            "**He drives adoption.** He runs company-wide AI training and designs every flow with a human validating the output.",
          ],
        },
      ],
      next: ["built", "agents", "contact"],
    },

    where: {
      question: "Where is he based?",
      answer: [
        { p: "In **Amsterdam**. He's an EU citizen, so no visa is needed, and his notice period is **one month**." },
        { p: "He works in **French** (native) and **English** (fluent)." },
      ],
      next: ["contact", "roles"],
    },

    built: {
      question: "What has he built?",
      answer: [
        { p: "Here are the main ones. Pick a question to go deeper, or open a card for the details." },
        { project: "freescout" },
        { project: "platform" },
        { project: "local" },
      ],
      next: ["freescout", "platform", "local", "more"],
    },

    freescout: {
      question: "Tell me about the FreeScout AI Copilot.",
      answer: [
        {
          p: "The support team was juggling tickets, call transcripts and AI tools across separate systems, and customer data risked ending up with third parties.",
        },
        {
          p: "Horn built a **single support workspace**: FreeScout tickets and call transcripts side by side, with contextual AI search, draft replies, per-mailbox templates and scheduled sends. A human reviews every draft before it goes out.",
        },
        { project: "freescout" },
      ],
      next: ["freescout-how", "freescout-stack"],
    },

    "freescout-how": {
      question: "How does it keep customer data safe?",
      answer: [
        { p: "Three rules shape it:" },
        {
          list: [
            "**Isolation first.** Before any model call, the context is strictly limited to the current customer — nothing else is sent.",
            "**Identity everywhere.** Google sign-in, per-operator identity, timeouts and rate limits on every outbound call.",
            "**Provider-agnostic.** It talks to OpenAI-compatible endpoints, so a self-hosted local model can replace a cloud API without a rewrite.",
          ],
        },
        { p: "The prompts were benchmarked on 30 real customer e-mails before the team relied on them." },
      ],
      next: ["freescout-stack", "local"],
    },

    "freescout-stack": {
      question: "What's the copilot's stack?",
      answer: [
        {
          list: [
            "**Front end:** React and TypeScript",
            "**Back end:** Node and Express",
            "**Deployment:** Docker and Caddy, with a Render blueprint",
            "**Quality:** 268 unit and integration tests, 26 Playwright end-to-end tests, CI on every change",
          ],
        },
      ],
      next: ["freescout-how", "platform"],
    },

    platform: {
      question: "What's the LibreChat platform?",
      answer: [
        {
          p: "Non-technical teams needed a safe, governed ChatGPT-like environment connected to company tools — instead of everyone using their own personal AI accounts.",
        },
        {
          p: "Horn **rebuilt LibreChat from source** into an internal platform: a full container stack with RAG, a local model endpoint, Google Workspace, Atlassian and Gmail connected over MCP, and an agent catalogue with search and access rules. Business teams create and reuse governed agents in one place.",
        },
        { project: "platform" },
      ],
      next: ["platform-docker", "platform-mcp"],
    },

    "platform-docker": {
      question: "What was the Docker migration?",
      answer: [
        {
          p: "The whole environment runs as containers: LibreChat, MongoDB, Meilisearch, a RAG API with pgvector, and a local model endpoint through LM Studio.",
        },
        { p: "He also packaged a **transportable backup-and-restore bundle**, so the entire environment can be moved to another machine and brought back up." },
      ],
      next: ["platform-mcp", "local"],
    },

    "platform-mcp": {
      question: "What's the MCP installer?",
      answer: [
        { p: "Connecting a new tool to the platform over **MCP** used to mean redoing the same procedure by hand every time." },
        {
          p: "Horn turned it into a **reusable skill**: it installs a new MCP server and verifies that it works, so adding a connector is a repeatable step, not a one-off procedure.",
        },
      ],
      next: ["platform-docker", "agents"],
    },

    local: {
      question: "What about local models?",
      answer: [
        {
          p: "For anything that must not leave the building, Horn runs **open models on local hardware**: an LM Studio endpoint wired into the platform, and a self-hosted vLLM or Ollama endpoint chosen as the support copilot's production target.",
        },
        {
          p: "He also knows when not to: one agent was installed and then **deliberately paused** — too powerful to run unsupervised on a work machine with sensitive data.",
        },
        { project: "local" },
      ],
      next: ["local-why", "agents-models"],
    },

    "local-why": {
      question: "Why keep the data home?",
      answer: [
        { p: "Because it's the first question every business team asks: **where does my data go?**" },
        {
          p: "Local models answer it cleanly — customer data never leaves the company's infrastructure. They take more effort to set up and are smaller than frontier models, so Horn writes prompts for them specifically and benchmarks them on real samples before trusting them.",
        },
      ],
      next: ["agents-models", "freescout"],
    },

    more: {
      question: "What else has he built?",
      answer: [
        { p: "Quite a lot. A few more:" },
        { project: "docflow" },
        { project: "crm" },
        { project: "cortex" },
        { project: "callcoach" },
        { open: "projects", label: "Open all projects" },
      ],
      next: ["toolbox", "enablement", "contact"],
    },

    enablement: {
      question: "Does he train people too?",
      answer: [
        {
          p: "Yes — adoption is half the job. He designed and ran a company-wide **AI Day** workshop: prompting, data security, hallucinations, RAG, MCP and hands-on agent creation.",
        },
        {
          p: "It grew into **AI Explorer**, a self-serve training site with foundations, a prompting lab and a five-step agent-architect builder: purpose, knowledge, boundaries, persona, review.",
        },
        { project: "enablement" },
      ],
      next: ["agents", "fit"],
    },

    toolbox: {
      question: "What is horn-dev?",
      answer: [
        { p: "**horn-dev** is his personal Claude Code plugin — the method he makes every coding agent follow:" },
        {
          list: [
            "One entry point that classifies the request and sizes the work",
            "Checks picked from what the change touched",
            "Explicit approval before anything runs",
            "Verification reports tied to the exact code they checked",
          ],
        },
        { p: "It's installed once and shared by all his projects, with thirty tests covering the plugin itself." },
        { project: "toolbox" },
      ],
      next: ["agents-reliable", "more"],
    },

    agents: {
      question: "How does he work with AI agents?",
      answer: [
        { p: "Like a lead with a team: he sets the scope, writes the rules, hands each agent its tools, and checks what comes back." },
        {
          p: "He builds agents that connect to business tools and data — CRM, Google Workspace, support systems — with **grounded outputs** and a **human validating** every flow that matters.",
        },
      ],
      next: ["agents-models", "agents-reliable", "toolbox"],
    },

    "agents-models": {
      question: "Which models does he use?",
      answer: [
        {
          list: [
            "**Frontier models** — Claude, GPT and Gemini, where capability drives the value",
            "**Local models** — through LM Studio, vLLM and Ollama, where data has to stay in-house",
            "**Coding agents** — Claude Code and Codex, every day",
          ],
        },
        { p: "The choice is made per use case and benchmarked on real samples, not decided once for everything." },
      ],
      next: ["local", "agents-reliable"],
    },

    "agents-reliable": {
      question: "How does he keep them reliable?",
      answer: [
        {
          list: [
            "**Grounding:** answers come from the customer's or the company's own data, with the context bounded before every call",
            "**Humans in the loop:** a person validates the output wherever it reaches a customer",
            "**Evaluation:** prompts are compared on real samples before they ship",
            "**Method:** his coding agents follow horn-dev — approval before action, proof after",
          ],
        },
      ],
      next: ["toolbox", "fit"],
    },

    skills: {
      question: "What are his skills?",
      answer: [
        {
          list: [
            "**AI agents & integrations:** agent design, MCP servers, REST APIs, n8n, LibreChat, Claude Code, Codex",
            "**LLMs & model strategy:** frontier and local models, benchmarking, RAG, guardrails and hallucination control",
            "**Deployment:** Docker & Compose, GitHub Actions, Caddy, Render, WSL2",
            "**Engineering:** TypeScript, React, Node / Express, Python, SQLite, Supabase, MongoDB, Vitest, Playwright, Electron",
            "**Business tools:** Salesforce, Twenty CRM, Google Workspace APIs, Power BI, Tableau",
          ],
        },
        { open: "skills", label: "Open Skills" },
      ],
      next: ["built", "agents", "contact"],
    },

    contact: {
      question: "How can I contact him?",
      answer: [
        { p: "The best way is e-mail: [saerenshorn@gmail.com](mailto:saerenshorn@gmail.com)" },
        {
          list: [
            "LinkedIn: [horn-saerens](https://www.linkedin.com/in/horn-saerens-7426b022b)",
            "GitHub: [hsaerens-lgtm](https://github.com/hsaerens-lgtm)",
          ],
        },
        { open: "resume", label: "Open the résumé" },
      ],
      next: ["roles", "built"],
    },
  },
};
