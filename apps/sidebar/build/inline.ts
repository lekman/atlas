/**
 * Puts the bundle's scripts and stylesheets into the HTML file, so the build
 * is one file. The claude.ai artifact publishes a single HTML file, and the
 * VS Code view loads that same file, adding its nonce to every script tag.
 */
import type { Plugin } from "vite";

/** A script's text, made safe to sit inside a `<script>` element. */
export function scriptText(code: string): string {
  return code.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}

/** A stylesheet's text, made safe to sit inside a `<style>` element. */
export function styleText(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

export function inlineBundle(): Plugin {
  return {
    name: "atlas-inline-bundle",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find(
        (file) => file.type === "asset" && file.fileName.endsWith(".html"),
      );
      if (!html || html.type !== "asset") return;
      let page = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        const href = `[^"]*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
        if (file.type === "chunk") {
          const tag = new RegExp(
            `<script\\b[^>]*\\ssrc="${href}"[^>]*></script>`,
          );
          if (!tag.test(page)) continue;
          page = page.replace(
            tag,
            () => `<script type="module">${scriptText(file.code)}</script>`,
          );
          delete bundle[name];
        } else if (name.endsWith(".css")) {
          const tag = new RegExp(`<link\\b[^>]*\\shref="${href}"[^>]*>`);
          if (!tag.test(page)) continue;
          page = page.replace(
            tag,
            () => `<style>${styleText(String(file.source))}</style>`,
          );
          delete bundle[name];
        }
      }
      html.source = page;
    },
  };
}
