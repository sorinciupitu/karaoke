import { describe, expect, it } from "vitest";
import { reorderIds } from "./reorder";

describe("reorderIds", () => {
  it("moves an item forward", () => {
    expect(reorderIds([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
  });

  it("moves an item backward", () => {
    expect(reorderIds([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
  });

  it("does not mutate the input", () => {
    const ids = [1, 2, 3];
    reorderIds(ids, 0, 1);
    expect(ids).toEqual([1, 2, 3]);
  });
});
