import { describe, expect, it } from "bun:test";

import { scriptText, styleText, woff2Only } from "../build/inline";

describe("inline bundle", () => {
  it("keeps a closing script tag inside code from ending the element", () => {
    expect(scriptText('a("</script>")')).toBe('a("<\\/script>")');
    expect(scriptText('a("</SCRIPT>")')).toBe('a("<\\/script>")');
    expect(scriptText("x<!--y")).toBe("x<\\!--y");
  });

  it("keeps a closing style tag inside CSS from ending the element", () => {
    expect(styleText('a::after{content:"</style>"}')).toBe(
      'a::after{content:"<\\/style>"}',
    );
  });
});

describe("woff2Only", () => {
  it("drops the WOFF fallback and keeps the WOFF2 source", () => {
    const face =
      'src:url(./files/a-400.woff2) format("woff2"), url(./files/a-400.woff) format("woff");';
    expect(woff2Only(face)).toBe(
      'src:url(./files/a-400.woff2) format("woff2");',
    );
  });
});
