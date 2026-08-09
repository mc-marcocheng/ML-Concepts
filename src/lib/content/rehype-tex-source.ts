import { visit } from 'unist-util-visit';
import type { Root, Element, Text } from 'hast';

export function rehypeTexSource() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const className = (node.properties?.className as string[] | undefined) ?? [];
      if (!className.includes('katex')) return;
      let tex = '';
      visit(node, 'element', (child: Element) => {
        if (child.tagName === 'annotation' && child.properties?.encoding === 'application/x-tex') {
          tex = child.children.map(grand => (grand as Text).value ?? '').join('');
        }
      });
      if (tex) {
        node.properties['data-tex'] = tex;
        node.properties['data-display'] = className.includes('katex-display') ? 'block' : 'inline';
      }
    });
  };
}
