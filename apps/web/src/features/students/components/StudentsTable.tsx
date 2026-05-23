import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Archive, Edit, Visibility } from '@mui/icons-material';
import type { Student } from '@anna-maria/contracts';
import { useNavigate } from 'react-router-dom';

interface Props {
  students: Student[];
  onArchive: (id: string) => void;
}

export function StudentsTable({ students, onArchive }: Props) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {students.map((s) => (
          <Card key={s.id} variant="outlined">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, '&:last-child': { pb: 2 } }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{s.fullName}</Typography>
                {s.phone && <Typography variant="body2" color="text.secondary">{s.phone}</Typography>}
              </Box>
              {!s.isActive && <Chip label="Inativo" size="small" color="default" />}
              <IconButton size="small" onClick={() => navigate(`/students/${s.id}`)}><Visibility fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => navigate(`/students/${s.id}/edit`)}><Edit fontSize="small" /></IconButton>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Nome</TableCell>
          <TableCell>Telefone</TableCell>
          <TableCell>Email</TableCell>
          <TableCell>Status</TableCell>
          <TableCell align="right">Ações</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {students.map((s) => (
          <TableRow key={s.id} hover>
            <TableCell>{s.fullName}</TableCell>
            <TableCell>{s.phone ?? '—'}</TableCell>
            <TableCell>{s.email ?? '—'}</TableCell>
            <TableCell>
              <Chip label={s.isActive ? 'Ativo' : 'Inativo'} size="small" color={s.isActive ? 'success' : 'default'} />
            </TableCell>
            <TableCell align="right">
              <Tooltip title="Ver detalhes">
                <IconButton size="small" onClick={() => navigate(`/students/${s.id}`)}><Visibility fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Editar">
                <IconButton size="small" onClick={() => navigate(`/students/${s.id}/edit`)}><Edit fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Arquivar">
                <IconButton size="small" onClick={() => onArchive(s.id)} disabled={!s.isActive}><Archive fontSize="small" /></IconButton>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
