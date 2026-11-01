import { describe, expect, it } from "bun:test";

import { scriptText, styleText } from "../build/inline";

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
