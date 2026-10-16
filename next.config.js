/** @type {import("next").NextConfig} */
const config = {
  pageExtensions: ["js", "jsx", "ts", "tsx"],
  // A static site: every page is HTML and the browser fetches the data.
  output: "export",
  // Team marks come straight from ESPN's CDN; there is no server to resize them.
  images: { unoptimized: true },
};

export default config;
