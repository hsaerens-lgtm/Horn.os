// Retro desktop: boot screen, icons, window manager, taskbar, start menu.

const G = {
  notepad: `<svg viewBox="0 0 32 32" class="glyph"><path d="M7 3h13l6 6v20H7z" fill="#fff" stroke="#000"/><path d="M20 3v6h6" fill="#c0c0c0" stroke="#000"/><path d="M10 13h12M10 17h12M10 21h12M10 25h8" stroke="#000080" stroke-width="1.5"/></svg>`,
  folder: `<svg viewBox="0 0 32 32" class="glyph"><path d="M3 8h9l3 3h14v15H3z" fill="#e8c34a" stroke="#000"/><path d="M3 13h26v13H3z" fill="#ffe680" stroke="#000"/></svg>`,
  briefcase: `<svg viewBox="0 0 32 32" class="glyph"><path d="M12 6h8v4h-8z" fill="#8b5a2b" stroke="#000"/><rect x="3" y="10" width="26" height="17" fill="#a0522d" stroke="#000"/><path d="M3 17h26" stroke="#000"/><rect x="14" y="15" width="4" height="4" fill="#ffd700" stroke="#000"/></svg>`,
  gear: `<svg viewBox="0 0 32 32" class="glyph"><path d="M16 3l3 3 4-1 1 4 4 2-2 4 2 4-4 2-1 4-4-1-3 3-3-3-4 1-1-4-4-2 2-4-2-4 4-2 1-4 4 1z" fill="#b0b0b0" stroke="#000"/><circle cx="16" cy="16" r="5" fill="#000080" stroke="#000"/></svg>`,
  card: `<svg viewBox="0 0 32 32" class="glyph"><rect x="2" y="7" width="28" height="18" fill="#fff" stroke="#000"/><circle cx="10" cy="15" r="3.5" fill="#ffcc99" stroke="#000"/><path d="M5 22c1-3 3-4 5-4s4 1 5 4" fill="#000080"/><path d="M17 13h9M17 17h9M17 21h6" stroke="#000" stroke-width="1.5"/></svg>`,
  pdf: `<svg viewBox="0 0 32 32" class="glyph"><path d="M7 3h13l6 6v20H7z" fill="#fff" stroke="#000"/><path d="M20 3v6h6" fill="#c0c0c0" stroke="#000"/><rect x="5" y="15" width="22" height="9" fill="#c00" /><text x="16" y="22" font-size="7" font-weight="bold" fill="#fff" text-anchor="middle" font-family="Arial">PDF</text></svg>`,
  exe: `<svg viewBox="0 0 32 32" class="glyph"><rect x="3" y="5" width="26" height="20" fill="#c0c0c0" stroke="#000"/><rect x="5" y="7" width="22" height="14" fill="#000080"/><path d="M8 11h10M8 14h14M8 17h6" stroke="#b8ffb8" stroke-width="1.5"/><rect x="11" y="25" width="10" height="3" fill="#808080" stroke="#000"/></svg>`,
  ppt: `<svg viewBox="0 0 32 32" class="glyph"><rect x="3" y="6" width="26" height="18" fill="#fff" stroke="#000"/><rect x="6" y="9" width="20" height="4" fill="#d2691e"/><path d="M7 16h12M7 19h16" stroke="#000" stroke-width="1.5"/><path d="M16 24v4M10 28h12" stroke="#000"/></svg>`,
  bat: `<svg viewBox="0 0 32 32" class="glyph"><rect x="3" y="5" width="26" height="22" fill="#000" stroke="#808080"/><path d="M6 10h4l3 3-3 3H6" fill="none" stroke="#b8ffb8" stroke-width="1.5"/><path d="M14 16h10" stroke="#b8ffb8" stroke-width="1.5"/></svg>`,
  computer: `<svg viewBox="0 0 32 32" class="glyph"><rect x="4" y="4" width="24" height="18" fill="#c0c0c0" stroke="#000"/><rect x="7" y="7" width="18" height="12" fill="#008080"/><rect x="10" y="24" width="12" height="4" fill="#c0c0c0" stroke="#000"/></svg>`,
  link: `<svg viewBox="0 0 32 32" class="glyph"><circle cx="16" cy="16" r="12" fill="#3a7bd5" stroke="#000"/><path d="M4 16h24M16 4c-5 6-5 18 0 24M16 4c5 6 5 18 0 24" stroke="#fff" fill="none" stroke-width="1.5"/></svg>`,
  mail: `<svg viewBox="0 0 32 32" class="glyph"><rect x="3" y="8" width="26" height="17" fill="#fff" stroke="#000"/><path d="M3 8l13 10 13-10" fill="none" stroke="#000"/></svg>`,
  logo: `<svg viewBox="0 0 32 32" class="glyph"><rect x="3" y="3" width="12" height="12" fill="#f25022"/><rect x="17" y="3" width="12" height="12" fill="#7fba00"/><rect x="3" y="17" width="12" height="12" fill="#00a4ef"/><rect x="17" y="17" width="12" height="12" fill="#ffb900"/></svg>`,
  door: `<svg viewBox="0 0 32 32" class="glyph"><rect x="6" y="3" width="16" height="26" fill="#8b5a2b" stroke="#000"/><circle cx="18" cy="17" r="1.5" fill="#ffd700"/><path d="M24 16h6M27 13l3 3-3 3" stroke="#000" fill="none" stroke-width="1.5"/></svg>`,
};

const fileGlyph = (name) => {
  if (name.endsWith(".ppt")) return G.ppt;
  if (name.endsWith(".bat")) return G.bat;
  return G.exe;
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const BOOT_LINES = [
  "HORN OS BIOS  v2026.09  (c) Saerens Systems",
  "",
  "Detecting hardware ...",
  "  CPU  : Business Understanding ........ OK",
  "  GPU  : Technical Ownership ........... OK",
  "  RAM  : 6 AI projects loaded .......... OK",
  "  NET  : MCP / API connectors .......... OK",
  "",
  "Mounting /skills ....................... OK",
  "Mounting /experience (4 roles, 4 yrs) .. OK",
  "Loading agents ......................... OK",
  "",
  "Starting HORN OS ...",
];

export function createOS(root, content, { onBack = null } = {}) {
  root.classList.add("os");
  root.innerHTML = `
    <div class="boot"></div>
    <div class="desktop">
      <div class="icons"></div>
      <div class="windows"></div>
    </div>
    <div class="start-menu">
      <div class="sm-band">HORN OS</div>
    </div>
    <div class="taskbar">
      <button class="start" type="button">${G.logo}<span>Start</span></button>
      <div class="divider"></div>
      <div class="tasks"></div>
      <div class="tray"><span class="clock">--:--</span></div>
    </div>`;

  const els = {
    boot: root.querySelector(".boot"),
    desktop: root.querySelector(".desktop"),
    icons: root.querySelector(".icons"),
    windows: root.querySelector(".windows"),
    tasks: root.querySelector(".tasks"),
    clock: root.querySelector(".clock"),
    start: root.querySelector(".start"),
    startMenu: root.querySelector(".start-menu"),
  };

  const windows = new Map();
  let zTop = 10;
  let cascade = 0;
  let booted = false;

  // ---------- Window content ----------
  const specs = {
    about: () => ({
      title: "About.txt - Notepad",
      glyph: G.notepad,
      width: 560,
      height: 420,
      menu: ["File", "Edit", "Search", "Help"],
      html: `
        <h1>${esc(content.name)}</h1>
        <div class="subtitle">${esc(content.title)} · ${esc(content.tagline)} · ${esc(content.location)}</div>
        <p>${esc(content.profile)}</p>
        <h2>Education</h2>
        <ul>${content.education.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
        <h2>Languages</h2>
        <p>${esc(content.languages)}</p>`,
    }),

    experience: () => ({
      title: "Experience",
      glyph: G.briefcase,
      width: 600,
      height: 460,
      html: `
        <div class="company"><b>${esc(content.company.name)}</b>${esc(content.company.note)}</div>
        ${content.experience
          .map(
            (r) => `
          <div class="role"><span>${esc(r.role)}</span><span class="dates">${esc(r.dates)}</span></div>
          <ul>${r.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
          )
          .join("")}`,
    }),

    projects: () => ({
      title: "Projects",
      glyph: G.folder,
      width: 620,
      height: 340,
      grey: false,
      menu: ["File", "Edit", "View", "Help"],
      html: `
        <div class="files">
          ${content.projects
            .map(
              (p) => `
            <div class="file" data-open="project:${p.id}">
              ${fileGlyph(p.file)}
              <span class="fname">${esc(p.file)}</span>
              <span class="fdesc">${esc(p.name)} — ${esc(p.status)}</span>
            </div>`
            )
            .join("")}
        </div>`,
    }),

    skills: () => ({
      title: "Skills.sys - System Properties",
      glyph: G.gear,
      width: 620,
      height: 380,
      html: content.skills
        .map((s) => `<div class="skill-row"><b>${esc(s.label)}</b><span>${esc(s.items)}</span></div>`)
        .join(""),
    }),

    contact: () => ({
      title: "Contact",
      glyph: G.card,
      width: 460,
      height: 300,
      html: `
        <h1>${esc(content.name)}</h1>
        <ul class="contact-list">
          <li><b>Email</b><a href="mailto:${esc(content.contact.email)}">${esc(content.contact.email)}</a></li>
          <li><b>Phone</b><span>${esc(content.contact.phone)}</span></li>
          <li><b>LinkedIn</b><a href="${esc(content.contact.linkedin)}" target="_blank" rel="noopener">${esc(content.contact.linkedin.replace("https://www.", ""))}</a></li>
          <li><b>GitHub</b><a href="${esc(content.contact.github)}" target="_blank" rel="noopener">${esc(content.contact.github.replace("https://", ""))}</a></li>
          <li><b>Location</b><span>${esc(content.location)}</span></li>
        </ul>
        <a class="btn" href="${esc(content.resumePdf)}" target="_blank" rel="noopener">Open Resume.pdf</a>`,
    }),
  };

  const projectSpec = (id) => {
    const p = content.projects.find((x) => x.id === id);
    if (!p) return null;
    const body = p.problem
      ? `<dl class="pbr">
           <dt>Problem</dt><dd>${esc(p.problem)}</dd>
           <dt>Built</dt><dd>${esc(p.built)}</dd>
           <dt>Result</dt><dd>${esc(p.result)}</dd>
         </dl>`
      : `<p>${esc(p.summary)}</p>`;
    return {
      title: p.file,
      glyph: fileGlyph(p.file),
      width: 560,
      height: 380,
      html: `<h1>${esc(p.name)}</h1><span class="badge">${esc(p.status)}</span>${body}`,
    };
  };

  const getSpec = (id) => (id.startsWith("project:") ? projectSpec(id.slice(8)) : specs[id]?.());

  // ---------- Window manager ----------
  function focusWindow(id) {
    for (const [wid, w] of windows) {
      const active = wid === id;
      w.el.classList.toggle("inactive", !active);
      w.task.classList.toggle("active", active && !w.el.classList.contains("minimized"));
    }
    const w = windows.get(id);
    if (w) w.el.style.zIndex = String(++zTop);
  }

  function closeWindow(id) {
    const w = windows.get(id);
    if (!w) return;
    w.el.remove();
    w.task.remove();
    windows.delete(id);
    const last = [...windows.keys()].pop();
    if (last) focusWindow(last);
  }

  function toggleMinimize(id) {
    const w = windows.get(id);
    if (!w) return;
    const min = w.el.classList.toggle("minimized");
    if (min) {
      w.task.classList.remove("active");
      const next = [...windows.keys()].reverse().find((k) => !windows.get(k).el.classList.contains("minimized"));
      if (next) focusWindow(next);
    } else focusWindow(id);
  }

  function makeDraggable(win, bar) {
    let start = null;
    bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".tb-btn")) return;
      start = { x: e.clientX, y: e.clientY, left: win.offsetLeft, top: win.offsetTop };
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", (e) => {
      if (!start) return;
      const scale = root.getBoundingClientRect().width / root.offsetWidth || 1;
      const dx = (e.clientX - start.x) / scale;
      const dy = (e.clientY - start.y) / scale;
      const maxX = root.offsetWidth - 60;
      const maxY = root.offsetHeight - 60;
      win.style.left = `${Math.min(maxX, Math.max(-win.offsetWidth + 80, start.left + dx))}px`;
      win.style.top = `${Math.min(maxY, Math.max(0, start.top + dy))}px`;
    });
    const end = () => (start = null);
    bar.addEventListener("pointerup", end);
    bar.addEventListener("pointercancel", end);
  }

  function openWindow(id) {
    if (windows.has(id)) {
      const w = windows.get(id);
      w.el.classList.remove("minimized");
      focusWindow(id);
      return;
    }
    const spec = getSpec(id);
    if (!spec) return;

    const el = document.createElement("div");
    el.className = "window";
    const maxW = root.offsetWidth - 40;
    const maxH = root.offsetHeight - 70;
    const w = Math.min(spec.width, maxW);
    const h = Math.min(spec.height, maxH);
    const left = Math.min(130 + cascade * 26, root.offsetWidth - w - 10);
    const top = Math.min(30 + cascade * 26, root.offsetHeight - h - 40);
    cascade = (cascade + 1) % 8;
    el.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px;`;
    el.innerHTML = `
      <div class="titlebar">${spec.glyph}<span class="title">${esc(spec.title)}</span>
        <button class="tb-btn min" type="button" title="Minimize">_</button>
        <button class="tb-btn max" type="button" title="Maximize">□</button>
        <button class="tb-btn close" type="button" title="Close">×</button>
      </div>
      ${spec.menu ? `<div class="menubar">${spec.menu.map((m) => `<span>${m}</span>`).join("")}</div>` : ""}
      <div class="win-body${spec.grey ? " grey" : ""}">${spec.html}</div>`;

    el.querySelector(".min").addEventListener("click", () => toggleMinimize(id));
    el.querySelector(".close").addEventListener("click", () => closeWindow(id));
    el.querySelector(".max").addEventListener("click", () => {
      const full = el.classList.toggle("maxed");
      if (full) {
        el.dataset.prev = el.style.cssText;
        el.style.cssText = `left:0;top:0;width:${root.offsetWidth}px;height:${root.offsetHeight - 28}px;z-index:${el.style.zIndex}`;
      } else el.style.cssText = el.dataset.prev;
    });
    el.addEventListener("pointerdown", () => focusWindow(id));
    el.querySelectorAll("[data-open]").forEach((n) => n.addEventListener("click", () => openWindow(n.dataset.open)));
    makeDraggable(el, el.querySelector(".titlebar"));

    const task = document.createElement("button");
    task.type = "button";
    task.className = "task-btn";
    task.innerHTML = `${spec.glyph}<span>${esc(spec.title)}</span>`;
    task.addEventListener("click", () => {
      const isActive = task.classList.contains("active");
      if (isActive) toggleMinimize(id);
      else {
        el.classList.remove("minimized");
        focusWindow(id);
      }
    });

    els.windows.appendChild(el);
    els.tasks.appendChild(task);
    windows.set(id, { el, task });
    focusWindow(id);
  }

  // ---------- Desktop icons ----------
  const ICONS = [
    { id: "about", label: "About.txt", glyph: G.notepad },
    { id: "experience", label: "Experience", glyph: G.briefcase },
    { id: "projects", label: "Projects", glyph: G.folder },
    { id: "skills", label: "Skills.sys", glyph: G.gear },
    { id: "contact", label: "Contact", glyph: G.card },
    { id: "resume", label: "Resume.pdf", glyph: G.pdf, href: content.resumePdf },
  ];

  els.icons.innerHTML = ICONS.map(
    (i) => `<div class="icon" tabindex="0" data-id="${i.id}" ${i.href ? `data-href="${i.href}"` : ""}>${i.glyph}<span>${i.label}</span></div>`
  ).join("");
  els.icons.querySelectorAll(".icon").forEach((n) => {
    const act = () => (n.dataset.href ? window.open(n.dataset.href, "_blank", "noopener") : openWindow(n.dataset.id));
    n.addEventListener("click", act);
    n.addEventListener("keydown", (e) => e.key === "Enter" && act());
  });

  // ---------- Start menu ----------
  const smItems = [
    { glyph: G.link, label: "LinkedIn", href: content.contact.linkedin },
    { glyph: G.link, label: "GitHub", href: content.contact.github },
    { glyph: G.mail, label: "Email me", href: `mailto:${content.contact.email}` },
    { glyph: G.pdf, label: "Resume.pdf", href: content.resumePdf },
  ];
  els.startMenu.insertAdjacentHTML(
    "beforeend",
    smItems.map((i) => `<a class="sm-item" href="${esc(i.href)}" target="_blank" rel="noopener">${i.glyph}<span>${i.label}</span></a>`).join("") +
      (onBack ? `<div class="sm-sep"></div><div class="sm-item" data-back>${G.door}<span>Leave the computer</span></div>` : "")
  );
  els.startMenu.querySelector("[data-back]")?.addEventListener("click", () => {
    toggleStart(false);
    onBack();
  });

  function toggleStart(force) {
    const open = force ?? !els.startMenu.classList.contains("open");
    els.startMenu.classList.toggle("open", open);
    els.start.classList.toggle("open", open);
  }
  els.start.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleStart();
  });
  root.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".start-menu") && !e.target.closest(".start")) toggleStart(false);
  });

  // ---------- Clock ----------
  const tick = () => {
    const d = new Date();
    els.clock.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  tick();
  setInterval(tick, 1000);

  // ---------- Boot ----------
  function boot() {
    if (booted) return;
    booted = true;
    let i = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      els.boot.classList.add("hidden");
      els.desktop.classList.add("visible");
      setTimeout(() => openWindow("about"), 500);
    };
    els.boot.addEventListener("click", finish, { once: true });
    const step = () => {
      if (done) return;
      if (i < BOOT_LINES.length) {
        els.boot.innerHTML = BOOT_LINES.slice(0, ++i).map(esc).join("\n") + `\n<span class="cursor"></span>`;
        setTimeout(step, i === BOOT_LINES.length ? 700 : 140);
      } else finish();
    };
    step();
  }

  return { boot, openWindow };
}
