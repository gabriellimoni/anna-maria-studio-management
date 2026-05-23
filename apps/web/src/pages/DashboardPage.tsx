import { Box, Typography } from '@mui/material';
import { useAuth } from '../auth/useAuth';

export function DashboardPage() {
  const { firebaseUser } = useAuth();
  const name = firebaseUser?.displayName ?? firebaseUser?.email ?? 'there';

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Welcome, {name}
      </Typography>
      <Typography color="text.secondary">
        Your app starts here. Add pages and features as needed.
      </Typography>
    </Box>
  );
}
