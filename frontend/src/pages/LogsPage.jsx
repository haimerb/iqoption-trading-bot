
import React, { useRef, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, Grid,
  Chip, ButtonGroup, Switch, FormControlLabel
} from '@mui/material';
import { Delete, Download } from '@mui/icons-material';

// Datos de ejemplo para los logs
const mockLogs = [
  { level: 'info', category: 'SYSTEM', message: 'Bot iniciado correctamente.' },
  { level: 'info', category: 'CONNECTION', message: 'Conectado a la API de IQ Option.' },
  { level: 'success', category: 'STRATEGY', message: 'Estrategia "MACD Crossover" iniciada para EUR/USD.' },
  { level: 'info', category: 'ORDER', message: 'Abriendo orden CALL para EUR/USD por $10.' },
  { level: 'warn', category: 'RISK_MGMT', message: 'El activo GBP/JPY tiene una volatilidad alta.' },
  { level: 'success', category: 'ORDER', message: 'Orden #123 cerrada con ganancia de $8.70.' },
  { level: 'info', category: 'ORDER', message: 'Abriendo orden PUT para GBP/JPY por $15.' },
  { level: 'error', category: 'ORDER', message: 'Fallo al cerrar la orden #124: Tiempo de expiración no alcanzado.' },
  { level: 'success', category: 'ORDER', message: 'Orden #125 cerrada con pérdida de -$15.00.' },
];

const getLogLevelColor = (level) => {
  switch (level) {
    case 'error': return 'error.main';
    case 'warn': return 'warning.main';
    case 'success': return 'success.main';
    case 'info':
    default:
      return 'info.main';
  }
};

const LogLine = ({ log }) => (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: '70px' }}>
            {new Date().toLocaleTimeString()}
        </Typography>
        <Chip
            label={log.level.toUpperCase()}
            size="small"
            sx={{
                bgcolor: getLogLevelColor(log.level),
                color: '#fff',
                width: '70px'
            }}
        />
        <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1 }}>
            [{log.category}] {log.message}
        </Typography>
    </Box>
);

export default function LogsPage() {
    const logContainerRef = useRef(null);

    useEffect(() => {
        // Auto-scroll al final
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [mockLogs]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
        Logs del Sistema
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
            <Grid item>
                <ButtonGroup variant="outlined" size="small">
                    <Button>Todos</Button>
                    <Button>Info</Button>
                    <Button>Warn</Button>
                    <Button>Error</Button>
                </ButtonGroup>
            </Grid>
            <Grid item sx={{ flexGrow: 1 }}>
                <FormControlLabel control={<Switch defaultChecked />} label="Auto-scroll" />
            </Grid>
            <Grid item>
                <Button variant="outlined" startIcon={<Download />} size="small">Exportar</Button>
            </Grid>
            <Grid item>
                <Button variant="outlined" color="error" startIcon={<Delete />} size="small">Limpiar Logs</Button>
            </Grid>
        </Grid>
      </Paper>

      <Paper
        ref={logContainerRef}
        sx={{
          flexGrow: 1,
          p: 2,
          overflowY: 'auto',
          bgcolor: 'background.default',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {mockLogs.map((log, index) => (
                <LogLine key={index} log={log} />
            ))}
             {mockLogs.map((log, index) => (
                <LogLine key={index+100} log={log} />
            ))}
        </Box>
      </Paper>
    </Box>
  );
}
