import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import { Mathematics } from '@tiptap/extension-mathematics';
import { createLowlight, common } from 'lowlight';
import { Callout } from './Callout.js';

const lowlight = createLowlight(common);

export function creerExtensions({ onMathClick }) {
  return [
    StarterKit.configure({
      codeBlock: false,
      // Les liens « page:ID » pointent vers une autre page de l'application
      link: {
        openOnClick: false,
        isAllowedUri: (url, ctx) => url.startsWith('page:') || ctx.defaultValidate(url),
      },
    }),
    Placeholder.configure({ placeholder: 'Écris ici…' }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'c' }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true } }),
    Details.configure({ persist: true }),
    DetailsSummary,
    DetailsContent,
    Image.configure({ allowBase64: true }),
    Mathematics.configure({
      inlineOptions: { onClick: (node, pos) => onMathClick('inline', node.attrs.latex, pos) },
      blockOptions: { onClick: (node, pos) => onMathClick('block', node.attrs.latex, pos) },
    }),
    Callout,
  ];
}

// Le contenu est stocké en JSON ; un ancien texte brut devient des paragraphes
export function lireContenu(contenu) {
  if (!contenu) return undefined;
  try {
    const doc = JSON.parse(contenu);
    if (doc && doc.type === 'doc') return doc;
  } catch { /* texte brut */ }
  return {
    type: 'doc',
    content: contenu.split('\n').map((ligne) => (
      ligne ? { type: 'paragraph', content: [{ type: 'text', text: ligne }] } : { type: 'paragraph' }
    )),
  };
}
