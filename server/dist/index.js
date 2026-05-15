import express from 'express';
import { test } from 'shared';
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send(`Server running. Shared test value: ${test}`);
});
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
