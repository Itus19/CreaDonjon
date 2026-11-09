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
 * `onChange` ne doit pas être appelé, et l'image et la légende s'affichent
 * telles que la donnée les porte. V3.1-189 : l'aperçu dans le texte a quitté
 * le bloc image (la place se choisit dans l'éditeur de texte).
 */
function monter(donnee: unknown, onChange: () => void, contenuDuSecond: unknown[] = [{ t: "text", v: "Second paragraphe." }]) {
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
                { id: "s2", blockType: "paragraph", visibility: { level: "public", scopeId: null }, content: contenuDuSecond, align: "left" },
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

  it("n'écrit rien pour un bloc à l'ancien ancrage par paragraphe", () => {
    const onChange = vi.fn();
    monter({ __v: 1, url: "/x.png", placement: "anchored", anchor: { blockId: "t1", segmentId: "s2", position: "before" } }, onChange);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("V3.1-189 : une image posée dans un texte nomme son bloc texte, sans rien écrire à l'ouverture", () => {
    const onChange = vi.fn();
    const html = monter({ __v: 1, url: "/x.png" }, onChange, [{ t: "text", v: "Avant " }, { t: "image", blockId: "b1" }]);
    expect(onChange).not.toHaveBeenCalled();
    expect(html).toContain("Dans « Description »");
    expect(html).toContain("Faites-la glisser dans le texte");
  });

  it("V3.1-189 : plus de curseur à crans ni de barre d'alignement dans le bloc image", () => {
    const html = monter({ __v: 1, url: "/x.png" }, vi.fn(), [{ t: "image", blockId: "b1" }]);
    expect(html).not.toContain('role="toolbar"');
    expect(html).not.toContain("Position dans le bloc");
  });

  it("cache flou et fondu sans fond, les montre avec un fond", () => {
    expect(monter({ __v: 1, url: "/x.png" }, vi.fn())).not.toContain("Flou du fond");
    expect(monter({ __v: 1, url: "/x.png", useAsWikiBackground: true }, vi.fn())).toContain("Flou du fond");
  });
});
