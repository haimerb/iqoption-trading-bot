import React, { useState, useEffect } from 'react';
import {
  Grid, Card, CardContent, CardHeader, Typography, Box, Chip,
  Button, Select, MenuItem, FormControl, InputLabel, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, LinearProgress, Alert, IconButton, Drawer, List, ListItem,
  ListItemText, ListItemIcon, Divider, Badge
} from '@mui/material';
import {
  Memory, TrendingUp, TrendingDown, Refresh, Settings,
  Notifications, PlayArrow, Analytics, Psychology
} from '@mui/icons-material';
import { useMLStore } from '../store';
import { mlAPI } from '../services/api';

const ASSETS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'BTCUSD'];
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h'];

export default function MLPage() {
  const {
    models, predictions, predictionHistory, mlStats, config, isLoading, lastError,
    setModels, setPrediction, addToHistory, setMLStats, updateConfig, setLoading, setError
  } = useMLStore();

  const [notification, setNotification] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    loadModels();
    loadStats();
  }, []);

  const loadModels = async () => {
    try {
      const response = await mlAPI.getModels();
      if (response.success) {
        setModels(response.data?.models || []);
      }
    } catch (err) {
      console.error('Error loading models:', err);
    }
  };

  const loadStats = async () => {
    try {
      setMLStats({ totalPredictions: predictionHistory.length });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const candlesRes = await mlAPI.getCandles(config.selectedAsset, {
        timeframe: config.selectedTimeframe,
        count: 30
      });
      const candles = candlesRes.success ? candlesRes.data?.candles : [];

      if (!candles || candles.length < 20) {
        setError('No hay suficientes velas para predecir. Necesitas al menos 20.');
        return;
      }

      const response = await mlAPI.predict({
        candles,
        asset: config.selectedAsset,
        timeframe: config.selectedTimeframe
      });
      
      if (response.success && response.data) {
        setPrediction(config.selectedAsset, response.data);
        addToHistory(response.data);
        
        if (response.data.direction) {
          setNotification({
            type: response.data.direction === 'call' ? 'success' : 'error',
            message: `Predicción: ${response.data.direction} (${(response.data.confidence * 100).toFixed(0)}%)`
          });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoTrain = async () => {
    setLoading(true);
    try {
      await mlAPI.autoTrain({
        asset: config.selectedAsset
      });
      setNotification({
        type: 'info',
        message: 'Auto-entrenamiento iniciado'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentPrediction = predictions[config.selectedAsset];

  return (
    <Box sx={{ p: 3 }}>
      {notification && (
        <Alert 
          severity={notification.type} 
          onClose={() => setNotification(null)}
          sx={{ mb: 2 }}
        >
          {notification.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Psychology sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  IA Predictions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Machine Learning powered predictions
                </Typography>
              </Box>
            </Box>
            <Box>
              <IconButton onClick={() => setDrawerOpen(true)}>
                <Badge badgeContent={predictionHistory.length} color="primary">
                  <Notifications />
                </Badge>
              </IconButton>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Configuración" avatar={<Settings />} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Activo</InputLabel>
                    <Select
                      value={config.selectedAsset}
                      label="Activo"
                      onChange={(e) => updateConfig({ selectedAsset: e.target.value })}
                    >
                      {ASSETS.map(a => (
                        <MenuItem key={a} value={a}>{a}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Timeframe</InputLabel>
                    <Select
                      value={config.selectedTimeframe}
                      label="Timeframe"
                      onChange={(e) => updateConfig({ selectedTimeframe: e.target.value })}
                    >
                      {TIMEFRAMES.map(t => (
                        <MenuItem key={t} value={t}>{t}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Confianza mínima"
                    type="number"
                    value={config.minConfidence}
                    onChange={(e) => updateConfig({ minConfidence: parseFloat(e.target.value) })}
                    inputProps={{ step: 0.05, min: 0.5, max: 1 }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader 
              title={`Predicción ${config.selectedAsset}`}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={handlePredict}
                    disabled={isLoading}
                  >
                    Predecir
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={handleAutoTrain}
                    disabled={isLoading}
                  >
                    Auto-Entrenar
                  </Button>
                </Box>
              }
            />
            <CardContent>
              {isLoading ? (
                <LinearProgress />
              ) : currentPrediction ? (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 4,
                      bgcolor: currentPrediction.direction === 'call' ? 'success.light' : currentPrediction.direction === 'put' ? 'error.light' : 'grey.100',
                      borderRadius: 2
                    }}>
                      {currentPrediction.direction === 'call' ? (
                        <TrendingUp sx={{ fontSize: 60 }} />
                      ) : currentPrediction.direction === 'put' ? (
                        <TrendingDown sx={{ fontSize: 60 }} />
                      ) : (
                        <Memory sx={{ fontSize: 60 }} />
                      )}
                      <Typography variant="h3" fontWeight="bold">
                        {currentPrediction.direction?.toUpperCase() || 'SIN SEÑAL'}
                      </Typography>
                      <Typography variant="h5">
                        {(currentPrediction.confidence * 100).toFixed(1)}% confianza
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Call: {(currentPrediction.probabilities?.call * 100 || 0).toFixed(1)}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={currentPrediction.probabilities?.call * 100 || 0}
                      color="success"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Put: {(currentPrediction.probabilities?.put * 100 || 0).toFixed(1)}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={currentPrediction.probabilities?.put * 100 || 0}
                      color="error"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      {currentPrediction.reason}
                    </Typography>
                  </Grid>
                  {currentPrediction.indicators && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip size="small" label={`RSI: ${currentPrediction.indicators.rsi?.toFixed(0)}`} />
                        <Chip size="small" label={`MACD: ${currentPrediction.indicators.macd?.toFixed(6)}`} />
                        <Chip size="small" label={`BB: ${currentPrediction.indicators.bb_position?.toFixed(2)}`} />
                      </Box>
                    </Grid>
                  )}
                </Grid>
              ) : (
                <Box sx={{ textAlign: 'center', p: 4 }}>
                  <Memory sx={{ fontSize: 60, color: 'grey.400' }} />
                  <Typography variant="h6" color="text.secondary">
                    Sin predicción aún
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Haz click en "Predecir" para obtener una predicción
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Modelos Entrenados" />
            <CardContent>
              {models.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Activo</TableCell>
                        <TableCell>Accuracy</TableCell>
                        <TableCell>Último entreno</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {models.map((model, i) => (
                        <TableRow key={i}>
                          <TableCell>{model.asset}</TableCell>
                          <TableCell>
                            <Chip 
                              size="small" 
                              color={model.accuracy > 0.7 ? 'success' : 'warning'}
                              label={`${(model.accuracy * 100).toFixed(0)}%`}
                            />
                          </TableCell>
                          <TableCell>{new Date().toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary">
                  No hay modelos entrenados
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Estadísticas" avatar={<Analytics />} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Predicciones</Typography>
                  <Typography variant="h5">{mlStats.totalPredictions}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Accuracy</Typography>
                  <Typography variant="h5">{(mlStats.accuracy * 100).toFixed(1)}%</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader title="Historial de Predicciones" />
            <CardContent>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Hora</TableCell>
                      <TableCell>Activo</TableCell>
                      <TableCell>Dirección</TableCell>
                      <TableCell>Confianza</TableCell>
                      <TableCell>Indicadores</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {predictionHistory.slice(0, 10).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell>{new Date(p.timestamp).toLocaleTimeString()}</TableCell>
                        <TableCell>{p.asset}</TableCell>
                        <TableCell>
                          <Chip 
                            size="small"
                            color={p.direction === 'call' ? 'success' : p.direction === 'put' ? 'error' : 'default'}
                            label={p.direction || 'N/A'}
                          />
                        </TableCell>
                        <TableCell>{(p.confidence * 100).toFixed(0)}%</TableCell>
                        <TableCell>RSI: {p.indicators?.rsi?.toFixed(0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 350, p: 2 }}>
          <Typography variant="h6" gutterBottom>Notificaciones</Typography>
          <Divider />
          <List>
            {predictionHistory.slice(0, 20).map((p, i) => (
              <ListItem key={i}>
                <ListItemIcon>
                  {p.direction === 'call' ? <TrendingUp color="success" /> : <TrendingDown color="error" />}
                </ListItemIcon>
                <ListItemText
                  primary={`${p.direction?.toUpperCase()} en ${p.asset}`}
                  secondary={`${(p.confidence * 100).toFixed(0)}% - ${new Date(p.timestamp).toLocaleTimeString()}`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </Box>
  );
}