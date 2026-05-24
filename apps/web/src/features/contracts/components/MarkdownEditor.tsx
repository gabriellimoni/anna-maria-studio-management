import { Box, Tab, Tabs, TextField, useMediaQuery, useTheme } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRef, useState } from 'react';
import { ContractVariablesHelper } from './ContractVariablesHelper';

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function MarkdownEditor({ value, onChange, disabled }: Props) {
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up('md'));
  const [tab, setTab] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    // Restore cursor after text
    requestAnimationFrame(() => {
      el.selectionStart = start + text.length;
      el.selectionEnd = start + text.length;
      el.focus();
    });
  }

  const editor = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
      <ContractVariablesHelper onInsert={insertAtCursor} />
      <TextField
        inputRef={textareaRef}
        multiline
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        minRows={20}
        sx={{ fontFamily: 'monospace', flex: 1, '& textarea': { fontFamily: 'monospace', fontSize: 13 } }}
        placeholder="# Título do Contrato&#10;&#10;Olá {{studentName}}, ..."
      />
    </Box>
  );

  const preview = (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 2,
        overflowY: 'auto',
        maxHeight: 600,
        fontFamily: 'Georgia, serif',
        lineHeight: 1.7,
        '& h1': { fontSize: '1.5em', fontWeight: 'bold', mb: 1 },
        '& h2': { fontSize: '1.2em', fontWeight: 'bold', mb: 0.5 },
        '& h3': { fontSize: '1.05em', fontWeight: 'bold' },
        '& p': { mb: 1 },
        '& ul, & ol': { pl: 3, mb: 1 },
        '& li': { mb: 0.3 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </Box>
  );

  if (isLg) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, alignItems: 'start' }}>
        {editor}
        {preview}
      </Box>
    );
  }

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v: number) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label="Editor" />
        <Tab label="Prévia" />
      </Tabs>
      {tab === 0 ? editor : preview}
    </Box>
  );
}
