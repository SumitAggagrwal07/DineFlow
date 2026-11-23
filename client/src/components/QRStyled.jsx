import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';

// A customisable QR code (colours, dot shape, restaurant logo in the middle).
const QRStyled = forwardRef(function QRStyled({ data, size = 200, opts }, ref) {
  const box = useRef(null);
  const qr = useRef(null);
  const key = JSON.stringify([data, size, opts]);

  useEffect(() => {
    const q = new QRCodeStyling({
      width: size,
      height: size,
      type: 'canvas',
      data,
      margin: 6,
      qrOptions: { errorCorrectionLevel: 'H' }, // high redundancy so the logo can sit on top
      image: opts.logo || undefined,
      dotsOptions: { color: opts.fg, type: opts.dots },
      cornersSquareOptions: { color: opts.fg, type: opts.corner },
      cornersDotOptions: { color: opts.fg, type: opts.cornerDot || 'dot' },
      backgroundOptions: { color: opts.bg },
      imageOptions: { crossOrigin: 'anonymous', margin: 4, imageSize: 0.28, hideBackgroundDots: true },
    });
    qr.current = q;
    if (box.current) {
      box.current.innerHTML = '';
      q.append(box.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useImperativeHandle(ref, () => ({
    download: (name) => qr.current?.download({ name, extension: 'png' }),
  }));

  return <div ref={box} className="qr-canvas" />;
});

export default QRStyled;
