require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' },
});

// ── Nodemailer transport ──────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function buildEmailHtml({ nombre, empresa, telefono, email, proyectos, mensaje }) {
  const safe = (s = '') => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <style>
    body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f0f2f5}
    .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
    .header{background:#0b1628;padding:28px 32px}
    .header h1{margin:0;font-size:20px;color:#fff;font-weight:700}
    .header h1 span{color:#c9954c}
    .header p{margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.55)}
    .body{padding:32px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
    .field .label{font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
    .field .value{font-size:15px;color:#1a1a2e;font-weight:500}
    .note{background:#f8f9fa;border-left:3px solid #c9954c;padding:16px 20px;margin-top:8px;font-size:14px;color:#374151;line-height:1.65;border-radius:0 8px 8px 0}
    .note strong{display:block;margin-bottom:6px;color:#0b1628}
    .footer{padding:16px 32px;background:#0b1628;font-size:12px;color:rgba(255,255,255,.4);text-align:center}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Inmovi<span>soft</span> — Nueva solicitud de demo</h1>
      <p>Recibida desde el formulario de contacto en inmovisoft.mx</p>
    </div>
    <div class="body">
      <div class="grid">
        <div class="field">
          <div class="label">Nombre</div>
          <div class="value">${safe(nombre)}</div>
        </div>
        <div class="field">
          <div class="label">Empresa</div>
          <div class="value">${safe(empresa)}</div>
        </div>
        <div class="field">
          <div class="label">Teléfono / WhatsApp</div>
          <div class="value">${safe(telefono)}</div>
        </div>
        <div class="field">
          <div class="label">Correo electrónico</div>
          <div class="value">${safe(email)}</div>
        </div>
      </div>
      <div class="field" style="margin-bottom:16px">
        <div class="label">Proyectos activos</div>
        <div class="value">${safe(proyectos) || '—'}</div>
      </div>
      <div class="note">
        <strong>¿Qué necesita mejorar?</strong>
        ${safe(mensaje) || 'Sin comentarios adicionales.'}
      </div>
    </div>
    <div class="footer">Inmovisoft &middot; Sistema ERP Inmobiliario &middot; inmovisoft.mx</div>
  </div>
</body>
</html>`;
}

// ── GET /api/health ──────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── POST /api/contact ─────────────────────────────────────────
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { nombre, empresa, telefono, email, proyectos, mensaje } = req.body;

  if (!nombre?.trim() || !empresa?.trim() || !telefono?.trim() || !email?.trim()) {
    return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ ok: false, message: 'Correo electrónico inválido.' });
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `Inmovisoft <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_EMAIL,
      replyTo: email,
      subject: `[Demo] ${nombre} — ${empresa}`,
      html: buildEmailHtml({ nombre, empresa, telefono, email, proyectos, mensaje }),
      text: [
        `Nombre: ${nombre}`,
        `Empresa: ${empresa}`,
        `Teléfono: ${telefono}`,
        `Correo: ${email}`,
        `Proyectos: ${proyectos || '—'}`,
        `Mensaje: ${mensaje || '—'}`,
      ].join('\n'),
    });

    res.json({ ok: true, message: '¡Solicitud enviada! Te contactaremos pronto.' });
  } catch (err) {
    console.error('Error enviando correo:', err.message);
    res.status(500).json({ ok: false, message: 'Error al enviar el mensaje. Intenta de nuevo.' });
  }
});

// ── Fallback → index.html ─────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Inmovisoft corriendo en http://localhost:${PORT}`);
});
