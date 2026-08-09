import { visit } from 'unist-util-visit';

export function rehypeTexSource() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      const className: string[] = node.properties?.className ?? [];
      if (!className.includes('katex')) return;
      let tex = '';
      visit(node, 'element', (child: any) => {
        if (child.tagName === 'annotation' && child.properties?.encoding === 'application/x-tex') {
          tex = (child.children ?? []).map((grand: any) => grand.value ?? '').join('');
        }
      });
      if (tex) {
        node.properties['data-tex'] = tex;
        node.properties['data-display'] = className.includes('katex-display') ? 'block' : 'inline';
      }
    });
  };
}
