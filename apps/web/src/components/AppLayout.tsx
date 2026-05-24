import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Assignment, AttachMoney, CalendarMonth, Description, EventNote, Home, LibraryBooks, Menu as MenuIcon, MoneyOff, People, Repeat } from '@mui/icons-material';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', icon: <Home />, path: '/' },
  { label: 'Alunos', icon: <People />, path: '/students' },
  { label: 'Planos', icon: <Assignment />, path: '/plans' },
  { label: 'Catálogo de planos', icon: <LibraryBooks />, path: '/plan-catalog' },
  { label: 'Agenda', icon: <CalendarMonth />, path: '/agenda' },
  { label: 'Aulas avulsas', icon: <EventNote />, path: '/drop-ins' },
  { label: 'A receber', icon: <AttachMoney />, path: '/financeiro/receber' },
  { label: 'A pagar', icon: <MoneyOff />, path: '/financeiro/pagar' },
  { label: 'Desp. recorrentes', icon: <Repeat />, path: '/financeiro/despesas-recorrentes' },
  { label: 'Templates de contrato', icon: <Description />, path: '/contratos/templates' },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { firebaseUser, signOut } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = firebaseUser?.displayName ?? firebaseUser?.email ?? '';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase();

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const drawerContent = (
    <>
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Anna Maria Studio</Typography>
      </Box>

      <List sx={{ px: 1, py: 1.5, flex: 1 }}>
        {navItems.map(({ label, icon, path }) => {
          const isActive =
            path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

          return (
            <ListItemButton
              key={path}
              selected={isActive}
              onClick={() => handleNav(path)}
              sx={{
                borderRadius: 1.5,
                mb: 0.25,
                '&.Mui-selected': {
                  bgcolor: 'primary.50',
                  color: 'primary.dark',
                  '& .MuiListItemIcon-root': { color: 'primary.main' },
                },
                '&.Mui-selected:hover': { bgcolor: 'primary.50' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>{icon}</ListItemIcon>
              <ListItemText
                primary={label}
                slotProps={{ primary: { style: { fontSize: 14 } } }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.light', color: 'primary.dark', fontSize: 13, fontWeight: 600 }}>
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>{displayName}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>{firebaseUser?.email}</Typography>
          </Box>
        </Box>
        <Button
          fullWidth
          size="small"
          onClick={signOut}
          sx={{ justifyContent: 'flex-start', px: 1.5, color: 'text.secondary', fontSize: 12 }}
        >
          Sign out
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {isMobile && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            color: 'text.primary',
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={() => setMobileOpen(true)} size="large">
              <MenuIcon />
            </IconButton>
            <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Anna Maria Studio</Typography>
          </Toolbar>
        </AppBar>
      )}

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: 'background.default',
          ...(isMobile && { pt: '56px' }),
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
