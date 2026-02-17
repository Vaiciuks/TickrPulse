import express from 'express';
import gainersRouter from './routes/gainers.js';
import chartRouter from './routes/chart.js';
import quoteRouter from './routes/quote.js';
import searchRouter from './routes/search.js';
import losersRouter from './routes/losers.js';
import trendingRouter from './routes/trending.js';
import futuresRouter from './routes/futures.js';
import indicesRouter from './routes/indices.js';
import cryptoRouter from './routes/crypto.js';
import chartsRouter from './routes/charts.js';
import newsRouter from './routes/news.js';
import marketNewsRouter from './routes/marketNews.js';
import digestRouter from './routes/digest.js';
import heatmapRouter from './routes/heatmap.js';
import earningsRouter from './routes/earnings.js';
import statsRouter from './routes/stats.js';
import economicCalendarRouter from './routes/economicCalendar.js';
import moversRouter from './routes/movers.js';
import screenerRouter from './routes/screener.js';
import contactRouter from './routes/contact.js';
import userRouter from './routes/user.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json());

app.use('/api/user', userRouter);
app.use('/api/gainers', gainersRouter);
app.use('/api/losers', losersRouter);
app.use('/api/trending', trendingRouter);
app.use('/api/futures', futuresRouter);
app.use('/api/indices', indicesRouter);
app.use('/api/crypto', cryptoRouter);
app.use('/api/chart', chartRouter);
app.use('/api/charts', chartsRouter);
app.use('/api/quote', quoteRouter);
app.use('/api/search', searchRouter);
app.use('/api/news', newsRouter);
app.use('/api/market-news', marketNewsRouter);
app.use('/api/digest', digestRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/earnings', earningsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/economic-calendar', economicCalendarRouter);
app.use('/api/movers', moversRouter);
app.use('/api/screener', screenerRouter);
app.use('/api/contact', contactRouter);

app.use(errorHandler);

export default app;
