
import React, { useRef, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, Grid,
  Chip, ButtonGroup, Switch, FormControlLabel
} from '@mui/material';
import { Delete, Download } from '@mui/icons-material';
import { useBotStore } from '../store';

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
            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
        </Typography>
        <Chip
            label={(log.level || 'info').toUpperCase()}
            size="small"
            sx={{
                bgcolor: getLogLevelColor(log.level || 'info'),
                color: '#fff',
                width: '70px'
            }}
        />
        <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1 }}>
            [{log.category || 'SYSTEM'}] {log.message || log.msg || ''}
        </Typography>
    </Box>
);

export default function LogsPage() {
    const logContainerRef = useRef(null);
    const { logs, clearLogs } = useBotStore();

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

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
            {(logs.length > 0 ? logs : []).map((log, index) => (
                <LogLine key={log.id || index} log={log} />
            ))}
        </Box>
      </Paper>
    </Box>
  );
}
