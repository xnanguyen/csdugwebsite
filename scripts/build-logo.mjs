import { readFile, writeFile } from "node:fs/promises";

// Preserve the supplied artwork; the SVG viewport excludes its outer white canvas.
const source = await readFile(new URL("../assets/images/csdug-logo-source.png", import.meta.url));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="617" height="437" viewBox="455 264 617 437">
  <image width="1920" height="1080" href="data:image/png;base64,${source.toString("base64")}"/>
</svg>\n`;
await writeFile(new URL("../assets/images/csdug-logo.svg", import.meta.url), svg);
