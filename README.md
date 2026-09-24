# Horn Saerens — Horn.os

The portfolio of Horn Saerens, AI Solutions Consultant in Amsterdam.

**Horn.os** is the desktop on Horn's computer. Its centrepiece is a chat in the
style of an LLM interface: Horn's assistant answers questions about his work,
his projects and why he'd fit your team. The conversation is a scripted tree —
click a suggested question and it types itself out, or just start typing and
every keystroke writes the next letters of the highlighted question. There is no
model behind it, so the assistant can never say anything that is not written in
`js/content/dialogue.js`, and every line there traces to Horn's CV or his own
project notes.

The dock also opens the résumé (with the PDF), the skills, one card per project,
the contact details, and a bonus: **the D&D table** at [`dnd/`](dnd/), a 3D
tabletop where the AI models Horn works with are the players and their character
sheets are his real projects.

A 3D office — a bright room full of plants, with the day turning to night
outside the window and Horn.os on the monitor — is being built around it.

## Running it

No build step: static files and plain ES modules.

    python serve.py 4330        # then open http://localhost:4330/

`?theme=light` or `?theme=dark` forces the theme (otherwise it follows the
visitor's clock: dark from 21:00 to 07:00). `?debug` exposes `window.__os` and
`window.__streamLog` (Plan 2's screen-light log of the chat's `onStream(true/false)`
calls).

## Tests

    npm test                    # content, dialogue graph, typing, inline marks (Node)
    npm run test:e2e            # Horn.os and the D&D page in Chromium (Playwright)
    npm run shots:os            # screenshots into test/out/

The `dnd:*` scripts (`dnd:shots`, `dnd:bench:*`) talk to the D&D page over
HTTP, so they need `npm run serve` running on `:4330` in another terminal
first.

Editing the dialogue: keep 1–4 questions per answer and never point `next` at
`root` — `npm test` fails on dead ends, unreachable answers and unknown project ids.

## Layout

    js/content/   profile.js (Horn as data), dialogue.js (the question tree), validate.js
    js/os/        hornos.js (desktop), wm.js (windows), chat.js, windows/*.js
    css/hornos.css
    dnd/          the D&D table, frozen — see dnd/README.md
