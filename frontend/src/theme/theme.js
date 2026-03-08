
import { createTheme } from '@mui/material/styles';

// Definición de la paleta de colores y tipografía para el tema oscuro.
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976D2', // Azul MUI
    },
    background: {
      default: '#121212', // Fondo principal oscuro
      paper: '#1E1E1E',   // Fondo para componentes como Cards y Menús
    },
    text: {
      primary: 'rgba(255, 255, 255, 0.87)',
      secondary: 'rgba(255, 255, 255, 0.6)',
    },
    success: {
      main: '#2E7D32', // Verde para ganancias
    },
    error: {
      main: '#D32F2F', // Rojo para pérdidas
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2rem', // 32px
      fontWeight: 700,
    },
    h2: {
      fontSize: '1.5rem', // 24px
      fontWeight: 700,
    },
    body1: {
      fontSize: '1rem', // 16px
    },
    caption: {
      fontSize: '0.75rem', // 12px
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E1E1E', // Hace que el AppBar use el color 'paper'
          backgroundImage: 'none', // Elimina cualquier gradiente o imagen por defecto
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1E1E1E',
        },
      },
    },
  },
});

export default theme;
