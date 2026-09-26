import { describe, expect, it } from "vitest";
import { promoteDetailLevel } from "./discovery";

describe("promoteDetailLevel — jamais une regression", () => {
  it("rien de decouvert : le niveau propose est acquis tel quel", () => {
    expect(promoteDetailLevel(null, "mentioned")).toBe("mentioned");
    expect(promoteDetailLevel(null, "known")).toBe("known");
  });

  it("avance : mentioned -> known -> detailed", () => {
    expect(promoteDetailLevel("mentioned", "known")).toBe("known");
    expect(promoteDetailLevel("known", "detailed")).toBe("detailed");
    expect(promoteDetailLevel("mentioned", "detailed")).toBe("detailed");
  });

  it("ne redescend jamais", () => {
    expect(promoteDetailLevel("detailed", "known")).toBe("detailed");
    expect(promoteDetailLevel("detailed", "mentioned")).toBe("detailed");
    expect(promoteDetailLevel("known", "mentioned")).toBe("known");
  });

  it("le meme niveau reste le meme niveau", () => {
    expect(promoteDetailLevel("known", "known")).toBe("known");
  });
});
