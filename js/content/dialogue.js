// What Horn's assistant says in Horn.os. A tree of scripted answers: the visitor
// picks a question (or "types" it — every keystroke writes the scripted text),
// and each answer offers the next questions. There is no model behind it, so it
// can never say anything that is not written here.
//
// Rules for editing: the assistant talks about Horn in the third person; every
// claim traces to CV v3, to Horn's own confirmations, or to the vault, like
// js/content/profile.js; 1–4 `next` questions per node (2–4 at the start); never
// point `next` at "root" — the chat adds "Back to topics" itself.
// `node --test test/unit/dialogue.test.mjs` catches dead ends, unreachable nodes
// and unknown project ids.
//
// Blocks: { p } paragraph, { list } bullets, { project: id } a card that opens
// the Projects window, { open: windowId, label } a button that opens a window.
// Text supports **bold** and [label](href), not nested.

export const dialogue = {
  start: "root",
  nodes: {
    root: {
      answer: [
        { p: "Hi, I'm Horn's assistant. I can tell you about his work, how he takes an AI idea all the way to a tool people use every day, and why he'd fit your team." },
        { p: "Pick a question below — or just start typing." },
      ],
      again: [{ p: "Sure. What would you like to know?" }],
      next: ["who", "method", "built", "contact"],
    },

    // ── Who he is ────────────────────────────────────────────────────────────

    who: {
      question: "Who is Horn?",
      answer: [
        {
          p: "**Horn Saerens** is an AI Solutions Consultant at Spotzer Digital in Amsterdam. He owns AI initiatives end to end: he finds where the business loses time or control, decides what is worth building, prototypes it, builds and deploys it, trains the teams, then keeps improving it.",
        },
        {
          p: "He came up through sales and operations, so he starts from the business problem, not from the model. His AI support workspace is used by **100+ people**, and his AI training has reached **150+ participants**.",
        },
      ],
      next: ["impact", "background", "roles", "where"],
    },

    impact: {
      question: "What impact has his work had?",
      answer: [
        { p: "Measured where it counts — in the teams' daily work:" },
        {
          list: [
            "**Support:** the AI support workspace is in production for **100+ users** and saves each of them **30 minutes to 2 hours a day**, with a clearer view and tighter control of customer data.",
            "**Adoption:** **150+ people** took part in his AI training, and the teams have built **30+ agents** of their own on the private AI platform he set up.",
            "**Knowledge:** Docflow is used by **all team leaders and the executive team** — 30 people — with one owner controlling which documents are current and approved.",
          ],
        },
      ],
      next: ["freescout", "enablement", "docflow"],
    },

    background: {
      question: "What's his background?",
      answer: [
        { p: "**Four roles in four years** at Spotzer Digital, each one built on what the business needed next:" },
        {
          list: [
            "**Sales Market Leader**, French market — from 2022",
            "**Team Leader Sales** — from 2023. He took over the team and brought it to target quickly, which earned him a **CEO Award**.",
            "**Sales Operations Manager** — from 2024, where he brought the first AI-assisted processes into sales operations",
            "**AI Solutions Consultant** — since August 2025",
          ],
        },
        { p: "He is self-taught in AI solution design. He is not a traditional developer: he designs the solution and builds it with AI coding agents (Claude Code, Codex), with a method of his own that makes them prove their work. Before that, he studied architecture at ENSAG in Grenoble." },
        { open: "resume", label: "Open the résumé" },
      ],
      next: ["roles", "method"],
    },

    roles: {
      question: "What roles is he looking for?",
      answer: [
        { p: "Roles where AI has to work in a real business, not just in a demo:" },
        { list: ["**AI Solutions Consultant**", "**AI Deployment or AI Adoption Lead**", "**AI transformation roles**"] },
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
            "**He ships to production.** He designs the architecture, writes the specs and test strategy, and builds with AI coding agents — deployment, CI and tests included. The support copilot is used daily by 100+ people.",
            "**He picks the right model.** Frontier APIs where capability matters, self-hosted models where customer data must stay in-house — benchmarked on real samples.",
            "**He drives adoption.** 150+ people trained, 30+ agents built by the teams themselves, and a human validating every output that reaches a customer.",
          ],
        },
      ],
      next: ["method", "built", "skills"],
    },

    where: {
      question: "Where is he based?",
      answer: [
        { p: "In **Amsterdam**. He's an EU citizen, so no visa is needed, and his notice period is **one month**." },
        { p: "He works in **French** (native) and **English** (fluent)." },
      ],
      next: ["contact", "roles"],
    },

    // ── How he works ─────────────────────────────────────────────────────────

    method: {
      question: "How does he work?",
      answer: [
        { p: "The same cycle on every project, from the first conversation to the tool people rely on:" },
        {
          list: [
            "**Identify** — see where a team loses time or control over its data",
            "**Decide** — weigh time saved, risk and data sensitivity, and make a clear build / no-build call",
            "**Prototype** — a quick POC, validated with the people who will use it",
            "**Build** — architecture, specs and tests, with AI coding agents writing the code",
            "**Deploy & gather feedback** — ship it, then listen to the users",
            "**Train & drive adoption** — training, guardrails and a human in the loop",
            "**Monitor & improve** — feedback becomes the next batch of work",
          ],
        },
      ],
      next: ["method-decide", "method-adopt", "method-improve", "agents"],
    },

    "method-decide": {
      question: "How does he decide what to build?",
      answer: [
        {
          p: "He starts with how the teams really work, not with a tool. Where do people copy the same data between systems? Where does customer data leave the company's control? Where does a task eat hours every week?",
        },
        {
          p: "Each answer becomes a use case, weighed on **time saved, risk and data sensitivity**. The promising ones get a quick POC, tested with real users before anything is built for production. The support copilot started exactly like that: agents juggling tickets, calls and AI tools in separate windows.",
        },
      ],
      next: ["method-adopt", "freescout"],
    },

    "method-adopt": {
      question: "How does he get teams to adopt it?",
      answer: [
        { p: "Adoption is half the job, so he plans it from the start:" },
        {
          list: [
            "**Training:** a company-wide AI Day — 150+ participants in total — on prompting, data security, hallucinations and building agents",
            "**A safe place to practise:** a private ChatGPT-style platform where the teams have built 30+ agents themselves",
            "**Trust:** grounded answers and a human validating every output that reaches a customer",
            "**Listening:** user feedback shapes what gets built next",
          ],
        },
      ],
      next: ["enablement", "platform"],
    },

    "method-improve": {
      question: "What happens after launch?",
      answer: [
        {
          p: "The tool keeps moving. On the support copilot, user feedback turned into delivery batches: **e-mail translation, internal notes, shareable ticket links, assignee and waiting-time columns, attachments**.",
        },
        {
          p: "He also runs a recurring **AI watch** on new tools, models and repositories, so the choices behind each tool stay current and are tested before anyone relies on them.",
        },
      ],
      next: ["watch", "freescout"],
    },

    watch: {
      question: "How does he keep up with AI?",
      answer: [
        {
          p: "Through a recurring **AI watch**, shared with the teams as a newsletter: new tools, models and repositories worth trying, tested before they are recommended.",
        },
        { p: "It keeps the teams up to date, feeds new experiments, and keeps his own judgement on which tool to use grounded in tests rather than hype." },
        { project: "briefing" },
      ],
      next: ["agents-models", "method"],
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
            "**Coding agents** — Claude Code and Codex, every day: they write the code, he sets the specs and checks the result",
          ],
        },
        { p: "The choice is made per use case and benchmarked on real samples, not decided once for everything — the same work he does across the company's Athena AI ecosystem." },
      ],
      next: ["athena", "local", "agents-reliable"],
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

    // ── What he built ────────────────────────────────────────────────────────

    built: {
      question: "What has he built?",
      answer: [
        { p: "Here are the main ones — all in use at Spotzer Digital. Pick a question to go deeper, or open a card for the details." },
        { project: "freescout" },
        { project: "platform" },
        { project: "docflow" },
      ],
      next: ["freescout", "platform", "docflow", "more"],
    },

    freescout: {
      question: "Tell me about the FreeScout AI Copilot.",
      answer: [
        {
          p: "The support team was juggling tickets, call transcripts and AI tools across separate systems, with no single view of the customer and customer data at risk of ending up with third parties.",
        },
        {
          p: "Horn designed a **single support workspace** and built it with AI coding agents: tickets and call transcripts side by side, with contextual AI search, draft replies, templates, scheduled sends and customer briefs. A human reviews every draft before it goes out.",
        },
        { p: "It is **in production for 100+ users** and saves each of them **30 minutes to 2 hours a day**." },
        { project: "freescout" },
      ],
      next: ["freescout-how", "freescout-stack", "method-improve"],
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
            "**Deployment:** Docker and Caddy",
            "**Quality:** 268 unit and integration tests, 26 Playwright end-to-end tests, CI on every change",
            "**Built with:** Claude Code and Codex, following his horn-dev method",
          ],
        },
      ],
      next: ["freescout-how", "platform"],
    },

    platform: {
      question: "What's his private AI platform?",
      answer: [
        {
          p: "Teams were using AI through personal accounts, with no shared practice and no control over company data. They needed a safe, private, ChatGPT-style place connected to the company's tools.",
        },
        {
          p: "Horn **rebuilt LibreChat from source** into that platform, working with AI coding agents: a full container stack with RAG, a local model endpoint, Google Workspace, Atlassian and Gmail connected over MCP, and an agent catalogue with search and access rules.",
        },
        { p: "The teams have built **30+ agents** on it themselves — the hands-on follow-up to his AI training." },
        { project: "platform" },
      ],
      next: ["platform-docker", "platform-mcp", "enablement"],
    },

    "platform-docker": {
      question: "How is the platform run?",
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

    enablement: {
      question: "Does he train people too?",
      answer: [
        {
          p: "Yes. He designed and ran the company-wide **AI Day** — **150+ participants** in total — on prompting, data security, hallucinations, RAG, MCP and hands-on agent creation, with one aim: using AI ethically and consciously in real work.",
        },
        {
          p: "It grew into **AI Explorer**, a self-serve training site with a prompting lab and a five-step agent-architect builder, and into the private AI platform where the teams now build their own agents. The result: faster adoption of new tools and simpler collaboration between teams.",
        },
        { project: "enablement" },
      ],
      next: ["platform", "method-adopt"],
    },

    docflow: {
      question: "What is Docflow?",
      answer: [
        {
          p: "Across thousands of Drive files, nobody knew which document was current, who owned it or whether it was approved — and AI tools had no governed corpus to read from.",
        },
        {
          p: "Horn designed **Docflow** and built it with AI coding agents, with Google Drive as the single source of truth: documents are admitted, versioned and owned, every change is logged, and search answers with cited passages.",
        },
        { p: "It is used by **all team leaders and the executive team** — 30 people — with a dedicated owner controlling what is current and approved." },
        { project: "docflow" },
      ],
      next: ["docflow-how", "more"],
    },

    "docflow-how": {
      question: "How does Docflow keep documents trustworthy?",
      answer: [
        {
          list: [
            "**One source of truth:** Google Drive holds the files; Docflow holds who owns them, which version is current and who approved it",
            "**Traceability:** a registry with an audit log of every change",
            "**Cited answers:** search returns the passages themselves; an optional model-written answer never alters them",
            "**Text first:** native extraction from PDFs and Office files, with OCR only when a scan needs it",
          ],
        },
      ],
      next: ["athena", "more"],
    },

    athena: {
      question: "What's Athena?",
      answer: [
        {
          p: "**Athena** is the company's AI ecosystem — Cortex for conversation intelligence, AI Coach, Recall and more.",
        },
        {
          p: "Horn is an active contributor to its structure, its prompting and its model choices, and to putting those models in place. For example, he unified the prompts of the Cortex pipeline for a small self-hosted model, with a benchmark harness comparing prompt versions on real samples, and connected Cortex customer briefs to the support copilot.",
        },
        { project: "athena" },
      ],
      next: ["agents-models", "local"],
    },

    local: {
      question: "What about local models?",
      answer: [
        {
          p: "For anything that must not leave the building, Horn runs **open models on local hardware**: an LM Studio endpoint wired into the platform, and a self-hosted vLLM or Ollama endpoint chosen for the support copilot.",
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
      next: ["athena", "freescout"],
    },

    more: {
      question: "What else has he built?",
      answer: [
        { p: "A few more:" },
        { project: "athena" },
        { project: "crm" },
        { project: "toolbox" },
        { project: "salesops" },
        { open: "projects", label: "Open all projects" },
      ],
      next: ["athena", "toolbox", "contact"],
    },

    toolbox: {
      question: "What is horn-dev?",
      answer: [
        { p: "**horn-dev** is his Claude Code plugin — the method he makes every coding agent follow:" },
        {
          list: [
            "One entry point that classifies the request and sizes the work",
            "Checks picked from what the change touched",
            "Explicit approval before anything runs",
            "Verification reports tied to the exact code they checked",
          ],
        },
        { p: "It's installed once and shared by all his projects, and it's public on GitHub with its own tests and CI." },
        { project: "toolbox" },
      ],
      next: ["agents-reliable", "more"],
    },

    skills: {
      question: "What are his skills?",
      answer: [
        {
          list: [
            "**AI & agents:** agent design, MCP servers, RAG, prompt engineering and evaluation, guardrails, n8n, LibreChat",
            "**Models:** Claude, GPT, Gemini; LM Studio, vLLM, Ollama; benchmarking and selection per use case",
            "**AI-assisted delivery:** specs, architecture and test strategy for coding agents (Claude Code, Codex); solutions shipped on TypeScript, React, Node, Python, SQLite, Docker, GitHub Actions, Playwright",
            "**Business:** Salesforce, Google Workspace APIs, Power BI, Tableau, discovery workshops, training and change management",
          ],
        },
        { open: "skills", label: "Open Skills" },
      ],
      next: ["built", "method", "contact"],
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
