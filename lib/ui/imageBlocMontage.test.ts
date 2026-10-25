import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import ImageBlockEditor from "@/components/blocks/ImageBlockEditor";
import { zImageBlockData } from "@/src/core/schemas/blocks/image";
import messages from "@/messages/fr.json";

/**
 * V3.1-67 — « un bloc ancien s'affiche à l'identique, sans qu'on écrive à son
 * ouverture ». Le montage est rendu côté serveur (pas de jsdom dans le dépôt) :
 * `onChange` ne doit pas être appelé, et l'aperçu doit montrer l'image et la
 * légende telles que la donnée les porte.
 */
function monter(donnee: unknown, onChange: () => void) {
  const data = zImageBlockData.parse(donnee);
  return renderToStaticMarkup(
    // Le typage de `NextIntlClientProvider` exige `children` dans les props quand on l'appelle par `createElement` sans JSX.
    // eslint-disable-next-line react/no-children-prop
    createElement(NextIntlClientProvider, {
      locale: "fr",
      messages,
      children: createElement(ImageBlockEditor, {
        blockId: "b1",
        data,
        onChange,
        siblings: [
          {
            id: "t1",
            blockType: "text",
            display: { label: "Description" },
            data: {
              segments: [
                { id: "s1", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v: "Premier paragraphe." }], align: "left" },
                { id: "s2", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: [{ t: "text", v: "Second paragraphe." }], align: "left" },
              ],
            },
          },
        ],
      }),
    }),
  );
}

describe("ImageBlockEditor au montage", () => {
  it("n'écrit rien pour un bloc ancien (champs absents), et l'affiche", () => {
    const onChange = vi.fn();
    const html = monter({ __v: 1, url: "/vieux.png", caption: "Vue du bourg", wrapMode: "wrap" }, onChange);
    expect(onChange).not.toHaveBeenCalled();
    expect(html).toContain("/vieux.png");
    expect(html).toContain('value="Vue du bourg"');
  });

  it("n'écrit rien pour un bloc ancré, et montre l'image dans le texte de l'hôte", () => {
    const onChange = vi.fn();
    const html = monter(
      { __v: 1, url: "/x.png", placement: "anchored", anchor: { blockId: "t1", segmentId: "s2", position: "before" } },
      onChange,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(html).toContain("Premier paragraphe.");
    expect(html.indexOf("Premier paragraphe.")).toBeLessThan(html.indexOf('src="/x.png"'));
    expect(html.indexOf('src="/x.png"')).toBeLessThan(html.indexOf("Second paragraphe."));
  });

  it("garde la barre flottante fermée tant qu'on ne touche pas l'image", () => {
    expect(monter({ __v: 1, url: "/x.png" }, vi.fn())).not.toContain('role="toolbar"');
  });

  it("cache flou et fondu sans fond, les montre avec un fond", () => {
    expect(monter({ __v: 1, url: "/x.png" }, vi.fn())).not.toContain("Flou du fond");
    expect(monter({ __v: 1, url: "/x.png", useAsWikiBackground: true }, vi.fn())).toContain("Flou du fond");
  });
});
