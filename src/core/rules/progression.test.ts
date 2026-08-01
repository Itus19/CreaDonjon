import { describe, expect, it } from "vitest";
import type { FormulaNode } from "../formula/ast";
import { computeProgressionRows } from "./progression";

describe("computeProgressionRows", () => {
  it("laisse les lignes intactes quand aucune colonne n'est de type formule", () => {
    const data = {
      max_level: 20,
      columns: [
        { key: "level", label: { fr: "Niveau" }, kind: "level" as const },
        { key: "rages", label: { fr: "Rages" }, kind: "value" as const },
      ],
      rows: [{ level: 1, rages: 2 }],
    };
    expect(computeProgressionRows(data)).toEqual(data.rows);
  });

  it("calcule une colonne formule a partir du niveau de la ligne, jamais saisie", () => {
    // Bonus de maitrise standard : 2 + floor((niveau-1)/4).
    const data = {
      max_level: 5,
      columns: [
        { key: "level", label: { fr: "Niveau" }, kind: "level" as const },
        {
          key: "pb",
          label: { fr: "Bonus de maitrise" },
          kind: "formula" as const,
          formula: {
            op: "add",
            args: [
              { op: "num", value: 2 },
              {
                op: "floor",
                args: [
                  {
                    op: "div",
                    args: [
                      { op: "sub", args: [{ op: "ref", name: "level" }, { op: "num", value: 1 }] },
                      { op: "num", value: 4 },
                    ],
                  },
                ],
              },
            ],
          } satisfies FormulaNode,
        },
      ],
      rows: [{ level: 1 }, { level: 4 }, { level: 5 }],
    };
    expect(computeProgressionRows(data)).toEqual([
      { level: 1, pb: 2 },
      { level: 4, pb: 2 },
      { level: 5, pb: 3 },
    ]);
  });
});
