// Line icons for the dock and the project cards: 24-unit grid, drawn with the
// current text colour so they follow the theme.

const NS = "http://www.w3.org/2000/svg";

function icon(...paths) {
  return () => {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "icon");
    for (const d of paths) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      svg.append(p);
    }
    return svg;
  };
}

export const ICONS = {
  chat: icon("M4 5h16v11H9l-5 4z", "M8 9h8", "M8 12h5"),
  resume: icon("M6 3h9l3 3v15H6z", "M15 3v3h3", "M9 11h6", "M9 15h6"),
  skills: icon("M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"),
  projects: icon("M3 7h7l2 2h9v10H3z"),
  contact: icon("M3 6h18v12H3z", "M3 7l9 6 9-6"),
  dnd: icon("M12 2l9 5v10l-9 5-9-5V7z", "M12 7l5 9H7z"),
};
