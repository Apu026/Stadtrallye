// Minimal index.js that mounts modular routers
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// health
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// mount routers
const usersRouter = require('./routes/users');
const poisRouter = require('./routes/pois');
const rallyesRouter = require('./routes/rallyes');
const roomsRouter = require('./routes/rooms');

// page-specific routers
const startseitePage = require('./routes/pages/startseite');
const spielseitePage = require('./routes/pages/spielseite');
const endseitePage = require('./routes/pages/endseite');
const adminPage = require('./routes/pages/admin');
const superadminPage = require('./routes/pages/superadmin');
const waitingroomPage = require('./routes/pages/waitingroom');
const groupselectPage = require('./routes/pages/groupselect');
const adminspielseitePage = require('./routes/pages/adminspielseite');
const adminendseitePage = require('./routes/pages/adminendseite');
const sessiongroupsRouter = require('./routes/sessiongroups');
const groupNamesRouter = require('./routes/group-names');
const authRouter = require('./routes/auth');
const pointsRouter = require('./routes/points');

app.use('/api/users', usersRouter);
app.use('/api/pois', poisRouter);
app.use('/api/rallyes', rallyesRouter);
app.use('/api/rooms', roomsRouter);

app.use('/api/page/startseite', startseitePage);
app.use('/api/page/spielseite', spielseitePage);
app.use('/api/page/endseite', endseitePage);
app.use('/api/page/admin', adminPage);
app.use('/api/page/superadmin', superadminPage);
app.use('/api/page/waitingroom', waitingroomPage);
app.use('/api/page/groupselect', groupselectPage);
app.use('/api/page/adminspielseite', adminspielseitePage);
app.use('/api/page/adminendseite', adminendseitePage);
app.use('/api/sessiongroups', sessiongroupsRouter);
app.use('/api/group-names', groupNamesRouter);
app.use('/api', authRouter);
app.use('/api/points', pointsRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
