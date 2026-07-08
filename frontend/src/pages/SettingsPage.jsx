
import React, { useState } from 'react';
import {
  Box, Button, Typography, Grid, Card, CardContent, CardActions,
  TextField, Switch, FormControlLabel, Divider, CardHeader, Alert
} from '@mui/material';
import { accountAPI } from '../services/api';

const SettingsSection = ({ title, subtitle, children, actions }) => (
    <Card>
      <CardHeader
        title={title}
        subheader={subtitle}
        titleTypographyProps={{ fontWeight: 'bold' }}
      />
      <CardContent>
        {children}
      </CardContent>
      {actions && (
        <>
            <Divider />
            <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                {actions}
            </CardActions>
        </>
      )}
    </Card>
);

export default function SettingsPage() {
  const [riskConfig, setRiskConfig] = useState({
    maxDailyLoss: 100,
    maxOrderAmount: 50,
    maxConsecutiveLosses: 5,
    cooldownAfterLoss: 60
  });
  const [notification, setNotification] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSaveRiskConfig = async () => {
    setSaving(true);
    setNotification(null);
    try {
      const response = await accountAPI.updateRiskConfig(riskConfig);
      if (response.success) {
        setNotification({ type: 'success', message: 'Configuración de riesgo guardada' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.error || 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4 }}>
        Ajustes
      </Typography>

      {notification && (
        <Alert severity={notification.type} onClose={() => setNotification(null)} sx={{ mb: 2 }}>
          {notification.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Gestión de Riesgo */}
        <Grid item xs={12}>
          <SettingsSection
            title="Gestión de Riesgo"
            subtitle="Límites para proteger tu cuenta"
            actions={
              <Button variant="contained" onClick={handleSaveRiskConfig} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Ajustes de Riesgo'}
              </Button>
            }
          >
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Pérdida Máxima Diaria ($)"
                  type="number"
                  value={riskConfig.maxDailyLoss}
                  onChange={(e) => setRiskConfig({...riskConfig, maxDailyLoss: parseFloat(e.target.value)})}
                  helperText="El bot se detendrá si la pérdida diaria alcanza este valor."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Monto Máximo por Orden ($)"
                  type="number"
                  value={riskConfig.maxOrderAmount}
                  onChange={(e) => setRiskConfig({...riskConfig, maxOrderAmount: parseFloat(e.target.value)})}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Máximo de Pérdidas Consecutivas"
                  type="number"
                  value={riskConfig.maxConsecutiveLosses}
                  onChange={(e) => setRiskConfig({...riskConfig, maxConsecutiveLosses: parseInt(e.target.value)})}
                  helperText="Pausa temporal tras N pérdidas seguidas."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Cooldown tras Pérdida (segundos)"
                  type="number"
                  value={riskConfig.cooldownAfterLoss}
                  onChange={(e) => setRiskConfig({...riskConfig, cooldownAfterLoss: parseInt(e.target.value)})}
                />
              </Grid>
            </Grid>
          </SettingsSection>
        </Grid>
      </Grid>
    </Box>
  );
}
