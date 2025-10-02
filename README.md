# Stock News AI Summarizer

A comprehensive tool that automatically gathers financial news from multiple sources and creates AI-powered summaries for traders and investors.

## Features

- **Multi-Source Data Collection**: Scrapes news from TradingView, Finviz, and Polygon API
- **AI-Powered Summaries**: Uses Gemini Pro 2.5 to generate intelligent summaries
- **Real-time Updates**: Daily refresh at 8 AM IST with 7-day history
- **Professional UI**: Clean interface with ticker management and news display
- **Cost-Effective**: Optimized for under $5/month operational costs

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Express.js
- **AI**: Google Gemini Pro 2.5
- **Data Sources**: TradingView, Finviz, Polygon API
- **Automation**: Node-cron for scheduled updates

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with your API keys
4. Start the development server: `npm run dev`
5. Start the backend server: `npm run server`

## API Keys Required

- Polygon API Key
- Google Gemini API Key

## Usage

1. Add stock tickers using the sidebar
2. View real-time news summaries
3. Check historical data (7-day window)
4. Monitor "What changed today" sections

## License

MIT+ Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
