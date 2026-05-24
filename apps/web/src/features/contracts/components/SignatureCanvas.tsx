import { Box, Button, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onConfirm: (dataUrl: string) => void;
  disabled?: boolean;
}

interface Point {
  x: number;
  y: number;
}

export function SignatureCanvas({ onConfirm, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [bbox, setBbox] = useState({ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const lastPoint = useRef<Point | null>(null);

  function syncSize(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => syncSize(canvas));
    observer.observe(canvas.parentElement!);
    syncSize(canvas);
    return () => observer.disconnect();
  }, []);

  function toCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || confirmed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    setError('');
    const pt = toCanvasPoint(e);
    lastPoint.current = pt;
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    updateBbox(pt);
    setPointCount((c) => c + 1);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || disabled || confirmed) return;
    const pt = toCanvasPoint(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPoint.current = pt;
    updateBbox(pt);
    setPointCount((c) => c + 1);
  }

  function onPointerUp() {
    setDrawing(false);
    lastPoint.current = null;
  }

  function updateBbox(pt: Point) {
    setBbox((b) => ({
      minX: Math.min(b.minX, pt.x),
      maxX: Math.max(b.maxX, pt.x),
      minY: Math.min(b.minY, pt.y),
      maxY: Math.max(b.maxY, pt.y),
    }));
  }

  function handleClear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPointCount(0);
    setBbox({ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    setConfirmed(false);
    setError('');
  }

  function handleConfirm() {
    if (pointCount < 50) {
      setError('Por favor, assine com traços maiores.');
      return;
    }
    const w = bbox.maxX - bbox.minX;
    const h = bbox.maxY - bbox.minY;
    if (w < 30 || h < 30) {
      setError('Por favor, assine maior.');
      return;
    }
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    setConfirmed(true);
    onConfirm(dataUrl);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Assine no espaço abaixo usando o mouse ou o dedo:
      </Typography>
      <Box
        sx={{
          border: '1px solid',
          borderColor: confirmed ? 'success.main' : 'divider',
          borderRadius: 1,
          bgcolor: '#fafafa',
          height: 140,
          overflow: 'hidden',
          cursor: disabled || confirmed ? 'default' : 'crosshair',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </Box>
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="outlined" onClick={handleClear} disabled={disabled || pointCount === 0}>
          Limpar
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={handleConfirm}
          disabled={disabled || confirmed || pointCount === 0}
        >
          {confirmed ? 'Assinatura confirmada ✓' : 'Confirmar assinatura'}
        </Button>
      </Box>
    </Box>
  );
}
