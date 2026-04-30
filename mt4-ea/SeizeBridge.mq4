//+------------------------------------------------------------------+
//|  SeizeBridge.mq4                                                  |
//|  MT4 Bridge Expert Advisor for SeizeWeb Platform                  |
//|                                                                   |
//|  SETUP:                                                           |
//|  1. Copy to: MetaTrader4/MQL4/Experts/SeizeBridge.mq4            |
//|  2. Compile in MetaEditor (F7)                                    |
//|  3. Drag onto any chart (e.g. EURUSD, M1)                        |
//|  4. Enable "Allow live trading"                                   |
//|  5. Tools > Options > Expert Advisors                             |
//|     > "Allow WebRequest for listed URL"                           |
//|     > Add: http://127.0.0.1:5000 (or your server URL)            |
//|  6. Set ServerUrl to your backend address                         |
//|  7. Get BridgeToken: SeizeWeb UI > MT4 Accounts > hover > EA btn |
//|  8. Paste the token into BridgeToken input parameter              |
//+------------------------------------------------------------------+
#property copyright "SeizeWeb"
#property version   "2.0"
#property strict

// Input parameters
input string  ServerUrl    = "http://127.0.0.1:5000"; // Backend server URL
input string  BridgeToken  = "";                       // Bridge token from SeizeWeb UI
input int     PushInterval = 30;                       // Push interval in seconds
input bool    PushHistory  = true;                     // Send trade history on first push
input int     MaxHistory   = 500;                      // Max history trades to send (0 = unlimited)

// Global state
datetime gLastPush    = 0;
bool     gHistorySent = false;

//--- Init
int OnInit()
{
   if(StringLen(BridgeToken) == 0)
   {
      Alert("[SeizeBridge] BridgeToken kosong! Ambil dari SeizeWeb UI > MT4 Accounts > hover > tombol EA.");
      return(INIT_FAILED);
   }
   Print("[SeizeBridge] Mulai. Server=", ServerUrl, " Login=", AccountNumber());
   EventSetTimer(1);
   return(INIT_SUCCEEDED);
}

//--- Deinit
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[SeizeBridge] Berhenti. Reason=", reason);
}

//--- Timer: push data setiap PushInterval detik
void OnTimer()
{
   if(TimeCurrent() - gLastPush < PushInterval) return;
   gLastPush = TimeCurrent();

   string posJson  = BuildPositionsJson();
   string histJson = "[]";

   if(PushHistory && !gHistorySent)
   {
      // Kirim history 90 hari terakhir saja (bukan semua history)
      datetime fromTime = TimeCurrent() - 90 * 86400;
      histJson     = BuildHistoryJson(fromTime);
      gHistorySent = true;
   }

   string login  = IntegerToString(AccountNumber());
   string server = AccountServer();

   string payload = "{";
   payload += "\"token\":\""       + BridgeToken + "\"";
   payload += ",\"login\":\""      + login + "\"";
   payload += ",\"server\":\""     + EscapeJson(server) + "\"";
   payload += ",\"account_info\":{";
   payload += "\"balance\":"       + SafeNum(AccountBalance(),   2);
   payload += ",\"equity\":"       + SafeNum(AccountEquity(),    2);
   payload += ",\"margin\":"       + SafeNum(AccountMargin(),    2);
   payload += ",\"freeMargin\":"   + SafeNum(AccountFreeMargin(),2);
   payload += ",\"profit\":"       + SafeNum(AccountProfit(),    2);
   payload += ",\"name\":\""       + EscapeJson(AccountName())    + "\"";
   payload += ",\"broker\":\""     + EscapeJson(AccountCompany()) + "\"";
   payload += ",\"currency\":\""   + AccountCurrency()            + "\"";
   payload += ",\"leverage\":"     + IntegerToString(AccountLeverage());
   payload += "}";
   payload += ",\"positions\":"    + posJson;
   payload += ",\"history\":"      + histJson;
   payload += "}";

   SendPush(payload);
}

//--- Kirim HTTP POST ke backend
void SendPush(string payload)
{
   string url     = ServerUrl + "/api/mt4/push";
   string headers = "Content-Type: application/json\r\n";
   char   postData[];
   char   resultData[];
   string resultHeaders;

   StringToCharArray(payload, postData, 0, StringLen(payload));
   ArrayResize(postData, ArraySize(postData) - 1);

   int res = WebRequest("POST", url, headers, 5000, postData, resultData, resultHeaders);

   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         Print("[SeizeBridge] URL belum di-whitelist! Tambahkan '", ServerUrl,
               "' di MT4: Tools > Options > Expert Advisors > Allow WebRequest.");
      else
         Print("[SeizeBridge] WebRequest gagal. Error=", err);
      return;
   }

   if(res != 200)
   {
      Print("[SeizeBridge] Push gagal. HTTP=", res,
            " Response=", CharArrayToString(resultData));
      return;
   }

   Print("[SeizeBridge] Push OK. Positions=", OrdersTotal());
}

//--- Bangun JSON array open positions
string BuildPositionsJson()
{
   string arr  = "[";
   bool   first = true;

   for(int i = 0; i < OrdersTotal(); i++)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderType() > OP_SELL) continue;

      if(!first) arr += ",";
      first = false;

      double curPrice = (OrderType() == OP_BUY)
                        ? MarketInfo(OrderSymbol(), MODE_BID)
                        : MarketInfo(OrderSymbol(), MODE_ASK);

      arr += "{";
      arr += "\"ticket\":"        + IntegerToString(OrderTicket());
      arr += ",\"symbol\":\""     + EscapeJson(OrderSymbol()) + "\"";
      arr += ",\"type\":\""       + TypeToStr(OrderType()) + "\"";
      arr += ",\"lots\":"         + SafeNum(OrderLots(),        2);
      arr += ",\"openPrice\":"    + SafeNum(OrderOpenPrice(),   5);
      arr += ",\"currentPrice\":" + SafeNum(curPrice,           5);
      arr += ",\"stopLoss\":"     + SafeNum(OrderStopLoss(),    5);
      arr += ",\"takeProfit\":"   + SafeNum(OrderTakeProfit(),  5);
      arr += ",\"profit\":"       + SafeNum(OrderProfit(),      2);
      arr += ",\"swap\":"         + SafeNum(OrderSwap(),        2);
      arr += ",\"openTime\":"     + IntegerToString(OrderOpenTime());
      arr += ",\"comment\":\"\"";
      arr += "}";
   }
   arr += "]";
   return arr;
}

//--- Bangun JSON array trade history
string BuildHistoryJson(datetime fromTime)
{
   string arr  = "[";
   bool   first = true;

   int count = 0;
   for(int i = OrdersHistoryTotal() - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
      if(OrderCloseTime() < fromTime) continue;
      if(OrderType() > OP_SELL) continue;
      if(MaxHistory > 0 && count >= MaxHistory) break;

      if(!first) arr += ",";
      first = false;
      count++;

      arr += "{";
      arr += "\"ticket\":"      + IntegerToString(OrderTicket());
      arr += ",\"symbol\":\""   + EscapeJson(OrderSymbol()) + "\"";
      arr += ",\"type\":\""     + TypeToStr(OrderType()) + "\"";
      arr += ",\"lots\":"       + SafeNum(OrderLots(),       2);
      arr += ",\"openPrice\":"  + SafeNum(OrderOpenPrice(),  5);
      arr += ",\"closePrice\":" + SafeNum(OrderClosePrice(), 5);
      arr += ",\"stopLoss\":"   + SafeNum(OrderStopLoss(),   5);
      arr += ",\"takeProfit\":" + SafeNum(OrderTakeProfit(), 5);
      arr += ",\"profit\":"     + SafeNum(OrderProfit(),     2);
      arr += ",\"commission\":" + SafeNum(OrderCommission(), 2);
      arr += ",\"swap\":"       + SafeNum(OrderSwap(),       2);
      arr += ",\"openTime\":"   + IntegerToString(OrderOpenTime());
      arr += ",\"closeTime\":"  + IntegerToString(OrderCloseTime());
      arr += ",\"comment\":\"\"";
      arr += "}";
   }
   arr += "]";
   return arr;
}

//--- Helper: order type ke string
string TypeToStr(int type)
{
   switch(type)
   {
      case OP_BUY:       return "BUY";
      case OP_SELL:      return "SELL";
      case OP_BUYLIMIT:  return "BUY_LIMIT";
      case OP_SELLLIMIT: return "SELL_LIMIT";
      case OP_BUYSTOP:   return "BUY_STOP";
      case OP_SELLSTOP:  return "SELL_STOP";
      default:           return "UNKNOWN";
   }
}

//--- Helper: escape JSON string - keep ONLY ASCII printable, escape " and \
string EscapeJson(string s)
{
   string result = "";
   int len = StringLen(s);
   for(int i = 0; i < len; i++)
   {
      ushort c = StringGetChar(s, i);
      if(c == 0x22)                  { result += "\\\""; continue; }  // "
      if(c == 0x5C)                  { result += "\\\\"; continue; }  // backslash
      if(c >= 0x20 && c <= 0x7E)     { result += ShortToString(c);   continue; } // printable ASCII
      // strip everything else: control chars, non-ASCII, etc.
   }
   return result;
}

//--- Helper: safe number to string - replaces nan/inf with 0
string SafeNum(double v, int digits)
{
   if(!MathIsValidNumber(v)) return "0";
   return DoubleToString(v, digits);
}
