import { Box, Paper } from '@mui/material';

interface Props {
  html: string;
}

export function ContractPreview({ html }: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 3, maxHeight: 500, overflowY: 'auto' }}>
      <Box
        sx={{
          fontFamily: 'Georgia, serif',
          fontSize: 14,
          lineHeight: 1.7,
          '& h1': { fontSize: '1.6em', fontWeight: 'bold', mb: 1 },
          '& h2': { fontSize: '1.3em', fontWeight: 'bold', mb: 0.5 },
          '& h3': { fontSize: '1.1em', fontWeight: 'bold', mb: 0.5 },
          '& p': { mb: 1 },
          '& ul, & ol': { pl: 3, mb: 1 },
          '& li': { mb: 0.3 },
          '& strong': { fontWeight: 'bold' },
          '& em': { fontStyle: 'italic' },
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Paper>
  );
}
