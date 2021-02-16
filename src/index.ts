import * as Binance from 'binance-api-node';
import { Candle, Symbol } from 'binance-api-node';

enum Timeframe {
  Daily,
  Weekly,
  Monthly,
}

const timeframeMap: Map<
  string,
  { Daily?: Candle; Weekly?: Candle; Monthly?: Candle }
> = new Map();
let tradingSymbols: string[];

const client = Binance.default();

const isTrading = (s: Symbol) => s.status === 'TRADING';
const isSpotTrading = (s: Symbol) => s.isSpotTradingAllowed === true;
const isUSDT = (s: Symbol) => s.quoteAsset === 'USDT';
const getSymbolAsString = (s: Symbol) => s.symbol;

async function run(): Promise<void> {
  tradingSymbols = await getSpotTradingSymbols();

  client.ws.candles(tradingSymbols, '1M', (ticker: Binance.Candle) => {
    mergeCandles(ticker, Timeframe.Monthly);
  });

  client.ws.candles(tradingSymbols, '1w', (ticker: Binance.Candle) => {
    mergeCandles(ticker, Timeframe.Weekly);
  });

  client.ws.candles(tradingSymbols, '1d', (ticker: Binance.Candle) => {
    mergeCandles(ticker, Timeframe.Daily);
  });
}

async function getSpotTradingSymbols(): Promise<string[]> {
  const info = await client.exchangeInfo();

  return info.symbols
    .filter(isTrading)
    .filter(isSpotTrading)
    .filter(isUSDT)
    .map(getSymbolAsString);
}

async function mergeCandles(ticker: Binance.Candle, timeframe: Timeframe) {
  let current = timeframeMap.get(ticker.symbol);

  if (current == null) {
    current = { Daily: undefined, Weekly: undefined, Monthly: undefined };
  }

  if (timeframe === Timeframe.Daily) {
    current.Daily = ticker;
  }
  if (timeframe === Timeframe.Weekly) {
    current.Weekly = ticker;
  }
  if (timeframe === Timeframe.Monthly) {
    current.Monthly = ticker;
  }
  timeframeMap.set(ticker.symbol, current);

  if (
    current.Daily != null &&
    current.Weekly != null &&
    current.Monthly != null
  ) {
    if (
      current.Daily.close > current.Weekly.low &&
      current.Daily.close < current.Weekly.high &&
      current.Daily.close > current.Monthly.low &&
      current.Daily.close < current.Monthly.high &&
      +current.Daily.close < +current.Monthly.high / 2
    ) {
      console.log(
        `interesting: ${ticker.symbol} - dc: ${current.Daily.close} - wl: ${current.Weekly.low} - wh: ${current.Weekly.high} - ml: ${current.Monthly.low} - mh: ${current.Monthly.high}`
      );
    }
  }
}

run();
