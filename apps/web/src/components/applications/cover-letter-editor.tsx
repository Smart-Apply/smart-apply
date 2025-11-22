'use client';

import { useEffect, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoverLetterEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  icon: ReactNode;
  label: string;
  disabled?: boolean;
}

function ToolbarButton({ onClick, active, icon, label, disabled }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition-colors',
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {icon}
    </button>
  );
}

export function CoverLetterEditor({ value, onChange, disabled }: CoverLetterEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          bulletList: { keepMarks: true },
          orderedList: { keepMarks: true },
        }),
      ],
      content: value || '<p></p>',
      editable: !disabled,
      immediatelyRender: false, // Required for Next.js SSR
      editorProps: {
        attributes: {
          class:
            'prose prose-slate mx-auto min-h-[320px] max-w-none px-4 py-3 text-sm focus:outline-none',
        },
      },
      onUpdate({ editor }) {
        onChange(editor.getHTML());
      },
    },
    [value, disabled],
  );

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    if (!value && current !== '<p></p>') {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return <div className="min-h-[320px] rounded-lg border border-slate-200 bg-white" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          icon={<Bold className="h-4 w-4" />}
          label="Fett"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          icon={<Italic className="h-4 w-4" />}
          label="Kursiv"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          icon={<List className="h-4 w-4" />}
          label="Aufzählung"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          icon={<ListOrdered className="h-4 w-4" />}
          label="Nummerierte Liste"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          icon={<Quote className="h-4 w-4" />}
          label="Zitat"
          disabled={disabled}
        />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
