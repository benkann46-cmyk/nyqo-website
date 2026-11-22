# NYQO website

The landing page for NYQO, an end-to-end encrypted chat app for gaming squads.

Plain HTML, CSS and JavaScript: no framework and no build step. Open `index.html` through any static
file server.

- `index.html`, `buy.html`, `privacy.html`, `imprint.html`, `cookies.html`: the pages
- `assets/site.css`: all styles
- `assets/site.js`: the page's behaviour
- `assets/3d/`: the WebGL scenes (the hero valley with the server, scroll-driven)

The order form on `buy.html` talks to the NYQO server, which is not part of this repository, so it
does nothing here. The imprint is still a draft.

## Third-party parts

- [three.js](https://threejs.org) in `assets/vendor/three/` (MIT, licence included)
- Fonts in `assets/fonts/`: Inter, Bebas Neue and JetBrains Mono (SIL Open Font License)
