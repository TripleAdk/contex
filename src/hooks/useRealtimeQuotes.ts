import React, { useEffect, useRef } from 'react';
import { Quote } from '../types';
import { FinanceAPI } from '../services/FinanceAPI';

const NGX_BASE_PRICES: Record<string, number> = {
  'DANGCEM': 650.00,
  'MTNN': 240.50,
  'ZENITHBANK': 38.45,
  'GTCO': 42.10,
  'SEPLAT': 3400.00,
  'NESTLE': 900.00,
  'STANBIC': 55.00,
  'FBNH': 28.50,
  'UBA': 25.30,
  'ACCESS': 22.15,
};

export function useRealtimeQuotes(
  tickers: string[],
  setQuotes: React.Dispatch<React.SetStateAction<Record<string, Quote>>>
) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (tickers.length === 0) return;

    // 1. Setup mock interval for NGX tickers
    const ngxTickers = tickers.filter(t => NGX_BASE_PRICES[t]);
    if (ngxTickers.length > 0) {
      mockIntervalRef.current = setInterval(() => {
        setQuotes(prevQuotes => {
          const newQuotes = { ...prevQuotes };
          let updated = false;

          ngxTickers.forEach(ticker => {
            const prevQuote = newQuotes[ticker];
            if (prevQuote) {
              const basePrice = NGX_BASE_PRICES[ticker];
              // Simulate small random trade (-0.5% to +0.5% from current price)
              const fluctuation = prevQuote.price * (Math.random() * 0.01 - 0.005);
              const newPrice = prevQuote.price + fluctuation;
              
              const change = newPrice - basePrice;
              const changePercent = (change / basePrice) * 100;

              newQuotes[ticker] = {
                ...prevQuote,
                price: newPrice,
                change,
                changePercent,
                lastUpdated: Date.now()
              };
              updated = true;
            }
          });

          return updated ? newQuotes : prevQuotes;
        });
      }, 3000); // Update every 3 seconds
    }

    // 2. Setup Finnhub WebSocket for Global tickers
    const globalTickers = tickers.filter(t => !NGX_BASE_PRICES[t]);
    const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;
    
    if (apiKey && globalTickers.length > 0) {
      const connect = () => {
        const socket = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
        socketRef.current = socket;

        socket.addEventListener('open', () => {
          globalTickers.forEach(ticker => {
            const mappedTicker = FinanceAPI.mapTicker(ticker);
            socket.send(JSON.stringify({ 'type': 'subscribe', 'symbol': mappedTicker }));
          });
        });

        socket.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'trade' && message.data && message.data.length > 0) {
              setQuotes(prevQuotes => {
                const newQuotes = { ...prevQuotes };
                let updated = false;
                
                message.data.forEach((trade: any) => {
                  const finnhubSymbol = trade.s;
                  // Find the original ticker that maps to this finnhub symbol
                  const ticker = globalTickers.find(t => FinanceAPI.mapTicker(t) === finnhubSymbol) || finnhubSymbol;
                  const price = trade.p;
                  const prevQuote = newQuotes[ticker];
                  
                  if (prevQuote) {
                    let change = prevQuote.change;
                    let changePercent = prevQuote.changePercent;
                    
                    if (prevQuote.previousClose) {
                      change = price - prevQuote.previousClose;
                      changePercent = (change / prevQuote.previousClose) * 100;
                    }
                    
                    newQuotes[ticker] = {
                      ...prevQuote,
                      price,
                      change,
                      changePercent,
                      lastUpdated: Date.now()
                    };
                    updated = true;
                  }
                });
                
                return updated ? newQuotes : prevQuotes;
              });
            }
          } catch (err) {
            console.error("Failed to parse websocket message", err);
          }
        });

        socket.onclose = () => {
          // Reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };
      };

      connect();
    }

    return () => {
      if (mockIntervalRef.current) {
        clearInterval(mockIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        // Remove close listener so it doesn't trigger reconnect on unmount
        socketRef.current.onclose = null;
        if (socketRef.current.readyState === WebSocket.OPEN) {
          globalTickers.forEach(ticker => {
            const mappedTicker = FinanceAPI.mapTicker(ticker);
            socketRef.current?.send(JSON.stringify({ 'type': 'unsubscribe', 'symbol': mappedTicker }));
          });
        }
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [tickers, setQuotes]);
}
