import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Tabs, { TabPanel } from "@/components/shared/Tabs";

const items = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

function rendre(idPrefix?: string): string {
  return renderToStaticMarkup(
    createElement(Tabs, { value: "b", items, onChange: () => {}, "aria-label": "Test", idPrefix }),
  );
}

describe("Tabs", () => {
  it("rend une tablist avec un nom accessible", () => {
    const html = rendre();
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Test"');
  });

  it("n'a qu'un seul onglet tabulable, l'actif", () => {
    const html = rendre();
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
  });

  it("marque l'onglet actif avec aria-selected", () => {
    const html = rendre();
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/aria-selected="false"/g)).toHaveLength(2);
  });

  it("relie onglets et panneaux avec idPrefix", () => {
    const html = rendre("p");
    expect(html).toContain('id="p-tab-a"');
    expect(html).toContain('aria-controls="p-panel-a"');
    expect(html).toContain('id="p-tab-c"');
  });

  it("n'ajoute ni id ni aria-controls sans idPrefix", () => {
    const html = rendre();
    expect(html).not.toContain("aria-controls");
  });
});

describe("TabPanel", () => {
  it("rend un tabpanel étiqueté par son onglet", () => {
    const html = renderToStaticMarkup(createElement(TabPanel, { idPrefix: "p", value: "b" }, "contenu"));
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('id="p-panel-b"');
    expect(html).toContain('aria-labelledby="p-tab-b"');
    expect(html).toContain("contenu");
  });
});
