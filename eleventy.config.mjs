/* Deterministic PRNG (mulberry32) + string hash — same title always shuffles
   the same way, so the animation doesn't jitter between builds. */
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return h;
}
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (ch) => HTML_ESCAPES[ch] || ch;

/* Splits text into words (kept from breaking mid-word) and reveals each
   letter with a blurred fade-in, staggered on a shuffled timeline — the same
   build-up used for "Petra Németová" in the home page hero. */
function letterAnim(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const totalLetters = words.reduce((n, w) => n + w.length, 0);
  if (!totalLetters) return "";

  const minDelay = 0.15;
  const maxDelay = Math.max(minDelay + 0.3, Math.min(1.45, 0.85 + totalLetters * 0.045));
  const delays = Array.from({ length: totalLetters }, (_, i) =>
    minDelay + (i / Math.max(totalLetters - 1, 1)) * (maxDelay - minDelay)
  );
  const rand = mulberry32(hashSeed(text));
  for (let i = delays.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [delays[i], delays[j]] = [delays[j], delays[i]];
  }

  let cursor = 0;
  const wordsHtml = words.map((word) => {
    const letters = word.split("").map((ch) => {
      const d = delays[cursor++].toFixed(2);
      return `<span style="--d:${d}s">${escapeHtml(ch)}</span>`;
    }).join("");
    return `<span class="letter-word">${letters}</span>`;
  }).join(" ");

  return `<span class="letter-anim" aria-hidden="true">${wordsHtml}</span>`;
}

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addWatchTarget("src/assets/css/");
  eleventyConfig.addWatchTarget("src/assets/js/");
  eleventyConfig.addFilter("letterAnim", letterAnim);

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
}
