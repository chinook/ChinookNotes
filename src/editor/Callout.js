import { Node, mergeAttributes } from '@tiptap/core';

// Bloc « callout » à la Notion : un encadré avec une icône et du contenu libre
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      icone: {
        default: '💡',
        parseHTML: (el) => el.getAttribute('data-icone') || '💡',
        renderHTML: (attrs) => ({ 'data-icone': attrs.icone }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },

  addCommands() {
    return {
      basculerCallout: () => ({ commands }) => commands.toggleWrap(this.name),
    };
  },
});
