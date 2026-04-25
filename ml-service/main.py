import os
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_DIR = os.getenv('MODEL_DIR', './models')
os.makedirs(MODEL_DIR, exist_ok=True)


class PredictRequest(BaseModel):
    candles: list
    asset: str = 'EURUSD'
    timeframe: str = '1m'
    features: list = None


class TrainRequest(BaseModel):
    candles: list
    labels: list
    asset: str = 'EURUSD'
    timeframe: str = '1m'
    model_type: str = 'gradient_boosting'


class PredictResponse(BaseModel):
    direction: str | None
    confidence: float
    probabilities: dict
    reason: str
    indicators: dict


class TrainResponse(BaseModel):
    success: bool
    accuracy: float
    report: str
    samples: int


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info('ML Service iniciado')
    yield
    logger.info('ML Service closing')


app = FastAPI(title='IQ Option ML Predictor', version='1.0.0', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

models = {}
scalers = {}


def calculate_indicators(df):
    df = df.copy()
    close = df['close'].values
    high = df['high'].values
    low = df['low'].values
    volume = df.get('volume', pd.Series([1] * len(df))).values

    df['returns'] = pd.Series(close).pct_change()
    df['sma_5'] = pd.Series(close).rolling(5).mean().values
    df['sma_20'] = pd.Series(close).rolling(20).mean().values
    df['sma_50'] = pd.Series(close).rolling(50).mean().values

    df['ema_12'] = pd.Series(close).ewm(span=12, adjust=False).mean().values
    df['ema_26'] = pd.Series(close).ewm(span=26, adjust=False).mean().values

    delta = pd.Series(close).diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / (loss + 1e-10)
    df['rsi'] = 100 - (100 / (1 + rs))

    sma20 = pd.Series(close).rolling(20).mean()
    std20 = pd.Series(close).rolling(20).std()
    df['bb_upper'] = sma20 + (std20 * 2)
    df['bb_middle'] = sma20
    df['bb_lower'] = sma20 - (std20 * 2)

    ema12 = pd.Series(close).ewm(span=12, adjust=False).mean()
    ema26 = pd.Series(close).ewm(span=26, adjust=False).mean()
    df['macd'] = ema12 - ema26
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
    df['macd_hist'] = df['macd'] - df['macd_signal']

    df['atr'] = pd.Series(high - low).rolling(14).mean()

    df['volume_sma'] = pd.Series(volume).rolling(20).mean()
    df['volume_ratio'] = volume / (df['volume_sma'] + 1e-10)

    return df.fillna(0)


def prepare_features(df, lookback=20):
    feature_cols = ['returns', 'sma_5', 'sma_20', 'sma_50', 'ema_12', 'ema_26',
                  'rsi', 'bb_upper', 'bb_middle', 'bb_lower', 'macd',
                  'macd_signal', 'macd_hist', 'atr', 'volume_ratio']

    features = []
    for i in range(lookback, len(df)):
        window = df[feature_cols].iloc[i-lookback:i].values.flatten()
        features.append(window)

    return np.array(features)


def create_labels(candles, threshold=0.002, hold_time=1):
    labels = []
    for i in range(len(candles) - hold_time):
        current_price = candles[i]['close']
        future_price = candles[i + hold_time]['close']
        change = (future_price - current_price) / current_price

        if change > threshold:
            labels.append(1)
        elif change < -threshold:
            labels.append(-1)
        else:
            labels.append(0)

    for _ in range(hold_time):
        labels.append(0)

    return labels


@app.get('/health')
async def health():
    return {'status': 'ok', 'service': 'ml-predictor'}


@app.post('/predict', response_model=PredictResponse)
async def predict(request: PredictRequest, background_tasks: BackgroundTasks):
    if not request.candles or len(request.candles) < 20:
        raise HTTPException(status_code=400, detail='Se necesitan al menos 20 velas')

    try:
        asset_key = f"{request.asset}_{request.timeframe}"
        model = models.get(asset_key)
        scaler = scalers.get(asset_key)

        if model is None:
            logger.warning(f'No hay modelo para {asset_key}, usando predicción por defecto')
            return PredictResponse(
                direction=None,
                confidence=0.0,
                probabilities={'call': 0.5, 'put': 0.5},
                reason='No hay modelo entrenado para este asset',
                indicators={}
            )

        df = pd.DataFrame(request.candles)
        df = calculate_indicators(df)

        features = prepare_features(df, lookback=20)
        features_scaled = scaler.transform(features[-1:])

        prediction = model.predict(features_scaled)[0]
        probabilities = model.predict_proba(features_scaled)[0]

        class_idx = model.classes_.tolist()
        call_idx = class_idx.index(1) if 1 in class_idx else 0
        put_idx = class_idx.index(-1) if -1 in class_idx else 0

        call_prob = probabilities[call_idx]
        put_prob = probabilities[put_idx]

        direction = 'call' if call_prob > put_prob and call_prob > 0.6 else 'put' if put_prob > 0.6 else None
        confidence = max(call_prob, put_prob)

        last_row = df.iloc[-1]
        indicators = {
            'rsi': round(last_row.get('rsi', 50), 2),
            'macd': round(last_row.get('macd', 0), 6),
            'macd_hist': round(last_row.get('macd_hist', 0), 6),
            'bb_position': round((last_row['close'] - last_row['bb_lower']) / 
                          (last_row['bb_upper'] - last_row['bb_lower'] + 1e-10), 3)
        }

        return PredictResponse(
            direction=direction,
            confidence=round(confidence, 3),
            probabilities={'call': round(call_prob, 3), 'put': round(put_prob, 3)},
            reason=f'IA predice {direction} con {confidence*100:.1f}% de confianza',
            indicators=indicators
        )

    except Exception as e:
        logger.error(f'Error en predict: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/train', response_model=TrainResponse)
async def train(request: TrainRequest, background_tasks: BackgroundTasks):
    if len(request.candles) < 100:
        raise HTTPException(status_code=400, detail='Se necesitan al menos 100 velas para entrenar')

    try:
        df = pd.DataFrame(request.candles)
        df = calculate_indicators(df)

        labels = request.labels
        y = np.array(labels)

        X = prepare_features(df, lookback=20)
        
        available = min(len(X), len(y))
        X = X[:available]
        y = y[:available]
        
        mask = y != 0
        X = X[mask]
        y = y[mask]

        if len(X) < 30:
            raise HTTPException(status_code=400, detail='No hay suficientes datos con labels válidos')

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=y
        )

        if request.model_type == 'random_forest':
            model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                random_state=42,
                n_jobs=-1
            )
        else:
            model = GradientBoostingClassifier(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                random_state=42
            )

        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        report = classification_report(y_test, y_pred, output_dict=True)

        asset_key = f"{request.asset}_{request.timeframe}"
        models[asset_key] = model
        scalers[asset_key] = scaler

        model_path = os.path.join(MODEL_DIR, f'{asset_key}.joblib')
        scaler_path = os.path.join(MODEL_DIR, f'{asset_key}_scaler.joblib')
        joblib.dump(model, model_path)
        joblib.dump(scaler, scaler_path)

        logger.info(f'Modelo entrenado para {asset_key}: accuracy={accuracy:.3f}')

        return TrainResponse(
            success=True,
            accuracy=round(accuracy, 3),
            report=f"Accuracy: {accuracy:.3f}, Call: {report.get('1', {}).get('recall', 0):.3f}, Put: {report.get('-1', {}).get('recall', 0):.3f}",
            samples=len(X)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Error en train: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/models')
async def list_models():
    return {'models': list(models.keys())}


@app.delete('/models/{asset}')
async def delete_model(asset: str):
    if asset in models:
        del models[asset]
        del scalers[asset]
        return {'success': True}
    raise HTTPException(status_code=404, detail='Modelo no encontrado')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)