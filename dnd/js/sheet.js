// Renders the CV as the Dungeon Master's character sheet, and each agent's
// project as that player's own sheet.
//
// Both are plain HTML laid into the 3D scene through CSS3D, which is why the
// type stays crisp while the room around it is painted: the sheet is never
// rasterised into the WebGL canvas at all.

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------------- The DM's sheet ---------------- */

const ability = (a) => `
  <div class="ability">
    <div class="ab-top">
      <span class="key">${esc(a.key)}</span>
      <span class="score">${a.score}</span>
      <span class="mod">${esc(a.mod)}</span>
    </div>
    <div class="ab-note">${esc(a.note)}</div>
  </div>`;

const entry = (e) => `
  <div class="entry">
    <div class="top">
      <span class="role"><i class="lvl">${esc(e.level)}</i>${esc(e.role)}</span>
      <span class="dates">${esc(e.dates)}</span>
    </div>
    <ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
  </div>`;

// A quest with a problem is one of the two the whole CV rests on, so it gets
// the full three-part treatment; the others are one line each.
const questFull = (q) => `
  <div class="quest">
    <div class="qn">${esc(q.name)}<span class="real">${esc(q.real)}</span></div>
    <div class="st">${esc(q.status)}</div>
    <dl>
      <dt>Problem</dt><dd>${esc(q.problem)}</dd>
      <dt>Built</dt><dd>${esc(q.built)}</dd>
      <dt>Outcome</dt><dd>${esc(q.result)}</dd>
    </dl>
  </div>`;

const questBrief = (q) => `
  <li>
    <span class="qn">${esc(q.name)}<span class="real">${esc(q.real)}</span></span>
    <span class="st">${esc(q.status)}</span>
    <p>${esc(q.summary)}</p>
  </li>`;

/**
 * Builds the sheet into `root`. Returns { scrollTop() } so the caller can reset
 * the scroll position when the sheet is revealed again.
 */
export function createSheet(root, c) {
  root.classList.add("sheet");
  const full = c.quests.filter((q) => q.problem);
  const brief = c.quests.filter((q) => !q.problem);

  root.innerHTML = `
    <header class="hdr">
      <div class="who">
        <h1>${esc(c.name)}</h1>
        <span class="dm-badge">${esc(c.role)}</span>
      </div>
      <div class="line">
        ${esc(c.charClass)} &nbsp;·&nbsp; Level ${c.level} &nbsp;·&nbsp;
        ${esc(c.background)} &nbsp;·&nbsp; ${esc(c.alignment)} &nbsp;·&nbsp; ${esc(c.location)}
      </div>
      <p class="tagline">${esc(c.tagline)}</p>
    </header>

    <p class="lead">${esc(c.blurb)}</p>

    <h2>Ability scores</h2>
    <div class="abilities">${c.abilities.map(ability).join("")}</div>

    <div class="cols">
      <section>
        <h2>Proficiencies</h2>
        <ul class="prof">
          ${c.proficiencies.map((p) => `<li><span>${esc(p.name)}</span><span class="rank">${esc(p.rank)}</span></li>`).join("")}
        </ul>
      </section>
      <section>
        <h2>Inventory</h2>
        <ul class="inv">
          ${c.inventory.map((i) => `<li><b>${esc(i.slot)}</b><span>${esc(i.items)}</span></li>`).join("")}
        </ul>
      </section>
    </div>

    <h2>Campaign log <span class="h2-note">${esc(c.campaign.company)} · ${esc(c.campaign.note)}</span></h2>
    ${c.campaign.entries.map(entry).join("")}

    <h2>Completed quests</h2>
    ${full.map(questFull).join("")}
    <ul class="quests-brief">${brief.map(questBrief).join("")}</ul>

    <h2>The party <span class="h2-note">click a player at the table to open their sheet</span></h2>
    <ul class="party">
      ${c.party
        .map(
          (m) => `<li style="--dot:${esc(m.colour)}">
            <span class="nm">${esc(m.name)}</span>
            <span class="rl">${esc(m.role)}</span>
            <span class="sx">${esc(m.status)}</span>
          </li>`
        )
        .join("")}
    </ul>

    <div class="cols">
      <section>
        <h2>Feats &amp; training</h2>
        <ul class="plain">${c.feats.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      </section>
      <section>
        <h2>Languages</h2>
        <p>${esc(c.languages)}</p>
        <h2>Send a raven</h2>
        <ul class="contact">
          <li><b>Email</b><a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></li>
          <li><b>Phone</b><span>${esc(c.contact.phone)}</span></li>
          <li><b>LinkedIn</b><a href="${esc(c.contact.linkedin)}" target="_blank" rel="noopener">${esc(
            c.contact.linkedin.replace("https://www.linkedin.com/in/", "")
          )}</a></li>
          <li><b>GitHub</b><a href="${esc(c.contact.github)}" target="_blank" rel="noopener">${esc(
            c.contact.github.replace("https://github.com/", "")
          )}</a></li>
        </ul>
      </section>
    </div>

    <a class="btn" href="${esc(c.resumePdf)}" target="_blank" rel="noopener">Download the plain résumé (PDF)</a>

    <div class="foot">Rolled up in Amsterdam · the dice are real, the metrics are not inflated</div>`;

  return { scrollTop: () => (root.scrollTop = 0) };
}

/* ---------------- One player's sheet ---------------- */

/**
 * Fills `el` with an agent's own character sheet: what it is, how it is
 * deployed, and the quest it maps to on the DM's sheet. This is the element
 * that lies on the table in front of that player and lifts when you click them,
 * so it has to hold everything at 480x740 without scrolling.
 */
export function renderAgentSheet(el, a, quest) {
  el.classList.add("pc");
  el.style.setProperty("--dot", a.colour);

  const body = !quest
    ? ""
    : quest.problem
      ? `<dl class="pc-quest">
           <dt>Problem</dt><dd>${esc(quest.problem)}</dd>
           <dt>Built</dt><dd>${esc(quest.built)}</dd>
           <dt>Outcome</dt><dd>${esc(quest.result)}</dd>
         </dl>`
      : `<p class="pc-sum">${esc(quest.summary)}</p>`;

  el.innerHTML = `
    <header class="pc-hdr">
      <div class="pc-name">${esc(a.name)}</div>
      <div class="pc-class">${esc(a.charClass ?? a.role)}</div>
      <div class="pc-status">${esc(a.status)}</div>
    </header>

    <p class="pc-lead">${esc(a.blurb)}</p>

    <dl class="pc-traits">
      ${(a.traits ?? []).map((t) => `<dt>${esc(t.k)}</dt><dd>${esc(t.v)}</dd>`).join("")}
    </dl>

    <div class="pc-sec">Stack</div>
    <p class="pc-stack">${esc(a.stack)}</p>

    ${
      quest
        ? `<div class="pc-sec">Quest — ${esc(quest.name)}</div>
           <div class="pc-real">${esc(quest.real)} · ${esc(quest.status)}</div>
           ${body}`
        : ""
    }

    <div class="pc-foot">Player at Horn Saerens&rsquo; table</div>`;
}
