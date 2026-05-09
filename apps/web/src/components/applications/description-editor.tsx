'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { FontSize } from '@/lib/tiptap';
import { FontSizeDropdown } from './font-size-dropdown';
import { cn } from '@/lib/utils';

interface DescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  icon: React.ReactNode;
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
        'inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors',
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {icon}
    </button>
  );
}

export function DescriptionEditor({ 
  value, 
  onChange, 
  disabled, 
  // Tiptap's StarterKit doesn't accept a placeholder out of the box —
  // the prop is kept for API compatibility with callers that pass one
  // (and so a future `Placeholder` extension can plug in without a
  // breaking change), but it isn't wired into the editor right now.
  placeholder: _placeholder = 'Beschreiben Sie Ihre Aufgaben, Verantwortlichkeiten und Erfolge...',
  minHeight = '160px'
}: DescriptionEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          bulletList: { 
            keepMarks: true,
            HTMLAttributes: {
              class: 'list-disc ml-4',
            },
          },
          orderedList: { 
            keepMarks: true,
            HTMLAttributes: {
              class: 'list-decimal ml-4',
            },
          },
          listItem: {
            HTMLAttributes: {
              class: 'mb-1',
            },
          },
        }),
        TextStyle,
        FontSize,
      ],
      content: value || '<p></p>',
      editable: !disabled,
      immediatelyRender: false, // Required for Next.js SSR
      editorProps: {
        attributes: {
          class: cn(
            'tiptap-editor max-w-none px-3 py-2 text-sm focus:outline-none prose prose-sm',
            'prose-ul:list-disc prose-ol:list-decimal prose-li:ml-0',
            'break-words [overflow-wrap:anywhere] [word-break:break-word]'
          ),
          style: `min-height: ${minHeight}`,
        },
      },
      onUpdate({ editor }) {
        onChange(editor.getHTML());
      },
    },
    [],
  );

  // Sync value changes to editor
  useEffect(() => {
    if (!editor) return;
    
    const current = editor.getHTML();
    
    // Only update if the value actually changed and is different from current
    if (value && value !== current) {
      queueMicrotask(() => {
        editor.commands.setContent(value, { emitUpdate: false });
      });
    }
    
    if (!value && current !== '<p></p>') {
      queueMicrotask(() => {
        editor.commands.clearContent();
      });
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return <div className={cn('rounded-lg border border-slate-200 bg-white')} style={{ minHeight }} />;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 p-1.5">
        <FontSizeDropdown editor={editor} disabled={disabled} className="h-7 w-[70px]" />
        <div className="mx-0.5 h-5 w-px bg-slate-200" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          icon={<Bold className="h-3.5 w-3.5" />}
          label="Fett"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          icon={<Italic className="h-3.5 w-3.5" />}
          label="Kursiv"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          icon={<List className="h-3.5 w-3.5" />}
          label="Aufzählung"
          disabled={disabled}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          icon={<ListOrdered className="h-3.5 w-3.5" />}
          label="Nummerierte Liste"
          disabled={disabled}
        />
      </div>
      <div className="rounded-b-lg border border-slate-200 bg-white overflow-hidden">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
