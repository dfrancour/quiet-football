import { PALETTE } from "~/lib/palette";

/** Whether the browser can draw the site's colours, which are all `oklch`. */
export const SUPPORTED_COLOR = "oklch(0% 0 0)";

/**
 * The page for a browser too old to draw the site: one without `oklch`, in
 * which every colour is lost, and so every one without cascade layers (an
 * older TV's), which drops every rule Tailwind writes and would draw the
 * page in its defaults. A browser that can draw the site skips all of it.
 *
 * It draws the loading frame's colours and layout in plain CSS, holds the
 * mark still, and shows the frame's line saying the browser is too old in
 * place of the one saying a script is needed, since the season could not
 * be drawn there even with one (`Supported`). It keeps the About page
 * legible too. The line is hidden by an inline style, which only
 * `!important` outranks: the `hidden` attribute would not do, since
 * Tailwind hides it with an `!important` in a layer, which beats any
 * outside one.
 *
 * It is inlined in the head, not kept in `globals.css`, so the stylesheet's
 * minifier, which builds for browsers that have `oklch`, never touches it.
 */
export const FALLBACK_STYLE = `@supports not (color:${SUPPORTED_COLOR}){
html{background-color:${PALETTE.surface};color:${PALETTE.inkMuted};font-family:system-ui,sans-serif}
body{margin:0}
a{color:inherit;text-decoration:none}
button{padding:0;border:0;background:none;color:inherit;font:inherit}
main>div{display:flex;flex-direction:column;box-sizing:border-box;max-width:72rem;min-height:100vh;margin:0 auto;padding:1.5rem 1rem}
main>div>header,main>div>header>a{display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-size:.875rem;font-weight:600}
main>div>div{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;padding-bottom:6rem;color:${PALETTE.inkFaint};text-align:center}
main>div>div>p{margin:.75rem 0 0;color:${PALETTE.inkMuted};font-size:.875rem}
main>div>div>p:empty,main>div>div>noscript{display:none}
[data-too-old]{display:block!important}
[aria-busy] svg{animation:none}
main article{max-width:34rem;margin:0 auto;text-align:center}
main article a{margin:0 .75rem}
main article a svg{margin-right:.375rem}
}`;
