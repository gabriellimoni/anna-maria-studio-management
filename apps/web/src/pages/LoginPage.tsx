import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Campaign } from '@mui/icons-material';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../auth/firebase';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Digite seu e-mail para redefinir a senha.');
      return;
    }
    await sendPasswordResetEmail(auth, email);
    setError('');
    alert('E-mail de redefinição enviado.');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mb: 1,
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                bgcolor: 'primary.main',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Campaign sx={{ color: 'white', fontSize: 22 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 22 }}>
              Studio de Pilates
            </Typography>
          </Box>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
            Acesse sua conta
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="small"
              required
              fullWidth
            />
            <TextField
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              size="small"
              required
              fullWidth
            />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormControlLabel
                control={<Checkbox size="small" color="primary" />}
                label={<Typography sx={{ fontSize: 13 }}>Lembrar-me</Typography>}
              />
              <Link
                component="button"
                type="button"
                underline="hover"
                onClick={handleForgotPassword}
                sx={{ fontSize: 13, color: 'primary.dark', fontWeight: 500 }}
              >
                Esqueci a senha
              </Link>
            </Box>

            {error && (
              <Typography sx={{ color: 'error.main', fontSize: 13 }}>
                {error}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{ py: 1.25 }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Entrar'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
