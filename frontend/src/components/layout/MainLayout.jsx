
import React, { useState } from 'react';
import { Outlet, Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar, Box, CssBaseline, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography, IconButton,
  Tooltip, Avatar, Menu, MenuItem, Divider, Chip
} from '@mui/material';
import {
  Dashboard, Insights, ShoppingCart, History, BugReport,
  Settings, Logout, AccountBalanceWallet, SignalCellularAlt, SignalCellularOff, Psychology
} from '@mui/icons-material';

const drawerWidth = 240;

const navItems = [
  { to: '/', icon: <Dashboard />, label: 'Dashboard' },
  { to: '/ml', icon: <Psychology />, label: 'IA Predictions' },
  { to: '/strategies', icon: <Insights />, label: 'Estrategias' },
  { to: '/orders', icon: <ShoppingCart />, label: 'Órdenes Abiertas' },
  { to: '/history', icon: <History />, label: 'Historial' },
  { to: '/logs', icon: <BugReport />, label: 'Logs' },
];

const bottomNavItems = [
  { to: '/settings', icon: <Settings />, label: 'Ajustes' },
];

// Componente para integrar React Router con MUI List
const ListItemLink = (props) => {
  const { icon, primary, to } = props;
  const location = useLocation();
  const isSelected = location.pathname === to;

  const CustomLink = React.useMemo(
    () =>
      React.forwardRef(function Link(linkProps, ref) {
        return <RouterLink ref={ref} to={to} {...linkProps} />;
      }),
    [to],
  );

  return (
    <li>
      <ListItemButton component={CustomLink} selected={isSelected}>
        {icon && <ListItemIcon>{icon}</ListItemIcon>}
        <ListItemText primary={primary} />
      </ListItemButton>
    </li>
  );
};


export default function MainLayout() {
  const [anchorElUser, setAnchorElUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Mock data - reemplazar con el estado real de la aplicación
  const isConnected = true;
  const userEmail = "user@example.com";
  const accountBalance = "10,523.50";
  const accountCurrency = "USD";

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };
  
  const handleLogout = () => {
    handleCloseUserMenu();
    // Lógica de logout aquí
    console.log("Cerrando sesión...");
    navigate('/login'); // Simula redirección a login
  };

  const getTitle = () => {
    const allNavItems = [...navItems, ...bottomNavItems];
    const currentNavItem = allNavItems.find(item => item.to === location.pathname);
    return currentNavItem ? currentNavItem.label : "Trading Bot";
  }

  const drawerContent = (
    <div>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" noWrap component="div">
          Trading Bot
        </Typography>
      </Toolbar>
      <Divider />
      <Box sx={{ p: 2, mt: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Balance</Typography>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{`$${accountBalance}`}</Typography>
        <Chip
            icon={isConnected ? <SignalCellularAlt /> : <SignalCellularOff />}
            label={isConnected ? "Conectado" : "Desconectado"}
            color={isConnected ? "success" : "error"}
            size="small"
            sx={{ mt: 1 }}
        />
      </Box>
      <List>
        {navItems.map((item) => (
          <ListItemLink key={item.to} to={item.to} primary={item.label} icon={item.icon} />
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      <List>
        {bottomNavItems.map((item) => (
          <ListItemLink key={item.to} to={item.to} primary={item.label} icon={item.icon} />
        ))}
        <ListItemButton onClick={handleLogout}>
            <ListItemIcon><Logout /></ListItemIcon>
            <ListItemText primary="Cerrar sesión" />
        </ListItemButton>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{ width: `calc(100% - ${drawerWidth}px)`, ml: `${drawerWidth}px` }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {getTitle()}
          </Typography>
          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Abrir menú de usuario">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar alt={userEmail} src="/static/images/avatar/2.jpg" />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px' }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
                <MenuItem onClick={handleLogout}>
                  <Typography textAlign="center">Cerrar sesión</Typography>
                </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        {drawerContent}
      </Drawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
