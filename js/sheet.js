// Renders the CV as the Dungeon Master's character sheet.

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const abilityBlock = (a) => `
  <div class="ability">
    <div class="key">${esc(a.key)}</div>
    <div class="score">${a.score}</div>
    <div class="mod">${esc(a.mod)}</div>
  </div>`;

const member = (m) => `
  <div class="member" style="--dot:${esc(m.colour)}">
    <div class="nm">${esc(m.name)}</div>
    <div class="rl">${esc(m.role)}</div>
    <p>${esc(m.blurb)}</p>
  </div>`;

const entry = (e) => `
  <div class="entry">
    <div class="top">
      <span class="role"><span class="lvl">${esc(e.level)}</span>${esc(e.role)}</span>
      <span class="dates">${esc(e.dates)}</span>
    </div>
    <ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
  </div>`;

const quest = (q) => {
  const body = q.problem
    ? `<dl>
         <dt>The problem</dt><dd>${esc(q.problem)}</dd>
         <dt>What I built</dt><dd>${esc(q.built)}</dd>
         <dt>Outcome</dt><dd>${esc(q.result)}</dd>
       </dl>`
    : `<p>${esc(q.summary)}</p>`;
  return `
    <div class="quest">
      <div class="qn">${esc(q.name)} <span class="real">— ${esc(q.real)}</span></div>
      <div class="st">${esc(q.status)}</div>
      ${body}
    </div>`;
};

/**
 * Builds the sheet into `root`. Returns { scrollTop() } so the caller can reset
 * the scroll position when the sheet is revealed again.
 */
export function createSheet(root, c) {
  root.classList.add("sheet");
  root.innerHTML = `
    <header class="hdr">
      <div class="who">
        <h1>${esc(c.name)}</h1>
        <span class="dm-badge">${esc(c.role)}</span>
      </div>
      <div class="line">
        <b>Class</b> ${esc(c.charClass)} &nbsp;·&nbsp;
        <b>Level</b> ${c.level} &nbsp;·&nbsp;
        <b>Background</b> ${esc(c.background)} &nbsp;·&nbsp;
        <b>Alignment</b> ${esc(c.alignment)} &nbsp;·&nbsp;
        <b>Base</b> ${esc(c.location)}
      </div>
      <p class="tagline">&ldquo;${esc(c.tagline)}&rdquo;</p>
    </header>

    <p>${esc(c.blurb)}</p>

    <h2>Ability Scores</h2>
    <div class="abilities">${c.abilities.map(abilityBlock).join("")}</div>
    <ul class="ability-notes">
      ${c.abilities.map((a) => `<li><b>${esc(a.key)}</b> — ${esc(a.note)}</li>`).join("")}
    </ul>

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
          ${c.inventory.map((i) => `<li><b>${esc(i.slot)}</b>${esc(i.items)}</li>`).join("")}
        </ul>
      </section>
    </div>

    <h2>The Party — agents at this table</h2>
    <div class="party">${c.party.map(member).join("")}</div>

    <h2>Campaign Log — ${esc(c.campaign.company)}, ${esc(c.campaign.note)}</h2>
    ${c.campaign.entries.map(entry).join("")}

    <h2>Completed Quests</h2>
    ${c.quests.map(quest).join("")}

    <h2>Feats &amp; Training</h2>
    <ul>${c.feats.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>

    <h2>Languages</h2>
    <p>${esc(c.languages)}</p>

    <h2>Send a Raven</h2>
    <ul class="contact">
      <li><b>Email</b><a href="mailto:${esc(c.contact.email)}">${esc(c.contact.email)}</a></li>
      <li><b>Phone</b><span>${esc(c.contact.phone)}</span></li>
      <li><b>LinkedIn</b><a href="${esc(c.contact.linkedin)}" target="_blank" rel="noopener">${esc(c.contact.linkedin.replace("https://www.", ""))}</a></li>
      <li><b>GitHub</b><a href="${esc(c.contact.github)}" target="_blank" rel="noopener">${esc(c.contact.github.replace("https://", ""))}</a></li>
    </ul>
    <a class="btn" href="${esc(c.resumePdf)}" target="_blank" rel="noopener">Download the plain résumé (PDF)</a>

    <div class="foot">Rolled up in Amsterdam · the dice are real, the metrics are not inflated</div>`;

  return { scrollTop: () => (root.scrollTop = 0) };
}
