const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
app.use(express.json());
app.use(cors());

const SECRET_KEY = 'clave_secreta_proyecto_grado_wilmer';

// Pega aquí tu URI de conexión de Supabase (Botón "Connect" arriba en Supabase -> URI)
const pool = new Pool({
    connectionString: 'postgresql://postgres.dtpozptgpewtooefjxjc:Wilmer1019.123@aws-1-us-west-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

// Middleware de verificación JWT (HU-04)
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ mensaje: 'Acceso denegado. Token requerido.' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ mensaje: 'Token inválido o expirado.' });
        req.user = user;
        next();
    });
};

// 1. Registrar usuario (HU-04)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;
        const hash = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3)', [nombre, email, hash]);
        res.status(201).json({ mensaje: 'Usuario registrado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Login con JWT (HU-04)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (result.rows.length === 0) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        const usuario = result.rows[0];
        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) return res.status(401).json({ mensaje: 'Contraseña incorrecta' });

        const token = jwt.sign({ id: usuario.id, email: usuario.email }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ mensaje: 'Autenticación exitosa', token, usuario: usuario.nombre });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Crear evento + Priorización Python (HU-02 y HU-03)
app.post('/api/eventos', verificarToken, async (req, res) => {
    const { dispositivo_id, tipo_evento, descripcion, zona, fuera_horario } = req.body;

    const pythonProcess = spawn('python', ['priorizador.py', JSON.stringify({ tipo_evento, zona, fuera_horario })]);

    let resultadoPython = '';
    pythonProcess.stdout.on('data', (data) => {
        resultadoPython += data.toString();
    });

    pythonProcess.on('close', async () => {
        try {
            const parsed = JSON.parse(resultadoPython);
            const prioridadCalculada = parsed.prioridad || 'Media';

            const result = await pool.query(
                'INSERT INTO eventos (dispositivo_id, tipo_evento, descripcion, prioridad) VALUES ($1, $2, $3, $4) RETURNING id',
                [dispositivo_id, tipo_evento, descripcion, prioridadCalculada]
            );

            res.status(201).json({
                mensaje: 'Evento procesado y priorizado por motor Python',
                id_evento: result.rows[0].id,
                prioridad_asignada: prioridadCalculada
            });
        } catch (error) {
            res.status(500).json({ error: 'Error procesando evento', detalle: error.message });
        }
    });
});

// 4. Listar eventos para el Dashboard (HU-06)
app.get('/api/eventos', verificarToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.id, d.nombre AS dispositivo, d.zona, e.tipo_evento, e.descripcion, e.prioridad, e.fecha_hora 
            FROM eventos e 
            LEFT JOIN dispositivos d ON e.dispositivo_id = d.id 
            ORDER BY e.fecha_hora DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});